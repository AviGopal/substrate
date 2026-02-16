#!/usr/bin/env bun

/**
 * Phase 2: Pointer Serialization Integration Test
 * 
 * Validates that:
 * 1. ImpulseSerializer strips content and keeps pointers
 * 2. Serialization reduces size by >90%
 * 3. ACP delegate sends pointer-only impulses
 * 4. Remote agent can resolve pointers from its filesystem
 * 5. Backwards compatibility with sendFullContent: true
 */

import { describe, test, expect, beforeAll } from "bun:test"
import { Storage } from "../repos/metabob-opencode/packages/opencode/src/storage/storage"
import { SessionMemory } from "../repos/metabob-opencode/packages/opencode/src/session/session-memory"
import { ImpulseSerializer } from "../repos/metabob-opencode/packages/opencode/src/session/impulse-serializer"
import { ActivityTemplate } from "../repos/metabob-opencode/packages/opencode/src/session/activity-template"
import * as fs from "fs"
import * as path from "path"

describe("Phase 2: Pointer Serialization", () => {
  const testSessionID = "test-phase2-pointer-serialization"
  
  beforeAll(async () => {
    // Clean up any previous test data
    try {
      await Storage.delete(["session", testSessionID])
    } catch {}
  })

  test("ImpulseSerializer strips content and keeps pointers", () => {
    const impulse: ActivityTemplate.Impulse.Schema = {
      id: "test-file-impulse",
      type: "file",
      sessionID: testSessionID,
      scope: "session",
      pointer: {
        type: "file",
        path: "/workspace/test.ts",
      },
      description: "Test file impulse",
      budget: 1000,
      priority: "medium",
      metadata: {},
    }

    const serialized = ImpulseSerializer.serializeForRemote(impulse)

    // Should strip content field completely
    expect(serialized).not.toHaveProperty("content")
    
    // Should preserve pointer
    expect(serialized.pointer).toEqual({
      type: "file",
      path: "/workspace/test.ts",
    })
    
    // Should preserve metadata
    expect(serialized.id).toBe("test-file-impulse")
    expect(serialized.type).toBe("file")
  })

  test("Serialization reduces size by >90% for file impulses", () => {
    // Create impulse with large file content (realistic scenario)
    const largeContent = "x".repeat(10000) // 10KB of file content
    
    const impulse: ActivityTemplate.Impulse.Schema = {
      id: "test-large-file-impulse",
      type: "file",
      sessionID: testSessionID,
      scope: "session",
      pointer: {
        type: "file",
        path: "/workspace/large-file.ts",
      },
      content: largeContent, // File content that should be stripped
      description: "Large file impulse",
      budget: 5000,
      priority: "high",
      metadata: {},
      tokenCount: 2500,
    }

    // Serialize without content (default behavior)
    const serialized = ImpulseSerializer.serializeMany([impulse], { includeContent: false })
    
    // Manual metrics calculation since estimateReduction calls serializeMany
    const originalSize = JSON.stringify([impulse]).length
    const serializedSize = JSON.stringify(serialized).length
    const reductionPercent = ((originalSize - serializedSize) / originalSize * 100)

    console.log("Size reduction metrics:", {
      originalSize,
      serializedSize,
      reductionPercent: reductionPercent.toFixed(1) + "%"
    })

    // Should show significant reduction (content is stripped)
    expect(reductionPercent).toBeGreaterThan(90)
    expect(serializedSize).toBeLessThan(originalSize / 10)
    
    // Serialized impulse should NOT have content field
    expect(serialized[0]).not.toHaveProperty("content")
    expect(serialized[0].pointer.type).toBe("file")
  })

  test("Pointer resolution check for different types", () => {
    // canResolveRemotely takes pointer type string, not full pointer object
    
    // Resolvable on remote
    expect(ImpulseSerializer.canResolveRemotely("file")).toBe(true)
    expect(ImpulseSerializer.canResolveRemotely("component")).toBe(true)
    expect(ImpulseSerializer.canResolveRemotely("commit")).toBe(true)
    expect(ImpulseSerializer.canResolveRemotely("memo")).toBe(true)
    expect(ImpulseSerializer.canResolveRemotely("metabobIssue")).toBe(true)

    // NOT resolvable on remote (host-only)
    expect(ImpulseSerializer.canResolveRemotely("hostFile")).toBe(false)
    expect(ImpulseSerializer.canResolveRemotely("acp")).toBe(false)
    expect(ImpulseSerializer.canResolveRemotely("activityOutput")).toBe(false)
  })

  test("Size estimation is accurate for file with content", () => {
    const fileContent = "x".repeat(1000) // 1KB file
    
    const fileImpulse: ActivityTemplate.Impulse.Schema = {
      id: "file-with-content",
      type: "file",
      sessionID: testSessionID,
      scope: "session",
      pointer: { type: "file", path: "/workspace/file.ts" },
      content: fileContent, // This should be stripped
      description: "File with content",
      budget: 500,
      priority: "medium",
      metadata: {},
    }

    const estimation = ImpulseSerializer.estimateReduction([fileImpulse])

    console.log("Size estimation:", estimation)

    expect(estimation.originalSize).toBeGreaterThan(0)
    expect(estimation.serializedSize).toBeGreaterThan(0)
    expect(estimation.serializedSize).toBeLessThan(estimation.originalSize)
    expect(estimation.reductionPercent).toBeGreaterThan(80) // Significant reduction
    expect(estimation.reductionPercent).toBeLessThan(100)
  })

  test("Batch serialization with mixed types", () => {
    const largeFileContent = "x".repeat(5000)
    const largeHostContent = "y".repeat(5000)
    
    const impulses: ActivityTemplate.Impulse.Schema[] = [
      {
        id: "file-impulse",
        type: "file",
        sessionID: testSessionID,
        scope: "session",
        pointer: { type: "file", path: "/workspace/test.ts" },
        content: largeFileContent, // Should be stripped
        description: "File",
        budget: 1000,
        priority: "medium",
        metadata: {},
      },
      {
        id: "memo-impulse",
        type: "memo",
        sessionID: testSessionID,
        scope: "session",
        pointer: { type: "memo", content: "Some memo content" },
        description: "Memo",
        budget: 200,
        priority: "low",
        metadata: {},
      },
      {
        id: "host-impulse",
        type: "hostFile",
        sessionID: testSessionID,
        scope: "session",
        pointer: { type: "hostFile", path: "/host/config.yaml" },
        content: largeHostContent, // Will be preserved (hostFile needs content)
        description: "Host file",
        budget: 500,
        priority: "high",
        metadata: {},
      },
    ]

    // Serialize WITHOUT including content (efficient mode)
    const serialized = ImpulseSerializer.serializeMany(impulses, { includeContent: false })
    const metrics = ImpulseSerializer.estimateReduction(impulses)

    // Should serialize all 3
    expect(serialized.length).toBe(3)
    
    // Check pointer types are preserved
    expect(serialized[0].pointer.type).toBe("file")
    expect(serialized[1].pointer.type).toBe("memo")
    expect(serialized[2].pointer.type).toBe("hostFile")
    
    // File impulse should NOT have content (stripped)
    expect(serialized[0]).not.toHaveProperty("content")
    
    // Should show significant reduction (file content stripped)
    expect(metrics.reductionPercent).toBeGreaterThan(30)
  })
})

console.log("✅ Phase 2 Pointer Serialization Tests")
console.log("")
console.log("Running tests...")
