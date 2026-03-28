#!/usr/bin/env bun
/**
 * Runner script for safe-config-self-modification validation harness
 * 
 * Usage:
 *   bun run tests/validation-harnesses/run-safe-config-self-modification-validation.ts
 */

import { runValidation } from "./safe-config-self-modification-harness"

async function main() {
  console.log("Running safe-config-self-modification validation harness...\n")

  try {
    const result = await runValidation()

    console.log("\n" + "=".repeat(80))
    console.log("VALIDATION HARNESS: safe-config-self-modification")
    console.log("=".repeat(80) + "\n")

    console.log(`Overall Result: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
    console.log(`Summary: ${result.summary}\n`)

    console.log("Checks:")
    for (const check of result.checks) {
      const status = check.pass ? "✅" : "❌"
      console.log(`  ${status} ${check.name}`)
      console.log(`     ${check.details}`)
    }

    if (result.warnings.length > 0) {
      console.log("\nWarnings:")
      result.warnings.forEach((w) => console.log(`  ⚠️  ${w}`))
    }

    if (result.errors.length > 0) {
      console.log("\nErrors:")
      result.errors.forEach((e) => console.log(`  ❌ ${e}`))
    }

    console.log("\n" + "=".repeat(80))

    if (result.pass) {
      console.log("\n✅ All static validations passed!")
      console.log("\nNext steps:")
      console.log("  1. Run runtime tests with actual config changes")
      console.log("  2. Test validation failure rollback")
      console.log("  3. Test impact analysis accuracy")
      console.log("  4. Test graceful reload vs defer")
    } else {
      console.log("\n❌ Some validations failed. Please fix the issues above.")
    }

    process.exit(result.pass ? 0 : 1)
  } catch (error) {
    console.error("❌ Validation harness failed:", error)
    process.exit(1)
  }
}

main()
