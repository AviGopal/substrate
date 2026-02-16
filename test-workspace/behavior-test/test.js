const { calculateTotal } = require('./sample');

// Test cases
const items = [
  { price: 10 },
  { price: 20 },
  { price: 30 }
];

const result = calculateTotal(items);
console.log('Result:', result);
console.log('Expected:', 60);
console.log('Test:', result === 60 ? 'PASS' : 'FAIL');
