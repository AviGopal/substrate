/**
 * Basic usage example for cpg-inference-ts
 *
 * Run with: bun run examples/basic-usage.ts
 */

import { CoChangePredictor } from '../src/index.js';

async function main() {
  console.log('Initializing CPG predictor...');

  // Create predictor instance
  const predictor = new CoChangePredictor({
    topK: 5,
    minSimilarity: 0.3,
  });

  // Initialize (loads ONNX model)
  await predictor.initialize();
  console.log('✓ Model loaded\n');

  // Add some sample files
  console.log('Adding files...');

  await predictor.addFile('auth.ts', `
export function login(username: string, password: string) {
  const session = authenticate(username, password);
  if (session) {
    trackLogin(username);
    return session;
  }
  return null;
}

export function logout(sessionId: string) {
  destroySession(sessionId);
  trackLogout(sessionId);
}
`);

  await predictor.addFile('session.ts', `
export function authenticate(username: string, password: string) {
  // Verify credentials
  const user = findUser(username);
  if (user && verifyPassword(user, password)) {
    return createSession(user);
  }
  return null;
}

export function createSession(user: any) {
  const sessionId = generateSessionId();
  storeSession(sessionId, user);
  return { sessionId, user };
}

export function destroySession(sessionId: string) {
  removeSession(sessionId);
}
`);

  await predictor.addFile('analytics.ts', `
export function trackLogin(username: string) {
  sendEvent('login', { username, timestamp: Date.now() });
}

export function trackLogout(sessionId: string) {
  sendEvent('logout', { sessionId, timestamp: Date.now() });
}

export function sendEvent(eventType: string, data: any) {
  console.log('Event:', eventType, data);
}
`);

  console.log('✓ Files added\n');

  // Get stats
  const stats = predictor.getStats();
  console.log('Statistics:');
  console.log(`  Components indexed: ${stats.componentsIndexed}`);
  console.log(`  Files added: ${stats.filesAdded}`);
  console.log(`  Embedding dimension: ${stats.embeddingDim}\n`);

  // Example: Find all components
  const cpg = predictor.getCPG();
  console.log('All indexed components:');
  let componentIds: string[] = [];
  for (const [id, node] of cpg.nodes) {
    if (node.type === 'function') {
      console.log(`  ${id}`);
      componentIds.push(id);
    }
  }

  // Predict co-changes for login function
  if (componentIds.length > 0) {
    // Find a login-related component from the component map
    const loginComponentId = Array.from(predictor.getStats().componentsIndexed > 0 ?
      [...predictor['componentMap'].keys()].find(id => id.includes('login')) || '' : '');

    // Just use the first indexed component for demo
    const firstComponentId = [...predictor['componentMap'].keys()][0];

    if (firstComponentId) {
      console.log(`\nPredicting co-changes for: ${firstComponentId}`);

      const predictions = await predictor.predictCochanges([firstComponentId], 5);

      console.log(`\nFound ${predictions.length} related components:`);
      for (const pred of predictions) {
        console.log(`  ${pred.similarityScore.toFixed(3)} - ${pred.componentName} (${pred.filePath}:${pred.startLine})`);
      }
    }
  }
}

main().catch(console.error);
