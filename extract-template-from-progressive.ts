#!/usr/bin/env bun
/**
 * Extract Template from Progressive Template Execution
 *
 * Converts progressive template execution output into a registerable template definition.
 *
 * This is an explicit, separate step that runs AFTER progressive execution completes.
 * It does not modify the progressive template itself.
 *
 * Usage:
 *   bun run extract-template-from-progressive.ts <execution-output-file>
 *   bun run extract-template-from-progressive.ts --stdin < execution-output.txt
 *
 * Output:
 *   Prints extracted template JSON to stdout
 *   Can be piped to a file: bun run ... > extracted-template.json
 */

import { readFileSync, existsSync } from "node:fs"
import { basename } from "node:path"

interface ActivityTemplate {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  tasks: Array<{
    id: string
    description: string
    prompt: {
      template: string
    }
    validation?: {
      required_patterns?: string[]
      forbidden_patterns?: string[]
    }
    dependencies?: string[]
  }>
}

/**
 * Parse progressive execution output to extract template information
 */
function parseProgressiveOutput(output: string): {
  goal: string
  stages: Array<{ name: string; description: string; success: boolean }>
  learnings: string[]
} {
  const lines = output.split("\n")

  // Extract goal from first mention
  const goalMatch = output.match(
    /goal[:\s]+(.+?)(?:\n|$)/i
  )
  const goal = goalMatch ? goalMatch[1].trim() : "Extracted Template"

  // Find all stage markers
  const stages = []

  const stage1Match = output.match(/STAGE-1-ALIGNED:\s*(.+?)(?:\n|STAGE|Goal|$)/is)
  if (stage1Match) {
    stages.push({
      name: "stage-1-setup",
      description: stage1Match[1].trim(),
      success: true,
    })
  }

  const stage1Fail = output.match(/STAGE-1-MISALIGNED:\s*(.+?)(?:\n|STAGE|Goal|$)/is)
  if (stage1Fail && stages.length === 0) {
    stages.push({
      name: "stage-1-setup",
      description: stage1Fail[1].trim(),
      success: false,
    })
  }

  const stage2Match = output.match(/STAGE-2-ALIGNED[^:]*:\s*(.+?)(?:\n|STAGE|Goal|$)/is)
  if (stage2Match) {
    stages.push({
      name: "stage-2-integration",
      description: stage2Match[1].trim(),
      success: true,
    })
  }

  const stage2Fail = output.match(/STAGE-2-MISALIGNED:\s*(.+?)(?:\n|STAGE|Goal|$)/is)
  if (stage2Fail && stages.filter((s) => s.name === "stage-2-integration").length === 0) {
    stages.push({
      name: "stage-2-integration",
      description: stage2Fail[1].trim(),
      success: false,
    })
  }

  const stage3Match = output.match(/GOAL-ACHIEVED:\s*(.+?)(?:\n|$)/is)
  if (stage3Match) {
    stages.push({
      name: "stage-3-validation",
      description: stage3Match[1].trim(),
      success: true,
    })
  }

  const stage3Fail = output.match(/GOAL-FAILED:\s*(.+?)(?:\n|$)/is)
  if (stage3Fail) {
    stages.push({
      name: "stage-3-validation",
      description: stage3Fail[1].trim(),
      success: false,
    })
  }

  // Extract learnings
  const learnings: string[] = []
  const learningsMatch = output.match(/Key Learnings:?\n([\s\S]*?)(?:\n\n|Recommendations|$)/i)
  if (learningsMatch) {
    const learningLines = learningsMatch[1].split("\n")
    for (const line of learningLines) {
      const cleaned = line.replace(/^\s*[-•*]\s*/, "").trim()
      if (cleaned) learnings.push(cleaned)
    }
  }

  return { goal, stages, learnings }
}

/**
 * Generate template ID from goal description
 */
function generateTemplateId(goal: string): string {
  return goal
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60)
}

/**
 * Create activity template from parsed progressive output
 */
function createTemplateFromParsedOutput(
  parsed: ReturnType<typeof parseProgressiveOutput>
): ActivityTemplate {
  const templateId = generateTemplateId(parsed.goal)

  // Build task list from stages
  const tasks = parsed.stages
    .filter((s) => s.success) // Only include successful stages
    .map((stage, index) => ({
      id: stage.name,
      description: stage.name
        .split("-")
        .map((w, i) => (i === 0 ? w : w))
        .join(" "),
      prompt: {
        template: stage.description,
      },
      validation: {
        required_patterns: [],
        forbidden_patterns: [],
      },
      dependencies: index > 0 ? [parsed.stages[index - 1].name] : [],
    }))

  // If no tasks extracted, create default structure
  if (tasks.length === 0) {
    tasks.push({
      id: "main-task",
      description: parsed.goal,
      prompt: {
        template: `Execute: ${parsed.goal}`,
      },
      validation: {
        required_patterns: [],
        forbidden_patterns: [],
      },
      dependencies: [],
    })
  }

  const template: ActivityTemplate = {
    id: templateId,
    name: parsed.goal.charAt(0).toUpperCase() + parsed.goal.slice(1),
    description: `Extracted from progressive composition execution. ${parsed.learnings.length > 0 ? "Key insights: " + parsed.learnings[0] : ""}`,
    category: "feature",
    tags: [
      "progressive.extraction",
      "auto-generated",
      `extraction-${Date.now()}`,
    ],
    tasks,
  }

  return template
}

/**
 * Format template as pretty JSON
 */
function formatTemplate(template: ActivityTemplate): string {
  return JSON.stringify(template, null, 2)
}

/**
 * Main extraction logic
 */
async function main(): Promise<void> {
  let output: string

  // Parse command line arguments
  if (Bun.argv.includes("--stdin")) {
    // Read from stdin
    output = await new Promise((resolve) => {
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
    output = readFileSync(filePath, "utf-8")
  } else {
    console.error("Usage:")
    console.error("  bun run extract-template-from-progressive.ts <file>")
    console.error("  bun run extract-template-from-progressive.ts --stdin < file")
    console.error("")
    console.error("Example:")
    console.error(
      "  bun run extract-template-from-progressive.ts execution-output.txt > template.json"
    )
    console.error("  cat execution-output.txt | bun run extract-template-from-progressive.ts --stdin > template.json")
    process.exit(1)
  }

  try {
    // Parse execution output
    const parsed = parseProgressiveOutput(output)

    // Create template
    const template = createTemplateFromParsedOutput(parsed)

    // Output template as JSON
    console.log(formatTemplate(template))

    // Optionally write debug info to stderr
    if (process.stderr) {
      console.error("\n📋 Extraction Summary (stderr):")
      console.error(`   Goal: ${parsed.goal}`)
      console.error(`   Stages found: ${parsed.stages.length}`)
      console.error(`   Successful stages: ${parsed.stages.filter((s) => s.success).length}`)
      console.error(`   Template ID: ${template.id}`)
      console.error(`   Tasks: ${template.tasks.length}`)
      if (parsed.learnings.length > 0) {
        console.error(`   Learnings: ${parsed.learnings.length}`)
      }
    }
  } catch (error) {
    console.error("❌ Extraction failed:")
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
