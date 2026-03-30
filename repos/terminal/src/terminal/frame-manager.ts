/**
 * Frame Manager
 *
 * Manages PTY (pseudo-terminal) processes and terminal state.
 * Handles spawning, input/output, and state tracking.
 */

import { spawn as spawnPty, IPty } from 'node-pty';
import type {
  TerminalFrameState,
  SpawnConfig,
  TerminalCommand,
  StateChangeEvent,
  CommandExecutedEvent,
  ApplicationPreset
} from '../types';

type EventHandler<T> = (event: T) => void;

export class FrameManager {
  private terminals = new Map<string, IPty>();
  private states = new Map<string, TerminalFrameState>();
  private listeners = new Map<string, EventHandler<any>[]>();

  /**
   * Spawn a new terminal session
   */
  async spawn(config: SpawnConfig): Promise<string> {
    const terminalId = `term-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Apply preset if specified
    const finalConfig = config.preset
      ? this.applyPreset(config.preset, config)
      : config;

    // Determine shell and command
    const shell = finalConfig.shell || process.env.SHELL || '/bin/bash';
    const args = finalConfig.args || [];

    // Spawn PTY
    // Filter out undefined env vars
    const envVars = Object.fromEntries(
      Object.entries({ ...process.env, ...finalConfig.env })
        .filter(([_, v]) => v !== undefined)
    ) as Record<string, string>;

    const pty = spawnPty(shell, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: finalConfig.cwd || process.cwd(),
      env: envVars
    });

    this.terminals.set(terminalId, pty);

    // Initialize state
    const state: TerminalFrameState = {
      terminalId,
      pid: pty.pid,
      shell,
      cwd: finalConfig.cwd || process.cwd(),
      buffer: '',
      cursor: { row: 0, col: 0 },
      scrollback: [],
      running: true,
      exitCode: null,
      environmentVars: envVars,
      shellHistory: [],
      createdAt: Date.now(),
      lastActivity: Date.now(),
      totalCommands: 0
    };

    this.states.set(terminalId, state);

    // Listen for output
    pty.onData((data) => {
      this.handleOutput(terminalId, data);
    });

    // Listen for exit
    pty.onExit(({ exitCode }) => {
      this.handleExit(terminalId, exitCode);
    });

    // If command specified, send it after spawn
    if (finalConfig.command && !finalConfig.shell?.includes(finalConfig.command)) {
      // Wait a moment for shell to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.sendInput(terminalId, `${finalConfig.command}\n`);
    }

    return terminalId;
  }

  /**
   * Send input to terminal
   */
  async sendInput(terminalId: string, input: string): Promise<void> {
    const pty = this.terminals.get(terminalId);
    if (!pty) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }

    const state = this.states.get(terminalId);
    if (!state) {
      throw new Error(`State not found: ${terminalId}`);
    }

    // Record command
    const command: TerminalCommand = {
      id: `cmd-${Date.now()}`,
      command: input.trim(),
      timestamp: Date.now()
    };

    state.shellHistory.push(input.trim());
    state.totalCommands++;
    state.lastActivity = Date.now();

    // Emit command event
    this.emit<CommandExecutedEvent>('commandExecuted', {
      terminalId,
      command,
      timestamp: Date.now()
    });

    // Send to PTY
    pty.write(input);
  }

  /**
   * Get current terminal state
   */
  async getState(terminalId: string): Promise<TerminalFrameState> {
    const state = this.states.get(terminalId);
    if (!state) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }
    // Return deep clone
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Restore terminal to checkpoint state
   */
  async restoreState(terminalId: string, state: TerminalFrameState): Promise<void> {
    const pty = this.terminals.get(terminalId);
    if (!pty) {
      throw new Error(`Terminal not found: ${terminalId}`);
    }

    // Clear terminal (CSI reset)
    pty.write('\x1bc');

    // Write buffer content
    pty.write(state.buffer);

    // Update internal state
    this.states.set(terminalId, JSON.parse(JSON.stringify(state)));

    // Emit state change
    this.notifyStateChange(terminalId, state);
  }

  /**
   * Kill terminal process
   */
  async kill(terminalId: string): Promise<void> {
    const pty = this.terminals.get(terminalId);
    if (pty) {
      pty.kill();
      this.terminals.delete(terminalId);
    }
    this.states.delete(terminalId);
  }

  /**
   * List all terminals
   */
  listTerminals(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Check if terminal exists
   */
  hasTerminal(terminalId: string): boolean {
    return this.terminals.has(terminalId);
  }

  /**
   * Handle terminal output
   */
  private handleOutput(terminalId: string, data: string): void {
    const state = this.states.get(terminalId);
    if (!state) return;

    // Update buffer
    state.buffer += data;
    state.lastActivity = Date.now();

    // Manage buffer size (keep last 1000 lines)
    const lines = state.buffer.split('\n');
    if (lines.length > 1000) {
      state.scrollback.push(...lines.slice(0, lines.length - 1000));
      state.buffer = lines.slice(-1000).join('\n');

      // Limit scrollback to 10,000 lines
      if (state.scrollback.length > 10000) {
        state.scrollback = state.scrollback.slice(-10000);
      }
    }

    // Notify listeners
    this.notifyStateChange(terminalId, state);
  }

  /**
   * Handle terminal exit
   */
  private handleExit(terminalId: string, exitCode: number): void {
    const state = this.states.get(terminalId);
    if (!state) return;

    state.running = false;
    state.exitCode = exitCode;
    state.lastActivity = Date.now();

    this.notifyStateChange(terminalId, state);
  }

  /**
   * Apply application preset
   */
  private applyPreset(preset: ApplicationPreset, config: SpawnConfig): SpawnConfig {
    const presets: Record<ApplicationPreset, Partial<SpawnConfig>> = {
      claude: {
        command: 'claude',
        interactive: true,
        captureAll: true,
        checkpoint: {
          frequency: 'on-prompt',
          maxCheckpoints: 50
        },
        env: { TERM: 'xterm-256color' }
      },
      minibob: {
        command: 'bun',
        args: ['repos/minibob/index.ts', '--mode=terminal'],
        interactive: true,
        checkpoint: {
          frequency: 'on-command',
          maxCheckpoints: 100
        }
      },
      shell: {
        shell: '/bin/bash',
        interactive: true,
        checkpoint: {
          frequency: 'manual',
          maxCheckpoints: 20
        }
      },
      vim: {
        command: 'vim',
        interactive: true,
        captureAll: true,
        checkpoint: {
          frequency: 'timed',
          interval: 60000,
          maxCheckpoints: 10
        }
      },
      repl: {
        interactive: true,
        captureAll: true,
        checkpoint: {
          frequency: 'on-prompt',
          maxCheckpoints: 30
        }
      },
      server: {
        interactive: false,
        captureAll: true,
        checkpoint: {
          frequency: 'timed',
          interval: 300000,
          maxCheckpoints: 12
        },
        persistent: true
      }
    };

    return { ...presets[preset], ...config };
  }

  /**
   * Notify state change to listeners
   */
  private notifyStateChange(terminalId: string, state: TerminalFrameState): void {
    this.emit<StateChangeEvent>('stateChange', {
      terminalId,
      state,
      timestamp: Date.now()
    });
  }

  /**
   * Event emitter: emit event
   */
  private emit<T>(event: string, data: T): void {
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Event emitter: register listener
   */
  on<T>(event: string, handler: EventHandler<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  /**
   * Event emitter: remove listener
   */
  off<T>(event: string, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

// Singleton instance
export const frameManager = new FrameManager();
