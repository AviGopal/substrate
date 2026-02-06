#!/usr/bin/env bun
/**
 * Create Integration Test Specification Impulse
 * 
 * Creates an impulse containing the comprehensive technical specification
 * for DevBob integration tests across all containers.
 */

import { Instance } from "./repos/metabob-opencode/packages/opencode/src/project/instance"
import { SessionMemory } from "./repos/metabob-opencode/packages/opencode/src/session/session-memory"
import type { ActivityTemplate } from "./repos/metabob-opencode/packages/opencode/src/session/activity-template"
import { readFile } from "fs/promises"

console.log("╔══════════════════════════════════════════════════════════╗")
console.log("║        Creating Integration Test Specification Impulse  ║")
console.log("╚══════════════════════════════════════════════════════════╝\n")

const SPEC_FILE = "./DEVBOB_INTEGRATION_TEST_SPECIFICATION.md"
const SESSION_ID = `integration-test-spec-${Date.now()}`
const IMPULSE_ID = "devbob-integration-test-specification"

await Instance.provide({
  directory: `${process.cwd()}/repos/metabob-opencode`,
  fn: async () => {
    try {
      // Read the specification file
      console.log("📄 Reading specification file...")
      const specContent = await readFile(SPEC_FILE, 'utf-8')
      console.log(`   File size: ${(specContent.length / 1024).toFixed(2)} KB`)
      console.log(`   Lines: ${specContent.split('\n').length}`)
      
      // Create the impulse
      console.log("\n🧠 Creating integration test specification impulse...")
      
      const impulse: ActivityTemplate.Impulse.Schema = {
        id: IMPULSE_ID,
        type: "technicalSpecification",
        pointer: {
          type: "memo",
          content: specContent,
          source: "integration-test-analysis",
        },
        budget: 8000, // Large budget for comprehensive specification
        loaded: true,
        content: specContent,
        scope: "session", // Add session scope
        sessionID: SESSION_ID, // Add session ID
      }
      
      await SessionMemory.addImpulse(SESSION_ID, impulse)
      
      console.log(`✅ Impulse created successfully!`)
      console.log(`   Impulse ID: ${IMPULSE_ID}`)
      console.log(`   Session ID: ${SESSION_ID}`)
      console.log(`   Content size: ${impulse.content.length} characters`)
      console.log(`   Budget allocated: ${impulse.budget} tokens`)
      
      // Verify the impulse was created
      console.log("\n🔍 Verifying impulse creation...")
      const verifiedImpulse = await SessionMemory.getImpulse(SESSION_ID, IMPULSE_ID)
      
      if (verifiedImpulse) {
        console.log("✅ Impulse verification successful!")
        console.log(`   Stored content length: ${verifiedImpulse.content?.length || 0}`)
        console.log(`   Impulse type: ${verifiedImpulse.type}`)
        console.log(`   Budget: ${verifiedImpulse.budget}`)
      } else {
        console.log("❌ Impulse verification failed!")
        throw new Error("Impulse not found after creation")
      }
      
      console.log("\n📊 Specification Summary:")
      console.log("   ✓ Current system architecture analysis")
      console.log("   ✓ Impulse system limitations and optimizations")
      console.log("   ✓ Activity system integration points")
      console.log("   ✓ Metabob integration requirements")
      console.log("   ✓ Memory-aware optimization strategy")
      console.log("   ✓ Intelligent context selection algorithms")
      console.log("   ✓ Cross-container validation approach")
      console.log("   ✓ Performance requirements and constraints")
      console.log("   ✓ Data models and schema changes")
      console.log("   ✓ API changes and new interfaces")
      console.log("   ✓ Comprehensive testing strategy")
      
      console.log("\n🎯 Next Steps:")
      console.log("   1. Use this impulse in subsequent activity templates")
      console.log("   2. Reference for implementation planning")
      console.log("   3. Share across containers via ACP delegation")
      console.log("   4. Update as implementation progresses")
      
      console.log(`\n📝 To reference this impulse in activities:`)
      console.log(`   shareImpulses: ["${IMPULSE_ID}"]`)
      
      console.log("\n✅ Integration test specification impulse ready for use!")
      
    } catch (error) {
      console.error("❌ Failed to create impulse:", error)
      throw error
    }
  },
})