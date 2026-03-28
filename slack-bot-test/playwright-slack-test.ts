#!/usr/bin/env tsx
/**
 * Playwright E2E Test for Slack Bot
 * 
 * Tests the complete flow:
 * 1. Navigate to Slack with Firefox profile (mahnarc.slack.com)
 * 2. Find/create DM with OpenCode bot
 * 3. Send messages and verify responses
 * 4. Test activity monitoring
 * 5. Test slash commands
 */

import { chromium, firefox, type Browser, type Page } from 'playwright'

const SLACK_WORKSPACE = 'https://mahnarc.slack.com'
const FIREFOX_PROFILE = '/home/avi/.mozilla/firefox/qcd6s4a4.default-release'
const BOT_NAME = 'OpenCode Bot' // Update with your actual bot name
const TEST_TIMEOUT = 120000 // 2 minutes

interface TestResult {
  test: string
  passed: boolean
  duration: number
  error?: string
}

class SlackBotTester {
  private browser?: Browser
  private page?: Page
  private results: TestResult[] = []

  async setup() {
    console.log('🚀 Setting up Playwright test environment...\n')

    try {
      // Launch Firefox with user profile
      this.browser = await firefox.launch({
        headless: false,
        args: [`--profile`, FIREFOX_PROFILE],
      })

      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
      })

