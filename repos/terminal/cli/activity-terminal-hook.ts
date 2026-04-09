#!/usr/bin/env bun
/**
 * Activity-Terminal Hook
 * Automatically spawns terminal sessions for activities and captures their state
 */

const ACTIVITY_API = process.env.ACTIVITY_API_ENDPOINT || 'https://activity.metabob.com';
const TERMINAL_VESSEL = process.env.TERMINAL_VESSEL_ENDPOINT || 'http://localhost:9137';
const API_KEY = process.env.METABOB_API_KEY;

interface ActivityExecution {
  execution_id: string;
  activity_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  input_impulses: any[];
  output_impulses: any[];
  tasks: any[];
  created_at: string;
  updated_at: string;
}

/**
 * Hook into activity execution lifecycle
 */
class ActivityTerminalHook {
  private terminalsByExecution: Map<string, string> = new Map();
  private pollInterval: number = 2000;

  /**
   * Start monitoring activity executions
   */
  async start() {
    console.log('🔗 Starting activity-terminal hook...');
    console.log(`   Activity API: ${ACTIVITY_API}`);
    console.log(`   Terminal Vessel: ${TERMINAL_VESSEL}`);
    console.log('');

    // Poll for new activity executions
    setInterval(() => this.checkForNewExecutions(), this.pollInterval);

    console.log('✅ Hook active - monitoring for activity executions\n');
  }

