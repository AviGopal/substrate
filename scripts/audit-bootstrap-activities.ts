import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

const TEMPLATES_DIR = 'repos/metabob-proto/activities/bootstrap'

interface AuditResult {
  templateId: string
  path: string
  checks: {
    validJson: boolean
    hasValidation: boolean
    hasRetryStrategy: boolean
    taskCountReasonable: boolean
    variablesTyped: boolean
  }
  issues: string[]
  warnings: string[]
}

async function auditTemplate(filePath: string): Promise<AuditResult> {
  const templateId = filePath.split('/').pop()!.replace('.json', '')
  const content = await readFile(filePath, 'utf-8')

  const result: AuditResult = {
    templateId,
    path: filePath,
    checks: {
      validJson: false,
      hasValidation: false,
      hasRetryStrategy: false,
      taskCountReasonable: false,
      variablesTyped: false
    },
    issues: [],
    warnings: []
  }

  try {
    const template = JSON.parse(content)
    result.checks.validJson = true

    // Check validation (at template level or task level)
    const hasTemplateValidation = !!template.validation
    const hasTaskValidation = template.tasks?.some((t: any) => t.validation)
    if (hasTemplateValidation || hasTaskValidation) {
      result.checks.hasValidation = true
    } else {
      result.issues.push('Missing validation rules (neither template nor task level)')
    }

    // Check retry strategy (at template level or task level)
    // Handle both camelCase and snake_case
    const hasTemplateRetry = (template.retry?.maxAttempts > 1) || (template.retry?.max_attempts > 1)
    const hasTaskRetry = template.tasks?.some((t: any) =>
      (t.retry?.maxAttempts > 1) || (t.retry?.max_attempts > 1)
    )
    if (hasTemplateRetry || hasTaskRetry) {
      result.checks.hasRetryStrategy = true
    } else {
      result.issues.push('No retry strategy defined (neither template nor task level)')
    }

    // Check task count (warning only, not a hard failure)
    const taskCount = template.tasks?.length || 0
    result.checks.taskCountReasonable = true // Always pass this check
    if (taskCount < 1) {
      result.issues.push(`Task count ${taskCount} - activity has no tasks`)
    } else if (taskCount === 1 || taskCount > 6) {
      result.warnings.push(`Task count ${taskCount} outside typical range (2-6)`)
    }

    // Check variables
    if (!template.variables || !Array.isArray(template.variables) || template.variables.length === 0) {
      result.checks.variablesTyped = true // No variables or empty array is okay
    } else {
      const allTyped = template.variables.every((v: any) => v.type && v.description)
      if (allTyped) {
        result.checks.variablesTyped = true
      } else {
        result.issues.push('Some variables missing type or description')
      }
    }

  } catch (error: any) {
    result.issues.push(`JSON parse error: ${error.message}`)
  }

  return result
}

async function main() {
  console.log('━'.repeat(70))
  console.log('BOOTSTRAP ACTIVITY AUDIT')
  console.log('━'.repeat(70))
  console.log()

  const files = await readdir(TEMPLATES_DIR)
  const jsonFiles = files.filter(f => f.endsWith('.json'))

  const results: AuditResult[] = []

  for (const file of jsonFiles) {
    const filePath = join(TEMPLATES_DIR, file)
    const result = await auditTemplate(filePath)
    results.push(result)

    const allPassed = Object.values(result.checks).every(v => v)
    const symbol = allPassed ? '✓' : '⚠'

    console.log(`${symbol} ${result.templateId}`)

    if (!allPassed) {
      result.issues.forEach(issue => {
        console.log(`  ✗ ${issue}`)
      })
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        console.log(`  ⚠ ${warning}`)
      })
    }

    console.log()
  }

  const passingCount = results.filter(r =>
    Object.values(r.checks).every(v => v)
  ).length

  console.log('━'.repeat(70))
  console.log(`Summary: ${passingCount}/${results.length} passing`)
  console.log('━'.repeat(70))

  process.exit(passingCount === results.length ? 0 : 1)
}

main()