      this.page = await context.newPage()
      console.log('✅ Browser launched with Firefox profile\n')
    } catch (error) {
      console.error('❌ Failed to launch browser:', error)
      throw error
    }
  }

  async navigateToSlack() {
    const start = Date.now()
    try {
      console.log(`📍 Navigating to ${SLACK_WORKSPACE}...`)
      await this.page!.goto(SLACK_WORKSPACE, { waitUntil: 'networkidle', timeout: 30000 })
      await this.page!.waitForTimeout(3000)

      const duration = Date.now() - start
      this.results.push({ test: 'Navigate to Slack', passed: true, duration })
      console.log(`✅ Loaded Slack (${duration}ms)\n`)
    } catch (error) {
      const duration = Date.now() - start
      this.results.push({ test: 'Navigate to Slack', passed: false, duration, error: String(error) })
      throw error
    }
  }

  async findBot() {
    const start = Date.now()
    try {
      console.log(`🔍 Looking for bot: ${BOT_NAME}...`)

      // Try to find the bot in DMs or search
      // Option 1: Click on "Direct messages" section
      const dmButton = this.page!.locator('[data-qa="desktop-sidebar-channels-header"]')
      if (await dmButton.isVisible()) {
        await dmButton.click()
      }

      // Option 2: Use search (Cmd+K or Ctrl+K)
      await this.page!.keyboard.press('Control+K')
      await this.page!.waitForTimeout(1000)

      // Type bot name
      await this.page!.keyboard.type(BOT_NAME)
      await this.page!.waitForTimeout(2000)

      // Click on the bot result
      const botResult = this.page!.locator(`[aria-label*="${BOT_NAME}"]`).first()
      await botResult.click({ timeout: 10000 })

      const duration = Date.now() - start
      this.results.push({ test: 'Find bot', passed: true, duration })
      console.log(`✅ Found and opened bot DM (${duration}ms)\n`)
    } catch (error) {
      const duration = Date.now() - start
      this.results.push({ test: 'Find bot', passed: false, duration, error: String(error) })
      console.log(`⚠️  Could not find bot automatically. Please manually navigate to bot DM.\n`)
      await this.page!.waitForTimeout(10000) // Give user time to manually navigate
    }
  }

  async sendMessage(message: string, expectedResponse?: string) {
    const start = Date.now()
    try {
      console.log(`💬 Sending message: "${message}"`)

      // Find message input
      const messageInput = this.page!.locator('[data-qa="message_input"]')
      await messageInput.fill(message)
      await messageInput.press('Enter')
      await this.page!.waitForTimeout(2000)

      // Wait for response
      if (expectedResponse) {
        console.log(`   Waiting for response containing: "${expectedResponse}"`)
        const responseLocator = this.page!.locator(`text=${expectedResponse}`)
        await responseLocator.waitFor({ timeout: 30000 })
      }

      const duration = Date.now() - start
      this.results.push({ test: `Send message: ${message}`, passed: true, duration })
      console.log(`✅ Message sent and response received (${duration}ms)\n`)
      return true
    } catch (error) {
      const duration = Date.now() - start
      this.results.push({ test: `Send message: ${message}`, passed: false, duration, error: String(error) })
      console.error(`❌ Failed to send/receive message (${duration}ms)\n`)
      return false
    }
  }

  async testActivityMonitoring() {
    const start = Date.now()
    try {
      console.log('🎯 Testing activity monitoring...')

      // Send a message that triggers an activity
      await this.sendMessage('List all TypeScript files in the current directory')

      // Look for activity start notification
      console.log('   Looking for activity notification...')
      const activityNotification = this.page!.locator('text=/🚀.*Activity Started/i')
      await activityNotification.waitFor({ timeout: 30000 })

      // Look for tool execution updates
      console.log('   Looking for tool updates...')
      await this.page!.waitForTimeout(5000)

      // Look for progress updates (optional)
      const progressUpdate = this.page!.locator('text=/⏳.*Activity Progress/i')
      const hasProgress = await progressUpdate.isVisible().catch(() => false)
      if (hasProgress) {
        console.log('   ✓ Progress update detected')
      }

      // Wait for completion
      console.log('   Waiting for activity completion...')
      const completionNotification = this.page!.locator('text=/✅.*Activity Completed/i')
      await completionNotification.waitFor({ timeout: 60000 })

      const duration = Date.now() - start
      this.results.push({ test: 'Activity monitoring', passed: true, duration })
      console.log(`✅ Activity monitoring verified (${duration}ms)\n`)
      return true
    } catch (error) {
      const duration = Date.now() - start
      this.results.push({ test: 'Activity monitoring', passed: false, duration, error: String(error) })
      console.error(`❌ Activity monitoring test failed (${duration}ms)\n`)
      return false
    }
  }

  async testSlashCommand(command: string, expectedText: string) {
    const start = Date.now()
    try {
      console.log(`⚡ Testing slash command: ${command}`)

      // Send slash command
      const messageInput = this.page!.locator('[data-qa="message_input"]')
      await messageInput.fill(command)
      await this.page!.waitForTimeout(1000)
      await messageInput.press('Enter')
      await this.page!.waitForTimeout(3000)

      // Wait for response
      const responseLocator = this.page!.locator(`text=${expectedText}`)
      await responseLocator.waitFor({ timeout: 15000 })

      const duration = Date.now() - start
      this.results.push({ test: `Slash command: ${command}`, passed: true, duration })
      console.log(`✅ Command verified (${duration}ms)\n`)
      return true
    } catch (error) {
      const duration = Date.now() - start
      this.results.push({ test: `Slash command: ${command}`, passed: false, duration, error: String(error) })
      console.error(`❌ Slash command test failed (${duration}ms)\n`)
      return false
    }
  }

  async takeScreenshot(name: string) {
    try {
      const filename = `/home/avi/documents/work/exp-repo/metabob-devbob/slack-bot-test/screenshot-${name}-${Date.now()}.png`
      await this.page!.screenshot({ path: filename, fullPage: true })
      console.log(`📸 Screenshot saved: ${filename}`)
    } catch (error) {
      console.error(`Failed to take screenshot: ${error}`)
    }
  }

  async runTests() {
    console.log('🧪 Starting Slack Bot E2E Tests\n')
    console.log('=' .repeat(60) + '\n')

    try {
      // Setup
      await this.setup()

      // Test 1: Navigate to Slack
      await this.navigateToSlack()
      await this.takeScreenshot('01-slack-loaded')

      // Test 2: Find bot
      await this.findBot()
      await this.takeScreenshot('02-bot-found')

      // Test 3: Basic message
      await this.sendMessage('Hello! Can you hear me?', 'Session created')
      await this.takeScreenshot('03-basic-message')

      // Test 4: Activity monitoring
      await this.testActivityMonitoring()
      await this.takeScreenshot('04-activity-monitoring')

      // Test 5: Slash commands
      await this.testSlashCommand('/status', 'Session State')
      await this.takeScreenshot('05-status-command')

      await this.testSlashCommand('/activities', 'Activities')
      await this.takeScreenshot('06-activities-command')

      await this.testSlashCommand('/session-info', 'Session Info')
      await this.takeScreenshot('07-session-info-command')

      // Final screenshot
      await this.takeScreenshot('08-final-state')

    } catch (error) {
      console.error('\n❌ Test suite failed:', error)
      await this.takeScreenshot('error')
    } finally {
      await this.printResults()
      await this.cleanup()
    }
  }

  async printResults() {
    console.log('\n' + '='.repeat(60))
    console.log('📊 TEST RESULTS')
    console.log('='.repeat(60) + '\n')

    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    const total = this.results.length

    this.results.forEach((result, i) => {
      const icon = result.passed ? '✅' : '❌'
      const duration = `${result.duration}ms`
      console.log(`${icon} Test ${i + 1}: ${result.test} (${duration})`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    })

    console.log('\n' + '-'.repeat(60))
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`)
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)
    console.log('='.repeat(60) + '\n')
  }

  async cleanup() {
    console.log('🧹 Cleaning up...')
    if (this.browser) {
      await this.browser.close()
      console.log('✅ Browser closed\n')
    }
  }
}

// Run tests
async function main() {
  const tester = new SlackBotTester()
  await tester.runTests()
}

main().catch(console.error)
