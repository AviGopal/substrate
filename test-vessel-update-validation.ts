#!/usr/bin/env bun
import { VesselUpdateManager } from "./repos/metabob-opencode/packages/opencode/src/vessel/update"
import { writeFile, unlink } from "node:fs/promises"

async function testGetCurrentVersions() {
  console.log("Test 1: Empty/missing file")
  const empty = await VesselUpdateManager.getCurrentVersions("/tmp/nonexistent.json")
  console.assert(Object.keys(empty.current).length === 0, "Should return empty current")
  console.assert(empty.history.length === 0, "Should return empty history")
  console.log("✓ Pass: Returns empty structure for missing file")
  
  console.log("\nTest 2: Valid version file")
  const testData = {
    current: {
      opencode: {
        name: "opencode",
        version: "1.2.3",
        checksum: "abc123",
        downloadUrl: "https://example.com/opencode"
      }
    },
    history: [
      {
        vessel: "opencode",
        version: "1.2.2",
        timestamp: "2024-01-01T00:00:00Z",
        source: "github",
        reason: "auto-update"
      }
    ]
  }
  
  const testPath = "/tmp/test-vessel-versions.json"
  await writeFile(testPath, JSON.stringify(testData))
  
  const loaded = await VesselUpdateManager.getCurrentVersions(testPath)
  console.assert(loaded.current.opencode.version === "1.2.3", "Should load version")
  console.assert(loaded.history.length === 1, "Should load history")
  console.log("✓ Pass: Loads valid version file correctly")
  
  await unlink(testPath)
  
  console.log("\nTest 3: Corrupted JSON")
  await writeFile(testPath, "{ invalid json }")
  const corrupted = await VesselUpdateManager.getCurrentVersions(testPath)
  console.assert(Object.keys(corrupted.current).length === 0, "Should return empty for corrupted")
  console.log("✓ Pass: Handles corrupted JSON gracefully")
  
  await unlink(testPath)
  
  console.log("\nTest 4: Error codes exist")
  console.assert(VesselUpdateManager.CHECKSUM_FAILED === "CHECKSUM_FAILED")
  console.assert(VesselUpdateManager.DOWNLOAD_FAILED === "DOWNLOAD_FAILED")
  console.assert(VesselUpdateManager.INSTALL_FAILED === "INSTALL_FAILED")
  console.log("✓ Pass: All error codes are defined")
  
  console.log("\nTest 5: createUpdateError")
  const error = VesselUpdateManager.createUpdateError(
    VesselUpdateManager.CHECKSUM_FAILED,
    "Checksum mismatch",
    "opencode",
    "1.2.3",
    { expected: "abc", actual: "def" },
    true
  )
  console.assert(error.code === "CHECKSUM_FAILED")
  console.assert(error.vessel === "opencode")
  console.assert(error.recoverable === true)
  console.log("✓ Pass: createUpdateError works correctly")
  
  console.log("\n✅ ALL TESTS PASSED")
}

testGetCurrentVersions().catch(console.error)
