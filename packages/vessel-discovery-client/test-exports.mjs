// Test that all exports work correctly
import {
  register,
  VesselClient,
  discoverByShape,
  discoverVessels,
  clearDiscoveryCache,
  VesselMetrics,
  Metrics,
  DefaultMetricsEmitter,
  BackoffManager,
  HttpClient,
} from "./dist/index.js"

console.log("✓ Main exports work")

// Test middleware exports
import {
  createHealthMiddleware,
  createHonoHealthMiddleware,
  createExpressHealthMiddleware,
} from "./dist/middleware/index.js"

console.log("✓ Middleware exports work")

// Verify classes are constructible
const backoff = new BackoffManager({
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxAttempts: 3,
})
console.log("✓ BackoffManager instantiates")

const client = new HttpClient({})
console.log("✓ HttpClient instantiates")

const metrics = new VesselMetrics()
console.log("✓ VesselMetrics instantiates")

const vesselClient = new VesselClient({
  vesselId: "test",
  vesselName: "Test",
  endpoint: "http://test:8080",
  shapes: ["test"],
  discoveryEndpoint: "http://discovery:8080",
})
console.log("✓ VesselClient instantiates")

console.log("\n✓ All exports verified successfully!")
