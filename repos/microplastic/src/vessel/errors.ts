/**
 * Vessel Error Types
 *
 * Structured errors for vessel operations.
 */

/**
 * Base error for vessel operations
 */
export class VesselError extends Error {
  constructor(
    message: string,
    public readonly vesselId: string,
    public readonly code: string,
    public readonly recoverable: boolean = true
  ) {
    super(`[${vesselId}] ${message}`);
    this.name = "VesselError";
  }
}

/**
 * Initialization failed - non-recoverable
 */
export class VesselInitError extends VesselError {
  readonly underlyingError?: Error;

  constructor(vesselId: string, message: string, underlyingError?: Error) {
    super(message, vesselId, "INIT_FAILED", false);
    this.name = "VesselInitError";
    this.underlyingError = underlyingError;
  }
}

/**
 * Resolution failed
 */
export class ResolverError extends VesselError {
  readonly pointerType: string;
  readonly underlyingError?: Error;

  constructor(
    vesselId: string,
    pointerType: string,
    message: string,
    recoverable = true,
    underlyingError?: Error
  ) {
    super(`Failed to resolve ${pointerType}: ${message}`, vesselId, "RESOLVE_FAILED", recoverable);
    this.name = "ResolverError";
    this.pointerType = pointerType;
    this.underlyingError = underlyingError;
  }
}

/**
 * Vessel not found in registry
 */
export class VesselNotFoundError extends VesselError {
  constructor(vesselId: string) {
    super(`Vessel not found: ${vesselId}`, vesselId, "NOT_FOUND", true);
    this.name = "VesselNotFoundError";
  }
}

/**
 * Vessel already registered
 */
export class VesselAlreadyRegisteredError extends VesselError {
  constructor(vesselId: string) {
    super(`Vessel already registered: ${vesselId}`, vesselId, "ALREADY_REGISTERED", true);
    this.name = "VesselAlreadyRegisteredError";
  }
}

/**
 * No resolver found for pointer type
 */
export class NoResolverError extends VesselError {
  constructor(pointerType: string) {
    super(`No resolver found for pointer type: ${pointerType}`, "registry", "NO_RESOLVER", true);
    this.name = "NoResolverError";
  }
}

/**
 * Health check failed
 */
export class HealthCheckError extends VesselError {
  readonly healthChecks: unknown[];

  constructor(vesselId: string, message: string, checks: unknown[]) {
    super(`Health check failed: ${message}`, vesselId, "HEALTH_FAILED", true);
    this.name = "HealthCheckError";
    this.healthChecks = checks;
  }
}
