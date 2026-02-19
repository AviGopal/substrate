#!/usr/bin/env -S npx tsx
/**
 * Test Activity System via ACP
 * 
 * This script proves the activity system works by:
 * 1. Connecting to devbob-clean container via ACP
 * 2. Requesting template creation
 * 3. Validating the template is stored
 * 4. Executing the created template
 * 5. Capturing all session data
 */

import { Client } from '@agentclientprotocol/sdk'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const CONTAINER_ACP_URL = 'http://localhost:3000'
const BACKEND_URL = 'http://localhost:8080'
const TEMPLATE_NAME = 'add-logging-statements'

interface TestResult {
  phase: string
  success: boolean
  details: any
  error?: string
}

const results: TestResult[] = []

async function log(message: string, level: 'info' | 'success' | 'error' = 'info') {
  const colors = {
    info: '\x1b[34m',    // Blue
    success: '\x1b[32m', // Green
    error: '\x1b[31m'    // Red
  }
  const reset = '\x1b[0m'
  console.log(`${colors[level]}${message}${reset}`)
}

async function fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}

async function testPhase1_CheckBackend() {
  await log('\n[Phase 1] Checking backend connectivity...', 'info')
  
  try {
    const templates = await fetchWithRetry(`${BACKEND_URL}/v2/activities/templates?limit=5`)
    
    results.push({
      phase: 'Phase 1: Backend Check',
      success: true,
      details: {
        templateCount: templates.length,
        backend: BACKEND_URL
      }
    })
    
    await log(`✓ Backend is accessible (${templates.length} templates stored)`, 'success')
    return templates.length
  } catch (error) {
    results.push({
      phase: 'Phase 1: Backend Check',
      success: false,
      details: {},
      error: String(error)
    })
    await log(`✗ Backend check failed: ${error}`, 'error')
    throw error
  }
}

async function testPhase2_CreateTemplate() {
  await log('\n[Phase 2] Creating activity template via ACP...', 'info')
  
  try {
    const client = new Client()
    await client.connect(CONTAINER_ACP_URL)
    
    await log('Connected to ACP server', 'info')
    
    const prompt = `Create an activity template called "${TEMPLATE_NAME}" using the create-activity-self-contained template.

Template specification:
- Name: ${TEMPLATE_NAME}
- Description: Add comprehensive logging statements to a function or module to improve debuggability
- Category: feature
- Tasks:
  1. Analyze target code to identify key decision points and data flows
  2. Add logging statements at entry points, decision branches, and error paths
  3. Run tests to ensure logging doesn't break functionality
  4. Commit changes with clear message
- Variables:
  - targetFile: Path to file to add logging to (required)
  - functionName: Name of function or module to instrument (optional)

Please execute this template creation now.`
    
    await log('Sending prompt to agent...', 'info')
    
    let response = ''
    let toolCalls: any[] = []
    
    const result = await client.sendPrompt(prompt, {
      onUpdate: (update) => {
        if (update.type === 'agent_message_chunk') {
          response += update.data.chunk
        } else if (update.type === 'tool_call') {
          toolCalls.push(update.data)
          console.log(`  Tool: ${update.data.tool}`)
        }
      }
    })
    
    await client.disconnect()
    
    results.push({
      phase: 'Phase 2: Template Creation',
      success: true,
      details: {
        response: response.substring(0, 500),
        toolCallCount: toolCalls.length,
        tools: toolCalls.map(t => t.tool)
      }
    })
    
    await log('✓ Template creation completed', 'success')
    await log(`  Response length: ${response.length} chars`, 'info')
    await log(`  Tool calls: ${toolCalls.length}`, 'info')
    
    return { response, toolCalls }
    
  } catch (error) {
    results.push({
      phase: 'Phase 2: Template Creation',
      success: false,
      details: {},
      error: String(error)
    })
    await log(`✗ Template creation failed: ${error}`, 'error')
    throw error
  }
}

async function testPhase3_VerifyStorage(initialCount: number) {
  await log('\n[Phase 3] Verifying template storage...', 'info')
  
  try {
    // Wait for backend to persist
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const templates = await fetchWithRetry(`${BACKEND_URL}/v2/activities/templates`)
    const newCount = templates.length
    
    // Find the new template
    const newTemplate = templates.find((t: any) => 
      t.name.toLowerCase().includes(TEMPLATE_NAME.toLowerCase())
    )
    
    if (!newTemplate) {
      throw new Error(`Template "${TEMPLATE_NAME}" not found in backend`)
    }
    
    if (newCount <= initialCount) {
      throw new Error(`Template count did not increase (${initialCount} → ${newCount})`)
    }
    
    results.push({
      phase: 'Phase 3: Verify Storage',
      success: true,
      details: {
        templateId: newTemplate.variant_id,
        templateName: newTemplate.name,
        category: newTemplate.category,
        taskCount: newTemplate.task_steps?.length || 0,
        countBefore: initialCount,
        countAfter: newCount
      }
    })
    
    await log(`✓ Template stored successfully`, 'success')
    await log(`  Template ID: ${newTemplate.variant_id}`, 'info')
    await log(`  Tasks: ${newTemplate.task_steps?.length || 0}`, 'info')
    await log(`  Count: ${initialCount} → ${newCount}`, 'info')
    
    return newTemplate
    
  } catch (error) {
    results.push({
      phase: 'Phase 3: Verify Storage',
      success: false,
      details: {},
      error: String(error)
    })
    await log(`✗ Storage verification failed: ${error}`, 'error')
    throw error
  }
}

