/**
 * VesselClient - Manages vessel registration and heartbeat
 */

import type {
  DiscoveryConfig,
  HealthStatus,
  HeartbeatResponse,
  RegisterResponse,
  Logger,
  HeartbeatMetrics,
} from "./types.js"
import { HttpClient } from "./utils/http.js"
import { BackoffManager } from "./utils/backoff.js"
import { VesselMetrics } from "./metrics.js"

/**
 * Default console logger
 */
const defaultLogger: Logger = {
  info: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
  debug: () => {}, // Suppress debug by default
}

/**
 * Manages vessel registration and heartbeat against discovery-vessel.
 *
 * For new vessels prefer DiscoveryRegistrationLoop (registration-loop.ts) —
 * canonical heartbeat/re-register semantics; VesselClient remains for
 * existing consumers.
 */
export class VesselClient {
  readonly config: DiscoveryConfig
  private logger: Logger
  private client: HttpClient
  private metrics: VesselMetrics
  private backoff: BackoffManager

  private heartbeatTimer?: Timer
  private lastHeartbeatTime: Date | null = null
  private consecutiveFailureCount = 0
  private running = false
  private startTime = Date.now()
  private shutdownHandlersRegistered = false

  constructor(config: DiscoveryConfig) {
    this.config = {
      version: "0.0.0",
      ttl: 300,
      heartbeatIntervalMs: 120000, // 2 minutes
      protocol: "http",
      authType: "Bearer",
      maxConsecutiveFailures: 3,
      initialRetryDelayMs: 1000,
      maxRetryDelayMs: 30000,
      enableMetrics: true,
      ...config,
    }

    this.logger = config.logger || defaultLogger
    this.client = new HttpClient({
      authToken: this.config.authToken,
      authType: this.config.authType,
      logger: this.logger,
    })

    this.metrics = new VesselMetrics(
      this.config.metricsEmitter,
      this.logger
    )

    this.backoff = new BackoffManager({
      initialDelayMs: this.config.initialRetryDelayMs!,
      maxDelayMs: this.config.maxRetryDelayMs!,
      maxAttempts: this.config.maxConsecutiveFailures!,
    })
  }

  /**
   * Check if heartbeat is running
   */
  get isRunning(): boolean {
    return this.running
  }

  /**
   * Get last successful heartbeat time
   */
  get lastHeartbeat(): Date | null {
    return this.lastHeartbeatTime
  }

  /**
   * Get consecutive failure count
   */
  get consecutiveFailures(): number {
    return this.consecutiveFailureCount
  }

