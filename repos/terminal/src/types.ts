/**
 * Terminal Vessel Type Definitions
 *
 * Core types for stateful terminal management with multi-viewer sync
 */

// ============================================================================
// Base Impulse Type (from foundation)
// ============================================================================

export interface Impulse {
  id: string;
  shape: string;
  pointer: Record<string, any>;
  loaded?: boolean;
  content?: any;
  budget?: number;
  priority?: 'high' | 'medium' | 'low';
}

// ============================================================================
// Terminal Frame State
// ============================================================================

export interface TerminalFrameState {
  terminalId: string;
  pid: number;
  shell: string;
  cwd: string;

  // Display state
  buffer: string;              // ANSI buffer
  cursor: { row: number; col: number };
  scrollback: string[];

  // Process state
  running: boolean;
  exitCode: number | null;

  // Context state
  environmentVars: Record<string, string>;
  shellHistory: string[];

  // Metadata
  createdAt: number;
  lastActivity: number;
  totalCommands: number;
}

// ============================================================================
// Commands and Events
// ============================================================================

export interface TerminalCommand {
  id: string;
  command: string;
  timestamp: number;
  exitCode?: number;
  duration?: number;
  output?: string;
}

// ============================================================================
// Checkpoints
// ============================================================================

export interface Checkpoint {
  id: string;
  terminalId: string;
  position: number;            // Command index
  state: TerminalFrameState;   // Deep clone
  timestamp: number;
  label?: string;
  broadcast?: boolean;         // Share with other terminals
}

// ============================================================================
// Connections (Viewers)
// ============================================================================

export interface Connection {
  connectionId: string;
  terminalId: string;
  instanceId: string;          // Which vessel instance
  connected: boolean;
  lastSync: number;
  viewOnly: boolean;           // Can only view, not send input
}

// ============================================================================
// Spawn Configuration
// ============================================================================

export type CheckpointFrequency = 'manual' | 'on-prompt' | 'on-command' | 'timed';
export type ApplicationPreset = 'claude' | 'minibob' | 'shell' | 'vim' | 'repl' | 'server';

export interface SpawnConfig {
  // Application to run
  command?: string;            // e.g., 'claude', 'vim', 'python'
  args?: string[];

  // Shell options
  shell?: string;              // e.g., '/bin/bash', '/bin/zsh'
  cwd?: string;
  env?: Record<string, string>;

  // Behavior
  interactive?: boolean;       // Wait for input
  captureAll?: boolean;        // Capture full output (not just stdout)

  // Persistence
  persistent?: boolean;
  persistenceKey?: string;     // For restoration

  // Checkpoint strategy
  checkpoint?: {
    frequency?: CheckpointFrequency;
    interval?: number;         // For timed strategy (ms)
    maxCheckpoints?: number;
  };

  // Application preset
  preset?: ApplicationPreset;
}

// ============================================================================
// Impulse Shapes
// ============================================================================

export interface TerminalStateImpulse extends Impulse {
  shape: 'terminalState';
  sticky: true;
  connectionId: string;
  instanceId: string;
  pointer: {
    terminalId: string;
    persistenceKey?: string;
  };
  content: {
    state: TerminalFrameState;
    history: TerminalCommand[];
    position: number;
    checkpoints: Checkpoint[];
    connections: Connection[];
  };
}

export interface TerminalCommandImpulse extends Impulse {
  shape: 'terminalCommand';
  pointer: {
    terminalId: string;
    command: string;
  };
  content: TerminalCommand;
}

export interface TerminalOutputImpulse extends Impulse {
  shape: 'terminalOutput';
  pointer: {
    terminalId: string;
    fromLine: number;
    toLine: number;
  };
  content: {
    lines: string[];
    ansiParsed: boolean;
  };
}

// ============================================================================
// Events
// ============================================================================

export interface StateChangeEvent {
  terminalId: string;
  state: TerminalFrameState;
  timestamp: number;
}

export interface CommandExecutedEvent {
  terminalId: string;
  command: TerminalCommand;
  timestamp: number;
}

export interface CheckpointCreatedEvent {
  terminalId: string;
  checkpoint: Checkpoint;
  timestamp: number;
}

export interface ConnectionEvent {
  terminalId: string;
  connectionId: string;
  action: 'connect' | 'disconnect';
  timestamp: number;
}

// ============================================================================
// MCP Tool Results
// ============================================================================

export interface SpawnResult {
  terminalId: string;
  impulseId: string;
  pid: number;
}

export interface SendInputResult {
  success: boolean;
  checkpointId?: string;
}

export interface ConnectResult {
  connected: boolean;
  state: TerminalFrameState;
  viewerCount: number;
}

export interface DisconnectResult {
  disconnected: boolean;
  remainingViewers: number;
}

export interface CheckpointResult {
  checkpointId: string;
  timestamp: number;
  position: number;
}

export interface ReplayResult {
  success: boolean;
  replayedCommands: number;
  finalPosition: number;
}

export interface RestoreResult {
  terminalId: string;
  impulseId: string;
  restored: boolean;
}

export interface TerminalListItem {
  terminalId: string;
  pid: number;
  running: boolean;
  viewerCount: number;
  persistent: boolean;
  createdAt: number;
  lastActivity: number;
}

export interface ListResult {
  terminals: TerminalListItem[];
}
