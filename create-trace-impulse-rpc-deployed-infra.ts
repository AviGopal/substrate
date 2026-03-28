#!/usr/bin/env tsx
/**
 * Create trace impulse for rpc-api-deployed-infrastructure-validation
 */

import { ImpulseManager } from "./repos/metabob-opencode/packages/opencode/src/impulse/manager"
import { Impulse } from "./repos/metabob-opencode/packages/opencode/src/impulse/types"
import * as fs from "fs"

async function main() {
  const manager = new ImpulseManager()
  
  // Read the trace analysis
  const traceContent = fs.readFileSync("TRACE_rpc-api-deployed-infrastructure-validation.json", "utf8")
  const traceData = JSON.parse(traceContent)
  
  const impulse: Impulse.CreateOptions = {
    id: "trace-rpc-api-deployed-infrastructure-validation",
    type: "file",
    pointer: {
      type: "memo",
      content: JSON.stringify(traceData, null, 2),
      source: "activity-trace"
    },
    metadata: {
      purpose: "Infrastructure validation trace for deployed RPC API in Kubernetes",
      specificationName: traceData.specificationName,
      components: traceData.validationTargets.length,
      blockers: traceData.blockers.length,
      nextSteps: traceData.nextSteps.length
    },
    budget: 5000
  }
  
  const created = await manager.create(impulse)
  console.log("Created impulse:", created.id)
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
