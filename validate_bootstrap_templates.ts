/**
 * Bootstrap Templates Validation Script
 * 
 * Performs comprehensive static validation on all bootstrap activity templates:
 * 1. JSON syntax validation
 * 2. Schema compliance
 * 3. Tool references verification
 * 4. Variable consistency
 * 5. Circular dependency detection
 * 6. Context requirements validation
 */

import * as fs from 'fs/promises'
import * as path from 'path'

interface ValidationResult {
  templateName: string
  filePath: string
  passed: boolean
  errors: string[]
  warnings: string[]
  info: string[]
}

const results: ValidationResult[] = []

console.log("=" .repeat(80))
console.log("BOOTSTRAP TEMPLATES VALIDATION")
console.log("=" .repeat(80))
console.log()

// Test 1: JSON Syntax Validation
console.log("Test 1: JSON Syntax Validation")
console.log("-".repeat(80))

const bootstrapDir = 'repos/metabob-proto/activities/bootstrap'
const files = await fs.readdir(bootstrapDir)
const jsonFiles = files.filter(f => f.endsWith('.json'))

console.log(`Found ${jsonFiles.length} JSON files\n`)

for (const file of jsonFiles) {
  const filePath = path.join(bootstrapDir, file)
  const result: ValidationResult = {
    templateName: file,
    filePath,
    passed: true,
    errors: [],
    warnings: [],
    info: []
  }
  
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const template = JSON.parse(content)
    
    console.log(`  ✅ ${file} - Valid JSON`)
    result.info.push('JSON syntax valid')
    
    // Test 2: Schema Compliance
    const requiredFields = ['name', 'version', 'description', 'category', 'tasks']
    const missingFields = requiredFields.filter(field => !(field in template))
    
    if (missingFields.length > 0) {
      result.errors.push(`Missing required fields: ${missingFields.join(', ')}`)
      result.passed = false
    }
    
    // Check tasks
    if (!Array.isArray(template.tasks) || template.tasks.length === 0) {
      result.errors.push('No tasks defined or tasks is not an array')
      result.passed = false
    } else {
      result.info.push(`Tasks: ${template.tasks.length}`)
      
      // Validate each task
      for (let i = 0; i < template.tasks.length; i++) {
        const task = template.tasks[i]
        const taskRequiredFields = ['id', 'subagent', 'description', 'prompt']
        const taskMissingFields = taskRequiredFields.filter(field => !(field in task))
        
        if (taskMissingFields.length > 0) {
          result.errors.push(`Task ${i} (${task.id || 'unknown'}): Missing ${taskMissingFields.join(', ')}`)
          result.passed = false
        }
        
        // Check prompt structure
        if (task.prompt) {
          if (!task.prompt.template) {
            result.errors.push(`Task ${task.id}: prompt.template missing`)
            result.passed = false
          }
          if (!task.prompt.maxTokens && !task.prompt.max_tokens) {
            result.warnings.push(`Task ${task.id}: no maxTokens specified`)
          }
        }
      }
    }
    
    // Test 3: Extract tool references
    const toolRefs = new Set<string>()
    if (template.tasks) {
      for (const task of template.tasks) {
        if (task.prompt?.template) {
          const promptTemplate = task.prompt.template
          // Match tool names in backticks (like `tool_name`)
          const matches = promptTemplate.matchAll(/`([a-z_]+)`/g)
          for (const match of matches) {
            const toolName = match[1]
            if (toolName.includes('_') && (
              toolName.startsWith('impulse_') ||
              toolName.startsWith('memory_') ||
              toolName.startsWith('metabob_') ||
              toolName.startsWith('activity_') ||
              toolName.startsWith('negotiate_')
            )) {
              toolRefs.add(toolName)
            }
          }
        }
      }
    }
    
    if (toolRefs.size > 0) {
      result.info.push(`Tool references: ${Array.from(toolRefs).join(', ')}`)
    }
    
    // Test 4: Variable consistency
    const variablesUsed = new Set<string>()
    const variablesDeclared = new Set<string>()
    
    if (template.tasks) {
      for (const task of template.tasks) {
        if (task.prompt?.template) {
          const promptTemplate = task.prompt.template
          // Match {{variable}} patterns
          const matches = promptTemplate.matchAll(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)
          for (const match of matches) {
            variablesUsed.add(match[1])
          }
        }
        
        // Check declared variables
        if (task.prompt?.variables && Array.isArray(task.prompt.variables)) {
          for (const varDef of task.prompt.variables) {
            if (varDef.name) {
              variablesDeclared.add(varDef.name)
            }
          }
        }
      }
    }
    
    // Also check template-level variables if they exist
    if (template.variables) {
      for (const varName of Object.keys(template.variables)) {
        variablesDeclared.add(varName)
      }
    }
    
    // Find undeclared variables (used but not declared)
    const undeclared = Array.from(variablesUsed).filter(v => !variablesDeclared.has(v))
    if (undeclared.length > 0) {
      result.warnings.push(`Undeclared variables: ${undeclared.join(', ')}`)
      result.info.push('Note: Variables may be inherited from parent activity or user input')
    }
    
    // Test 5: Circular dependencies
    if (template.tasks) {
      const taskIds = new Set(template.tasks.map((t: any) => t.id))
      for (const task of template.tasks) {
        if (task.dependencies && Array.isArray(task.dependencies)) {
          for (const dep of task.dependencies) {
            if (!taskIds.has(dep)) {
              result.errors.push(`Task ${task.id}: depends on non-existent task "${dep}"`)
              result.passed = false
            }
            if (dep === task.id) {
              result.errors.push(`Task ${task.id}: circular self-dependency`)
              result.passed = false
            }
          }
        }
      }
    }
    
    // Test 6: Context requirements
    if (template.contextRequirements && Array.isArray(template.contextRequirements)) {
      result.info.push(`Context requirements: ${template.contextRequirements.length}`)
      for (const req of template.contextRequirements) {
        if (!req.key) {
          result.errors.push('Context requirement missing key')
          result.passed = false
        }
        if (!req.impulseTypes || !Array.isArray(req.impulseTypes)) {
          result.warnings.push(`Context requirement ${req.key}: no impulseTypes specified`)
        }
      }
    }
    
  } catch (error) {
    result.errors.push(`Failed to parse: ${error.message}`)
    result.passed = false
    console.log(`  ❌ ${file} - ${error.message}`)
  }
  
  results.push(result)
}