  /**
   * Check for new activity executions
   */
  private async checkForNewExecutions() {
    try {
      // Query recent activity executions
      const response = await fetch(`${ACTIVITY_API}/v2/activities/execution-traces?limit=10&status=in_progress`, {
        headers: {
          'Authorization': `ApiKey ${API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      const executions = data.traces as ActivityExecution[];

      for (const execution of executions) {
        // Skip if we already created a terminal for this execution
        if (this.terminalsByExecution.has(execution.execution_id)) {
          continue;
        }

        // Check if activity wants a terminal session
        const needsTerminal = this.activityNeedsTerminal(execution);

        if (needsTerminal) {
          await this.attachTerminalToExecution(execution);
        }
      }
    } catch (error: any) {
      console.error(`⚠️  Error checking executions: ${error.message}`);
    }
  }

  /**
   * Determine if activity needs a terminal session
   */
  private activityNeedsTerminal(execution: ActivityExecution): boolean {
    // Check if activity requests terminal impulse
    const hasTerminalImpulse = execution.input_impulses?.some(
      (impulse: any) => impulse.metadata?.shape === 'terminalState'
    );

    if (hasTerminalImpulse) return true;

    // Check if activity has tasks that use terminal tools
    const usesTerminalTools = execution.tasks?.some(
      (task: any) => task.tools?.includes('terminal') || task.tools?.includes('mcp')
    );

    if (usesTerminalTools) return true;

    // Check activity category
    const category = execution.activity_id.split('-')[0];
    const terminalCategories = ['debug', 'test', 'build', 'deploy', 'interactive'];

    if (terminalCategories.includes(category)) return true;

    return false;
  }

  /**
   * Attach a terminal session to an activity execution
   */
  private async attachTerminalToExecution(execution: ActivityExecution) {
    console.log(`\n📎 Attaching terminal to execution: ${execution.execution_id}`);
    console.log(`   Activity: ${execution.activity_id}`);

    try {
      // Spawn terminal
      const spawnResponse = await fetch(`${TERMINAL_VESSEL}/v2/terminals/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset: 'shell',
          persistent: true,
          persistenceKey: `activity-${execution.execution_id}`,
          env: {
            ACTIVITY_EXECUTION_ID: execution.execution_id,
            ACTIVITY_ID: execution.activity_id
          }
        })
      });

      if (!spawnResponse.ok) {
        throw new Error(`Failed to spawn terminal: ${spawnResponse.statusText}`);
      }

      const terminalResult = await spawnResponse.json();
      this.terminalsByExecution.set(execution.execution_id, terminalResult.terminalId);

      console.log(`   ✅ Terminal spawned: ${terminalResult.terminalId}`);
      console.log(`   Impulse: ${terminalResult.impulseId}`);

      // Create impulse reference for activity to use
      await this.createImpulseReference(execution.execution_id, terminalResult.impulseId);

      // Set up side-effect handlers
      await this.setupSideEffectHandlers(execution.execution_id, terminalResult.terminalId);
    } catch (error: any) {
      console.error(`   ❌ Failed to attach terminal: ${error.message}`);
    }
  }

  /**
   * Create impulse reference that activity can load
   */
  private async createImpulseReference(executionId: string, impulseId: string) {
    try {
      // Post impulse reference to activity API
      const response = await fetch(`${ACTIVITY_API}/v2/activities/execution-impulses`, {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          execution_id: executionId,
          impulse_id: impulseId,
          impulse_type: 'auxiliary', // Not required, but available
          metadata: {
            shape: 'terminalState',
            created_by: 'activity-terminal-hook',
            purpose: 'execution_monitoring'
          }
        })
      });

      if (response.ok) {
        console.log(`   ✅ Impulse reference created`);
      }
    } catch (error: any) {
      console.error(`   ⚠️  Could not create impulse reference: ${error.message}`);
    }
  }

  /**
   * Set up handlers for terminal side-effects
   */
  private async setupSideEffectHandlers(executionId: string, terminalId: string) {
    console.log(`   🔧 Setting up side-effect handlers`);

    // Poll terminal state and detect side-effects
    const checkInterval = setInterval(async () => {
      try {
        const response = await fetch(`${TERMINAL_VESSEL}/v2/impulses/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pointer: { type: 'terminalState', terminalId }
          })
        });

        if (!response.ok) {
          clearInterval(checkInterval);
          return;
        }

        const result = await response.json();
        const state = JSON.parse(result.content).state;

        // Detect side-effects
        await this.detectAndHandleSideEffects(executionId, terminalId, state);

        // Stop monitoring if terminal exited
        if (!state.running) {
          console.log(`   ⏹️  Terminal ${terminalId} stopped - ending monitoring`);
          clearInterval(checkInterval);
        }
      } catch (error: any) {
        console.error(`   ⚠️  Error monitoring terminal: ${error.message}`);
      }
    }, 3000);
  }

  /**
   * Detect and handle terminal side-effects
   */
  private async detectAndHandleSideEffects(executionId: string, terminalId: string, state: any) {
    const buffer = state.buffer || '';
    const lastCommand = state.shellHistory?.slice(-1)[0] || '';

    // Detect file system changes
    if (lastCommand.match(/^(git add|git commit|rm|mv|cp|mkdir|touch)/)) {
      console.log(`   📝 Side-effect detected: File system modification`);
      await this.reportSideEffect(executionId, {
        type: 'filesystem_change',
        command: lastCommand,
        terminalId
      });
    }

    // Detect git operations
    if (lastCommand.match(/^git (commit|push|pull|merge)/)) {
      console.log(`   🌿 Side-effect detected: Git operation`);
      await this.reportSideEffect(executionId, {
        type: 'git_operation',
        command: lastCommand,
        terminalId
      });
    }

    // Detect network operations
    if (lastCommand.match(/^(curl|wget|npm install|bun install)/)) {
      console.log(`   🌐 Side-effect detected: Network operation`);
      await this.reportSideEffect(executionId, {
        type: 'network_operation',
        command: lastCommand,
        terminalId
      });
    }

    // Detect errors
    if (buffer.match(/(error|failed|exception|fatal)/i) && state.exitCode !== 0 && state.exitCode !== null) {
      console.log(`   ❌ Side-effect detected: Command failure`);
      await this.reportSideEffect(executionId, {
        type: 'command_failure',
        command: lastCommand,
        exitCode: state.exitCode,
        terminalId
      });
    }
  }

  /**
   * Report side-effect to activity API
   */
  private async reportSideEffect(executionId: string, sideEffect: any) {
    try {
      await fetch(`${ACTIVITY_API}/v2/activities/side-effects`, {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          execution_id: executionId,
          side_effect: sideEffect,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error: any) {
      // Silently fail - side-effect reporting is best-effort
    }
  }
}

// Main
if (!API_KEY) {
  console.error('❌ Error: METABOB_API_KEY environment variable not set');
  console.error('   Set it with: export METABOB_API_KEY=your-key-here');
  process.exit(1);
}

const hook = new ActivityTerminalHook();
hook.start();
