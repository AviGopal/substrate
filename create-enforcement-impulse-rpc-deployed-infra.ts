#!/usr/bin/env tsx
/**
 * Create enforcement impulse for rpc-api-deployed-infrastructure-validation
 */

import { ImpulseManager } from "./repos/metabob-opencode/packages/opencode/src/impulse/manager"
import { Impulse } from "./repos/metabob-opencode/packages/opencode/src/impulse/types"
import * as fs from "fs"

async function main() {
  const manager = new ImpulseManager()
  
  // Read the enforcement summary
  const summaryContent = fs.readFileSync(
    "ENFORCEMENT_SUMMARY_rpc-api-deployed-infrastructure-validation.json", 
    "utf8"
  )
  const summaryData = JSON.parse(summaryContent)
  
  const impulse: Impulse.CreateOptions = {
    id: "enforcement-rpc-api-deployed-infrastructure-validation",
    type: "file",
    pointer: {
      type: "memo",
      content: summaryContent,
      source: "activity-enforcement"
    },
    metadata: {
      purpose: "Enforcement summary for RPC API deployed infrastructure validation",
      specificationName: summaryData.specificationName,
      changesApplied: summaryData.changesApplied.length,
      blockers: summaryData.blockers.length,
      testsPassed: 2,
      testsFailed: 1,
      testsSkipped: 5
    },
    budget: 3000
  }
  
  const created = await manager.create(impulse)
  console.log("Created enforcement impulse:", created.id)
  console.log("Type:", created.type)
  console.log("Budget:", created.budget)
  console.log("Metadata:", JSON.stringify(created.metadata, null, 2))
  
  // Verify it can be retrieved
  const retrieved = await manager.get(created.id)
  if (retrieved) {
    console.log("\nImpulse successfully created and retrieved!")
    console.log("Content size:", JSON.stringify(retrieved.pointer).length, "bytes")
  }
}

main().catch(console.error)
