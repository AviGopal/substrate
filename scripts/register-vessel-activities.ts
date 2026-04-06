#!/usr/bin/env bun
/**
 * Register vessel development activities with the activity API
 *
 * This script registers mentor activities that teach MiniBob how to:
 * - Create React primitive components
 * - Implement WebSocket handlers
 * - Create dashboard visualization activities
 * - Orchestrate the internal-dashboard overhaul
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const ACTIVITY_API_URL = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local'

interface ActivityTemplate {
  id: string
  name: string
  description: string
  tags?: string[]
  variables?: Array<{
    name: string
    type: string
    required?: boolean
    default?: unknown
    description?: string
  }>
  inputSchema?: {
    required?: Array<{ shape: string; description?: string }>
    optional?: Array<{ shape: string; description?: string }>
  }
  outputSchema?: {
    produces?: Array<{ shape: string; description?: string; collection?: boolean }>
  }
  tasks: Array<{
    id: string
    description: string
    prompt?: { template: string; variables?: string[] }
    resolver?: string
    dependencies?: string[]
    validation?: Record<string, unknown>
    resolverRequirements?: Record<string, unknown>
  }>
  metadata?: Record<string, unknown>
}

async function loadActivitiesFromDirectory(dir: string): Promise<ActivityTemplate[]> {
  const activities: ActivityTemplate[] = []

  try {
    const files = await readdir(dir)

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      const filePath = join(dir, file)
      const content = await readFile(filePath, 'utf-8')

      try {
        const activity = JSON.parse(content) as ActivityTemplate
        activities.push(activity)
        console.log(`  ✓ Loaded: ${activity.id} (${activity.name})`)
      } catch (parseError) {
        console.error(`  ✗ Failed to parse ${file}:`, parseError)
      }
    }
  } catch (dirError) {
    console.warn(`  ⚠ Directory not found or empty: ${dir}`)
  }

  return activities
}

// Map activity categories to valid enum values
function mapCategory(activity: ActivityTemplate): string {
  const validCategories = ['feature', 'bugfix', 'refactor', 'tool', 'infrastructure', 'meta']

  // Check if first tag matches a valid category
  const firstTag = activity.tags?.[0]?.split('.')[0] || ''
  if (validCategories.includes(firstTag)) {
    return firstTag
  }

  // Map common patterns
  const id = activity.id.toLowerCase()
  if (id.includes('develop') || id.includes('create') || id.includes('add')) {
    return 'feature'
  }
  if (id.includes('fix') || id.includes('debug')) {
    return 'bugfix'
  }
  if (id.includes('refactor') || id.includes('evolve')) {
    return 'refactor'
  }
  if (id.includes('vessel') || id.includes('tool')) {
    return 'tool'
  }
  if (id.includes('scaffold') || id.includes('bootstrap')) {
    return 'infrastructure'
  }
  if (id.includes('trace') || id.includes('meta')) {
    return 'meta'
  }

  // Default to feature
  return 'feature'
}

async function registerActivity(activity: ActivityTemplate): Promise<boolean> {
  try {
    // Extract input/output shapes for flat array format
    const inputShapes = [
      ...(activity.inputSchema?.required?.map(s => s.shape) || []),
      ...(activity.inputSchema?.optional?.map(s => s.shape) || [])
    ]

    const outputShapes = activity.outputSchema?.produces?.map(s => s.shape) || []

    // Ensure tags is non-empty
    const tags = activity.tags?.length ? activity.tags : ['development']

    // Prepare registration payload
    const payload = {
      id: activity.id,
      name: activity.name,
      description: activity.description,
      tags,
      category: mapCategory(activity),
      input_shapes: inputShapes,
      output_shapes: outputShapes,
      variables: activity.variables || [],
      tasks: activity.tasks,
      metadata: {
        ...activity.metadata,
        registeredAt: new Date().toISOString(),
        registeredBy: 'register-vessel-activities.ts'
      }
    }

    const response = await fetch(`${ACTIVITY_API_URL}/v2/activities/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`  ✗ Failed to register ${activity.id}: ${response.status} ${errorText}`)
      return false
    }

    const result = await response.json()
    console.log(`  ✓ Registered: ${activity.id} (variant: ${result.variant_id || 'new'})`)
    return true

  } catch (error) {
    console.error(`  ✗ Error registering ${activity.id}:`, error)
    return false
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     Register Vessel Development Activities                  ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log()
  console.log(`Activity API: ${ACTIVITY_API_URL}`)
  console.log()

  // Directories containing activities to register
  const activityDirs = [
    'repos/metabob-proto/activities/vessel',
    'repos/metabob-proto/activities/dashboard',
    'repos/metabob-proto/activities/bootstrap'
  ]

  const allActivities: ActivityTemplate[] = []

  // Load activities from all directories
  console.log('Loading activities...')
  for (const dir of activityDirs) {
    console.log(`\nFrom ${dir}:`)
    const activities = await loadActivitiesFromDirectory(dir)
    allActivities.push(...activities)
  }

  console.log(`\nTotal activities loaded: ${allActivities.length}`)
  console.log()

  // Check API health
  console.log('Checking API health...')
  try {
    const healthResponse = await fetch(`${ACTIVITY_API_URL}/health`)
    if (!healthResponse.ok) {
      console.error('✗ Activity API is not healthy')
      process.exit(1)
    }
    console.log('✓ Activity API is healthy')
  } catch (error) {
    console.error('✗ Cannot connect to Activity API:', error)
    console.log('\nMake sure the activity API is running:')
    console.log('  kubectl port-forward -n activity-system svc/metabob-activity-api 8080:8080')
    console.log('  OR')
    console.log('  export ACTIVITY_API_URL=http://localhost:8080')
    process.exit(1)
  }

  console.log()

  // Register all activities
  console.log('Registering activities...')
  let successCount = 0
  let failCount = 0

  for (const activity of allActivities) {
    const success = await registerActivity(activity)
    if (success) {
      successCount++
    } else {
      failCount++
    }
  }

  console.log()
  console.log('════════════════════════════════════════════════════════════')
  console.log(`Registration complete: ${successCount} succeeded, ${failCount} failed`)
  console.log()

  if (successCount > 0) {
    console.log('Activities are now available for Thompson Sampling selection.')
    console.log('MiniBob can execute them via:')
    console.log()
    console.log('  bun run repos/minibob -- --goal "Create a chart primitive for react-renderer"')
    console.log()
  }

  process.exit(failCount > 0 ? 1 : 0)
}

main().catch(console.error)
