#!/usr/bin/env bun
/**
 * State Space Inspector
 * Discovers and displays what's in the current state space
 */

const TERMINAL_VESSEL = process.env.TERMINAL_VESSEL_ENDPOINT || 'http://localhost:9137';
const ACTIVITY_API = process.env.ACTIVITY_API_ENDPOINT || 'https://activity.metabob.com';
const API_KEY = process.env.METABOB_API_KEY;

interface StateSpaceSnapshot {
  timestamp: string;
  terminals: TerminalInfo[];
  impulses: ImpulseInfo[];
  activeExecutions: ExecutionInfo[];
  availableShapes: ShapeInfo[];
}

interface TerminalInfo {
  terminalId: string;
  pid: number;
  running: boolean;
  viewerCount: number;
  persistent: boolean;
  createdAt: number;
  lastActivity: number;
  impulseId: string;
}

interface ImpulseInfo {
  id: string;
  shape: string;
  sticky: boolean;
  budget: number;
  loaded: boolean;
  sizeBytes?: number;
}

interface ExecutionInfo {
  execution_id: string;
  activity_id: string;
  status: string;
  input_impulse_count: number;
  output_impulse_count: number;
  duration_ms?: number;
}

interface ShapeInfo {
  shape: string;
  resolver: string;
  endpoint?: string;
  count: number;
  examples: string[];
}

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

async function inspectTerminals(): Promise<TerminalInfo[]> {
  try {
    const response = await fetch(`${TERMINAL_VESSEL}/v2/terminals/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter: 'all' })
    });

    if (!response.ok) {
      log(`⚠️  Could not fetch terminals: ${response.statusText}`, colors.yellow);
      return [];
    }

    const result = await response.json();
    return result.terminals.map((t: any) => ({
      ...t,
      impulseId: `terminal-${t.terminalId}`
    }));
  } catch (error: any) {
    log(`⚠️  Terminal vessel not reachable: ${error.message}`, colors.yellow);
    return [];
  }
}

async function inspectImpulses(terminals: TerminalInfo[]): Promise<ImpulseInfo[]> {
  const impulses: ImpulseInfo[] = [];

  // Terminal impulses
  for (const terminal of terminals) {
    try {
      const response = await fetch(`${TERMINAL_VESSEL}/v2/impulses/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pointer: { type: 'terminalState', terminalId: terminal.terminalId }
        })
      });

      if (response.ok) {
        const result = await response.json();
        const content = result.content || '';

        impulses.push({
          id: terminal.impulseId,
          shape: 'terminalState',
          sticky: true,
          budget: 10000,
          loaded: true,
          sizeBytes: new Blob([content]).size
        });
      }
    } catch (error) {
      // Skip if can't resolve
    }
  }

  // TODO: Query activity API for other impulses in recent executions

  return impulses;
}

async function inspectActiveExecutions(): Promise<ExecutionInfo[]> {
  if (!API_KEY) return [];

  try {
    const response = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces?limit=20&status=in_progress`, {
      headers: {
        'Authorization': `ApiKey ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.traces.map((t: any) => ({
      execution_id: t.execution_id,
      activity_id: t.activity_id,
      status: t.status,
      input_impulse_count: t.input_impulses?.length || 0,
      output_impulse_count: t.output_impulses?.length || 0,
      duration_ms: t.duration_ms
    }));
  } catch (error) {
    return [];
  }
}

async function inspectAvailableShapes(terminals: TerminalInfo[]): Promise<ShapeInfo[]> {
  const shapes: Map<string, ShapeInfo> = new Map();

  // Terminal shapes
  if (terminals.length > 0) {
    shapes.set('terminalState', {
      shape: 'terminalState',
      resolver: 'terminal-vessel',
      endpoint: TERMINAL_VESSEL,
      count: terminals.length,
      examples: terminals.slice(0, 3).map(t => t.impulseId)
    });

    shapes.set('terminalCommand', {
      shape: 'terminalCommand',
      resolver: 'terminal-vessel',
      endpoint: TERMINAL_VESSEL,
      count: terminals.reduce((sum, t) => sum + (t.shellHistory?.length || 0), 0),
      examples: ['cmd-<timestamp>']
    });

    shapes.set('terminalOutput', {
      shape: 'terminalOutput',
      resolver: 'terminal-vessel',
      endpoint: TERMINAL_VESSEL,
      count: terminals.length,
      examples: [`output-${terminals[0]?.terminalId}-<timestamp>`]
    });
  }

  // TODO: Query backend for registered vessels and their shapes

  return Array.from(shapes.values());
}

async function captureSnapshot(): Promise<StateSpaceSnapshot> {
  log('\n🔍 Inspecting state space...', colors.cyan);

  const terminals = await inspectTerminals();
  const impulses = await inspectImpulses(terminals);
  const activeExecutions = await inspectActiveExecutions();
  const availableShapes = await inspectAvailableShapes(terminals);

  return {
    timestamp: new Date().toISOString(),
    terminals,
    impulses,
    activeExecutions,
    availableShapes
  };
}

