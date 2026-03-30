/**
 * Impulse Store
 *
 * Manages terminal state impulses in memory.
 * Provides resolution and state synchronization.
 */

import type {
  Impulse,
  TerminalStateImpulse
} from '../types';
import { frameManager } from '../terminal/frame-manager';
import { checkpointManager } from '../terminal/checkpoint-manager';
import { connectionPool } from './connection-pool';

export class ImpulseStore {
  private impulses = new Map<string, Impulse>();

  /**
   * Add impulse to store
   */
  add(impulse: Impulse): void {
    this.impulses.set(impulse.id, impulse);
  }

  /**
   * Get impulse by ID
   */
  get(impulseId: string): Impulse | null {
    return this.impulses.get(impulseId) || null;
  }

  /**
   * Create terminal state impulse
   */
  async createTerminalStateImpulse(
    terminalId: string,
    persistenceKey?: string
  ): Promise<TerminalStateImpulse> {
    const state = await frameManager.getState(terminalId);
    const checkpoints = checkpointManager.getCheckpoints(terminalId);
    const connections = connectionPool.getConnections(terminalId);

    const impulse: TerminalStateImpulse = {
      id: `terminal-${terminalId}`,
      shape: 'terminalState',
      sticky: true,
      connectionId: `spawner-${Date.now()}`,
      instanceId: process.env.INSTANCE_ID || 'terminal-vessel-1',
      pointer: {
        terminalId,
        persistenceKey
      },
      loaded: true,
      content: {
        state,
        history: [],  // Will be populated from shell history
        position: state.totalCommands,
        checkpoints,
        connections
      }
    };

    this.add(impulse);
    return impulse;
  }

  /**
   * Update terminal state impulse
   */
  async updateTerminalStateImpulse(terminalId: string): Promise<void> {
    const impulseId = `terminal-${terminalId}`;
    const impulse = this.impulses.get(impulseId) as TerminalStateImpulse;

    if (!impulse) {
      throw new Error(`Impulse not found for terminal: ${terminalId}`);
    }

    // Update state
    impulse.content.state = await frameManager.getState(terminalId);
    impulse.content.position = impulse.content.state.totalCommands;
    impulse.content.checkpoints = checkpointManager.getCheckpoints(terminalId);
    impulse.content.connections = connectionPool.getConnections(terminalId);
  }

  /**
   * Resolve terminalState impulse
   */
  async resolveTerminalState(impulseId: string): Promise<TerminalStateImpulse> {
    const impulse = this.impulses.get(impulseId) as TerminalStateImpulse;

    if (!impulse) {
      throw new Error(`Impulse not found: ${impulseId}`);
    }

    // Update with latest state
    await this.updateTerminalStateImpulse(impulse.pointer.terminalId);

    return impulse;
  }

  /**
   * Remove impulse
   */
  remove(impulseId: string): boolean {
    return this.impulses.delete(impulseId);
  }

  /**
   * List all impulses
   */
  list(): Impulse[] {
    return Array.from(this.impulses.values());
  }

  /**
   * List impulses by shape
   */
  listByShape(shape: string): Impulse[] {
    return Array.from(this.impulses.values()).filter(i => i.shape === shape);
  }

  /**
   * Get terminal state impulse by terminal ID
   */
  getByTerminalId(terminalId: string): TerminalStateImpulse | null {
    const impulseId = `terminal-${terminalId}`;
    return this.impulses.get(impulseId) as TerminalStateImpulse || null;
  }

  /**
   * Cleanup non-sticky impulses (for GC)
   */
  cleanup(): number {
    let removed = 0;
    for (const [id, impulse] of this.impulses.entries()) {
      if (!('sticky' in impulse) || !impulse.sticky) {
        this.impulses.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

// Singleton instance
export const impulseStore = new ImpulseStore();