  /**
   * Register vessel with discovery service
   */
  async register(): Promise<boolean> {
    const url = `${this.config.discoveryEndpoint}/register`

    try {
      this.logger.info(
        `[VesselClient] Registering ${this.config.vesselId} at ${this.config.discoveryEndpoint}`
      )

      const response = await this.client.post<RegisterResponse>(url, {
        vesselId: this.config.vesselId,
        vesselName: this.config.vesselName,
        version: this.config.version,
        endpoint: this.config.endpoint,
        shapes: this.config.shapes,
        protocol: this.config.protocol,
        orgId: this.config.orgId,
        metadata: this.config.metadata,
        resolve_endpoint: this.config.resolve_endpoint,
        resolve_request_format: this.config.resolve_request_format,
        auth_scheme: this.config.auth_scheme,
        resolve_timeout_ms: this.config.resolve_timeout_ms,
        auth_token_source: this.config.auth_token_source,
        auth_delegation_mode: this.config.auth_delegation_mode,
      })

      if (response.success) {
        this.logger.info(
          `[VesselClient] ✓ Registered successfully, expires at ${new Date(response.expiresAt).toISOString()}`
        )
        this.metrics.registrationSuccess(this.config.vesselId)
        this.backoff.reset()
        return true
      } else {
        this.logger.warn("[VesselClient] Registration returned success=false")
        this.metrics.registrationFailure(this.config.vesselId, "success=false")
        return false
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger.error(`[VesselClient] Registration failed:`, errorMsg)
      this.metrics.registrationFailure(this.config.vesselId, errorMsg)
      return false
    }
  }

  /**
   * Send heartbeat to discovery service
   */
  async heartbeat(metrics?: HeartbeatMetrics): Promise<boolean> {
    const url = `${this.config.discoveryEndpoint}/heartbeat`
    const startTime = Date.now()

    try {
      const response = await this.client.post<HeartbeatResponse>(url, {
        vesselId: this.config.vesselId,
        metrics,
      })

      const latency = Date.now() - startTime

      if (response.success) {
        this.lastHeartbeatTime = new Date()
        this.consecutiveFailureCount = 0
        this.backoff.reset()
        this.metrics.heartbeatSuccess(this.config.vesselId, latency)

        this.logger.debug(
          `[VesselClient] ✓ Heartbeat successful (${latency}ms), next in ${response.nextHeartbeatMs}ms`
        )

        return true
      } else {
        this.consecutiveFailureCount++
        this.logger.warn(
          `[VesselClient] Heartbeat returned success=false (${this.consecutiveFailureCount}/${this.config.maxConsecutiveFailures})`
        )
        this.metrics.heartbeatFailure(
          this.config.vesselId,
          this.consecutiveFailureCount
        )
        return false
      }
    } catch (error) {
      this.consecutiveFailureCount++
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger.error(
        `[VesselClient] Heartbeat failed (${this.consecutiveFailureCount}/${this.config.maxConsecutiveFailures}):`,
        errorMsg
      )
      this.metrics.heartbeatFailure(
        this.config.vesselId,
        this.consecutiveFailureCount
      )
      return false
    }
  }

  /**
   * Start heartbeat loop
   */
  startHeartbeat(): void {
    if (this.running) {
      this.logger.warn("[VesselClient] Heartbeat already running")
      return
    }

    this.running = true
    this.logger.info(
      `[VesselClient] Starting heartbeat (interval: ${this.config.heartbeatIntervalMs}ms)`
    )

    const runHeartbeat = async () => {
      if (!this.running) return

      const success = await this.heartbeat()

      // Check if max failures reached
      if (
        !success &&
        this.consecutiveFailureCount >= this.config.maxConsecutiveFailures!
      ) {
        this.logger.error(
          `[VesselClient] Max consecutive failures (${this.config.maxConsecutiveFailures}) reached, attempting re-registration`
        )
        this.stopHeartbeat()

        // Attempt re-registration with backoff
        const delay = this.backoff.nextDelay()
        this.logger.info(
          `[VesselClient] Re-registering in ${delay}ms (attempt ${this.backoff.getAttempts()})`
        )

        setTimeout(async () => {
          const registered = await this.register()
          if (registered) {
            this.startHeartbeat()
          } else if (!this.backoff.isMaxAttemptsReached()) {
            // Retry registration
            this.startHeartbeat()
          } else {
            this.logger.error(
              "[VesselClient] Max re-registration attempts reached, giving up"
            )
          }
        }, delay)

        return
      }

      // Schedule next heartbeat
      if (this.running) {
        this.heartbeatTimer = setTimeout(
          runHeartbeat,
          this.config.heartbeatIntervalMs!
        )
      }
    }

    // Start first heartbeat
    runHeartbeat()
  }

  /**
   * Stop heartbeat loop
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
    this.running = false
    this.logger.info("[VesselClient] Heartbeat stopped")
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthStatus {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000)

    let status: "ok" | "degraded" | "unhealthy"
    if (!this.running) {
      status = "unhealthy"
    } else if (this.consecutiveFailureCount > 0) {
      status = "degraded"
    } else {
      status = "ok"
    }

    return {
      status,
      vessel: this.config.vesselId,
      version: this.config.version!,
      uptime,
      heartbeat: {
        lastSuccess: this.lastHeartbeatTime?.toISOString() || null,
        consecutiveFailures: this.consecutiveFailureCount,
        isRunning: this.running,
      },
      shapes: this.config.shapes,
    }
  }

  /**
   * Deregister vessel from discovery service
   */
  private async deregister(): Promise<void> {
    const url = `${this.config.discoveryEndpoint}/vessels/${this.config.vesselId}`

    try {
      this.logger.info(`[VesselClient] Deregistering ${this.config.vesselId}`)
      await this.client.delete(url)
      this.logger.info("[VesselClient] ✓ Deregistered successfully")
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger.warn(`[VesselClient] Deregistration failed:`, errorMsg)
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info("[VesselClient] Shutting down gracefully")

    // Stop heartbeat
    this.stopHeartbeat()

    // Deregister from discovery
    await this.deregister()

    this.metrics.shutdownClean(this.config.vesselId)
    this.logger.info("[VesselClient] ✓ Shutdown complete")
  }

  /**
   * Register signal handlers for graceful shutdown
   */
  registerShutdownHandlers(): void {
    if (this.shutdownHandlersRegistered) {
      return
    }

    const handleShutdown = async (signal: string) => {
      this.logger.info(`[VesselClient] Received ${signal}, shutting down`)
      await this.shutdown()
      process.exit(0)
    }

    process.on("SIGTERM", () => handleShutdown("SIGTERM"))
    process.on("SIGINT", () => handleShutdown("SIGINT"))

    this.shutdownHandlersRegistered = true
    this.logger.debug("[VesselClient] Shutdown handlers registered")
  }
}
