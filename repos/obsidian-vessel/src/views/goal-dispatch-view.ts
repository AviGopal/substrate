/**
 * Goal Dispatch View
 *
 * An Obsidian ItemView that provides a sidebar panel for dispatching
 * goals to goal-host-vessel and watching execution events in real time.
 *
 * Layout:
 *   ┌─────────────────────────────────────┐
 *   │ [textarea]                          │
 *   │ [Dispatch] [Clear]                  │
 *   ├─────────────────────────────────────┤
 *   │ scrollable event output             │
 *   └─────────────────────────────────────┘
 *
 * - Dispatches via GoalHostClient (POST /run-goal)
 * - Streams events from activity-api WS, filtered by executionId
 * - Writes vault notes via GoalNoteManager
 * - Reconnects WS on 3s backoff
 */

import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import type MetabobVesselPlugin from '../main';
import { GoalHostClient } from '../goals/goal-host-client';
import { GoalNoteManager } from '../goals/goal-note-manager';

export const VIEW_TYPE_GOAL_DISPATCH = 'metabob-goal-dispatch';

/** Map of event type → display emoji */
const EVENT_ICONS: Record<string, string> = {
  'task.started': '▶',
  'task.completed': '✓',
  'task.failed': '✗',
  'tool.call': '⚙',
  'impulse.resolved': '◎',
};

export class GoalDispatchView extends ItemView {
  private plugin: MetabobVesselPlugin;

  // DOM elements
  private textarea: HTMLTextAreaElement | null = null;
  private dispatchBtn: HTMLButtonElement | null = null;
  private outputEl: HTMLElement | null = null;

  // State
  private ws: WebSocket | null = null;
  private wsReconnectTimer: number | null = null;
  private activeExecutionId: string | null = null;
  private goalFile: TFile | null = null;
  private goalNoteManager: GoalNoteManager;
  private dispatching = false;

  constructor(leaf: WorkspaceLeaf, plugin: MetabobVesselPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.goalNoteManager = new GoalNoteManager(plugin.app);
  }

  getViewType(): string {
    return VIEW_TYPE_GOAL_DISPATCH;
  }

  getDisplayText(): string {
    return 'Goal Dispatch';
  }

  getIcon(): string {
    return 'bot';
  }

  async onOpen(): Promise<void> {
    this.buildUI();
    if (this.plugin.settings.enableGoalDispatch) {
      this.connectWS();
    }
  }

  async onClose(): Promise<void> {
    this.disconnectWS();
  }

  // ---------------------------------------------------------------------------
  // UI construction
  // ---------------------------------------------------------------------------

  private buildUI(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('metabob-goal-dispatch-view');

    // Input section
    const inputSection = contentEl.createDiv('goal-dispatch-input-section');

    const textareaWrapper = inputSection.createDiv('goal-dispatch-textarea-wrapper');
    this.textarea = textareaWrapper.createEl('textarea', {
      cls: 'goal-dispatch-textarea',
      attr: { placeholder: 'Describe your goal…', rows: '4' },
    });
    this.textarea.addEventListener('keydown', (ev: KeyboardEvent) => {
      // Ctrl/Cmd+Enter to dispatch
      if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        this.dispatchFromUI();
      }
    });

    const btnRow = inputSection.createDiv('goal-dispatch-btn-row');

    this.dispatchBtn = btnRow.createEl('button', {
      text: 'Dispatch',
      cls: 'mod-cta goal-dispatch-btn',
    });
    this.dispatchBtn.addEventListener('click', () => this.dispatchFromUI());

    const clearBtn = btnRow.createEl('button', {
      text: 'Clear',
      cls: 'goal-dispatch-clear-btn',
    });
    clearBtn.addEventListener('click', () => this.clearOutput());

    // Divider
    contentEl.createEl('hr', { cls: 'goal-dispatch-divider' });

    // Output section
    const outputSection = contentEl.createDiv('goal-dispatch-output-section');
    this.outputEl = outputSection.createDiv('goal-dispatch-output');

