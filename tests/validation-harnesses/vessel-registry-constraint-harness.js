/**
 * Validation Harness: Vessel Registry Constraint
 * 
 * Validates that SurrealDB vessel_registry table contains all 3 vessels
 * (devbob-0, devbob-1, devbob-2) with their pod IPs, ACP endpoints, 
 * status, and heartbeat timestamps.
 * 
 * Validation Strategy: external-impulse-surrealdb-query
 */

/**
 * Query SurrealDB vessel_registry table
 */
async function querySurrealDB(query, config) {
  const host = config.host || process.env.SURREAL_HOST || "localhost"
  const port = config.port || process.env.SURREAL_PORT || "8000"
  const user = config.user || process.env.SURREAL_USER || "root"
  const pass = config.pass || process.env.SURREAL_PASS || "root"
  const ns = config.namespace || process.env.SURREAL_NAMESPACE || "metabob"
  const db = config.database || process.env.SURREAL_DATABASE || "devbob"

  const url = `http://${host}:${port}/sql`
  const auth = Buffer.from(`${user}:${pass}`).toString("base64")

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "NS": ns,
      "DB": db,
      "Authorization": `Basic ${auth}`
    },
    body: query
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`SurrealDB query failed: HTTP ${response.status} - ${text}`)
  }

  return await response.json()
}

/**
 * Main validation function
 */
export async function runValidation(config = {}) {
  const errors = []
  const warnings = []

  const expected = {
    minRecordCount: 3,
    expectedVesselNames: ["devbob-0", "devbob-1", "devbob-2"],
    requiredFields: [
      "pod_name",
      "pod_ip", 
      "acp_endpoint",
      "status",
      "last_heartbeat",
      "registered_at"
    ]
  }

  console.log("[INFO] Starting vessel registry validation")

  try {
    const query = `SELECT * FROM vessel_registry WHERE status = "running";`
    const result = await querySurrealDB(query, config)

    let vessels = []
    if (Array.isArray(result) && result.length > 0) {
      if (result[0].result && Array.isArray(result[0].result)) {
        vessels = result[0].result
      } else if (result[0].status === "ERR") {
        errors.push(`SurrealDB query error: ${result[0].result}`)
        return {
          pass: false,
          actual: { recordCount: 0, vessels: [], foundVesselNames: [] },
          expected,
          errors,
          warnings
        }
      }
    }

    const recordCount = vessels.length
    const foundVesselNames = vessels.map(v => v.pod_name).sort()

    console.log(`[INFO] Found ${recordCount} vessels: ${foundVesselNames.join(", ")}`)

    const actual = {
      recordCount,
      vessels,
      foundVesselNames
    }

    // Check 1: Minimum record count
    if (recordCount < expected.minRecordCount) {
      errors.push(
        `Insufficient vessels: found ${recordCount}, expected at least ${expected.minRecordCount}`
      )
    }

    // Check 2: Verify expected vessel names
    const missingVessels = expected.expectedVesselNames.filter(
      name => !foundVesselNames.includes(name)
    )
    if (missingVessels.length > 0) {
      errors.push(`Missing vessels: ${missingVessels.join(", ")}`)
    }

    // Check 3: Verify required fields
    for (const vessel of vessels) {
      const missingFields = expected.requiredFields.filter(
        field => !(field in vessel) || vessel[field] === null
      )
      
      if (missingFields.length > 0) {
        errors.push(
          `Vessel ${vessel.pod_name} missing fields: ${missingFields.join(", ")}`
        )
      }

      // Check 4: Validate field content
      if (vessel.pod_ip === "unknown" || !vessel.pod_ip) {
        warnings.push(`Vessel ${vessel.pod_name} has unknown or missing pod_ip`)
      }

      if (!vessel.acp_endpoint.includes("devbob-headless")) {
        warnings.push(
          `Vessel ${vessel.pod_name} has unexpected acp_endpoint format: ${vessel.acp_endpoint}`
        )
      }

      // Check 5: Validate heartbeat freshness (within last 5 minutes)
      try {
        const heartbeat = new Date(vessel.last_heartbeat)
        const now = new Date()
        const diffMinutes = (now - heartbeat) / 1000 / 60

        if (diffMinutes > 5) {
          warnings.push(
            `Vessel ${vessel.pod_name} heartbeat is stale (${diffMinutes.toFixed(1)} minutes old)`
          )
        }
      } catch (e) {
        warnings.push(
          `Vessel ${vessel.pod_name} has invalid last_heartbeat format`
        )
      }
    }

    const pass = errors.length === 0

    if (pass) {
      console.log(`[INFO] ✅ Vessel registry validation PASSED (${warnings.length} warnings)`)
    } else {
      console.error(`[ERROR] ❌ Vessel registry validation FAILED (${errors.length} errors)`)
    }

    return { pass, actual, expected, errors, warnings }

  } catch (error) {
    errors.push(`Validation error: ${error.message}`)
    console.error("[ERROR] Validation exception:", error.message)

    return {
      pass: false,
      actual: { recordCount: 0, vessels: [], foundVesselNames: [] },
      expected,
      errors,
      warnings
    }
  }
}

/**
 * CLI entry point
 */
async function main() {
  console.log("=".repeat(80))
  console.log("Vessel Registry Constraint Validation Harness")
  console.log("=".repeat(80))
  console.log()

  const config = {
    host: process.env.SURREAL_HOST || "localhost",
    port: process.env.SURREAL_PORT || "8000"
  }

  console.log(`Configuration: ${config.host}:${config.port}`)
  console.log()

  const result = await runValidation(config)

  console.log("Results:")
  console.log(`  Status: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
  console.log(`  Records found: ${result.actual.recordCount}`)
  console.log()

  if (result.errors.length > 0) {
    console.log("Errors:")
    result.errors.forEach(err => console.log(`  ❌ ${err}`))
  }

  if (result.warnings.length > 0) {
    console.log("Warnings:")
    result.warnings.forEach(warn => console.log(`  ⚠️  ${warn}`))
  }

  if (result.pass && result.actual.vessels.length > 0) {
    console.log("\nDetails:")
    result.actual.vessels.forEach(vessel => {
      console.log(`  - ${vessel.pod_name}: ${vessel.pod_ip} → ${vessel.acp_endpoint}`)
    })
  }

  process.exit(result.pass ? 0 : 1)
}

if (require.main === module) {
  main().catch(error => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
}
