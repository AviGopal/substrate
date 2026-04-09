#!/usr/bin/env bun
/**
 * Seed Vessel Activities to Backend
 *
 * Registers vessel development activities with the backend for Thompson Sampling.
 * This allows MiniBob to discover and use these activities when given vessel-related goals.
 *
 * Activities seeded:
 * - vessel-scaffold: Create new vessel structure
 * - vessel-add-resolver: Add impulse resolver to vessel
 * - vessel-add-tool: Add MCP tool to vessel
 * - vessel-register: Configure backend registration
 * - vessel-test: Validate vessel functionality
 *
 * Usage:
 *   bun run scripts/seed-vessel-activities.ts
 *   bun run scripts/seed-vessel-activities.ts --dry-run
 *   bun run scripts/seed-vessel-activities.ts --endpoint http://localhost:8080
 */

import { initializeMCP, getMCPClient, type MCPClient } from "../repos/minibob/src/mcp"
import type { ActivityTemplate } from "../repos/minibob/src/types"

// Parse arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const endpointArg = args.find(a => a.startsWith('--endpoint='))
const endpoint = endpointArg?.split('=')[1] || process.env.ACTIVITY_API_ENDPOINT || 'http://activity.metabob.local'

// Activity template files to seed
const VESSEL_ACTIVITIES = [
  'vessel-scaffold',
  'vessel-add-resolver',
  'vessel-add-tool',
  'vessel-register',
  'vessel-test',
  'search-changes',
]

const ACTIVITIES_DIR = new URL('../repos/metabob-proto/activities/vessel/', import.meta.url).pathname

/**
 * Load an activity template from JSON file
 */
async function loadActivity(name: string): Promise<ActivityTemplate> {
  const filePath = `${ACTIVITIES_DIR}${name}.json`
  const file = Bun.file(filePath)

  if (!(await file.exists())) {
    throw new Error(`Activity file not found: ${filePath}`)
  }

  const content = await file.json()
  return content as ActivityTemplate
}

/**
 * Validate an activity template
 */
function validateActivity(activity: ActivityTemplate): string[] {
  const errors: string[] = []

  if (!activity.id) errors.push('Missing id')
  if (!activity.name) errors.push('Missing name')
  if (!activity.description) errors.push('Missing description')
  if (!activity.tasks || activity.tasks.length === 0) errors.push('Missing or empty tasks')

  // Validate each task
  for (const task of activity.tasks || []) {
    if (!task.id) errors.push(`Task missing id`)
    if (!task.description) errors.push(`Task ${task.id} missing description`)
    if (!task.prompt?.template && !task.resolver) {
      errors.push(`Task ${task.id} missing prompt template or resolver`)
    }
  }

  return errors
}

/**
 * Register activity with backend
 */
async function registerActivity(mcp: MCPClient, activity: ActivityTemplate): Promise<boolean> {
  if (dryRun) {
    console.log(`[DRY RUN] Would register: ${activity.id}`)
    return true
  }

  try {
    const success = await mcp.registerTemplate(activity)
    return success
  } catch (error) {
    console.error(`Failed to register ${activity.id}:`, error)
    return false
  }
}

/**
 * Main seeding function
 */
async function main() {
  console.log('='.repeat(60))
  console.log('SEED VESSEL ACTIVITIES')
  console.log('='.repeat(60))
  console.log(`Endpoint: ${endpoint}`)
  console.log(`Dry Run: ${dryRun}`)
  console.log(`Activities: ${VESSEL_ACTIVITIES.join(', ')}`)
  console.log('')

  // Initialize MCP client
  if (!dryRun) {
    const mcp = await initializeMCP({
      endpoint,
      instance: {
        instanceId: process.env.MINIBOB_INSTANCE_ID || 'seeder-instance',
        apiKey: process.env.MINIBOB_API_KEY || '',
      },
    }, true)  // Skip health check for seeding

    if (!mcp) {
      console.error('Failed to initialize MCP client')
      process.exit(1)
    }
  }

  const results: { name: string; status: string; errors?: string[] }[] = []

  // Process each activity
  for (const name of VESSEL_ACTIVITIES) {
    console.log(`\nProcessing: ${name}`)
    console.log('-'.repeat(40))

    try {
      // Load activity
      const activity = await loadActivity(name)
      console.log(`  Loaded: ${activity.name}`)
      console.log(`  Description: ${activity.description?.substring(0, 60)}...`)
      console.log(`  Tasks: ${activity.tasks.length}`)
      console.log(`  Category: ${activity.category || 'uncategorized'}`)
      console.log(`  Tags: ${activity.tags?.join(', ') || 'none'}`)

      // Validate
      const errors = validateActivity(activity)
      if (errors.length > 0) {
        console.log(`  Validation Errors:`)
        for (const error of errors) {
          console.log(`    - ${error}`)
        }
        results.push({ name, status: 'invalid', errors })
        continue
      }
      console.log(`  Validation: OK`)

      // Register
      const mcp = getMCPClient()
      if (!mcp && !dryRun) {
        console.log(`  Status: skipped (no MCP client)`)
        results.push({ name, status: 'skipped' })
        continue
      }

      const success = mcp ? await registerActivity(mcp, activity) : true
      const status = dryRun ? 'dry-run' : (success ? 'registered' : 'failed')
      console.log(`  Status: ${status}`)
      results.push({ name, status })

    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : String(error)}`)
      results.push({ name, status: 'error', errors: [String(error)] })
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))

  const registered = results.filter(r => r.status === 'registered').length
  const dryRunCount = results.filter(r => r.status === 'dry-run').length
  const failed = results.filter(r => r.status === 'failed' || r.status === 'error' || r.status === 'invalid').length

  console.log(`Total: ${results.length}`)
  if (dryRun) {
    console.log(`Would Register: ${dryRunCount}`)
  } else {
    console.log(`Registered: ${registered}`)
  }
  console.log(`Failed: ${failed}`)

  // List failures
  if (failed > 0) {
    console.log('\nFailures:')
    for (const result of results.filter(r => r.status !== 'registered' && r.status !== 'dry-run')) {
      console.log(`  - ${result.name}: ${result.status}`)
      if (result.errors) {
        for (const error of result.errors) {
          console.log(`      ${error}`)
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('DONE')
  console.log('='.repeat(60))

  // Exit with error code if any failures
  if (failed > 0) {
    process.exit(1)
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