    this.appendMessage('Ready. Enter a goal and press Dispatch (or Ctrl+Enter).');
  }

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  /**
   * Read goal from textarea and dispatch.
   */
  private async dispatchFromUI(): Promise<void> {
    const goal = this.textarea?.value.trim() ?? '';
    if (!goal) {
      new Notice('Enter a goal first.');
      return;
    }
    await this.dispatchGoal(goal);
  }

  /**
   * Dispatch a goal. Can be called externally (e.g. from GoalInputModal command).
   */
  async dispatchGoal(goal: string): Promise<void> {
    if (this.dispatching) {
      new Notice('A goal is already dispatching. Please wait.');
      return;
    }

    if (!this.plugin.settings.enableGoalDispatch) {
      new Notice('Goal dispatch is disabled in settings.');
      return;
    }

    const { goalHostEndpoint, apiKey } = this.plugin.settings;

    if (!apiKey) {
      new Notice('Metabob: API key not configured. Set it in plugin settings.');
      return;
    }

    this.dispatching = true;
    this.setDispatchBtnState(true);
    this.clearOutput();
    this.appendMessage(`Dispatching: ${goal}`);

    try {
      const client = new GoalHostClient(goalHostEndpoint, apiKey);
      const result = await client.dispatchGoal(goal);

      this.activeExecutionId = result.executionId;
      this.appendMessage(`Execution ID: ${result.executionId}`);
      if (result.selectedTemplateId) {
        this.appendMessage(`Template: ${result.selectedTemplateId}`);
      }
      this.appendMessage(`Status: ${result.status}`);
      this.appendMessage('---');

      // Create vault note
      this.goalFile = await this.goalNoteManager.createGoalNote(result.executionId, goal);

      // If goal completed synchronously already, mark done
      if (result.status === 'success' || result.status === 'completed') {
        this.appendMessage('Goal completed.');
        if (this.goalFile) {
          await this.goalNoteManager.markComplete(this.goalFile, result.status);
        }
        this.dispatching = false;
        this.setDispatchBtnState(false);
      } else {
        // Keep dispatching=true until WS tells us it's done
        this.appendMessage('Listening for events…');
        // Ensure WS is connected so we receive events
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.connectWS();
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.appendMessage(`Error dispatching goal: ${msg}`);
      new Notice(`Goal dispatch failed: ${msg}`);
      this.dispatching = false;
      this.setDispatchBtnState(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Output helpers
  // ---------------------------------------------------------------------------

  /**
   * Append a timestamped message line to the output panel.
   * Also callable from external code (e.g. after WS reconnect).
   */
  appendMessage(text: string): void {
    if (!this.outputEl) return;
    const line = this.outputEl.createDiv('goal-dispatch-line');
    const ts = new Date().toLocaleTimeString();
    line.createSpan({ cls: 'goal-dispatch-ts', text: `[${ts}] ` });
    line.createSpan({ cls: 'goal-dispatch-msg', text });
    // Auto-scroll to bottom
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  private clearOutput(): void {
    if (this.outputEl) this.outputEl.empty();
  }

  private setDispatchBtnState(disabled: boolean): void {
    if (this.dispatchBtn) {
      this.dispatchBtn.disabled = disabled;
      this.dispatchBtn.textContent = disabled ? 'Dispatching…' : 'Dispatch';
    }
  }

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------

  private connectWS(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const wsUrl = (() => {
      let ep = this.plugin.settings.websocketUrl || this.plugin.settings.activityApiUrl;
      ep = ep.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      ep = ep.replace(/\/$/, '');
      if (!ep.endsWith('/ws')) ep = ep + '/ws';
      return ep;
    })();
    const apiKey = this.plugin.settings.apiKey;

    try {
      this.ws = new window.WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[GoalDispatchView] WS connected');
        // Authenticate
        this.ws!.send(JSON.stringify({ type: 'authenticate', token: apiKey }));
      };

      this.ws.onmessage = (ev) => {
        this.handleWSMessage(ev.data as string);
      };

      this.ws.onerror = (ev) => {
        console.warn('[GoalDispatchView] WS error', ev);
      };

      this.ws.onclose = () => {
        console.log('[GoalDispatchView] WS closed, scheduling reconnect');
        this.ws = null;
        // Reconnect after 3s if the view is still open
        if (this.dispatching) {
          this.wsReconnectTimer = window.setTimeout(() => {
            this.wsReconnectTimer = null;
            this.connectWS();
          }, 3000);
        }
      };
    } catch (error) {
      console.error('[GoalDispatchView] Failed to create WS:', error);
    }
  }

  private disconnectWS(): void {
    if (this.wsReconnectTimer !== null) {
      window.clearTimeout(this.wsReconnectTimer);
      this.wsReconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // prevent reconnect loop
      this.ws.close();
      this.ws = null;
    }
  }

  private handleWSMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const type = msg.type as string | undefined;
    if (!type) return;

    // Only surface events for the active execution
    const msgExecId = (msg.executionId ?? msg.execution_id) as string | undefined;
    if (this.activeExecutionId && msgExecId && msgExecId !== this.activeExecutionId) {
      return;
    }

    const icon = EVENT_ICONS[type] ?? '•';
    let line = `${icon} ${type}`;

    if (type === 'task.started' || type === 'task.completed' || type === 'task.failed') {
      const taskId = (msg.taskId ?? msg.task_id) as string | undefined;
      const desc = msg.description as string | undefined;
      if (taskId) line += ` [${taskId}]`;
      if (desc) line += `: ${desc}`;
    } else if (type === 'tool.call') {
      const tool = msg.tool as string | undefined;
      if (tool) line += `: ${tool}`;
    } else if (type === 'impulse.resolved') {
      const shape = msg.shape as string | undefined;
      if (shape) line += `: ${shape}`;
    }

    this.appendMessage(line);

    // Persist to vault note
    if (this.goalFile) {
      this.goalNoteManager.appendEvent(this.goalFile, `- ${new Date().toISOString()} ${line}`);
    }

    // Detect terminal events
    if (type === 'task.failed' || type === 'execution.failed') {
      this.appendMessage('Execution failed.');
      if (this.goalFile) {
        this.goalNoteManager.markComplete(this.goalFile, 'failed');
      }
      this.dispatching = false;
      this.setDispatchBtnState(false);
    }

    // Check for execution-level success signals
    const status = msg.status as string | undefined;
    if (
      type === 'execution.completed' ||
      (msgExecId && status === 'success') ||
      (msgExecId && status === 'completed')
    ) {
      this.appendMessage('Execution complete.');
      if (this.goalFile) {
        this.goalNoteManager.markComplete(this.goalFile, 'completed');
      }
      this.dispatching = false;
      this.setDispatchBtnState(false);
    }
  }
}
