import { ImpulseRef, ResolvedImpulse, resolveImpulse } from './src/impulse/index.js';

// Test the ImpulseRef interface
const testImpulse: ImpulseRef = {
  id: 'test-memo',
  type: 'memo',
  content: 'This is a test memo',
  priority: 'medium',
  budget: 100
};

console.log('ImpulseRef interface created successfully:', testImpulse);

// Test the resolveImpulse function
resolveImpulse(testImpulse)
  .then((result: ResolvedImpulse) => {
    console.log('resolveImpulse function works:', result);
  })
  .catch((error) => {
    console.error('Error resolving impulse:', error);
  });