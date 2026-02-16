#!/usr/bin/env bun
/**
 * Phase 2: End-to-End Pointer Serialization Test
 * 
 * Tests the complete pointer serialization flow:
 * 1. Create impulses with large content
 * 2. Serialize to pointers (strip content)
 * 3. Send via ACP delegation to remote agent
 * 4. Remote agent resolves pointers from its filesystem
 * 5. Verify 90%+ prompt size reduction
 * 6. Test backwards compatibility (sendFullContent: true)
 */

import { Instance } from "../repos/metabob-opencode/packages/opencode/src/project/instance"
import { ACPDelegateTool } from "../repos/metabob-opencode/packages/opencode/src/tool/acp-delegate"
import { SessionMemory } from "../repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { ImpulseSerializer } from "../repos/metabob-opencode/packages/opencode/src/session/impulse-serializer"
import type { ActivityTemplate } from "../repos/metabob-opencode/packages/opencode/src/session/activity-template"
import * as fs from "fs"
import * as path from "path"

const CONTAINER_NAME = process.env.DEVBOB_CONTAINER || "devbob-opencode"
const TARGET = `docker://${CONTAINER_NAME}`
const TEST_SESSION_ID = `test-phase2-e2e-${Date.now()}`

console.log("🧪 Phase 2: End-to-End Pointer Serialization Test")
console.log("=" .repeat(60))
console.log(`Target: ${TARGET}`)
console.log(`Session: ${TEST_SESSION_ID}`)
console.log("")

