/**
 * Discovery client for querying vessel capabilities
 */

import type { DiscoveryOptions, DiscoveryResult, Logger } from "./types.js"
import { HttpClient } from "./utils/http.js"
import { VesselMetrics } from "./metrics.js"

interface CacheEntry {
  result: DiscoveryResult
  expiresAt: number
}

/**
 * Discovery cache with TTL support
 */
class DiscoveryCache {
  private cache = new Map<string, CacheEntry>()

  set(key: string, result: DiscoveryResult, ttlMs: number): void {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttlMs,
    })
  }

  get(key: string): DiscoveryResult | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.result
  }

  clear(): void {
    this.cache.clear()
  }
}

// Global cache shared across all discovery calls
const globalCache = new DiscoveryCache()

/**
 * Discover vessels that can resolve a specific shape
 */
export async function discoverByShape(
  options: DiscoveryOptions
): Promise<DiscoveryResult> {
  const {
    shape,
    discoveryEndpoint,
    authToken,
    authType,
    cacheTtlMs = 60000, // 1 minute default
    logger,
  } = options

  const metrics = new VesselMetrics(undefined, logger)
  const cacheKey = `${shape}:${discoveryEndpoint}`

  // Check cache first
  const cached = globalCache.get(cacheKey)
  if (cached) {
    logger?.debug(`[Discovery] Cache hit for shape: ${shape}`)
    metrics.discoveryCacheHit(shape)
    return { ...cached, cached: true }
  }

  // Query discovery service
  const client = new HttpClient({ authToken, authType, logger })
  const url = `${discoveryEndpoint}/resolve`

  try {
    logger?.debug(`[Discovery] Querying for shape: ${shape}`)

    const response = await client.post<{
      content: {
        shape: string
        vessels: Array<{
          vesselId: string
          vesselName: string
          endpoint: string
          protocol?: string
          confidence: number
          lastSeen: string
          metadata?: Record<string, unknown>
        }>
        found: boolean
      }
    }>(url, {
      pointer: {
        type: "vesselCapability",
        shape,
      },
    })

    const result: DiscoveryResult = {
      found: response.content.found,
      shape: response.content.shape,
      vessels: response.content.vessels,
      cached: false,
    }

    // Cache the result
    globalCache.set(cacheKey, result, cacheTtlMs)

    logger?.info(
      `[Discovery] Found ${result.vessels.length} vessel(s) for shape: ${shape}`
    )
    metrics.discoverySuccess(shape, result.vessels.length)

    return result
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger?.error(`[Discovery] Failed to query for shape ${shape}:`, errorMsg)
    metrics.discoveryFailure(shape, errorMsg)

    // Return cached result if available (fallback)
    const staleCache = globalCache.get(cacheKey)
    if (staleCache) {
      logger?.warn(`[Discovery] Using stale cache for shape: ${shape}`)
      return { ...staleCache, cached: true }
    }

    // No cache available, return empty result
    return {
      found: false,
      shape,
      vessels: [],
      cached: false,
    }
  }
}

/**
 * Discover all registered vessels
 */
export async function discoverVessels(options: {
  discoveryEndpoint: string
  authToken?: string
  authType?: "Bearer" | "ApiKey"
  logger?: Logger
}): Promise<{
  vessels: Array<{
    vesselId: string
    vesselName: string
    shapes: string[]
    endpoint: string
    protocol?: string
    status: string
    lastSeen: string
    metadata?: Record<string, unknown>
  }>
  totalCount: number
}> {
  const { discoveryEndpoint, authToken, authType, logger } = options

  const client = new HttpClient({ authToken, authType, logger })
  const url = `${discoveryEndpoint}/resolve`

  try {
    logger?.debug("[Discovery] Querying for all vessels")

    const response = await client.post<{
      content: {
        vessels: Array<{
          vesselId: string
          vesselName: string
          shapes: string[]
          endpoint: string
          protocol?: string
          status: string
          lastSeen: string
          metadata?: Record<string, unknown>
        }>
        totalCount: number
      }
    }>(url, {
      pointer: {
        type: "vesselRegistry",
      },
    })

    logger?.info(
      `[Discovery] Found ${response.content.totalCount} total vessel(s)`
    )

    return response.content
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger?.error("[Discovery] Failed to query vessels:", errorMsg)

    return {
      vessels: [],
      totalCount: 0,
    }
  }
}

/**
 * Clear discovery cache (useful for testing)
 */
export function clearDiscoveryCache(): void {
  globalCache.clear()
}
