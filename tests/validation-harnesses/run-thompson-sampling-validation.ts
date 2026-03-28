#!/usr/bin/env ts-node
/**
 * Runner for Thompson Sampling Architectural Boundary Validation
 * 
 * Executes validation harness and reports results
 */

import { runValidation } from "./thompson-sampling-in-rpc-api-only-harness"
import * as fs from "fs"
import * as path from "path"

async function main() {
  console.log("🚀 Starting Thompson Sampling Architectural Validation\n")
  
  try {
    const result = await runValidation()
    
    // Save results to file
    const outputPath = path.join(__dirname, "validation-results-thompson-sampling.json")
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2))
    
    console.log(`\n📄 Results saved to: ${outputPath}`)
    
    // Exit with appropriate code
    process.exit(result.overallPass ? 0 : 1)
  } catch (error) {
    console.error("❌ Validation error:", error)
    process.exit(1)
  }
}

main()
