/**
 * Replay Engine
 *
 * Handles terminal state rollback and replay from checkpoints.
 * Supports configurable replay speed.
 */

import type { TerminalFrameState, ReplayResult } from '../types';
import { frameManager } from './frame-manager';
import { checkpointManager } from './checkpoint-manager';

export class ReplayEngine {
  /**
   * Rollback to checkpoint and replay commands
   */
  async rollbackAndReplay(
    terminalId: string,
    checkpointId: string,
    speed: number = 10
  ): Promise<ReplayResult> {
    // Get checkpoint
    const checkpoint = checkpointManager.getCheckpoint(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    if (checkpoint.terminalId !== terminalId) {
      throw new Error(`Checkpoint ${checkpointId} does not belong to terminal ${terminalId}`);
    }

    // Restore state to checkpoint
    await frameManager.restoreState(terminalId, checkpoint.state);

    // Get current state for comparison
    const currentState = await frameManager.getState(terminalId);

    // Get commands to replay (from checkpoint position to current)
    const commandsToReplay = currentState.shellHistory.slice(checkpoint.position);

    // Replay commands
    let replayedCount = 0;
    for (const command of commandsToReplay) {
      await this.replayCommand(terminalId, command, speed);
      replayedCount++;
    }

    // Get final state
    const finalState = await frameManager.getState(terminalId);

    return {
      success: true,
      replayedCommands: replayedCount,
      finalPosition: finalState.totalCommands
    };
  }

  /**
   * Replay single command with speed multiplier
   */
  private async replayCommand(
    terminalId: string,
    command: string,
    speed: number
  ): Promise<void> {
    // Send command to terminal
    await frameManager.sendInput(terminalId, command + '\n');

    // Wait with reduced delay (inverse of speed)
    const normalDelay = 100;  // ms
    const replayDelay = normalDelay / speed;
    await this.sleep(replayDelay);
  }

  /**
   * Detect misalignment between expected and actual state
   */
  async detectMisalignment(
    _terminalId: string,
    expectedState: TerminalFrameState,
    actualState: TerminalFrameState
  ): Promise<boolean> {
    // Compare critical state properties
    return (
      expectedState.cursor.row !== actualState.cursor.row ||
      expectedState.cursor.col !== actualState.cursor.col ||
      expectedState.totalCommands !== actualState.totalCommands ||
      this.hashBuffer(expectedState.buffer) !== this.hashBuffer(actualState.buffer)
    );
  }

  /**
   * Catch up viewer to current terminal state
   */
  async catchUp(
    _connectionId: string,
    terminalId: string,
    speed: number = 10
  ): Promise<void> {
    // Find closest checkpoint
    const currentState = await frameManager.getState(terminalId);
    const checkpoint = checkpointManager.getCheckpointByPosition(
      terminalId,
      currentState.totalCommands - 1
    );

    if (!checkpoint) {
      // No checkpoint available, full sync needed
      return;
    }

    // Replay from checkpoint to current
    await this.rollbackAndReplay(terminalId, checkpoint.id, speed);
  }

  /**
   * Simple buffer hash for comparison
   */
  private hashBuffer(buffer: string): string {
    // Simple hash: last 100 chars + length
    const tail = buffer.slice(-100);
    return `${tail}-${buffer.length}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const replayEngine = new ReplayEngine();
