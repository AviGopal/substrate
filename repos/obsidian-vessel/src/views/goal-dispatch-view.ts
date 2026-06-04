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

import { ItemView, WorkspaceLeaf, TFile, Notice, MarkdownView } from 'obsidian';
import type MetabobVesselPlugin from '../main';
import { GoalHostClient, type VaultContext } from '../goals/goal-host-client';
import { GoalNoteManager } from '../goals/goal-note-manager';

export const VIEW_TYPE_GOAL_DISPATCH = 'metabob-goal-dispatch';

// ---------------------------------------------------------------------------
// Execution context tracking
// ---------------------------------------------------------------------------

interface TaskCtx {
  index: number;
  description: string;
  startedAt: number;
}

interface ExecCtx {
  variantId?: string;
  tasks: Map<string, TaskCtx>;
}

/** Shorten a variant/resolver/vessel id to a readable slug (last 2 segments). */
function shortId(id: string): string {
  const parts = id.split(/[-_:]/);
  return parts.slice(-2).join('-');
}

/** Human label for resolver tier. */
function tierLabel(tier: string | undefined): string {
  if (tier === 'deterministic') return 'fast';
  if (tier === 'pattern') return 'cached';
  if (tier === 'llm') return 'llm';
  return tier ?? '';
}

/** Format milliseconds as a compact duration string. */
function fmtDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Truncate a string for inline preview. */
function preview(val: unknown, max = 70): string {
  const s = typeof val === 'string' ? val : JSON.stringify(val);
  if (!s || s === 'null' || s === '{}') return '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

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

  // Execution context: tracks activity name + task descriptions per execId
  private execCtxs = new Map<string, ExecCtx>();

  // Event buffer: accumulate WS messages while waiting for the real executionId
  // from the poll. Keyed by execId so we can replay just the right one.
  private eventBuffer = new Map<string, Array<Record<string, unknown>>>();
  private buffering = false;

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

    // Keyboard hint
    inputSection.createDiv({ cls: 'goal-dispatch-hint', text: '⌘↵ to dispatch' });

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

    this.appendMessage('Ready. Enter a goal and press Dispatch (or Ctrl+Enter).', 'ready');
  }

  // ---------------------------------------------------------------------------
  // Vault context collection
  // ---------------------------------------------------------------------------

  /**
   * Snapshot the current Obsidian workspace state into a VaultContext.
   *
   * The snapshot is passed as `variables` to /run-goal so activities can
   * reference live vault content via template interpolation:
   *   - {{active_note_path}}   → path of the focused note
   *   - {{selection}}          → selected text (if any)
   *   - {{open_note_paths}}    → JSON array of open tabs
   *   - {{vault_path}}         → filesystem root of the vault
   *   - {{obsidian_vessel_endpoint}} → resolver call-back URL
   *
   * Activities that have tasks with resolver `obsidian:note` will
   * automatically receive these variables in their impulse pointer.
   * The `available_shapes` list is forwarded as `expected_output_shapes`
   * to bias Thompson sampling toward vault-aware activities.
   */
  private collectVaultContext(): VaultContext {
    const app = this.plugin.app;
    const ctx: VaultContext = {};

    // Active note
    const activeFile = app.workspace.getActiveFile();
    if (activeFile) {
      ctx.active_note_path = activeFile.path;

      // Cursor section: heading breadcrumb from the active MarkdownView
      const mdView = app.workspace.getActiveViewOfType(MarkdownView);
      if (mdView) {
        const editor = mdView.editor;
        const cursor = editor.getCursor();
        const cache = app.metadataCache.getFileCache(activeFile);
        if (cache?.headings?.length) {
          // Walk headings in order; last one whose line <= cursor line is active
          const activeHeadings: string[] = [];
          let lastLevel = 0;
          for (const h of cache.headings) {
            if (h.position.start.line > cursor.line) break;
            if (h.level <= lastLevel || activeHeadings.length === 0) {
              // pop deeper headings when we encounter a same-or-higher level
              while (activeHeadings.length > 0 && h.level <= lastLevel) {
                activeHeadings.pop();
                lastLevel = h.level - 1;
              }
            }
            activeHeadings.push(h.heading);
            lastLevel = h.level;
          }
          if (activeHeadings.length) ctx.active_note_section = activeHeadings.join(' › ');
        }

        // Selection
        const sel = editor.getSelection();
        if (sel?.trim()) ctx.selection = sel.trim();
      }
    }

    // All open markdown leaves → distinct paths
    const openPaths = new Set<string>();
    app.workspace.iterateAllLeaves(leaf => {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.file) {
        openPaths.add(view.file.path);
      }
    });
    if (openPaths.size > 0) ctx.open_note_paths = Array.from(openPaths);

    // Vault filesystem root
    const adapter = app.vault.adapter as { basePath?: string };
    if (adapter.basePath) ctx.vault_path = adapter.basePath;

    // Obsidian-vessel HTTP endpoint so activities can call back for resolution
    const port = this.plugin.settings.serverPort;
    if (port && this.plugin.settings.serverEnabled) {
      ctx.obsidian_vessel_endpoint = `http://127.0.0.1:${port}`;
    }

    // Shapes this context makes available for impulse resolution
    ctx.available_shapes = [...this.plugin.settings.shapes];

    return ctx;
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
    this.execCtxs.clear();
    this.appendMessage(`⟶ Goal: "${goal}"`);

    // Collect and display the vault context that will accompany the goal
    const ctx = this.collectVaultContext();
    this.appendVaultContextSummary(ctx);
    try {
      const client = new GoalHostClient(goalHostEndpoint, apiKey);

      // Start buffering WS events NOW — the execution may complete and fire
      // its events BEFORE the poll returns the executionId (auto-draft LLM
      // calls can take 30+ seconds while the actual execution runs in <100ms).
      this.eventBuffer.clear();
      this.buffering = true;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectWS();
      }

      // Step 1: dispatch → 202 with dispatchId
      const result = await client.dispatchGoal(goal, ctx);
      const dispatchId = result.executionId; // holds dispatchId from 202 body

      // Show elapsed time while the auto-draft LLM selects/authors an activity.
      // This can take 30-120s; without feedback the UI looks frozen.
      const selectStart = Date.now();
      const elapsedTimer = window.setInterval(() => {
        const secs = Math.floor((Date.now() - selectStart) / 1000);
        this.updateSelectingMessage(secs);
      }, 5000);
      this.updateSelectingMessage(0);

      // Step 2: poll until the real execution_id is known, then replay buffer
      const executionId = await client.pollExecutionId(dispatchId);
      window.clearInterval(elapsedTimer);

      if (!executionId) {
        this.appendMessage('Execution did not start within 5 min — check goal-host logs.', 'error');
        this.buffering = false;
        this.eventBuffer.clear();
        this.dispatching = false;
        this.setDispatchBtnState(false);
        return;
      }

      // Step 3: replay buffered events for this execution_id, then switch to live
      this.buffering = false;
      this.activeExecutionId = executionId;
      this.appendMessage('─'.repeat(36), 'divider');

      const buffered = this.eventBuffer.get(executionId) ?? [];
      if (buffered.length > 0) {
        for (const msg of buffered) this.processWSEvent(msg);
      }
      this.eventBuffer.clear();

      this.goalFile = await this.goalNoteManager.createGoalNote(executionId, goal);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.appendMessage(`Error dispatching goal: ${msg}`, 'error');
      new Notice(`Goal dispatch failed: ${msg}`);
      this.buffering = false;
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
   *
   * type maps to CSS class gd-{type} for color-coding:
   *   ready | success | failure | error | task | tool | impulse | divider
   */
  appendMessage(text: string, type?: string): void {
    if (!this.outputEl) return;
    const cls = ['goal-dispatch-line', type ? `gd-${type}` : ''].filter(Boolean).join(' ');
    const line = this.outputEl.createDiv(cls);
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.createSpan({ cls: 'goal-dispatch-ts', text: `${ts}` });
    line.createSpan({ cls: 'goal-dispatch-msg', text });
    // Auto-scroll to bottom
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  /**
   * Emit a concise impulse state space summary so an outside observer can see
   * exactly what vault context was attached to the goal.
   */
  private appendVaultContextSummary(ctx: VaultContext): void {
    const parts: string[] = [];

    if (ctx.active_note_path) {
      const name = ctx.active_note_path.split('/').pop() ?? ctx.active_note_path;
      const section = ctx.active_note_section ? ` › ${ctx.active_note_section}` : '';
      parts.push(`active: ${name}${section}`);
    } else {
      parts.push('active: none');
    }

    if (ctx.selection) {
      const snippet = ctx.selection.length > 40
        ? ctx.selection.slice(0, 40) + '…'
        : ctx.selection;
      parts.push(`selection: "${snippet}"`);
    }

    const openCount = ctx.open_note_paths?.length ?? 0;
    if (openCount > 1) {
      parts.push(`open: ${openCount} notes`);
    }

    if (ctx.available_shapes?.length) {
      parts.push(`shapes: ${ctx.available_shapes.length}`);
    }

    this.appendMessage(`◎ Context  ${parts.join('  ·  ')}`, 'impulse');
  }

  /** Update (or create) the 'selecting' status line in place rather than appending. */
  private updateSelectingMessage(elapsedSecs: number): void {
    if (!this.outputEl) return;
    const existing = this.outputEl.querySelector('.gd-selecting-line');
    const text = elapsedSecs === 0
      ? 'Activity selecting…'
      : `Activity selecting…  ${elapsedSecs}s`;
    if (existing) {
      existing.querySelector('.goal-dispatch-msg')!.textContent = text;
    } else {
      const line = this.outputEl.createDiv('goal-dispatch-line gd-selecting-line');
      const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      line.createSpan({ cls: 'goal-dispatch-ts', text: ts });
      line.createSpan({ cls: 'goal-dispatch-msg', text });
    }
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

  private getExecCtx(execId: string): ExecCtx {
    if (!this.execCtxs.has(execId)) {
      this.execCtxs.set(execId, { tasks: new Map() });
    }
    return this.execCtxs.get(execId)!;
  }

  private handleWSMessage(raw: string): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!this.dispatching && !this.activeExecutionId) return;

    // While buffering (waiting for poll to return executionId), stash events
    // keyed by execId so we can replay just the right one afterward.
    if (this.buffering) {
      const d = (msg.data ?? msg) as Record<string, unknown>;
      const eid = (d.execution_id ?? d.executionId) as string | undefined;
      if (eid) {
        if (!this.eventBuffer.has(eid)) this.eventBuffer.set(eid, []);
        this.eventBuffer.get(eid)!.push(msg);
      }
      return;
    }

    this.processWSEvent(msg);
  }

  private processWSEvent(msg: Record<string, unknown>): void {
    const type = msg.type as string | undefined;
    if (!type) return;

    // Events nest their payload under `data`; older broadcasts hoist to top.
    const data = (msg.data ?? msg) as Record<string, unknown>;
    const execId = (data.execution_id ?? data.executionId) as string | undefined;
    const taskId = (data.task_id ?? data.taskId) as string | undefined;

    // Strict filter: root execution + registered sub-executions.
    const isRoot = !execId || execId === this.activeExecutionId;
    if (!isRoot && !this.execCtxs.has(execId ?? '')) return;

    const pad = isRoot ? '' : '  ';
    const cpd = isRoot ? '  ' : '    ';

    switch (type) {

      // ── execution lifecycle ───────────────────────────────────────────────
      case 'activity.started':
      case 'execution_started':
      case 'execution.started': {
        const variantId = (data.template_name ?? data.templateName ?? data.variant_id ?? data.variantId ?? data.templateId) as string | undefined;
        if (execId) {
          const ctx = this.getExecCtx(execId); // registers it, passes future filter
          ctx.variantId = variantId;
        }
        if (isRoot && variantId) {
          // Show the activity name for the root execution
          this.appendMessage(`◈ Activity: ${variantId}`);
        } else if (!isRoot && variantId) {
          this.appendMessage(`${pad}↳ Sub-activity: ${variantId}`, 'sub');
        }
        break;
      }

      // ── task lifecycle ────────────────────────────────────────────────────
      case 'task.started': {
        const idx = (data.task_index ?? data.taskIndex) as number | undefined;
        const desc = (data.description ?? data.task_description) as string | undefined;
        if (execId && taskId) {
          const ctx = this.getExecCtx(execId);
          ctx.tasks.set(taskId, { index: idx ?? 0, description: desc ?? taskId, startedAt: Date.now() });
        }
        const n = idx !== undefined ? `${idx + 1}` : '?';
        this.appendMessage(`${pad}▶ Task ${n}: ${desc ?? taskId}`, 'task');
        break;
      }

      case 'task.completed': {
        const success = (data.success ?? data.succeeded) as boolean | undefined;
        const durationMs = (data.duration_ms ?? data.durationMs) as number | undefined;
        const error = (data.error ?? data.error_message) as string | undefined;
        const outputIds = (data.output_impulse_ids ?? data.outputImpulseIds) as string[] | undefined;
        const inputIds = (data.input_impulse_ids ?? data.inputImpulseIds) as string[] | undefined;
        const idx = ((data.task_index ?? data.taskIndex) as number | undefined)
          ?? (execId && taskId ? this.execCtxs.get(execId)?.tasks.get(taskId)?.index : undefined);
        const n = idx !== undefined ? `${idx + 1}` : '?';
        const durStr = durationMs ? `  ${fmtDuration(durationMs)}` : '';
        const outStr = outputIds?.length ? `  → ${outputIds.length} output${outputIds.length > 1 ? 's' : ''}` : '';
        const inStr = inputIds?.length ? `  ← ${inputIds.length} in` : '';

        if (success === false) {
          const errStr = error ? `  ${error.slice(0, 100)}` : '';
          this.appendMessage(`${pad}✗ Task ${n} failed${errStr}`, 'failure');
        } else {
          this.appendMessage(`${pad}✓ Task ${n} done${durStr}${inStr}${outStr}`, 'task');
        }
        break;
      }

      // ── resolver events ───────────────────────────────────────────────────
      case 'tool.call': {
        const toolName = (data.tool_name ?? data.tool) as string | undefined;
        const tier = (data.resolver_tier ?? data.resolverTier) as string | undefined;
        const latMs = (data.latency_ms ?? data.latencyMs) as number | undefined;
        const cost = (data.cost_usd ?? data.costUsd) as number | undefined;
        const tl = tierLabel(tier);
        const parts: string[] = [`⚙ ${toolName ?? '?'}`];
        if (tl) parts.push(`[${tl}]`);
        if (latMs) parts.push(fmtDuration(latMs));
        if (cost && cost > 0) parts.push(`$${cost.toFixed(4)}`);
        this.appendMessage(`${cpd}${parts.join('  ')}`, 'tool');
        break;
      }

      case 'impulse.resolved': {
        const shape = (data.shape ?? data.impulse_id ?? data.impulseId) as string | undefined;
        const resolverId = (data.resolver_id ?? data.resolverId) as string | undefined;
        const vessel = (data.vessel_id ?? data.vesselId) as string | undefined;
        const body = data.body;
        const latMs = (data.latency_ms ?? data.latencyMs) as number | undefined;

        const parts: string[] = [`◎ ${shape ?? '?'}`];
        if (resolverId) parts.push(`via ${shortId(resolverId)}`);
        if (vessel && vessel !== resolverId) parts.push(`@ ${shortId(vessel)}`);
        if (latMs) parts.push(fmtDuration(latMs));

        // Body preview: show what context was actually loaded
        if (body !== undefined && body !== null) {
          const b = body as Record<string, unknown> | string;
          if (typeof b === 'object' && b.truncated) {
            parts.push(`↯ ${preview(b.summary, 50)}`);
          } else {
            const p = preview(body, 60);
            if (p) parts.push(`"${p}"`);
          }
        }
        this.appendMessage(`${cpd}${parts.join('  ')}`, 'impulse');
        break;
      }

      // ── execution completion ──────────────────────────────────────────────
      case 'activity.completed':
      case 'execution.completed':
      case 'execution_completed': {
        const success = (data.success ?? data.succeeded) as boolean | undefined;
        const durationMs = (data.duration_ms ?? data.durationMs) as number | undefined;
        const cost = (data.cost ?? data.cost_usd) as number | undefined;
        const durStr = durationMs ? `  ${fmtDuration(durationMs)}` : '';
        const costStr = cost && cost > 0 ? `  $${cost.toFixed(4)}` : '';

        if (isRoot) {
          const ok = success !== false;
          this.appendMessage(
            `${ok ? '✓' : '✗'} Execution ${ok ? 'complete' : 'failed'}${durStr}${costStr}`,
            ok ? 'success' : 'failure',
          );
          if (this.goalFile) {
            this.goalNoteManager.markComplete(this.goalFile, ok ? 'completed' : 'failed');
          }
          this.dispatching = false;
          this.setDispatchBtnState(false);
        } else {
          const ok = success !== false;
          this.appendMessage(`${pad}${ok ? '✓' : '✗'} Sub-activity done${durStr}`, ok ? 'sub' : 'failure');
        }
        break;
      }

      case 'activity.failed':
      case 'execution.failed': {
        if (isRoot) {
          const err = (data.error ?? data.error_message) as string | undefined;
          this.appendMessage(`✗ Execution failed${err ? `  ${err.slice(0, 80)}` : ''}`, 'failure');
          if (this.goalFile) this.goalNoteManager.markComplete(this.goalFile, 'failed');
          this.dispatching = false;
          this.setDispatchBtnState(false);
        } else {
          this.appendMessage(`${pad}✗ Sub-activity failed`, 'failure');
        }
        break;
      }

      default: {
        // Unknown event — show type so nothing is silently swallowed
        if (isRoot) this.appendMessage(`• ${type}`, undefined);
        break;
      }
    }

    if (this.goalFile) {
      this.goalNoteManager.appendEvent(
        this.goalFile,
        `- ${new Date().toISOString()} ${type} exec=${execId ?? ''} task=${taskId ?? ''}`,
      );
    }
  }
}
