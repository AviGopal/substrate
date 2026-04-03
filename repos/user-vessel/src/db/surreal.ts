/**
 * SurrealDB connection manager for user-vessel
 *
 * Provides authenticated database connections with automatic token refresh
 */

import { Surreal } from "surrealdb"
import type { UserVesselConfig, AuthContext } from "../types"

// =============================================================================
// CONNECTION MANAGER
// =============================================================================

let rootDb: Surreal | null = null

/**
 * Get or create root database connection (for bootstrapping only)
 */
export async function getRootDb(config: UserVesselConfig): Promise<Surreal> {
  if (rootDb) return rootDb

  const db = new Surreal()
  await db.connect(config.surrealdb.url)

  await db.use({
    namespace: config.surrealdb.namespace,
    database: config.surrealdb.database,
  })

  await db.signin({
    username: config.surrealdb.username,
    password: config.surrealdb.password,
  })

  rootDb = db
  return db
}

/**
 * Create an authenticated database connection using JWT
 *
 * This connection will have $auth populated and PERMISSIONS enforced
 */
export async function createAuthenticatedClient(
  config: UserVesselConfig,
  token: string
): Promise<Surreal> {
  const db = new Surreal()
  await db.connect(config.surrealdb.url)

  await db.use({
    namespace: config.surrealdb.namespace,
    database: config.surrealdb.database,
  })

  // Authenticate with JWT token
  await db.authenticate(token)

  return db
}

/**
 * Get authenticated database connection from auth context
 *
 * Creates a temporary JWT token from auth context to establish
 * an authenticated connection with PERMISSIONS enforcement
 */
export async function getAuthenticatedDb(
  config: UserVesselConfig,
  auth: AuthContext
): Promise<Surreal> {
  // Import JWT utilities
  const { createToken } = await import("../utils/jwt")

  // Create JWT token from auth context
  const token = await createToken(auth, config.jwt.secret, config.jwt.expiresIn)

  // Create authenticated connection
  return createAuthenticatedClient(config, token)
}

/**
 * Execute query with authentication context
 *
 * Ensures PERMISSIONS are enforced via $auth
 */
export async function queryWithAuth(
  config: UserVesselConfig,
  token: string,
  query: string,
  params?: Record<string, unknown>
): Promise<any[]> {
  const db = await createAuthenticatedClient(config, token)
  try {
    const result = await db.query(query, params)
    return result
  } finally {
    await db.close()
  }
}

/**
 * Execute query with root credentials (use sparingly!)
 *
 * Only for:
 * - Initial bootstrap
 * - Schema migrations
 * - System operations that need to bypass PERMISSIONS
 */
export async function queryWithRoot(
  config: UserVesselConfig,
  query: string,
  params?: Record<string, unknown>
): Promise<any[]> {
  const db = await getRootDb(config)
  return await db.query(query, params)
}

/**
 * Close root connection
 */
export async function closeRootDb(): Promise<void> {
  if (rootDb) {
    await rootDb.close()
    rootDb = null
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse SurrealDB result array to get first record
 *
 * Handles both formats:
 * - New format: [[{record}]]
 * - Old format: [{result: [{record}]}]
 */
export function getFirstRecord<T>(result: any[]): T | null {
  if (!result || result.length === 0) return null

  const firstResult = result[0]
  if (!firstResult) return null

  // New format: [[{record}]]
  if (Array.isArray(firstResult)) {
    return firstResult.length > 0 ? (firstResult[0] as T) : null
  }

  // Old format: [{result: [{record}]}]
  if (firstResult.result && Array.isArray(firstResult.result)) {
    return firstResult.result.length > 0 ? (firstResult.result[0] as T) : null
  }

  return null
}

/**
 * Parse SurrealDB result array to get all records
 *
 * Handles both formats:
 * - New format: [[{record1}, {record2}]]
 * - Old format: [{result: [{record1}, {record2}]}]
 */
export function getAllRecords<T>(result: any[]): T[] {
  if (!result || result.length === 0) return []

  const firstResult = result[0]
  if (!firstResult) return []

  // New format: [[{record1}, {record2}]]
  if (Array.isArray(firstResult)) {
    return firstResult as T[]
  }

  // Old format: [{result: [{record1}, {record2}]}]
  if (firstResult.result && Array.isArray(firstResult.result)) {
    return firstResult.result as T[]
  }

  return []
}

/**
 * Check if SurrealDB query resulted in error
 */
export function hasError(result: any[]): boolean {
  if (!result || result.length === 0) return true
  return result.some((r) => r.status === 'ERR')
}

/**
 * Get error message from SurrealDB result
 */
export function getErrorMessage(result: any[]): string {
  if (!result || result.length === 0) return "Unknown error"
  const errorResult = result.find((r) => r.status === 'ERR')
  return errorResult?.result || "Unknown error"
}
