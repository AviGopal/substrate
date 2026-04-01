#!/usr/bin/env bun
/**
 * Test script for connection tracking endpoints
 *
 * Tests the full connection lifecycle:
 * 1. Claim a connection slot
 * 2. Send heartbeat
 * 3. List active connections
 * 4. Release connection
 */

const BASE_URL = process.env.USER_VESSEL_URL || "http://localhost:8080"

// Test configuration
const TEST_API_KEY = process.env.TEST_API_KEY || "live_test_key_123"
const INSTANCE_ID = `test-instance-${Date.now()}`

async function main() {
  console.log("=== Connection Tracking Test ===\n")

  try {
    // Step 1: Claim a connection
    console.log("1. Claiming connection...")
    const claimResponse = await fetch(`${BASE_URL}/v2/connections/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TEST_API_KEY,
        instance_id: INSTANCE_ID,
        instance_type: "cli",
        client_metadata: {
          test: true,
          timestamp: new Date().toISOString()
        }
      })
    })

    if (!claimResponse.ok) {
      const error = await claimResponse.json()
      console.error("  [FAIL] Claim connection:", error)
      return
    }

    const claimData = await claimResponse.json()
    console.log("  [OK] Connection claimed:")
    console.log("    Connection ID:", claimData.connection_id)
    console.log("    Instance ID:", claimData.instance_id)
    console.log("    Heartbeat interval:", claimData.heartbeat_interval_ms, "ms")

    // Step 2: Send heartbeat
    console.log("\n2. Sending heartbeat...")
    const heartbeatResponse = await fetch(`${BASE_URL}/v2/connections/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instance_id: INSTANCE_ID,
        client_metadata: {
          heartbeat_count: 1
        }
      })
    })

    if (!heartbeatResponse.ok) {
      const error = await heartbeatResponse.json()
      console.error("  [FAIL] Heartbeat:", error)
    } else {
      const heartbeatData = await heartbeatResponse.json()
      console.log("  [OK] Heartbeat sent:")
      console.log("    Last heartbeat:", heartbeatData.last_heartbeat_at)
      console.log("    Expires in:", heartbeatData.expires_in_ms, "ms")
    }

    // Step 3: List active connections
    console.log("\n3. Listing active connections...")
    const listResponse = await fetch(`${BASE_URL}/v2/connections`)

    if (!listResponse.ok) {
      const error = await listResponse.json()
      console.error("  [FAIL] List connections:", error)
    } else {
      const listData = await listResponse.json()
      console.log("  [OK] Active connections:", listData.total)
      if (listData.connections.length > 0) {
        console.log("    Sample connection:")
        const conn = listData.connections[0]
        console.log("      Instance ID:", conn.instance_id)
        console.log("      Instance type:", conn.instance_type)
        console.log("      Connected at:", conn.connected_at)
      }
    }

    // Step 4: Release connection
    console.log("\n4. Releasing connection...")
    const releaseResponse = await fetch(`${BASE_URL}/v2/connections/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instance_id: INSTANCE_ID
      })
    })

    if (!releaseResponse.ok) {
      const error = await releaseResponse.json()
      console.error("  [FAIL] Release connection:", error)
    } else {
      const releaseData = await releaseResponse.json()
      console.log("  [OK] Connection released:")
      console.log("    Connection ID:", releaseData.connection_id)
      console.log("    Disconnected at:", releaseData.disconnected_at)
    }

    // Step 5: Verify connection is released
    console.log("\n5. Verifying connection is released...")
    const verifyResponse = await fetch(`${BASE_URL}/v2/connections`)
    const verifyData = await verifyResponse.json()

    const stillActive = verifyData.connections.find(
      (c: any) => c.instance_id === INSTANCE_ID
    )

    if (stillActive) {
      console.log("  [WARN] Connection still shows as active")
    } else {
      console.log("  [OK] Connection successfully released")
    }

    console.log("\n=== Test Complete ===")
  } catch (error) {
    console.error("Test failed with error:", error)
    process.exit(1)
  }
}

main()
