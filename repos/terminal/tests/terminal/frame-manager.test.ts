/**
 * Frame Manager Tests
 */

import { test, expect, describe } from 'bun:test';
import { FrameManager } from '../../src/terminal/frame-manager';

describe('FrameManager', () => {
  test('should spawn terminal with shell preset', async () => {
    const manager = new FrameManager();

    const terminalId = await manager.spawn({
      preset: 'shell',
      cwd: '/tmp'
    });

    expect(terminalId).toMatch(/^term-/);
    expect(manager.hasTerminal(terminalId)).toBe(true);

    const state = await manager.getState(terminalId);
    expect(state.terminalId).toBe(terminalId);
    expect(state.running).toBe(true);
    expect(state.shell).toContain('bash');
    expect(state.cwd).toBe('/tmp');

    // Cleanup
    await manager.kill(terminalId);
  });

  test('should send input to terminal', async () => {
    const manager = new FrameManager();

    const terminalId = await manager.spawn({
      preset: 'shell'
    });

    await manager.sendInput(terminalId, 'echo "test"\n');

    const state = await manager.getState(terminalId);
    expect(state.shellHistory).toContain('echo "test"');
    expect(state.totalCommands).toBeGreaterThan(0);

    // Cleanup
    await manager.kill(terminalId);
  });

  test('should emit stateChange events', async () => {
    const manager = new FrameManager();
    let eventReceived = false;

    manager.on('stateChange', (event: any) => {
      if (event.terminalId) {
        eventReceived = true;
      }
    });

    const terminalId = await manager.spawn({ preset: 'shell' });

    // Wait a bit for output
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(eventReceived).toBe(true);

    // Cleanup
    await manager.kill(terminalId);
  });

  test('should list terminals', async () => {
    const manager = new FrameManager();

    const term1 = await manager.spawn({ preset: 'shell' });
    const term2 = await manager.spawn({ preset: 'shell' });

    const terminals = manager.listTerminals();
    expect(terminals).toContain(term1);
    expect(terminals).toContain(term2);
    expect(terminals.length).toBe(2);

    // Cleanup
    await manager.kill(term1);
    await manager.kill(term2);
  });

  test('should handle terminal exit', async () => {
    const manager = new FrameManager();

    const terminalId = await manager.spawn({ preset: 'shell' });

    // Send exit command
    await manager.sendInput(terminalId, 'exit\n');

    // Wait for exit
    await new Promise(resolve => setTimeout(resolve, 500));

    const state = await manager.getState(terminalId);
    expect(state.running).toBe(false);
    expect(state.exitCode).toBeNumber();

    // Cleanup
    await manager.kill(terminalId);
  });
});