async function testPhase4_ExecuteTemplate(templateId: string) {
  await log('\n[Phase 4] Executing created template...', 'info')
  
  try {
    const client = new Client()
    await client.connect(CONTAINER_ACP_URL)
    
    const prompt = `Create a test file at /workspace/test-target/sample.py with this content:

\`\`\`python
def calculate_total(items):
    total = 0
    for item in items:
        if item.get('active', False):
            total += item['price']
    return total
\`\`\`

Then use the "${templateId}" activity template to add comprehensive logging to the calculate_total function. The logging should show:
- Function entry with input parameters
- Loop iterations
- Conditional branches
- Return values`
    
    let response = ''
    let toolCalls: any[] = []
    
    const result = await client.sendPrompt(prompt, {
      onUpdate: (update) => {
        if (update.type === 'agent_message_chunk') {
          response += update.data.chunk
        } else if (update.type === 'tool_call') {
          toolCalls.push(update.data)
        }
      }
    })
    
    await client.disconnect()
    
    results.push({
      phase: 'Phase 4: Execute Template',
      success: true,
      details: {
        templateId,
        response: response.substring(0, 500),
        toolCallCount: toolCalls.length,
        tools: toolCalls.map(t => t.tool)
      }
    })
    
    await log('✓ Template execution completed', 'success')
    await log(`  Tool calls: ${toolCalls.length}`, 'info')
    
    return { response, toolCalls }
    
  } catch (error) {
    results.push({
      phase: 'Phase 4: Execute Template',
      success: false,
      details: {},
      error: String(error)
    })
    await log(`⚠ Template execution had issues: ${error}`, 'error')
    // Don't throw - execution issues are expected for new templates
    return { response: '', toolCalls: [] }
  }
}

async function generateReport() {
  await log('\n[Report] Generating test report...', 'info')
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const logDir = join(process.cwd(), 'proof-logs', timestamp)
  
  mkdirSync(logDir, { recursive: true })
  
  const reportPath = join(logDir, 'PROOF_REPORT.json')
  const summaryPath = join(logDir, 'PROOF_SUMMARY.md')
  
  const report = {
    timestamp: new Date().toISOString(),
    templateName: TEMPLATE_NAME,
    results,
    summary: {
      totalPhases: results.length,
      successfulPhases: results.filter(r => r.success).length,
      failedPhases: results.filter(r => !r.success).length
    }
  }
  
  writeFileSync(reportPath, JSON.stringify(report, null, 2))
  
  const success = results.every(r => r.success)
  const markdown = `# Activity System Proof Test

**Date:** ${new Date().toISOString()}  
**Template:** ${TEMPLATE_NAME}  
**Status:** ${success ? '✅ SUCCESS' : '⚠️ PARTIAL SUCCESS'}

## Results

${results.map(r => `
### ${r.phase}

**Status:** ${r.success ? '✅ Success' : '❌ Failed'}

${r.success ? `
**Details:**
\`\`\`json
${JSON.stringify(r.details, null, 2)}
\`\`\`
` : `
**Error:** ${r.error}
`}
`).join('\n')}

## Summary

- Total Phases: ${report.summary.totalPhases}
- Successful: ${report.summary.successfulPhases}
- Failed: ${report.summary.failedPhases}

## Conclusion

${success ? 
  '✅ The activity system is working end-to-end. Template creation, storage, and execution are all functional.' : 
  '⚠️ Some phases had issues. Review the error details above to diagnose problems.'}

## Files

- Full report: \`${reportPath}\`
- Summary: \`${summaryPath}\`
`
  
  writeFileSync(summaryPath, markdown)
  
  await log(`✓ Report generated: ${logDir}`, 'success')
  
  return { reportPath, summaryPath, success }
}

async function main() {
  console.log('='.repeat(80))
  console.log('Activity System Proof Test (ACP)')
  console.log('='.repeat(80))
  
  try {
    const initialCount = await testPhase1_CheckBackend()
    await testPhase2_CreateTemplate()
    const template = await testPhase3_VerifyStorage(initialCount)
    await testPhase4_ExecuteTemplate(template.variant_id)
    
    const { reportPath, summaryPath, success } = await generateReport()
    
    console.log('\n' + '='.repeat(80))
    if (success) {
      await log('✅ All phases completed successfully!', 'success')
    } else {
      await log('⚠️ Some phases had issues - check report for details', 'error')
    }
    console.log('='.repeat(80))
    console.log(`\nReport: ${reportPath}`)
    console.log(`Summary: ${summaryPath}`)
    
    process.exit(success ? 0 : 1)
    
  } catch (error) {
    await log(`\n✗ Test failed: ${error}`, 'error')
    await generateReport()
    process.exit(1)
  }
}

main()
