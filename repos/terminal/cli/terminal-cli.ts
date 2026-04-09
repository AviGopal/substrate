#!/usr/bin/env bun
/**
 * Terminal Vessel CLI
 * Human interface for interacting with terminal sessions
 */

const VESSEL_ENDPOINT = process.env.TERMINAL_VESSEL_ENDPOINT || 'http://localhost:9137';

interface TerminalState {
  buffer: string;
  cursor: { row: number; col: number };
  shellHistory: string[];
  exitCode: number | null;
  running: boolean;
  pid: number;
  cwd: string;
}

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function spawn(preset: string = 'shell', persistent: boolean = false): Promise<void> {
  log(`\n📦 Spawning terminal with preset: ${preset}`, colors.cyan);

  const response = await fetch(`${VESSEL_ENDPOINT}/v2/terminals/spawn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preset,
      persistent,
      persistenceKey: persistent ? `cli-session-${Date.now()}` : undefined
    })
  });

  if (!response.ok) {
    log(`❌ Failed to spawn terminal: ${response.statusText}`, colors.red);
    return;
  }

  const result = await response.json();
  log(`✅ Terminal spawned successfully`, colors.green);
  log(`   Terminal ID: ${result.terminalId}`, colors.bright);
  log(`   Impulse ID: ${result.impulseId}`);
  log(`   PID: ${result.pid}`);
  log(`\n💡 Use this terminal ID with other commands`);
  log(`   Example: terminal-cli send ${result.terminalId} "ls -la"`);
}

async function sendInput(terminalId: string, input: string, createCheckpoint: boolean = false): Promise<void> {
  log(`\n📤 Sending input to terminal ${terminalId}`, colors.cyan);
  log(`   Input: ${input}`);

  const response = await fetch(`${VESSEL_ENDPOINT}/v2/terminals/send-input`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      terminalId,
      input: input.includes('\n') ? input : input + '\n',
      createCheckpoint
    })
  });

  if (!response.ok) {
    log(`❌ Failed to send input: ${response.statusText}`, colors.red);
    return;
  }

  const result = await response.json();
  log(`✅ Input sent successfully`, colors.green);
  if (result.checkpointId) {
    log(`   Checkpoint created: ${result.checkpointId}`, colors.yellow);
  }
}

async function getState(terminalId: string): Promise<void> {
  log(`\n🔍 Fetching terminal state: ${terminalId}`, colors.cyan);

  const response = await fetch(`${VESSEL_ENDPOINT}/v2/impulses/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pointer: {
        type: 'terminalState',
        terminalId
      }
    })
  });

  if (!response.ok) {
    log(`❌ Failed to get state: ${response.statusText}`, colors.red);
    return;
  }

  const result = await response.json();
  const state = JSON.parse(result.content).state as TerminalState;

  log(`\n─────────────────────────────────────────────────────`, colors.bright);
  log(`Terminal State: ${terminalId}`);
  log(`─────────────────────────────────────────────────────`, colors.bright);
  log(`\nPID: ${state.pid}`);
  log(`CWD: ${state.cwd}`);
  log(`Running: ${state.running ? colors.green + 'Yes' + colors.reset : colors.yellow + 'No' + colors.reset}`);
  log(`Exit Code: ${state.exitCode === null ? 'N/A' : state.exitCode === 0 ? colors.green + '0 (success)' + colors.reset : colors.red + state.exitCode + ' (error)' + colors.reset}`);
  log(`\nCursor: Row ${state.cursor.row}, Col ${state.cursor.col}`);
  log(`\nShell History (last 5 commands):`);
  state.shellHistory.slice(-5).forEach((cmd, i) => {
    log(`  ${i + 1}. ${cmd}`, colors.cyan);
  });

  log(`\nTerminal Buffer:`, colors.bright);
  log(`─────────────────────────────────────────────────────`);
  console.log(state.buffer);
  log(`─────────────────────────────────────────────────────`, colors.bright);
}

