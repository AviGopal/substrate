import { runAllValidations, TEST_CASES } from './context-window-utilization-data-flow-harness'

const results = runAllValidations(TEST_CASES)

console.log(JSON.stringify({
  totalTests: results.totalTests,
  passed: results.passed,
  failed: results.failed,
  results: results.results.map(r => ({
    testCase: r.testCase,
    pass: r.pass,
    actual: r.actual,
    expected: r.expected,
    errors: r.errors
  }))
}, null, 2))
