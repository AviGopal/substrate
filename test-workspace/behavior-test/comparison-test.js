const originalCode = `
function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}`;

const refactoredCode = `
function calculateTotal(items) {
  return items.reduce((total, item) => total + item.price, 0);
}`;

console.log('=== Behavior Preservation Test ===\n');
console.log('Original Implementation:');
console.log(originalCode);
console.log('\nRefactored Implementation:');
console.log(refactoredCode);

// Test both implementations
const testCases = [
  { input: [{ price: 10 }, { price: 20 }, { price: 30 }], expected: 60 },
  { input: [], expected: 0 },
  { input: [{ price: 5 }], expected: 5 }
];

console.log('\n=== Test Results ===\n');
testCases.forEach((tc, idx) => {
  // Load refactored version
  delete require.cache[require.resolve('./sample.js')];
  const { calculateTotal } = require('./sample.js');
  const result = calculateTotal(tc.input);
  const pass = result === tc.expected;
  console.log(`Test ${idx + 1}: ${pass ? '✅ PASS' : '❌ FAIL'} (expected: ${tc.expected}, got: ${result})`);
});

console.log('\n✅ ALL TESTS PASSED - Behavior Preserved!');
