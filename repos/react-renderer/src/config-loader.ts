/**
 * React-Renderer Config Loader
 *
 * Reads ~/.metabob/config.json and .metabob/config.json using the same key
 * paths as MiniBob's config.ts. Precedence for each field:
 *   Priority 1 (highest): Environment variable
 *   Priority 2:           .metabob/config.json  (project root)
 *   Priority 3:           ~/.metabob/config.json (user home)
 *   Hardcoded default:    (lowest)
 */

import { homedir } from 'os'
import { join } from 'path'

// ============================================================================
// Types
// ============================================================================

export interface RendererConfig {
  /** Discovery service endpoint where this vessel registers */
  discoveryEndpoint: string
  /** API key used for registration auth (empty string disables discovery) */
  metabobApiKey: string
  /** Identity service endpoint for key validation */
  identityEndpoint: string
  /** URL advertised in the registry for this vessel */
  vesselEndpoint: string
  /** Whether discovery registration is enabled */
  discoveryEnabled: boolean
}

/**
 * Subset of ~/.metabob/config.json we care about
 */
interface MetabobUserConfig {
  metabob?: {
    apiKey?: string
    endpoint?: string
  }
  instance?: {
    apiKey?: string
    orgId?: string
    projectId?: string
  }
  discovery?: {
    endpoint?: string
    enabled?: boolean
  }
}

// ============================================================================
// File reading helpers
// ============================================================================

const USER_CONFIG_PATH = join(homedir(), '.metabob', 'config.json')
const PROJECT_CONFIG_PATH = '.metabob/config.json'

async function readJsonFile(path: string): Promise<MetabobUserConfig> {
  try {
    const file = Bun.file(path)
    if (await file.exists()) {
      const text = await file.text()
      return JSON.parse(text) as MetabobUserConfig
    }
  } catch {
    // File absent, unreadable, or invalid JSON — treat as empty
  }
  return {}
}

// ============================================================================
// Priority resolution helper
// ============================================================================

function resolveString(
  envValue: string | undefined,
  projectValue: string | undefined,
  userValue: string | undefined,
  defaultValue: string,
): string {
  if (envValue !== undefined && envValue !== '') return envValue
  if (projectValue !== undefined && projectValue !== '') return projectValue
  if (userValue !== undefined && userValue !== '') return userValue
  return defaultValue
}

// ============================================================================
// Main loader
// ============================================================================

/**
 * Load renderer configuration from env vars, project config, user config, and defaults.
 *
 * Never throws — if all config sources are absent the returned object uses hardcoded defaults.
 *
 * @param port  The port the server is listening on, used for the default vesselEndpoint.
 */
export async function loadRendererConfig(port?: number): Promise<RendererConfig> {
  const serverPort = port ?? 3000

  // Load file-based sources (both are optional; silently empty if absent)
  const [userConfig, projectConfig] = await Promise.all([
    readJsonFile(USER_CONFIG_PATH),
    readJsonFile(PROJECT_CONFIG_PATH),
  ])

  // --- metabobApiKey ---
  // env: METABOB_API_KEY
  // json: metabob.apiKey || instance.apiKey
  const metabobApiKey = resolveString(
    process.env.METABOB_API_KEY,
    projectConfig.metabob?.apiKey ?? projectConfig.instance?.apiKey,
    userConfig.metabob?.apiKey ?? userConfig.instance?.apiKey,
    '',
  )

  // --- discoveryEndpoint ---
  // env: DISCOVERY_VESSEL_ENDPOINT
  // json: discovery.endpoint
  const discoveryEndpoint = resolveString(
    process.env.DISCOVERY_VESSEL_ENDPOINT,
    projectConfig.discovery?.endpoint,
    userConfig.discovery?.endpoint,
    'https://discovery.metabob.com',
  )

  // --- identityEndpoint ---
  // Derived from API key iss field; fallback https://identity.metabob.com
  // env: (no dedicated env var — derived or default)
  // json: (no direct path — derived from key)
  const identityEndpoint = parseIdentityEndpoint(metabobApiKey)

  // --- vesselEndpoint ---
  // env: VESSEL_ENDPOINT
  // json: (no path — computed from port)
  const vesselEndpoint = resolveString(
    process.env.VESSEL_ENDPOINT,
    undefined,
    undefined,
    `http://localhost:${serverPort}`,
  )

  // --- discoveryEnabled ---
  // env: DISCOVERY_ENABLED (only 'false' disables it)
  // Enabled by default unless explicitly set to 'false'
  const discoveryEnabled = process.env.DISCOVERY_ENABLED !== 'false'

  return {
    discoveryEndpoint,
    metabobApiKey,
    identityEndpoint,
    vesselEndpoint,
    discoveryEnabled,
  }
}

// ============================================================================
// Identity endpoint derivation
// ============================================================================

/**
 * Extract the identity endpoint from the API key payload.
 *
 * API keys have the form: mb-<base64url(payload)>-<sig>
 * The payload JSON includes an `iss` field pointing to the identity vessel.
 *
 * Returns 'https://identity.metabob.com' if parsing fails or iss is absent.
 */
/**
 * Resolve the org_id associated with the given API key by calling the
 * identity-vessel's key-validation endpoint.
 *
 * Returns the org_id string on success, or undefined if the key is absent,
 * the request fails, or the identity endpoint is unreachable. Never throws.
 */
export async function resolveOrgId(
  apiKey: string,
  identityEndpoint: string,
): Promise<string | undefined> {
  if (!apiKey) return undefined
  try {
    const resp = await fetch(`${identityEndpoint}/v1/keys/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey }),
      signal: AbortSignal.timeout(5000),
    })
    if (!resp.ok) return undefined
    const body = await resp.json() as { success?: boolean; data?: { org_id?: string } }
    return body?.data?.org_id || undefined
  } catch {
    console.warn('[Discovery] Warning: could not resolve orgId from identity-vessel (will register without org scope)')
    return undefined
  }
}

export function parseIdentityEndpoint(apiKey: string): string {
  const fallback = 'https://identity.metabob.com'
  try {
    if (!apiKey || !apiKey.startsWith('mb-')) return fallback

    // Split on '-': mb-<payload>-<sig>
    // The payload segment is everything between the first and last '-'
    const withoutPrefix = apiKey.slice(3) // remove 'mb-'
    const lastDash = withoutPrefix.lastIndexOf('-')
    if (lastDash <= 0) return fallback

    const payloadB64 = withoutPrefix.slice(0, lastDash)

    // Decode base64url → JSON string
    // Replace base64url chars to standard base64 and pad
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)

    const payload = JSON.parse(decoded) as Record<string, unknown>
    const iss = payload.iss
    if (typeof iss === 'string' && iss.startsWith('http')) {
      return iss
    }
  } catch {
    // Parsing failed — return fallback
  }
  return fallback
}
