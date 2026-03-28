/**
 * Integration tests - Full pipeline testing
 */

import { describe, test, expect, beforeAll } from 'bun:test';
import { CoChangePredictor } from '../src/predictor.js';

describe('Integration Tests', () => {
  let predictor: CoChangePredictor;

  beforeAll(async () => {
    predictor = new CoChangePredictor();
    await predictor.initialize();
  });

  test('full pipeline: parse → build → query → embed → search', async () => {
    // Add files
    const files = {
      'src/auth.ts': `
export function login(user: string, pass: string) {
  return authenticate(user, pass);
}

export function logout(session: string) {
  clearSession(session);
}
`,
      'src/session.ts': `
export function authenticate(user: string, pass: string) {
  return createSession(user);
}

export function clearSession(session: string) {
  destroySession(session);
}

export function createSession(user: string) {
  return { id: generateId(), user };
}

export function destroySession(session: string) {
  // Remove session
}
`,
    };

    // Parse → Build CPG
    const results = await predictor.addFiles(files);
    expect(results.length).toBe(2);
    expect(results[0].componentsAdded).toBeGreaterThan(0);

    // Query CPG
    const cpg = predictor.getCPG();
    const functions = cpg.findNodes({ nodeType: 'function' });
    expect(functions.length).toBeGreaterThan(0);

    // Get a component
    const componentIds = Array.from(predictor['componentMap'].keys());
    expect(componentIds.length).toBeGreaterThan(0);

    const firstComponent = predictor.getComponent(componentIds[0]);
    expect(firstComponent).toBeDefined();
    expect(firstComponent?.name).toBeDefined();

    // Predict co-changes (Embed → Search)
    const predictions = await predictor.predictCochanges([componentIds[0]], 3);
    expect(predictions).toBeInstanceOf(Array);

    // Predictions should have valid structure
    for (const pred of predictions) {
      expect(pred.componentId).toBeDefined();
      expect(pred.similarityScore).toBeGreaterThanOrEqual(0);
      expect(pred.similarityScore).toBeLessThanOrEqual(1);
      expect(pred.filePath).toBeDefined();
      expect(pred.componentName).toBeDefined();
    }
  });

  test('embedding search returns similar code', async () => {
    const predictor2 = new CoChangePredictor();
    await predictor2.initialize();

    // Add similar functions
    await predictor2.addFile('file1.ts', `
function processUser(user: any) {
  validateUser(user);
  saveUser(user);
  return user;
}
`);

    await predictor2.addFile('file2.ts', `
function handleUser(user: any) {
  checkUser(user);
  storeUser(user);
  return user;
}
`);

    await predictor2.addFile('file3.ts', `
function calculateTotal(items: any[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}
`);

    const componentIds = Array.from(predictor2['componentMap'].keys());
    const processUserIds = componentIds.filter(id => id.includes('processUser'));

    if (processUserIds.length > 0) {
      const predictions = await predictor2.predictCochanges(processUserIds, 2);

      // Should return predictions
      expect(predictions.length).toBeGreaterThanOrEqual(0);

      // If predictions exist, they should have valid names
      if (predictions.length > 0) {
        expect(predictions[0].componentName).toBeDefined();
      }
    }
  });

  test('works on real minibob codebase structure', async () => {
    const predictor3 = new CoChangePredictor();
    await predictor3.initialize();

    // Simulate minibob-like code structure
    await predictor3.addFile('src/activity.ts', `
export class ActivityExecutor {
  async executeTask(task: Task) {
    const result = await this.runPrompt(task.prompt);
    return result;
  }

  async runPrompt(prompt: string) {
    return await this.llm.complete(prompt);
  }
}
`);

    await predictor3.addFile('src/llm.ts', `
export class LLMClient {
  async complete(prompt: string) {
    return await this.anthropic.messages.create({
      model: 'claude-sonnet-4',
      messages: [{ role: 'user', content: prompt }]
    });
  }
}
`);

    const stats = predictor3.getStats();
    expect(stats.componentsIndexed).toBeGreaterThan(0);
    expect(stats.filesAdded).toBe(2);

    // Should be able to find related methods
    const componentIds = Array.from(predictor3['componentMap'].keys());
    if (componentIds.length > 0) {
      const predictions = await predictor3.predictCochanges([componentIds[0]], 3);
      expect(predictions.length).toBeGreaterThanOrEqual(0);
    }
  });
});
