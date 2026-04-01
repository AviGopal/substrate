/**
 * Configuration loading for user-vessel
 *
 * Priority:
 * 1. Environment variables (highest)
 * 2. Project config (.metabob/user-vessel.json)
 * 3. Global config (~/.metabob/config.json)
 * 4. Defaults (lowest)
 */

import type { UserVesselConfig } from "./types"
import { homedir } from "os"
import { join } from "path"

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const defaultConfig: UserVesselConfig = {
  port: 8080,
  host: "0.0.0.0",
  surrealdb: {
    url: "http://surrealdb.activity-system.svc.cluster.local:8000",
    namespace: "activity-system",
    database: "learning_loop",
    username: "root",
    password: "surrealdb-local-dev-123",
  },
  jwt: {
    secret: "metabob-jwt-secret-key-change-in-production",
    expiresIn: "15m",
  },
  activityApi: {
    endpoint: "http://metabob-activity-api.activity-system.svc.cluster.local:8080",
  },
}

// =============================================================================
// CONFIGURATION LOADING
// =============================================================================

/**
 * Load configuration with priority chain
 */
export async function loadConfig(): Promise<UserVesselConfig> {
  // Start with defaults
  const config: UserVesselConfig = JSON.parse(JSON.stringify(defaultConfig))

  // Try to load project config
  try {
    const projectConfigPath = join(process.cwd(), ".metabob", "user-vessel.json")
    const file = Bun.file(projectConfigPath)
    if (await file.exists()) {
      const projectConfig = await file.json()
      mergeConfig(config, projectConfig)
    }
  } catch {
    // Project config doesn't exist, continue with defaults
  }

  // Try to load global config
  try {
    const globalConfigPath = join(homedir(), ".metabob", "config.json")
    const file = Bun.file(globalConfigPath)
    if (await file.exists()) {
      const globalConfig = await file.json()
      if (globalConfig.userVessel) {
        mergeConfig(config, globalConfig.userVessel)
      }
    }
  } catch {
    // Global config doesn't exist, continue
  }

  // Override with environment variables (highest priority)
  if (process.env.PORT || process.env.USER_VESSEL_PORT) {
    config.port = parseInt(process.env.PORT || process.env.USER_VESSEL_PORT || "8080")
  }
  if (process.env.HOST || process.env.USER_VESSEL_HOST) {
    config.host = process.env.HOST || process.env.USER_VESSEL_HOST || "0.0.0.0"
  }

  // SurrealDB config
  if (process.env.SURREALDB_URL) {
    config.surrealdb.url = process.env.SURREALDB_URL
  }
  if (process.env.SURREALDB_NAMESPACE) {
    config.surrealdb.namespace = process.env.SURREALDB_NAMESPACE
  }
  if (process.env.SURREALDB_DATABASE) {
    config.surrealdb.database = process.env.SURREALDB_DATABASE
  }
  if (process.env.SURREALDB_USERNAME) {
    config.surrealdb.username = process.env.SURREALDB_USERNAME
  }
  if (process.env.SURREALDB_PASSWORD) {
    config.surrealdb.password = process.env.SURREALDB_PASSWORD
  }

  // JWT config
  if (process.env.JWT_SECRET) {
    config.jwt.secret = process.env.JWT_SECRET
  }
  if (process.env.JWT_EXPIRES_IN) {
    config.jwt.expiresIn = process.env.JWT_EXPIRES_IN
  }

  // Activity API config
  if (process.env.ACTIVITY_API_ENDPOINT) {
    config.activityApi.endpoint = process.env.ACTIVITY_API_ENDPOINT
  }

  return config
}

/**
 * Merge source config into target config
 */
function mergeConfig(target: any, source: any) {
  for (const key in source) {
    if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {}
      mergeConfig(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
}

/**
 * Get configuration summary for logging
 */
export function configSummary(config: UserVesselConfig): string {
  return `
user-vessel Configuration:
  Port: ${config.host}:${config.port}
  SurrealDB: ${config.surrealdb.url}
  Namespace: ${config.surrealdb.namespace}
  Database: ${config.surrealdb.database}
  Activity API: ${config.activityApi.endpoint}
  JWT Secret: ${config.jwt.secret ? "***" + config.jwt.secret.slice(-4) : "(not set)"}
`.trim()
}
