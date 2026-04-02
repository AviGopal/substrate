#!/usr/bin/env bun
/**
 * Register Template with Backend
 *
 * Submits an extracted template to the metabob-activity-api for registration,
 * indexing, and Thompson Sampling integration.
 *
 * This is an explicit, separate step that runs AFTER template extraction.
 * It does not modify any existing templates.
 *
 * Usage:
 *   bun run register-template-with-backend.ts <template.json>
 *   bun run register-template-with-backend.ts --stdin < template.json
 *
 * Example:
 *   # Extract and register in pipeline
 *   bun run extract-template-from-progressive.ts output.txt | \\
 *     bun run register-template-with-backend.ts --stdin
 *
 *   # Register existing template file
 *   bun run register-template-with-backend.ts my-template.json
 */

import { readFileSync, existsSync } from "node:fs"

interface ActivityTemplate {
  id: string
  name: string
  description: string
  category: string
  tags?: string[]
  tasks: any[]
}

interface RegistrationResponse {
  id: string
  name: string
  message?: string
  error?: string
}

/**
 * Convert simple template format to backend schema
 */
function transformToBackendSchema(template: any): any {
  // If already in backend format, return as-is
  if (template.variant_id && template.activity_id) {
    return template
  }

  // Convert from simple format
  return {
    // Backend requires these for the activity table
    variant_id: template.id || template.variant_id,
    activity_id: template.id || template.activity_id || `activity-${template.id}`,
    variant_name: template.name || template.variant_name,
    description: template.description,
    category: template.category || "feature",
    tags: template.tags || [],
    scope: template.scope || "global",  // Required: 'global' | 'org' | 'project'
    org_id: template.org_id || null,
    project_id: template.project_id || null,

    // Convert tasks to task_steps for backend
    task_steps: (template.tasks || []).map((task: any) => ({
      id: task.id,
      description: task.description,
      prompt: task.prompt,
      validation: task.validation || { required_patterns: [], forbidden_patterns: [] },
      dependencies: task.dependencies || [],
      retry: task.retry || { maxAttempts: 1, strategy: "linear" },
    })),

    // Metadata
    metadata: template.metadata || { author: "auto-extracted", version: "1.0.0" },
    variables: template.variables || [],
    impulses: template.impulses || [],
  }
}

/**
 * Validate template structure
 */
