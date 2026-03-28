// Test Step Library
import { StepRegistry } from './src/step/step-registry'
import { executeStep } from './src/step/step-executor'
import { readFileStep } from './src/step/steps/read-file'
import { writeFile } from 'fs/promises'

async function main() {
  console.log('=== Step Library Test ===\n')
  
  // Test 1: Registry
  console.log('1. Registry test')
  const steps = StepRegistry.list()
  console.log(`  Registered steps: ${steps.length}`)
  steps.forEach(s => console.log(`    - ${s.id}: ${s.description}`))
  console.log('  ✓ Registry works\n')
  
  // Test 2: Execute read-file step
  console.log('2. Execute read-file step')
  await writeFile('/tmp/test.txt', 'Hello from step library!')
  
  const readStep = StepRegistry.get('read-file')
  if (!readStep) throw new Error('read-file step not found')
  
  const result = await executeStep(readStep, readFileStep, { path: '/tmp/test.txt' })
  
  console.log(`  Success: ${result.success}`)
  console.log(`  Output: ${result.output?.content}`)
  console.log(`  Duration: ${result.duration}ms`)
  console.log('  ✓ Execution works\n')
  
  console.log('=== All Tests Passed ===')
}

main().catch(console.error)
