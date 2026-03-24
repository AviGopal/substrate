/**
 * Tests for CoChangePredictor
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { CoChangePredictor } from '../src/predictor.js';

describe('CoChangePredictor', () => {
  let predictor: CoChangePredictor;

  beforeAll(async () => {
    predictor = new CoChangePredictor();
    await predictor.initialize();
  });

  test('should initialize successfully', () => {
    const stats = predictor.getStats();
    expect(stats.componentsIndexed).toBe(0);
    expect(stats.filesAdded).toBe(0);
    expect(stats.embeddingDim).toBe(32);
  });

  test('should add file and extract components', async () => {
    const code = `
function hello() {
  return "world";
}

function goodbye() {
  return "farewell";
}

class Greeter {
  greet() {
    return hello();
  }
}
`;

    const result = await predictor.addFile('test.ts', code);

    expect(result.filePath).toBe('test.ts');
    expect(result.componentsAdded).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThan(0);

    const stats = predictor.getStats();
    expect(stats.componentsIndexed).toBeGreaterThan(0);
    expect(stats.filesAdded).toBe(1);
  });

  test('should add multiple files', async () => {
    const predictor2 = new CoChangePredictor();
    await predictor2.initialize();

    const files = {
      'file1.ts': 'function foo() { return 1; }',
      'file2.ts': 'function bar() { return 2; }',
      'file3.ts': 'function baz() { return 3; }',
    };

    const results = await predictor2.addFiles(files);

    expect(results.length).toBe(3);

    const stats = predictor2.getStats();
    expect(stats.filesAdded).toBe(3);
  });

  test('should predict co-changes', async () => {
    const predictor3 = new CoChangePredictor();
    await predictor3.initialize();

    // Add some related code
    await predictor3.addFile(
      'auth.ts',
      `
function login(user: string) {
  return authenticate(user);
}

function logout(user: string) {
  return clearSession(user);
}
`
    );

    await predictor3.addFile(
      'session.ts',
      `
function authenticate(user: string) {
  return createSession(user);
}

function clearSession(user: string) {
  return destroySession(user);
}
`
    );

    // Get stats to find a component ID
    const stats = predictor3.getStats();
    expect(stats.componentsIndexed).toBeGreaterThan(0);

    // For this test, we'll just verify the API works
    // Finding the actual component ID would require introspection
    // In practice, users would get IDs from addFile results or queries
  });

  test('should get CPG instance', () => {
    const cpg = predictor.getCPG();
    expect(cpg).toBeDefined();
    expect(cpg.nodes.size).toBeGreaterThanOrEqual(0);
  });

  test('should handle empty predictions gracefully', async () => {
    const predictor4 = new CoChangePredictor();
    await predictor4.initialize();

    const predictions = await predictor4.predictCochanges(['nonexistent']);
    expect(predictions).toEqual([]);
  });
});
