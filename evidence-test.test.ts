import { describe, test, expect } from 'bun:test';

describe('Activity Evidence Collection Test', () => {
  test('should fail initially - will be fixed by activity', () => {
    // Intentional failure: 1 + 1 should be 2, not 3
    expect(1 + 1).toBe(3);
  });
});
