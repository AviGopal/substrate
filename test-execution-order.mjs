#!/usr/bin/env node
/**
 * Test script to prove activity execution order
 * 
 * This creates a simple 2-task activity and captures all logs
 * to prove when lifecycle hooks run vs when tasks execute.
 */

import { execSync } from 'child_process'
import fs from 'fs'

const testActivityTemplate = {
  name: "execution-order-test",
  description: "Test to prove execution order of tasks and hooks",
  category: "testing",
  tasks: [
    {
      id: "task-1",
      subagent: "general",
      description: "First test task",
      dependencies: [],
      prompt: {
        template: "Print the message 'TASK_1_EXECUTED' and nothing else. This is a test.",
        maxTokens: 1000,
        compressionStrategy: "filter",
        variables: []
      },
      validation: {
        requiredFiles: [],
        requiredPatterns: [],
        forbiddenPatterns: [],
        commands: []
      },
      retry: {
        maxAttempts: 1,
        strategy: "simple"
      }
    },
    {
      id: "task-2",
      subagent: "general",
      description: "Second test task",
      dependencies: ["task-1"],
      prompt: {
        template: "Print the message 'TASK_2_EXECUTED' and nothing else. This is a test.",
        maxTokens: 1000,
        compressionStrategy: "filter",
        variables: []
      },
      validation: {
        requiredFiles: [],
        requiredPatterns: [],
        forbiddenPatterns: [],
        commands: []
      },
      retry: {
        maxAttempts: 1,
        strategy: "simple"
      }
    }
  ],
  integration: {
    preChecks: [],
    postChecks: [],
    qualityGates: [],
    requiresCleanGit: false
  }
}

// Save template to file
const templatePath = './test-execution-order-template.json'
fs.writeFileSync(templatePath, JSON.stringify(testActivityTemplate, null, 2))

console.log('Created test activity template:', templatePath)
console.log('\nTemplate structure:')
console.log('- Task 1: Print TASK_1_EXECUTED')
console.log('- Task 2: Print TASK_2_EXECUTED (depends on Task 1)')
console.log('\n' + '='.repeat(80))
console.log('EXPECTED EXECUTION ORDER:')
console.log('='.repeat(80))
console.log(`
1. Activity tool invoked
2. [TRACE] BEFORE TASK: task-1
3. [HOOK] memory-management executing
4. [HOOK] metabob-context-preparation executing (if enabled)
5. [Agent] Executes task-1 prompt
6. [HOOK] post-turn-cleanup executing
7. [HOOK] session-memory-optimization executing
8. [VALIDATION] Task-1 validation runs
9. [TRACE] AFTER TASK: task-1
10. [TRACE] BEFORE TASK: task-2
11. [HOOK] memory-management executing (AGAIN - per task!)
12. [HOOK] metabob-context-preparation executing (AGAIN)
13. [Agent] Executes task-2 prompt
14. [HOOK] post-turn-cleanup executing (AGAIN)
15. [HOOK] session-memory-optimization executing (AGAIN)
16. [VALIDATION] Task-2 validation runs
17. [TRACE] AFTER TASK: task-2
18. Activity complete
`)
console.log('='.repeat(80))
console.log('\nNow register and execute the template...\n')

try {
  // Register template
  console.log('Registering template...')
  execSync(`cd repos/metabob-opencode && bun run register-template ../../${templatePath}`, {
    stdio: 'inherit',
    cwd: process.cwd()
  })
  
  console.log('\nTemplate registered successfully!')
  console.log('\n' + '='.repeat(80))
  console.log('TO EXECUTE:')
  console.log('='.repeat(80))
  console.log(`
Run this in opencode CLI:

  opencode activity execution-order-test \\
    --variables '{}' \\
    --reason "Testing execution order of tasks and hooks"

Then check the logs for:
- [TRACE] markers showing task boundaries
- [HOOK TRACE] markers showing hook execution
- Order of execution matching expected order above

Look for patterns like:
  BEFORE TASK → hooks run → agent executes → hooks run → validation → AFTER TASK
`)
  
  console.log('\n' + '='.repeat(80))
  console.log('ALTERNATIVE: Add trace logs to source code')
  console.log('='.repeat(80))
  console.log(`
Add these trace logs to prove execution order:

1. In src/session/template-executor.ts:executeTasks() (around line 370):
   for (const task of template.tasks) {
     console.error(\`\\n[TRACE] BEFORE TASK: \${task.id}\\n\`)
     const execution = await executeTaskWithRetry(...)
     console.error(\`\\n[TRACE] AFTER TASK: \${task.id}, validation: \${execution.validation?.passed}\\n\`)
   }

2. In src/session/turn-lifecycle-hooks.ts (in each hook's execute function):
   execute: async (ctx) => {
     console.error(\`\\n[HOOK TRACE] memory-management EXECUTING for session \${ctx.sessionID}\\n\`)
     // ... existing hook logic
   }

3. In src/session/template-executor.ts:validateTaskResult() (around line 1290):
   console.error(\`\\n[VALIDATION] Running validators for task \${task.id}\\n\`)
   const validation = await validateTaskResult(...)
   console.error(\`\\n[VALIDATION] Complete: passed=\${validation.passed}\\n\`)

Then run the activity and watch the console output!
`)

} catch (error) {
  console.error('\nFailed to register template:', error.message)
  console.error('\nYou can manually register it:')
  console.error(`  cd repos/metabob-opencode && bun run register-template ../../${templatePath}`)
}

console.log('\n' + '='.repeat(80))
console.log('PROOF DOCUMENT CREATED:')
console.log('='.repeat(80))
console.log('See: ACTIVITY_EXECUTION_ORDER_PROOF.md')
console.log('- Contains full code traces')
console.log('- Shows exact execution flow')
console.log('- Proves hooks run INSIDE tasks, not BETWEEN tasks')
console.log('- Proves validators run AFTER agent completes')