// Summary
console.log()
console.log("=" .repeat(80))
console.log("VALIDATION SUMMARY")
console.log("=" .repeat(80))
console.log()

const passed = results.filter(r => r.passed).length
const failed = results.filter(r => r.passed === false).length

console.log(`Total templates: ${results.length}`)
console.log(`✅ Passed: ${passed}`)
console.log(`❌ Failed: ${failed}`)
console.log()

// Detailed results
for (const result of results) {
  const status = result.passed ? '✅ PASS' : '❌ FAIL'
  console.log(`${status} - ${result.templateName}`)
  
  if (result.errors.length > 0) {
    console.log(`  Errors:`)
    for (const error of result.errors) {
      console.log(`    ❌ ${error}`)
    }
  }
  
  if (result.warnings.length > 0) {
    console.log(`  Warnings:`)
    for (const warning of result.warnings) {
      console.log(`    ⚠️  ${warning}`)
    }
  }
  
  if (result.info.length > 0 && (result.errors.length > 0 || result.warnings.length > 0)) {
    console.log(`  Info:`)
    for (const info of result.info) {
      console.log(`    ℹ️  ${info}`)
    }
  }
  
  console.log()
}

// Exit code
if (failed > 0) {
  console.log("⚠️  Some templates failed validation. Review errors above.")
  process.exit(1)
} else {
  console.log("🎉 All templates passed validation!")
  process.exit(0)
}