function displaySnapshot(snapshot: StateSpaceSnapshot) {
  log('\n╔═══════════════════════════════════════════════════════════╗', colors.bright);
  log('║           STATE SPACE SNAPSHOT                            ║', colors.bright);
  log('╚═══════════════════════════════════════════════════════════╝', colors.bright);

  log(`\n📅 Timestamp: ${new Date(snapshot.timestamp).toLocaleString()}`);

  // Terminals
  log(`\n┌─ TERMINALS (${snapshot.terminals.length}) ───────────────────`, colors.bright);
  if (snapshot.terminals.length === 0) {
    log('   No active terminals', colors.dim);
  } else {
    snapshot.terminals.forEach((t, i) => {
      const statusColor = t.running ? colors.green : colors.yellow;
      const status = t.running ? '●' : '○';

      log(`   ${i + 1}. ${statusColor}${status}${colors.reset} ${colors.bright}${t.terminalId}${colors.reset}`);
      log(`      PID: ${t.pid} | Viewers: ${t.viewerCount} | Persistent: ${t.persistent ? 'Yes' : 'No'}`, colors.dim);
      log(`      Created: ${new Date(t.createdAt).toLocaleString()}`, colors.dim);
      log(`      Impulse: ${t.impulseId}`, colors.cyan);
    });
  }

  // Impulses
  log(`\n┌─ IMPULSES (${snapshot.impulses.length}) ────────────────────`, colors.bright);
  const impulsesByShape = snapshot.impulses.reduce((acc, imp) => {
    if (!acc[imp.shape]) acc[imp.shape] = [];
    acc[imp.shape].push(imp);
    return acc;
  }, {} as Record<string, ImpulseInfo[]>);

  Object.entries(impulsesByShape).forEach(([shape, impulses]) => {
    log(`   ${colors.magenta}${shape}${colors.reset} (${impulses.length})`);
    impulses.slice(0, 3).forEach((imp) => {
      const stickyBadge = imp.sticky ? colors.yellow + '📌' + colors.reset : '';
      const loadedBadge = imp.loaded ? colors.green + '✓' + colors.reset : colors.dim + '○' + colors.reset;
      const size = imp.sizeBytes ? formatBytes(imp.sizeBytes) : 'unknown';

      log(`      ${loadedBadge} ${imp.id} ${stickyBadge}`, colors.cyan);
      log(`         Budget: ${imp.budget} tokens | Size: ${size}`, colors.dim);
    });

    if (impulses.length > 3) {
      log(`      ... and ${impulses.length - 3} more`, colors.dim);
    }
  });

  // Active Executions
  log(`\n┌─ ACTIVE EXECUTIONS (${snapshot.activeExecutions.length}) ──`, colors.bright);
  if (snapshot.activeExecutions.length === 0) {
    log('   No active executions', colors.dim);
  } else {
    snapshot.activeExecutions.forEach((exec, i) => {
      log(`   ${i + 1}. ${colors.bright}${exec.execution_id}${colors.reset}`);
      log(`      Activity: ${exec.activity_id}`, colors.cyan);
      log(`      Status: ${exec.status}`, colors.yellow);
      log(`      Impulses: ${exec.input_impulse_count} in → ${exec.output_impulse_count} out`, colors.dim);
      if (exec.duration_ms) {
        log(`      Duration: ${formatDuration(exec.duration_ms)}`, colors.dim);
      }
    });
  }

  // Available Shapes
  log(`\n┌─ AVAILABLE SHAPES (${snapshot.availableShapes.length}) ───`, colors.bright);
  snapshot.availableShapes.forEach((shape) => {
    log(`   ${colors.magenta}${shape.shape}${colors.reset}`);
    log(`      Resolver: ${shape.resolver}`, colors.cyan);
    if (shape.endpoint) {
      log(`      Endpoint: ${shape.endpoint}`, colors.dim);
    }
    log(`      Count: ${shape.count}`, colors.dim);
    log(`      Examples: ${shape.examples.join(', ')}`, colors.dim);
  });

  // Summary
  log(`\n┌─ SUMMARY ─────────────────────────────────────────`, colors.bright);
  log(`   Total Terminals: ${snapshot.terminals.length}`);
  log(`   Total Impulses: ${snapshot.impulses.length}`);
  log(`   Active Executions: ${snapshot.activeExecutions.length}`);
  log(`   Available Shapes: ${snapshot.availableShapes.length}`);

  const totalImpulseSize = snapshot.impulses.reduce((sum, imp) => sum + (imp.sizeBytes || 0), 0);
  log(`   Total Memory: ${formatBytes(totalImpulseSize)}`);

  log('\n');
}

async function watch() {
  log('👁️  Entering watch mode (updates every 5s, Ctrl+C to exit)', colors.cyan);

  while (true) {
    console.clear();
    const snapshot = await captureSnapshot();
    displaySnapshot(snapshot);

    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

// Main
const args = process.argv.slice(2);
const command = args[0];

if (command === 'watch') {
  await watch();
} else {
  const snapshot = await captureSnapshot();
  displaySnapshot(snapshot);
}
