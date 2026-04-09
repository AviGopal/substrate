import { add } from './src/calculator';

console.log('add(2, 3):', add(2, 3).value, '(expected: 5)');
console.log('add(-2, -3):', add(-2, -3).value, '(expected: -5)');
console.log('add(10, 3):', add(10, 3).value, '(expected: 13)');
console.log('add(5, 0):', add(5, 0).value, '(expected: 5)');