/**
 * Validation Harness: metrics-calculation-in-rpc-api-only
 * 
 * Validates that metrics calculation logic has been removed from opencode client
 * and moved to rpc-api backend, enforcing architectural boundaries.
 * 
 * Validation Strategy:
 * 1. Search for calculation operators (/, *, Math.) in template-metrics-client.ts
 * 2. Verify no success_rate calculations (alpha / (alpha + beta))
 * 3. Verify template-quality-score.ts is deprecated stub
 * 4. Verify MetabobCLI.completeActivityExecution is deprecated
 * 5. Verify reportExecution() has no dual-write pattern
 * 
 * Expected Outcomes:
 * - template-metrics-client.ts contains ONLY HTTP client code
 * - No division operators for calculations (only for null-checks like result?.data)
 * - No Math.* function calls
 * - template-quality-score.ts is <100 lines (stub)
 * - No dual-write pattern (Promise.allSettled with multiple write paths)
 */

import * as fs from 'fs'
import * as path from 'path'

interface ValidationCase {
  name: string
  description: string
  check: () => Promise<ValidationResult>
}

interface ValidationResult {
  pass: boolean
  actual: any
  expected: any
  message: string
}

interface HarnessResult {
  specificationName: string
  overallPass: boolean
  cases: Array<{
    name: string
    pass: boolean
    actual: any
    expected: any
    message: string
  }>
  summary: {
    total: number
    passed: number
    failed: number
  }
}

