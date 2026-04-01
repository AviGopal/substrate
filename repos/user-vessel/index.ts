#!/usr/bin/env bun
/**
 * user-vessel - User Management Vessel
 *
 * Manages organizations, users, projects, and API keys with RBAC enforcement.
 * Integrates with cloud dashboard for authentication and participates in the
 * learning loop through activity traces.
 *
 * Usage:
 *   user-vessel                    Start HTTP server
 *   user-vessel --help             Show this help
 */

import { Hono } from "hono"
import { cors } from "hono/cors"
import { loadConfig, configSummary } from "./src/config"
import { getRootDb, closeRootDb } from "./src/db/surreal"
import { authRoutes } from "./src/routes/auth"
import { userRoutes } from "./src/routes/users"
import { organizationRoutes } from "./src/routes/organizations"
import { projectRoutes } from "./src/routes/projects"
import { apiKeyRoutes } from "./src/routes/api-keys"
import { connectionRoutes } from "./src/routes/connections"
import type { UserVesselConfig } from "./src/types"

// =============================================================================
// CLI ARGUMENT PARSING
// =============================================================================

const args = process.argv.slice(2)
const isHelp = args.includes("--help") || args.includes("-h")

if (isHelp) {
  console.log(`
user-vessel - User Management Vessel

USAGE:
  user-vessel                    Start HTTP server
  user-vessel --help             Show this help

ENVIRONMENT VARIABLES:
  USER_VESSEL_PORT               Server port (default: 8080)
  USER_VESSEL_HOST               Bind address (default: 0.0.0.0)
  SURREALDB_URL                  SurrealDB endpoint
  SURREALDB_NAMESPACE            Database namespace (default: activity-system)
  SURREALDB_DATABASE             Database name (default: learning_loop)
  SURREALDB_USERNAME             Database username (default: root)
  SURREALDB_PASSWORD             Database password
  JWT_SECRET                     Secret for JWT signing
  JWT_EXPIRES_IN                 Token expiry duration (default: 15m)
  ACTIVITY_API_ENDPOINT          Activity API URL

EXAMPLES:
  # Start server with defaults
  user-vessel

  # Start with custom port
  USER_VESSEL_PORT=3000 user-vessel

  # Connect to remote database
  SURREALDB_URL=https://db.example.com user-vessel
`)
  process.exit(0)
}

// =============================================================================
// SERVER STARTUP
// =============================================================================

async function startServer() {
  // Load configuration
  const config = await loadConfig()
  console.log(configSummary(config))

  // Test database connection
  console.log("\n=== Database Connection ===")
  try {
    const db = await getRootDb(config)
    console.log("[OK] Connected to SurrealDB")
  } catch (error) {
    console.error("[FAIL] Could not connect to SurrealDB:", error)
    process.exit(1)
  }

  // Apply schema migrations
  console.log("\n=== Schema Migrations ===")
  try {
    await applyMigrations(config)
    console.log("[OK] Schema migrations applied")
  } catch (error) {
    console.error("[FAIL] Schema migration failed:", error)
    // Don't exit - maybe schema already exists
  }

  // Create Hono app
  const app = new Hono()

  // CORS middleware
  app.use("/*", cors({
    origin: "*",  // TODO: Configure allowed origins
    credentials: true,
  }))

  // Health check
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      vessel: "user-vessel",
      version: "0.1.0",
    })
  })

  // Vessel manifest
  app.get("/manifest", (c) => {
    return c.json({
      id: "user-vessel",
      name: "User Management Vessel",
      version: "0.1.0",
      capabilities: ["user-management", "rbac", "jwt-auth"],
      impulseTypes: ["user_profile", "org_settings", "api_key_info", "project_list"],
      activities: ["user-vessel:onboard-user", "user-vessel:provision-organization"],
    })
  })

  // Mount routes with config
  app.route("/v2/auth", authRoutes(config))
  app.route("/v2/users", userRoutes(config))
  app.route("/v2/organizations", organizationRoutes(config))
  app.route("/v2/projects", projectRoutes(config))
  app.route("/v2/api-keys", apiKeyRoutes(config))
  app.route("/v2/connections", connectionRoutes(config))

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: "Not found" }, 404)
  })

  // Error handler
  app.onError((err, c) => {
    console.error("Error:", err)
    return c.json({ error: err.message || "Internal server error" }, 500)
  })

  // Start server
  const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    fetch: app.fetch,
  })

  console.log(`\n[OK] user-vessel running on http://${config.host}:${config.port}`)
  console.log(`  Health: http://${config.host}:${config.port}/health`)
  console.log(`  Manifest: http://${config.host}:${config.port}/manifest`)
  console.log(`\nPress Ctrl+C to stop.\n`)

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...")
    await closeRootDb()
    process.exit(0)
  })
}

/**
 * Apply database schema migrations
 */
async function applyMigrations(config: UserVesselConfig) {
  const db = await getRootDb(config)

  // Apply migrations in order
  const migrations = [
    "001-user-vessel-extensions.surql",
    "002-connection-tracking.surql",
  ]

  for (const migration of migrations) {
    const migrationPath = `${import.meta.dir}/sql/${migration}`
    const file = Bun.file(migrationPath)

    if (await file.exists()) {
      const sql = await file.text()
      await db.query(sql)
      console.log(`  Applied: ${migration}`)
    } else {
      console.log(`  [SKIP] ${migration} not found`)
    }
  }
}

// Start the server
startServer().catch((error) => {
  console.error("Failed to start server:", error)
  process.exit(1)
})
