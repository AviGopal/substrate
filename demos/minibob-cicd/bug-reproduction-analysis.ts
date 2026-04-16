import { add } from './src/calculator';

// Reproduce the bug with simple test cases
console.log('Bug Reproduction: Calculator Add Function');
console.log('=====================================');

// Test case 1: add(2, 3) should be 5
const test1 = add(2, 3);
console.log(`add(2, 3):`);
console.log(`  Expected: 5`);
console.log(`  Received: ${test1.value}`);
console.log(`  Bug: ${test1.value !== 5 ? 'CONFIRMED' : 'NOT FOUND'}`);
console.log();

// Test case 2: add(-2, -3) should be -5
const test2 = add(-2, -3);
console.log(`add(-2, -3):`);
console.log(`  Expected: -5`);
console.log(`  Received: ${test2.value}`);
console.log(`  Bug: ${test2.value !== -5 ? 'CONFIRMED' : 'NOT FOUND'}`);
console.log();

// Test case 3: add(10, 3) should be 13, not 7
const test3 = add(10, 3);
console.log(`add(10, 3):`);
console.log(`  Expected: 13`);
console.log(`  Received: ${test3.value}`);
console.log(`  Bug: ${test3.value !== 13 ? 'CONFIRMED' : 'NOT FOUND'}`);
console.log();

// Show what's actually happening
console.log('Analysis:');
console.log('The add function is using subtraction (a - b) instead of addition (a + b)');
console.log('This explains why:');
console.log('- add(2, 3) = 2 - 3 = -1 (not 5)');
console.log('- add(-2, -3) = -2 - (-3) = -2 + 3 = 1 (not -5)');
console.log('- add(10, 3) = 10 - 3 = 7 (not 13)');