export async function runValidation(): Promise<HarnessResult> {
  const cases: ValidationCase[] = [
    {
      name: "no-calculation-operators",
      description: "Verify template-metrics-client.ts has no calculation operators",
      check: async () => {
        const filePath = path.join(__dirname, '../../repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts')
        const content = fs.readFileSync(filePath, 'utf-8')
        
        // Search for calculation patterns
        // Allowed: result?.data, result?.error (optional chaining)
        // Not allowed: alpha / beta, cost * rate, Math.sqrt, etc.
        
        const lines = content.split('\n')
        const violatingLines: Array<{line: number, content: string, reason: string}> = []
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const lineNum = i + 1
          
          // Skip comments
          if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
            continue
          }
          
          // Check for division operator (not part of // comment, ?., or path string)
          if (line.includes('/') && !line.includes('//') && !line.includes('?.') && !line.includes('import') && !line.includes('"') && !line.includes("'")) {
            // Check if it's a calculation (not a comment, optional chaining, or path)
            const divisionContext = line.match(/(\w+)\s*\/\s*(\w+)/)
            if (divisionContext && !line.includes('v2') && !line.includes('API')) {
              violatingLines.push({
                line: lineNum,
                content: line.trim(),
                reason: `Division operator found: ${divisionContext[0]}`
              })
            }
          }
          
          // Check for multiplication operator
          if (line.includes('*') && !line.includes('/*') && !line.includes('*/') && !line.includes('*:')) {
            const multiplyContext = line.match(/(\w+)\s*\*\s*(\w+)/)
            if (multiplyContext) {
              violatingLines.push({
                line: lineNum,
                content: line.trim(),
                reason: `Multiplication operator found: ${multiplyContext[0]}`
              })
            }
          }
          
          // Check for Math.* functions
          if (line.includes('Math.')) {
            violatingLines.push({
              line: lineNum,
              content: line.trim(),
              reason: 'Math function call found'
            })
          }
          
          // Check for success_rate calculation pattern
          if (line.includes('alpha') && line.includes('beta') && line.includes('/')) {
            violatingLines.push({
              line: lineNum,
              content: line.trim(),
              reason: 'Thompson Sampling calculation pattern found (alpha/beta)'
            })
          }
        }
        
        return {
          pass: violatingLines.length === 0,
          actual: violatingLines,
          expected: [],
          message: violatingLines.length === 0 
            ? 'No calculation operators found (correct)'
            : `Found ${violatingLines.length} calculation operators (violates architectural boundary)`
        }
      }
    },
    {
      name: "no-dual-write-pattern",
      description: "Verify reportExecution() has no dual-write pattern",
      check: async () => {
        const filePath = path.join(__dirname, '../../repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts')
        const content = fs.readFileSync(filePath, 'utf-8')
        
        // Check for dual-write indicators
        const hasDualWrite = content.includes('Promise.allSettled') || 
                            content.includes('MetabobCLI.completeActivityExecution') ||
                            content.includes('redisPromise') ||
                            content.includes('mcpPromise')
        
        const hasParallelWrites = content.match(/const\s+\[\w+,\s*\w+\]\s*=\s*await\s+Promise\.allSettled/)
        
        return {
          pass: !hasDualWrite && !hasParallelWrites,
          actual: { 
            hasDualWrite, 
            hasParallelWrites: !!hasParallelWrites,
            pattern: hasParallelWrites ? hasParallelWrites[0] : null
          },
          expected: { hasDualWrite: false, hasParallelWrites: false },
          message: !hasDualWrite && !hasParallelWrites
            ? 'No dual-write pattern found (correct - single write path)'
            : 'Dual-write pattern detected (violates architectural boundary)'
        }
      }
    },
    {
      name: "quality-score-deprecated",
      description: "Verify template-quality-score.ts is deprecated stub (<100 lines)",
      check: async () => {
        const filePath = path.join(__dirname, '../../repos/metabob-opencode/packages/opencode/src/session/template-quality-score.ts')
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        const lineCount = lines.length
        
        // Check for deprecation markers
        const isDeprecated = content.includes('@deprecated') || content.includes('REMOVED')
        
        // Check for calculation functions (should NOT exist - only stub throwing error)
        const hasCalculationFunctions = content.includes('calculateSuccessScore(') ||
                               content.includes('calculateCostScore(') ||
                               content.includes('calculateDurationScore(') ||
                               content.includes('calculateQualityScore(')
        
        // Check if it's a stub that throws (correct)
        const throwsError = content.includes('throw new Error')
        
        const hasCalculations = hasCalculationFunctions && !throwsError
        
        const isStub = lineCount < 100 && isDeprecated && !hasCalculations
        
        return {
          pass: isStub,
          actual: { lineCount, isDeprecated, hasCalculations },
          expected: { lineCount: '<100', isDeprecated: true, hasCalculations: false },
          message: isStub
            ? `Quality score file is deprecated stub (${lineCount} lines)`
            : `Quality score file violates architectural boundary (${lineCount} lines, deprecated: ${isDeprecated}, hasCalculations: ${hasCalculations})`
        }
      }
    },
    {
      name: "reportExecution-single-write",
      description: "Verify reportExecution() uses single write path",
      check: async () => {
        const filePath = path.join(__dirname, '../../repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts')
        const content = fs.readFileSync(filePath, 'utf-8')
        
        // Find reportExecution function start
        const funcStart = content.indexOf('export async function reportExecution')
        if (funcStart === -1) {
          return {
            pass: false,
            actual: 'Function not found',
            expected: 'Function exists with single write path',
            message: 'reportExecution function not found'
          }
        }
        
        // Find the JSDoc before it (search backwards for /**)
        let jsdocStart = funcStart
        while (jsdocStart > 0 && content.substring(jsdocStart - 3, jsdocStart) !== '/**') {
          jsdocStart--
        }
        jsdocStart -= 3 // Include the /**
        
        // Find the closing brace (match closing brace at proper nesting level)
        let braceCount = 0
        let inFunction = false
        let funcEnd = funcStart
        
        for (let i = funcStart; i < content.length; i++) {
          if (content[i] === '{') {
            braceCount++
            inFunction = true
          } else if (content[i] === '}') {
            braceCount--
            if (inFunction && braceCount === 0) {
              funcEnd = i + 1
              break
            }
          }
        }
        
        const functionBody = content.substring(jsdocStart, funcEnd)
        
        // Count MCP tool calls (should be exactly 1)
        const mcpCalls = (functionBody.match(/callMCPTool</g) || []).length
        
        // Check for single write path documentation
        const hasSingleWriteDoc = functionBody.includes('single write path') || functionBody.includes('Single write path')
        
        // Check it mentions architectural boundary (case-insensitive)
        const mentionsArchitecture = /architectural\s+boundary/i.test(functionBody)
        
        const isSingleWrite = mcpCalls === 1 && hasSingleWriteDoc && mentionsArchitecture
        
        return {
          pass: isSingleWrite,
          actual: { mcpCalls, hasSingleWriteDoc, mentionsArchitecture },
          expected: { mcpCalls: 1, hasSingleWriteDoc: true, mentionsArchitecture: true },
          message: isSingleWrite
            ? 'reportExecution uses single write path (correct)'
            : `reportExecution may violate architectural boundary (mcpCalls: ${mcpCalls}, docs: ${hasSingleWriteDoc})`
        }
      }
    },
    {
      name: "file-size-check",
      description: "Verify template-metrics-client.ts is reasonable size for HTTP client",
      check: async () => {
        const filePath = path.join(__dirname, '../../repos/metabob-opencode/packages/opencode/src/session/template-metrics-client.ts')
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.split('\n')
        const lineCount = lines.length
        
        // Thin HTTP client should be <400 lines (includes multiple methods: reportExecution, getMetrics, promoteTemplate, etc.)
        // Previous version was ~350 lines with dual-write, so <400 is reasonable for cleaned version
        const isReasonableSize = lineCount < 400
        
        return {
          pass: isReasonableSize,
          actual: lineCount,
          expected: '<400 lines',
          message: isReasonableSize
            ? `File size is reasonable for HTTP client (${lineCount} lines)`
            : `File may contain calculation logic (${lineCount} lines, expected <400)`
        }
      }
    }
  ]
  
  const results: HarnessResult = {
    specificationName: 'metrics-calculation-in-rpc-api-only',
    overallPass: true,
    cases: [],
    summary: {
      total: cases.length,
      passed: 0,
      failed: 0
    }
  }
  
  for (const testCase of cases) {
    const result = await testCase.check()
    results.cases.push({
      name: testCase.name,
      pass: result.pass,
      actual: result.actual,
      expected: result.expected,
      message: result.message
    })
    
    if (result.pass) {
      results.summary.passed++
    } else {
      results.summary.failed++
      results.overallPass = false
    }
  }
  
  return results
}

// CLI execution
if (require.main === module) {
  runValidation().then(results => {
    console.log('\n=== Validation Harness: metrics-calculation-in-rpc-api-only ===\n')
    
    results.cases.forEach(testCase => {
      const status = testCase.pass ? '✓ PASS' : '✗ FAIL'
      console.log(`${status}: ${testCase.name}`)
      console.log(`  Message: ${testCase.message}`)
      if (!testCase.pass) {
        console.log(`  Expected: ${JSON.stringify(testCase.expected)}`)
        console.log(`  Actual: ${JSON.stringify(testCase.actual)}`)
      }
      console.log('')
    })
    
    console.log(`\nSummary: ${results.summary.passed}/${results.summary.total} tests passed`)
    console.log(`Overall: ${results.overallPass ? 'PASS' : 'FAIL'}\n`)
    
    process.exit(results.overallPass ? 0 : 1)
  }).catch(error => {
    console.error('Validation harness error:', error)
    process.exit(1)
  })
}