async function runTests() {
  await Instance.provide({
    directory: `${process.cwd()}/repos/metabob-opencode`,
    fn: async () => {
      console.log("📋 Test 1: Pointer-Only Delegation (Efficient Mode)")
      console.log("-".repeat(60))
      
      try {
        // Initialize ACP tool
        const acpTool = await ACPDelegateTool.init()
        console.log("✅ ACP Tool initialized")
        
        // Create test file in the remote container's workspace
        const testFilePath = "/workspace/test-phase2-file.ts"
        const testFileContent = `/**
 * Test file for Phase 2 pointer serialization
 * This file contains significant content to test size reduction
 */

export class AuthenticationService {
  private users: Map<string, User> = new Map()
  
  async login(username: string, password: string): Promise<User | null> {
    const user = this.users.get(username)
    if (!user) return null
    
    const valid = await this.verifyPassword(password, user.passwordHash)
    if (!valid) return null
    
    return user
  }
  
  async register(username: string, password: string): Promise<User> {
    if (this.users.has(username)) {
      throw new Error("User already exists")
    }
    
    const passwordHash = await this.hashPassword(password)
    const user: User = {
      id: crypto.randomUUID(),
      username,
      passwordHash,
      createdAt: new Date(),
    }
    
    this.users.set(username, user)
    return user
  }
  
  private async hashPassword(password: string): Promise<string> {
    // Simulated password hashing
    return Buffer.from(password).toString("base64")
  }
  
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const computed = await this.hashPassword(password)
    return computed === hash
  }
}

interface User {
  id: string
  username: string
  passwordHash: string
  createdAt: Date
}
`

        // Create impulse with large file content
        const impulse: ActivityTemplate.Impulse.Schema = {
          id: "test-file-impulse-large",
          type: "file",
          sessionID: TEST_SESSION_ID,
          scope: "session",
          pointer: {
            type: "file",
            path: testFilePath,
          },
          content: testFileContent,
          description: "Large test file for pointer serialization",
          budget: 2000,
          priority: "high",
          metadata: {
            testId: "phase2-e2e-pointer-only",
          },
        }
        
        // Calculate sizes
        const originalSize = JSON.stringify([impulse]).length
        const serialized = ImpulseSerializer.serializeMany([impulse], { includeContent: false })
        const serializedSize = JSON.stringify(serialized).length
        const reduction = ((originalSize - serializedSize) / originalSize * 100).toFixed(1)
        
        console.log(`📊 Size Metrics:`)
        console.log(`   Original size: ${originalSize} bytes`)
        console.log(`   Serialized size: ${serializedSize} bytes`)
        console.log(`   Reduction: ${reduction}%`)
        console.log("")
        
        if (parseFloat(reduction) < 90) {
          console.log(`⚠️  Warning: Size reduction is ${reduction}%, expected >90%`)
        } else {
          console.log(`✅ Size reduction target met: ${reduction}% > 90%`)
        }
        console.log("")
        
        // First, write the test file to remote so pointer can resolve
        console.log("📝 Writing test file to remote container...")
        const writeResult = await acpTool.execute(
          {
            target: TARGET,
            taskDescription: "Write test file for pointer resolution",
            prompt: `Please create a file at ${testFilePath} with the following content:

\`\`\`typescript
${testFileContent}
\`\`\`

Just write the file, no other work needed. Respond with "File written" when complete.`,
            timeout: 60,
          },
          {
            sessionID: `${TEST_SESSION_ID}-setup`,
            activityId: undefined,
            taskId: undefined,
          } as any,
        )
        
        if (!writeResult.metadata?.success) {
          console.log("❌ Failed to write test file to remote")
          console.log("Error:", writeResult.metadata?.error)
          return
        }
        console.log("✅ Test file written to remote")
        console.log("")
        
        // Now delegate with pointer-only impulse (sendFullContent: false)
        console.log("🚀 Delegating with pointer-only impulse...")
        const result = await acpTool.execute(
          {
            target: TARGET,
            taskDescription: "Test pointer resolution",
            prompt: `You have received a shared impulse pointing to a file. 
            
Please:
1. Resolve the pointer using ImpulseResolver.resolveForPrompt()
2. Read the file content
3. Confirm you can see the AuthenticationService class
4. Report the first method name you find

This tests that pointer serialization works correctly.`,
            shareImpulses: ["test-file-impulse-large"],
            sendFullContent: false, // POINTER-ONLY MODE (efficient)
            timeout: 90,
          },
          {
            sessionID: TEST_SESSION_ID,
            activityId: undefined,
            taskId: undefined,
          } as any,
        )
        
        if (result.metadata?.success) {
          console.log("✅ Pointer-only delegation successful!")
          console.log("")
          console.log("Response preview:")
          console.log(result.output.slice(0, 500))
          console.log("")
          
          // Check if remote agent resolved the pointer correctly
          if (result.output.toLowerCase().includes("authentication") || 
              result.output.toLowerCase().includes("login")) {
            console.log("✅ Remote agent successfully resolved pointer and read file!")
          } else {
            console.log("⚠️  Response doesn't mention expected content")
          }
        } else {
          console.log("❌ Pointer-only delegation failed")
          console.log("Error:", result.metadata?.error)
        }
        
        console.log("")
        console.log("")
        console.log("📋 Test 2: Backwards Compatibility (sendFullContent: true)")
        console.log("-".repeat(60))
        
        // Test backwards compatibility with full content
        const legacyResult = await acpTool.execute(
          {
            target: TARGET,
            taskDescription: "Test full content mode",
            prompt: `You have received a shared impulse with FULL CONTENT (backwards compatibility mode).

Please confirm you can see the content directly without needing to resolve a pointer.
Look for the AuthenticationService class and report the first method name.`,
            shareImpulses: ["test-file-impulse-large"],
            sendFullContent: true, // LEGACY MODE (full content)
            timeout: 90,
          },
          {
            sessionID: `${TEST_SESSION_ID}-legacy`,
            activityId: undefined,
            taskId: undefined,
          } as any,
        )
        
        if (legacyResult.metadata?.success) {
          console.log("✅ Full content mode successful!")
          console.log("")
          console.log("Response preview:")
          console.log(legacyResult.output.slice(0, 500))
          console.log("")
          
          if (legacyResult.output.toLowerCase().includes("authentication") || 
              legacyResult.output.toLowerCase().includes("login")) {
            console.log("✅ Remote agent received and processed full content!")
          }
        } else {
          console.log("❌ Full content mode failed")
          console.log("Error:", legacyResult.metadata?.error)
        }
        
        console.log("")
        console.log("")
        console.log("=" .repeat(60))
        console.log("📊 Phase 2 E2E Test Summary")
        console.log("=" .repeat(60))
        console.log(`✅ Pointer serialization: ${reduction}% size reduction`)
        console.log(`✅ Pointer-only delegation: ${result.metadata?.success ? "PASS" : "FAIL"}`)
        console.log(`✅ Backwards compatibility: ${legacyResult.metadata?.success ? "PASS" : "FAIL"}`)
        console.log("")
        
        if (result.metadata?.success && legacyResult.metadata?.success && parseFloat(reduction) > 90) {
          console.log("🎉 All Phase 2 tests PASSED!")
          process.exit(0)
        } else {
          console.log("❌ Some tests FAILED")
          process.exit(1)
        }
        
      } catch (error) {
        console.log("❌ Test failed with error:", error)
        process.exit(1)
      }
    }
  })
}

// Check if container is available
import { execSync } from "child_process"

try {
  execSync(`docker inspect ${CONTAINER_NAME}`, { stdio: "ignore" })
  console.log(`✅ Container ${CONTAINER_NAME} is running`)
  console.log("")
} catch {
  console.log(`❌ Container ${CONTAINER_NAME} is not running`)
  console.log("")
  console.log(`Please start the container first:`)
  console.log(`  docker-compose --profile devbob up -d`)
  console.log("")
  process.exit(1)
}

runTests().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
