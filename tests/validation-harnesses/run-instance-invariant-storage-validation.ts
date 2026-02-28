#!/usr/bin/env tsx
/**
 * Runner script for Instance Invariant Storage validation harness
 */

import { runValidation } from "./instance-invariant-storage-harness-v2";
import * as fs from "fs/promises";
import * as path from "path";

async function main() {
  console.log("🚀 Instance Invariant Storage Validation Runner\n");
  
  try {
    const result = await runValidation();
    
    // Write results to file
    const resultsPath = path.join(__dirname, "validation-results-instance-invariant-storage.json");
    await fs.writeFile(resultsPath, JSON.stringify(result, null, 2));
    
    console.log(`\n📊 Results written to: ${resultsPath}`);
    
    // Print summary
    console.log("\n" + "=".repeat(80));
    console.log("SUMMARY");
    console.log("=".repeat(80));
    console.log(`Overall: ${result.overallPass ? "✅ PASS" : "❌ FAIL"}`);
    console.log(`Tests: ${result.passed}/${result.totalTests} passed`);
    
    if (result.failed > 0) {
      console.log("\nFailed Tests:");
      result.results
        .filter(r => !r.pass)
        .forEach(r => {
          console.log(`  - ${r.testName}: ${r.errorMessage || "Unknown error"}`);
        });
    }
    
    console.log("=".repeat(80) + "\n");
    
    process.exit(result.overallPass ? 0 : 1);
  } catch (error: any) {
    console.error("\n❌ Validation runner failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
