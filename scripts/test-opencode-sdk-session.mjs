#!/usr/bin/env node
/**
 * Test OpenCode session tracking via SDK (bypasses CLI run command bug)
 * This directly tests the SessionPrompt.prompt() flow
 */

import { SessionPrompt } from '../repos/metabob-opencode/packages/opencode/dist/session/prompt.js'
import { Session } from '../repos/metabob-opencode/packages/opencode/dist/session/session.js'
import { Agent } from '../repos/metabob-opencode/packages/opencode/dist/agent/agent.js'
import { v4 as uuidv4 } from 'uuid'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function checkRedisSession(sessionId) {
  try {
    const { stdout } = await execAsync(
      `docker exec metabob-redis redis-cli GET "agent_execution:session:${sessionId}"`
    )
    if (stdout.trim() && stdout.trim() !== '(nil)') {
      return JSON.parse(stdout)
    }
    return null
  } catch (error) {
    console.error('Redis check failed:', error.message)
    return null
  }
}

async function countRedisSessions() {
  try {
    const { stdout } = await execAsync(
      'docker exec metabob-redis redis-cli KEYS "agent_execution:session:*"'
    )
    return stdout.trim().split('\n').filter(line => line.length > 0).length
  } catch (error) {
    console.error('Redis count failed:', error.message)
    return 0
  }
}

async function main() {
  console.log('======================================================================')
  console.log('OpenCode SDK Session Tracking Test')
  console.log('======================================================================')
  console.log('')

  // Check Redis before
  console.log('Checking Redis state before test...')
  const sessionsBefore = await countRedisSessions()
  console.log(`  Sessions before: ${sessionsBefore}`)
  console.log('')

  // Create a test session
  const sessionId = `sdk-test-${Date.now()}`
  console.log(`Creating test session: ${sessionId}`)
  console.log('')

  try {
    // Initialize session (creates session in DB)
    console.log('Initializing session...')
    await Session.touch(sessionId)
    console.log('✅ Session initialized')
    console.log('')

    // Send first message (should trigger session tracking)
    console.log('Sending first message to trigger session tracking...')
    const promptInput = {
      sessionID: sessionId,
      agent: 'activity',
      promptText: 'Read test_tracking.py and explain what it does',
      noReply: false, // We want AI to respond
    }

    console.log('  Calling SessionPrompt.prompt()...')
    console.log(`  Session ID: ${sessionId}`)
    console.log(`  Prompt: "${promptInput.promptText}"`)
    console.log('')

    // This should trigger our first-message detection and call AgentExecutionTracker
    const result = await SessionPrompt.prompt(promptInput)
    
    console.log('✅ SessionPrompt.prompt() completed')
    console.log('')

    // Wait for async tracking operations
    console.log('Waiting 2 seconds for async operations...')
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('')

    // Check Redis after
    console.log('======================================================================')
    console.log('Checking Results')
    console.log('======================================================================')
    console.log('')

    const sessionsAfter = await countRedisSessions()
    console.log(`Sessions after: ${sessionsAfter}`)
    console.log(`New sessions: ${sessionsAfter - sessionsBefore}`)
    console.log('')

    if (sessionsAfter > sessionsBefore) {
      console.log('✅ SUCCESS: Session tracking detected!')
      console.log('')
      
      const sessionData = await checkRedisSession(sessionId)
      if (sessionData) {
        console.log('Session data:')
        console.log('-------------')
        console.log(JSON.stringify(sessionData, null, 2))
      } else {
        console.log('⚠️  Session created but not found in Redis (might have different ID)')
        
        // List all sessions
        const { stdout } = await execAsync(
          'docker exec metabob-redis redis-cli KEYS "agent_execution:session:*"'
        )
        console.log('')
        console.log('All sessions:')
        console.log(stdout)
      }
    } else {
      console.log('❌ FAILURE: No new session tracking detected')
      console.log('')
      console.log('This means:')
      console.log('1. First message detection did not trigger')
      console.log('2. MCP tool call failed')
      console.log('3. Backend API call failed')
      console.log('')
      console.log('Check the console output above for debug logs:')
      console.log('  - [DEBUG] Session tracking check...')
      console.log('  - [DEBUG] Starting agent execution tracking...')
      console.log('  - [DEBUG] Agent execution tracking startSession() completed')
    }

  } catch (error) {
    console.error('')
    console.error('❌ Test failed with error:')
    console.error(error)
    console.error('')
    console.error('Stack trace:')
    console.error(error.stack)
  }

  console.log('')
  console.log('======================================================================')
  console.log('Test Complete')
  console.log('======================================================================')
}

main().catch(console.error)
