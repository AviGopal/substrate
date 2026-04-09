#!/usr/bin/env bun

// Minimal reproduction of the calculator add bug
import { add } from './src/calculator';

console.log('=== Bug Reproduction ===');
console.log('Testing add function implementation...\n');

// Test case 1: Positive numbers
const result1 = add(2, 3);
console.log('add(2, 3):');
console.log('Expected: { value: 5, operation: "add", inputs: [2, 3] }');
console.log('Actual:  ', result1);
console.log('BUG:', result1.value === 5 ? '❌ FIXED' : '✅ REPRODUCED');
console.log();

// Test case 2: Negative numbers
const result2 = add(-2, -3);
console.log('add(-2, -3):');
console.log('Expected: { value: -5, operation: "add", inputs: [-2, -3] }');
console.log('Actual:  ', result2);
console.log('BUG:', result2.value === -5 ? '❌ FIXED' : '✅ REPRODUCED');
console.log();

// Test case 3: Zero (this one passes)
const result3 = add(5, 0);
console.log('add(5, 0):');
console.log('Expected: { value: 5, operation: "add", inputs: [5, 0] }');
console.log('Actual:  ', result3);
console.log('RESULT:', result3.value === 5 ? '✅ PASSES' : '❌ FAILS');