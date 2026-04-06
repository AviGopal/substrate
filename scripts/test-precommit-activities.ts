#!/usr/bin/env bun
/**
 * Test script for resolver-based pre-commit activities
 *
 * Runs activities WITHOUT LLM - pure bash resolver execution with trace capture.
 *
 * Usage:
 *   bun run scripts/test-precommit-activities.ts [activity-name]
 *
 * Examples:
 *   bun run scripts/test-precommit-activities.ts cruft-scan
 *   bun run scripts/test-precommit-activities.ts lint-check
 *   bun run scripts/test-precommit-activities.ts secrets-scan
 *   bun run scripts/test-precommit-activities.ts all
 */

import { readFile } from "fs/promises"
import { join } from "path"

// Activity execution trace
interface TaskTrace {
  taskId: string
  description: string
  resolver: string
  command?: string
  startedAt: number
  completedAt?: number
  durationMs?: number
  exitCode?: number
  stdout: string
  stderr: string
  success: boolean
}

interface ActivityTrace {
  activityId: string
  variantId: string
  name: string
  startedAt: number
  completedAt?: number
  durationMs?: number
  tasks: TaskTrace[]
  success: boolean
  summary?: string
}

// Simple bash executor (mirrors BashResolver logic)
async function executeBash(
  command: string,
  cwd: string,
  timeout = 60000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["sh", "-c", command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      proc.kill()
      reject(new Error(`Command timed out after ${timeout}ms`))
    }, timeout)
  })

  try {
    const exitCode = await Promise.race([proc.exited, timeoutPromise])
    const stdout = await new Response(proc.stdout).text()
    const stderr = await new Response(proc.stderr).text()
    return { stdout, stderr, exitCode }
  } catch (error) {
    return {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: -1,
    }
  }
}

// Load and parse activity template
async function loadActivity(name: string): Promise<any> {
  const activitiesDir = join(process.cwd(), ".metabob/activities")
  const filePath = join(activitiesDir, `precommit-${name}.json`)

  try {
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content)
  } catch (error) {
    throw new Error(`Activity not found: ${filePath}`)
  }
}

// Execute a single task
async function executeTask(
  task: any,
  workingDir: string
): Promise<TaskTrace> {
  const startedAt = Date.now()
  const trace: TaskTrace = {
    taskId: task.id,
    description: task.description,
    resolver: task.resolver || "unknown",
    command: task.config?.command,
    startedAt,
    stdout: "",
    stderr: "",
    success: false,
  }

  console.log(`  ├─ [${task.id}] ${task.description}`)

  if (task.resolver === "bash" && task.config?.command) {
    const result = await executeBash(
      task.config.command,
      workingDir,
      task.config.timeout || 60000
    )

    trace.stdout = result.stdout
    trace.stderr = result.stderr
    trace.exitCode = result.exitCode
    trace.success = result.exitCode === 0 || result.stdout.includes("CLEAN")

    // Show output preview
    const preview = result.stdout.trim().split("\n").slice(0, 3).join("\n")
    if (preview) {
      console.log(`  │  └─ ${preview.substring(0, 80)}${preview.length > 80 ? "..." : ""}`)
    }
  } else {
    trace.stderr = `Unknown resolver: ${task.resolver}`
    trace.success = false
  }

  trace.completedAt = Date.now()
  trace.durationMs = trace.completedAt - startedAt

  const status = trace.success ? "✓" : "✗"
  console.log(`  │     ${status} ${trace.durationMs}ms`)

  return trace
}

// Topological sort for task dependencies
function sortTasks(tasks: any[]): any[] {
  const taskMap = new Map(tasks.map(t => [t.id, t]))
  const visited = new Set<string>()
  const result: any[] = []

  function visit(taskId: string) {
    if (visited.has(taskId)) return
    visited.add(taskId)

    const task = taskMap.get(taskId)
    if (!task) return

    for (const depId of task.dependencies || []) {
      visit(depId)
    }
    result.push(task)
  }

  for (const task of tasks) {
    visit(task.id)
  }

  return result
}

// Execute activity with trace capture
async function executeActivity(
  activity: any,
  workingDir: string
): Promise<ActivityTrace> {
  const startedAt = Date.now()
  const trace: ActivityTrace = {
    activityId: activity.activity_id,
    variantId: activity.variant_id,
    name: activity.variant_name,
    startedAt,
    tasks: [],
    success: false,
  }

  console.log(`\n╔══════════════════════════════════════════════════════════╗`)
  console.log(`║ Activity: ${activity.variant_name.padEnd(47)} ║`)
  console.log(`║ ID: ${activity.activity_id.padEnd(53)} ║`)
  console.log(`╚══════════════════════════════════════════════════════════╝`)
  console.log(`  │`)

  // Sort tasks by dependencies
  const sortedTasks = sortTasks(activity.task_steps || [])

  // Execute each task
  for (const task of sortedTasks) {
    const taskTrace = await executeTask(task, workingDir)
    trace.tasks.push(taskTrace)
  }

  trace.completedAt = Date.now()
  trace.durationMs = trace.completedAt - startedAt
  trace.success = trace.tasks.every(t => t.success)

  // Generate summary
  const passed = trace.tasks.filter(t => t.success).length
  const total = trace.tasks.length
  trace.summary = `${passed}/${total} tasks passed in ${trace.durationMs}ms`

  console.log(`  │`)
  console.log(`  └─ ${trace.success ? "✅ PASSED" : "❌ FAILED"}: ${trace.summary}`)

  return trace
}

// Store trace to file
async function storeTrace(trace: ActivityTrace): Promise<string> {
  const tracesDir = join(process.cwd(), ".metabob/traces")
  await Bun.write(join(tracesDir, ".gitkeep"), "")

  const filename = `${trace.activityId.replace(/:/g, "-")}-${trace.startedAt}.json`
  const filepath = join(tracesDir, filename)

  await Bun.write(filepath, JSON.stringify(trace, null, 2))
  return filepath
}

// Main
async function main() {
  const args = process.argv.slice(2)
  const activityName = args[0] || "all"
  const workingDir = process.cwd()

  console.log(`\n🔍 Pre-Commit Activity Tester (No LLM)`)
  console.log(`   Working directory: ${workingDir}`)
  console.log(`   Activity: ${activityName}`)

  const activities = activityName === "all"
    ? ["lint-check", "cruft-scan", "secrets-scan"]
    : [activityName]

  const traces: ActivityTrace[] = []

  for (const name of activities) {
    try {
      const activity = await loadActivity(name)
      const trace = await executeActivity(activity, workingDir)
      traces.push(trace)

      // Store trace
      const tracePath = await storeTrace(trace)
      console.log(`   📝 Trace saved: ${tracePath}`)
    } catch (error) {
      console.error(`\n❌ Error loading activity '${name}':`, error)
    }
  }

  // Summary
  console.log(`\n╔══════════════════════════════════════════════════════════╗`)
  console.log(`║ SUMMARY                                                  ║`)
  console.log(`╠══════════════════════════════════════════════════════════╣`)

  for (const trace of traces) {
    const status = trace.success ? "✅" : "❌"
    console.log(`║ ${status} ${trace.name.padEnd(45)} ${trace.durationMs?.toString().padStart(6)}ms ║`)
  }

  console.log(`╚══════════════════════════════════════════════════════════╝`)

  const allPassed = traces.every(t => t.success)
  process.exit(allPassed ? 0 : 1)
}

main().catch(console.error)
