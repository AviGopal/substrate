/**
 * Simple Code Change Test
 * Uses write tool instead of edit to ensure success
 */

import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"
import { MinibobIntegration } from "./repos/metabob-opencode/packages/opencode/src/minibob-integration"
import { writeFile, readFile, mkdir } from "fs/promises"
import { join } from "path"
import { execSync } from "child_process"

async function main() {
  console.log("═══════════════════════════════════════════════════════")
  console.log("  Minibob Library - Simple Code Change Test")
  console.log("═══════════════════════════════════════════════════════\n")

  const testDir = join(process.cwd(), "test-full-stack")
  const testFile = join(testDir, "calculator.ts")
  const testSessionId = "code-change-" + Date.now()

  // Setup
  await mkdir(testDir, { recursive: true })
  try {
    execSync("git init", { cwd: testDir, stdio: "ignore" })
    execSync('git config user.email "test@example.com"', { cwd: testDir, stdio: "ignore" })
    execSync('git config user.name "Test User"', { cwd: testDir, stdio: "ignore" })
  } catch (e) {}

  await Instance.provide({
    directory: testDir,
    fn: async () => {
      console.log("📁 Working directory:", Instance.directory)
      console.log()

      // Create initial file
      const initial = `export function add(a: number, b: number): number {
  return a + b
}
`
      await writeFile(testFile, initial)
      console.log("✅ Created calculator.ts with add() function")
      console.log()

      // Check API
      console.log("🔗 Checking backend...")
      const health = await fetch("http://api.minibob.local/health").then(r => r.json())
      console.log("   Backend:", health.status, "✓")
      console.log()

      // Initialize
      console.log("⚙️  Initializing minibob...")
      await MinibobIntegration.initialize(testSessionId)
      console.log("   Session:", testSessionId, "✓")
      console.log()

      // Create simple activity - just write a new function
      const template: any = {
        id: "add-subtract-function",
        name: "Add Subtract Function",
        description: "Add a subtract function to calculator",
        category: "feature",
        tasks: [{
          id: "write-subtract",
          subagent: "general",
          description: "Write subtract function",
          dependencies: [],
          prompt: {
            template: `Write a subtract function to the file /home/avi/documents/work/exp-repo/metabob-devbob/test-full-stack/calculator.ts

The file currently contains an add function. Add a subtract function below it with this signature:
export function subtract(a: number, b: number): number

Use the write tool to create the complete file with both functions.

Current content:
export function add(a: number, b: number): number {
  return a + b
}

Expected result should have BOTH add and subtract functions.`,
            maxTokens: 2000,
            compressionStrategy: "truncate",
            variables: []
          },
          validation: {
            requiredFiles: [testFile],
            requiredPatterns: ["subtract"],
            forbiddenPatterns: [],
            commands: []
          },
          retry: {
            maxAttempts: 1,
            strategy: "simple"
          }
        }],
        variables: []
      }

      console.log("🚀 Executing activity:", template.name)
      console.log("   Task:", template.tasks[0].description)
      console.log()

      const start = Date.now()
      const execution = await MinibobIntegration.executeActivity(
        testSessionId,
        template,
        {},
        "Add subtract function to calculator via minibob library"
      )
      const duration = Date.now() - start

      console.log("═══════════════════════════════════════════════════════")
      console.log("  RESULTS")
      console.log("═══════════════════════════════════════════════════════")
      console.log()
      console.log("Activity ID:", execution.id)
      console.log("Status:", execution.status)
      console.log("Duration:", duration, "ms")
      console.log("Cost: $", execution.metrics?.cost?.toFixed(4) ?? "0.0000")
      console.log()

      if (execution.status === "completed") {
        console.log("✅ Activity completed successfully!")
        console.log()

        // Read and show the modified file
        const modified = await readFile(testFile, "utf-8")
        console.log("📄 Modified calculator.ts:")
        console.log("─".repeat(55))
        console.log(modified)
        console.log("─".repeat(55))
        console.log()

        // Verify both functions exist
        const hasAdd = modified.includes("function add")
        const hasSubtract = modified.includes("function subtract")
        
        console.log("Verification:")
        console.log("  ✓ Has add():", hasAdd)
        console.log("  ✓ Has subtract():", hasSubtract)
        console.log()

        if (hasAdd && hasSubtract) {
          console.log("🎉 SUCCESS! Code was modified correctly!")
          console.log()
          console.log("Dashboard: http://dashboard.minibob.local/activities/" + execution.id)
          console.log()
          console.log("This proves:")
          console.log("  • Minibob library integration works")
          console.log("  • Direct library calls (no HTTP)")
          console.log("  • Real code modification successful")
          console.log("  • Backend tracking activity")
        }
      } else {
        console.log("❌ Activity failed")
        execution.taskResults.forEach(task => {
          if (task.error) {
            console.log("Error:", task.error.slice(0, 200))
          }
        })
      }
    }
  })
}

main().catch(e => {
  console.error("Fatal error:", e.message)
  process.exit(1)
})
