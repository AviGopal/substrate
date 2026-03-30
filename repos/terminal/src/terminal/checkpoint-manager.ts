/**
 * Checkpoint Manager
 *
 * Manages checkpoints for terminal state rollback and replay.
 * Implements FIFO checkpoint limits and checkpoint sharing.
 */

import type { Checkpoint, TerminalFrameState } from '../types';
import { frameManager } from './frame-manager';

export class CheckpointManager {
  private checkpoints = new Map<string, Checkpoint[]>();  // terminalId → checkpoints
  private maxCheckpoints = 20;  // Default limit

  /**
   * Create checkpoint for terminal
   */
  async create(
    terminalId: string,
    label?: string,
    broadcast?: boolean
  ): Promise<Checkpoint> {
    const state = await frameManager.getState(terminalId);

    // Deep clone state
    const clonedState: TerminalFrameState = JSON.parse(JSON.stringify(state));

    const checkpoint: Checkpoint = {
      id: `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      terminalId,
      position: state.totalCommands,  // Current command index
      state: clonedState,
      timestamp: Date.now(),
      label,
      broadcast
    };

    // Get existing checkpoints for this terminal
    const terminalCheckpoints = this.checkpoints.get(terminalId) || [];

    // Add new checkpoint
    terminalCheckpoints.push(checkpoint);

    // Enforce FIFO limit
    if (terminalCheckpoints.length > this.maxCheckpoints) {
      terminalCheckpoints.shift();  // Remove oldest
    }

    this.checkpoints.set(terminalId, terminalCheckpoints);

    return checkpoint;
  }

  /**
   * Get checkpoint by ID
   */
  getCheckpoint(checkpointId: string): Checkpoint | null {
    for (const checkpoints of this.checkpoints.values()) {
      const checkpoint = checkpoints.find(cp => cp.id === checkpointId);
      if (checkpoint) {
        return checkpoint;
      }
    }
    return null;
  }

  /**
   * Get all checkpoints for terminal
   */
  getCheckpoints(terminalId: string): Checkpoint[] {
    return this.checkpoints.get(terminalId) || [];
  }

  /**
   * Get checkpoint by position (command index)
   */
  getCheckpointByPosition(terminalId: string, position: number): Checkpoint | null {
    const checkpoints = this.checkpoints.get(terminalId) || [];

    // Find checkpoint at or before position
    const candidates = checkpoints.filter(cp => cp.position <= position);

    // Return most recent checkpoint before position
    if (candidates.length === 0) return null;
    return candidates[candidates.length - 1];
  }

  /**
   * Delete checkpoint
   */
  deleteCheckpoint(checkpointId: string): boolean {
    for (const checkpoints of this.checkpoints.values()) {
      const index = checkpoints.findIndex(cp => cp.id === checkpointId);
      if (index > -1) {
        checkpoints.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Delete all checkpoints for terminal
   */
  deleteCheckpoints(terminalId: string): void {
    this.checkpoints.delete(terminalId);
  }

  /**
   * Set max checkpoints limit
   */
  setMaxCheckpoints(max: number): void {
    this.maxCheckpoints = max;
  }

  /**
   * Find common checkpoint between two terminals (for sync)
   */
  findCommonCheckpoint(terminalId1: string, terminalId2: string): Checkpoint | null {
    const checkpoints1 = this.checkpoints.get(terminalId1) || [];
    const checkpoints2 = this.checkpoints.get(terminalId2) || [];

    // Find checkpoint with same position in both
    for (const cp1 of checkpoints1) {
      for (const cp2 of checkpoints2) {
        if (cp1.position === cp2.position) {
          return cp1;
        }
      }
    }

    return null;
  }
}

// Singleton instance
export const checkpointManager = new CheckpointManager();
