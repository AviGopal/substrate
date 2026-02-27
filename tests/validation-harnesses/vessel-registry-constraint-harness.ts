/**
 * Validation Harness: Vessel Registry Constraint
 * 
 * Validates that SurrealDB vessel_registry table contains all 3 vessels
 * (devbob-0, devbob-1, devbob-2) with their pod IPs, ACP endpoints, 
 * status, and heartbeat timestamps.
 * 
 * Validation Strategy: external-impulse-surrealdb-query
 * 
 * This harness:
 * 1. Queries SurrealDB vessel_registry table
 * 2. Validates record count (must be >= 3)
 * 3. Validates all required fields are present
 * 4. Validates vessel names match expected set
 * 5. Returns PASS/FAIL with detailed results
 */

/**
 * Configuration for SurrealDB connection
 */
export interface SurrealDBConfig {
  host?: string
  port?: string | number
  user?: string
  pass?: string
  namespace?: string
  database?: string
}

/**
 * Vessel registry record structure
 */
export interface VesselRecord {
  pod_name: string
  pod_ip: string
  acp_endpoint: string
  status: string
  last_heartbeat: string
  registered_at: string
}

/**
 * Validation result structure
 */
export interface ValidationResult {
  pass: boolean
  actual: {
    recordCount: number
    vessels: VesselRecord[]
    foundVesselNames: string[]
  }
  expected: {
    minRecordCount: number
    expectedVesselNames: string[]
    requiredFields: string[]
  }
  errors: string[]
  warnings: string[]
}

/**
 * Query SurrealDB vessel_registry table
 */
async function querySurrealDB(
  query: string,
  config: SurrealDBConfig
): Promise<any> {
  const host = config.host || "localhost"
  const port = config.port || "8000"
  const user = config.user || "root"
  const pass = config.pass || "root"
  const ns = config.namespace || "metabob"
  const db = config.database || "devbob"

  const url = `http://${host}:${port}/sql`
  
  // Create basic auth header
  const authString = `${user}:${pass}`
  const authBuffer = new TextEncoder().encode(authString)
  const authBase64 = btoa(String.fromCharCode(...authBuffer))

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      "NS": ns,
      "DB": db,
      "Authorization": `Basic ${authBase64}`
    },
    body: query
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`SurrealDB query failed: HTTP ${response.status} - ${text}`)
  }

  const result = await response.json()
  return result
}

/**
 * Main validation function
 * 
 * @param config - SurrealDB connection configuration
 * @returns ValidationResult with pass/fail status and details
 */
export async function runValidation(
  config: SurrealDBConfig = {}
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

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
    // Query for running vessels
    const query = `SELECT * FROM vessel_registry WHERE status = "running";`
    const result = await querySurrealDB(query, config)

    // Extract records from SurrealDB response format
    // SurrealDB returns: [{ result: [...records...] }]
    let vessels: VesselRecord[] = []
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

    // Validation checks
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

    // Check 2: Verify expected vessel names are present
    const missingVessels = expected.expectedVesselNames.filter(
      name => !foundVesselNames.includes(name)
    )
    if (missingVessels.length > 0) {
      errors.push(
        `Missing vessels: ${missingVessels.join(", ")}`
      )
    }

    // Check 3: Verify all required fields are present for each vessel
    for (const vessel of vessels) {
      const missingFields = expected.requiredFields.filter(
        field => !(field in vessel) || vessel[field as keyof VesselRecord] === null
      )
      
      if (missingFields.length > 0) {
        errors.push(
          `Vessel ${vessel.pod_name} missing fields: ${missingFields.join(", ")}`
        )
      }

      // Check 4: Validate field content
      if (vessel.pod_ip === "unknown" || !vessel.pod_ip) {
        warnings.push(
          `Vessel ${vessel.pod_name} has unknown or missing pod_ip`
        )
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
        const diffMs = now.getTime() - heartbeat.getTime()
        const diffMinutes = diffMs / 1000 / 60

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

    return {
      pass,
      actual,
      expected,
      errors,
      warnings
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    errors.push(`Validation error: ${errorMsg}`)
    
    console.error("[ERROR] Validation exception:", errorMsg)

    return {
      pass: false,
      actual: {
        recordCount: 0,
        vessels: [],
        foundVesselNames: []
      },
      expected,
      errors,
      warnings
    }
  }
}

/**
 * CLI entry point for standalone execution
 */
export async function main() {
  console.log("=".repeat(80))
  console.log("Vessel Registry Constraint Validation Harness")
  console.log("=".repeat(80))
  console.log()

  // Get config from environment or use defaults
  const config: SurrealDBConfig = {
    host: process.env.SURREAL_HOST || "localhost",
    port: process.env.SURREAL_PORT || "8000",
    user: process.env.SURREAL_USER || "root",
    pass: process.env.SURREAL_PASS || "root",
    namespace: process.env.SURREAL_NAMESPACE || "metabob",
    database: process.env.SURREAL_DATABASE || "devbob"
  }

  console.log("Configuration:")
  console.log(`  Host: ${config.host}:${config.port}`)
  console.log(`  Namespace: ${config.namespace}`)
  console.log(`  Database: ${config.database}`)
  console.log()

  const result = await runValidation(config)

  console.log("Results:")
  console.log(`  Status: ${result.pass ? "✅ PASS" : "❌ FAIL"}`)
  console.log(`  Records found: ${result.actual.recordCount}`)
  console.log(`  Vessels: ${result.actual.foundVesselNames.join(", ")}`)
  console.log()

  if (result.errors.length > 0) {
    console.log("Errors:")
    result.errors.forEach(err => console.log(`  ❌ ${err}`))
    console.log()
  }

  if (result.warnings.length > 0) {
    console.log("Warnings:")
    result.warnings.forEach(warn => console.log(`  ⚠️  ${warn}`))
    console.log()
  }

  if (result.pass) {
    console.log("Details:")
    result.actual.vessels.forEach(vessel => {
      console.log(`  - ${vessel.pod_name}:`)
      console.log(`      IP: ${vessel.pod_ip}`)
      console.log(`      Endpoint: ${vessel.acp_endpoint}`)
      console.log(`      Status: ${vessel.status}`)
      console.log(`      Heartbeat: ${vessel.last_heartbeat}`)
    })
  }

  process.exit(result.pass ? 0 : 1)
}

// Run if executed directly via CLI
if (typeof require !== "undefined" && require.main === module) {
  main().catch(error => {
    console.error("Fatal error:", error)
    process.exit(1)
  })
}