function validateTemplate(template: any): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!template.id && !template.variant_id && !template.activity_id) {
    errors.push("Missing 'id' or 'variant_id' field")
  }
  if (!template.name && !template.variant_name) {
    errors.push("Missing 'name' or 'variant_name' field")
  }
  if (!template.description || typeof template.description !== "string") {
    errors.push("Missing or invalid 'description' field")
  }
  if (!template.category || typeof template.category !== "string") {
    errors.push("Missing or invalid 'category' field")
  }
  const tasksArray = template.tasks || template.task_steps
  if (!Array.isArray(tasksArray) || tasksArray.length === 0) {
    errors.push("Missing or empty 'tasks' array")
  }

  // Validate each task
  for (let i = 0; i < tasksArray?.length; i++) {
    const task = tasksArray[i]
    if (!task.id) errors.push(`Task ${i}: Missing 'id' field`)
    if (!task.description) errors.push(`Task ${i}: Missing 'description' field`)
    if (!task.prompt) errors.push(`Task ${i}: Missing 'prompt' field`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Register template with backend
 */
async function registerTemplate(
  template: ActivityTemplate,
  apiEndpoint: string
): Promise<RegistrationResponse> {
  const response = await fetch(`${apiEndpoint}/v2/activities/templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(template),
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`
    try {
      const errorBody = await response.text()
      errorMessage += `: ${errorBody}`
    } catch {
      // Ignore error reading response body
    }
    throw new Error(errorMessage)
  }

  return await response.json()
}

/**
 * Pretty-print template info
 */
function printTemplateInfo(template: ActivityTemplate): void {
  console.error("\n📋 Template Information:")
  console.error(`   ID: ${template.id}`)
  console.error(`   Name: ${template.name}`)
  console.error(`   Category: ${template.category}`)
  console.error(`   Tasks: ${template.tasks.length}`)
  if (template.tags) {
    console.error(`   Tags: ${template.tags.join(", ")}`)
  }
  console.error(`   Description: ${template.description.substring(0, 80)}...`)
}

/**
 * Main registration logic
 */
async function main(): Promise<void> {
  let templateJson: string
  let template: ActivityTemplate

  // Get API endpoint from environment
  const apiEndpoint = process.env.ACTIVITY_API_ENDPOINT || "http://activity.metabob.local"

  console.error(`🔗 API Endpoint: ${apiEndpoint}`)

  // Parse command line arguments
  if (Bun.argv.includes("--stdin")) {
    // Read from stdin
    console.error("📥 Reading template from stdin...")
    templateJson = await new Promise((resolve) => {
      let data = ""
      process.stdin.on("data", (chunk) => {
        data += chunk
      })
      process.stdin.on("end", () => resolve(data))
    })
  } else if (Bun.argv[2]) {
    // Read from file
    const filePath = Bun.argv[2]
    if (!existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`)
      process.exit(1)
    }
    console.error(`📥 Reading template from: ${filePath}`)
    templateJson = readFileSync(filePath, "utf-8")
  } else {
    console.error("Usage:")
    console.error("  bun run register-template-with-backend.ts <template.json>")
    console.error("  bun run register-template-with-backend.ts --stdin < template.json")
    console.error("")
    console.error("Environment variables:")
    console.error("  ACTIVITY_API_ENDPOINT - Backend API URL (default: http://activity.metabob.local)")
    console.error("")
    console.error("Example:")
    console.error("  bun run register-template-with-backend.ts extracted-template.json")
    console.error("")
    console.error("  Extract and register in pipeline:")
    console.error("  bun run extract-template-from-progressive.ts output.txt |")
    console.error("    bun run register-template-with-backend.ts --stdin")
    process.exit(1)
  }

  try {
    // Parse JSON
    template = JSON.parse(templateJson)

    // Validate template structure
    const validation = validateTemplate(template)
    if (!validation.valid) {
      console.error("\n❌ Template validation failed:")
      for (const error of validation.errors) {
        console.error(`   • ${error}`)
      }
      process.exit(1)
    }

    printTemplateInfo(template)

    // Transform to backend schema if needed
    const backendTemplate = transformToBackendSchema(template)

    // Register with backend
    console.error(`\n⏳ Registering template with backend...`)
    const result = await registerTemplate(backendTemplate, apiEndpoint)

    // Success response
    console.log(JSON.stringify(result, null, 2))

    console.error("\n✅ Template registered successfully!")
    console.error(`   ID: ${result.id}`)
    console.error(`   Name: ${result.name}`)
    console.error("")
    console.error("📍 Next steps:")
    console.error(`   1. Verify discoverability:`)
    console.error(
      `      curl ${apiEndpoint}/v2/activities/templates/${result.id}`
    )
    console.error(`   2. Check in search results:`)
    console.error(
      `      curl "${apiEndpoint}/v2/activities/templates?limit=100" | jq '.[] | select(.id=="${result.id}")'`
    )
    console.error(`   3. Monitor Thompson Sampling recommendations:`)
    console.error(`      curl -X POST ${apiEndpoint}/v2/activities/recommend \\`)
    console.error(`        -H "Content-Type: application/json" \\`)
    console.error(`        -d '{"task_description":"${template.name.toLowerCase()}","limit":10}'`)
    console.error("")
  } catch (error) {
    console.error("\n❌ Registration failed:")
    console.error(error instanceof Error ? error.message : String(error))
    console.error("")
    console.error("💡 Troubleshooting:")
    console.error(`   • Is the backend running? Try: curl ${apiEndpoint}/health`)
    console.error("   • Is the template JSON valid? Check with: jq . template.json")
    console.error("   • Are required fields present? Check with: jq '.id, .name, .tasks' template.json")
    process.exit(1)
  }
}

main()
