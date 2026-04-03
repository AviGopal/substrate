#!/usr/bin/env bun
/**
 * Seed Bootstrap Activities
 *
 * Seeds the 11 bootstrap activities from metabob-proto to the activity-api.
 * Initializes Thompson Sampling parameters (α=1, β=1) for each.
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const API_URL = process.env.ACTIVITY_API_URL || 'http://activity.metabob.local'
// Use record format for org_id consistency with JWT $auth.org_id
const ORG_ID = process.env.ORG_ID || 'organizations:metabob_internal'
const TEMPLATES_DIR = 'repos/metabob-proto/activities/bootstrap'

interface ActivityTemplate {
  activity_id: string
  variant_id: string
  name: string
  description: string
  category: string
  tasks: any[]
  version?: number
}

async function seedTemplate(filePath: string): Promise<void> {
  const content = await readFile(filePath, 'utf-8')
  const template: ActivityTemplate = JSON.parse(content)

  // Ensure required fields
  if (!template.variant_id) {
    template.variant_id = template.activity_id
  }
  if (!template.activity_id) {
    template.activity_id = template.variant_id
  }

  // Transform to backend schema
  const backendTemplate = {
    variant_id: template.variant_id,
    activity_id: template.activity_id,
    variant_name: template.name, // name -> variant_name
    description: template.description,
    category: template.category,
    task_steps: template.tasks, // tasks -> task_steps
    org_id: ORG_ID,
    scope: 'org' as const,
    // Initialize Thompson Sampling params
    thompson_params: {
      alpha: 1,
      beta: 1
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  // Seed to backend
  const response = await fetch(`${API_URL}/v2/activities/templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Org-ID': ORG_ID
    },
    body: JSON.stringify(backendTemplate)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to seed ${template.variant_id}: ${response.status} ${error}`)
  }

  const result = await response.json()
  console.log(`✓ ${template.variant_id} (id: ${result.id || 'N/A'})`)
}

async function main() {
  console.log(`Seeding bootstrap activities to ${API_URL}...`)
  console.log(`Organization: ${ORG_ID}`)
  console.log()

  const files = await readdir(TEMPLATES_DIR)
  const jsonFiles = files.filter(f => f.endsWith('.json')).sort()

  let seeded = 0
  let failed = 0

  for (const file of jsonFiles) {
    const filePath = join(TEMPLATES_DIR, file)
    try {
      await seedTemplate(filePath)
      seeded++
    } catch (error: any) {
      console.error(`✗ ${file}: ${error.message}`)
      failed++
    }
  }

  console.log()
  console.log('━'.repeat(70))
  console.log(`Seeded: ${seeded}/${jsonFiles.length} activities`)
  if (failed > 0) {
    console.log(`Failed: ${failed}`)
  }
  console.log('━'.repeat(70))

  process.exit(failed > 0 ? 1 : 0)
}

main()