async function list(filter: string = 'all'): Promise<void> {
  log(`\n📋 Listing terminals (filter: ${filter})`, colors.cyan);

  const response = await fetch(`${VESSEL_ENDPOINT}/v2/terminals/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filter })
  });

  if (!response.ok) {
    log(`❌ Failed to list terminals: ${response.statusText}`, colors.red);
    return;
  }

  const result = await response.json();

  if (result.terminals.length === 0) {
    log(`   No terminals found`, colors.yellow);
    return;
  }

  log(`\nFound ${result.terminals.length} terminal(s):\n`);

  result.terminals.forEach((terminal: any, i: number) => {
    const statusColor = terminal.running ? colors.green : colors.yellow;
    const exitColor = terminal.exitCode === 0 ? colors.green : colors.red;

    log(`${i + 1}. Terminal ID: ${colors.bright}${terminal.terminalId}${colors.reset}`);
    log(`   PID: ${terminal.pid}`);
    log(`   Status: ${statusColor}${terminal.running ? 'Running' : 'Stopped'}${colors.reset}`);
    if (terminal.exitCode !== null) {
      log(`   Exit Code: ${exitColor}${terminal.exitCode}${colors.reset}`);
    }
    log(`   Viewers: ${terminal.viewerCount}`);
    log(`   Persistent: ${terminal.persistent ? 'Yes' : 'No'}`);
    log(`   Created: ${new Date(terminal.createdAt).toLocaleString()}`);
    log('');
  });
}

async function interactive(terminalId: string): Promise<void> {
  log(`\n🎮 Entering interactive mode for terminal ${terminalId}`, colors.cyan);
  log(`   Type commands and press Enter. Type 'exit' to quit.\n`);

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.green + '$ ' + colors.reset
  });

  rl.prompt();

  rl.on('line', async (line: string) => {
    if (line.trim() === 'exit') {
      log('\n👋 Exiting interactive mode', colors.yellow);
      rl.close();
      return;
    }

    if (line.trim() === '') {
      rl.prompt();
      return;
    }

    // Send command
    await sendInput(terminalId, line);

    // Wait a bit for command to execute
    await new Promise(resolve => setTimeout(resolve, 500));

    // Show updated buffer
    const response = await fetch(`${VESSEL_ENDPOINT}/v2/impulses/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pointer: { type: 'terminalState', terminalId }
      })
    });

    if (response.ok) {
      const result = await response.json();
      const state = JSON.parse(result.content).state as TerminalState;

      // Show last 10 lines of buffer
      const lines = state.buffer.split('\n');
      const lastLines = lines.slice(-10).join('\n');
      console.log(lastLines);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

async function help(): Promise<void> {
  log(`
Terminal Vessel CLI
===================

Commands:

  spawn [preset]                   Spawn a new terminal session
                                   Presets: shell, claude, minibob, vim, repl, server
                                   Example: terminal-cli spawn shell

  send <terminalId> <command>      Send a command to a terminal
                                   Example: terminal-cli send term-123 "ls -la"

  state <terminalId>               Show terminal state (buffer, history, cursor)
                                   Example: terminal-cli state term-123

  list [filter]                    List all terminal sessions
                                   Filters: all, running, exited, persistent
                                   Example: terminal-cli list running

  interactive <terminalId>         Enter interactive mode (REPL)
                                   Example: terminal-cli interactive term-123

  help                             Show this help message

Environment Variables:

  TERMINAL_VESSEL_ENDPOINT         Vessel endpoint (default: http://localhost:9137)

Examples:

  # Spawn a development shell
  terminal-cli spawn shell

  # Run a command
  terminal-cli send term-abc123 "npm test"

  # View terminal output
  terminal-cli state term-abc123

  # Interactive session
  terminal-cli interactive term-abc123
`, colors.bright);
}

// Main CLI logic
const args = process.argv.slice(2);
const command = args[0];

try {
  switch (command) {
    case 'spawn':
      await spawn(args[1] || 'shell', args.includes('--persistent'));
      break;

    case 'send':
      if (args.length < 3) {
        log('❌ Usage: terminal-cli send <terminalId> <command>', colors.red);
        process.exit(1);
      }
      await sendInput(args[1], args.slice(2).join(' '), args.includes('--checkpoint'));
      break;

    case 'state':
      if (args.length < 2) {
        log('❌ Usage: terminal-cli state <terminalId>', colors.red);
        process.exit(1);
      }
      await getState(args[1]);
      break;

    case 'list':
      await list(args[1] || 'all');
      break;

    case 'interactive':
      if (args.length < 2) {
        log('❌ Usage: terminal-cli interactive <terminalId>', colors.red);
        process.exit(1);
      }
      await interactive(args[1]);
      break;

    case 'help':
    case '--help':
    case '-h':
    case undefined:
      await help();
      break;

    default:
      log(`❌ Unknown command: ${command}`, colors.red);
      log(`Run 'terminal-cli help' for usage information`);
      process.exit(1);
  }
} catch (error: any) {
  log(`\n❌ Error: ${error.message}`, colors.red);
  process.exit(1);
}
