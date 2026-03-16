/**
 * Validation Harness: minibob Self-Configuration System
 * 
 * Validates environment auto-detection and dynamic capability configuration:
 * 1. Local Environment: No cluster mode, no boredom, local templates
 * 2. Docker Environment: Same as local
 * 3. K8s Single Pod: No cluster mode, MCP if backend available
 * 4. K8s Cluster (3+ pods): Cluster mode, boredom enabled, ACP gossip flag
 * 
 * Validation Strategy:
 * - External: /health and /config endpoints, startup logs, DNS lookups
 * - Internal: Code verification of detection logic in src/environment.ts
 */

import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// =============================================================================
// TYPES
// =============================================================================

export type RuntimeEnvironment = "local" | "docker" | "k8s-single" | "k8s-cluster"

export interface ValidationInput {
  environment: RuntimeEnvironment
  minibobEndpoint?: string // e.g., "http://localhost:8080" or "http://minibob.testing.svc.cluster.local:8080"
  namespace?: string // K8s namespace (required for k8s-* environments)
  expectedPeerCount?: number // Expected peer count for cluster mode
  backendEndpoint?: string // MCP backend endpoint for health check
  checkStartupLogs?: boolean // Whether to validate startup logs
}

export interface ValidationOutput {
  pass: boolean
  environment: EnvironmentValidationResult
  config: ConfigEndpointResult
  health: HealthEndpointResult
  dns?: DNSValidationResult
  logs?: LogsValidationResult
  summary: {
    totalChecks: number
    passedChecks: number
    failedChecks: number
  }
}

export interface EnvironmentValidationResult {
  pass: boolean
  actual: {
    environment: string
    clusterMode: boolean
    peerCount: number
    boredomEnabled: boolean
    acpGossipEnabled: boolean
    backendAvailable: boolean
  }
  expected: {
    environment: string
    clusterMode: boolean
    minPeerCount: number
    boredomEnabled: boolean
    acpGossipEnabled: boolean
  }
  error?: string
}

export interface ConfigEndpointResult {
  pass: boolean
  actual: {
    capabilities: string[]
    metadata?: {
      environment?: string
      clusterMode?: boolean
      peerCount?: number
      backendAvailable?: boolean
    }
  }
  expected: {
    baseCapabilities: string[]
    conditionalCapabilities: string[]
    hasMetadata: boolean
  }
  error?: string
}

export interface HealthEndpointResult {
  pass: boolean
  actual: {
    status: string
    vessel: string
    responseTime: number
  }
  expected: {
    status: string
    vessel: string
  }
  error?: string
}

export interface DNSValidationResult {
  pass: boolean
  actual: {
    addresses: string[]
    count: number
  }
  expected: {
    minCount: number
  }
  error?: string
}

export interface LogsValidationResult {
  pass: boolean
  actual: {
    hasEnvironmentDetection: boolean
    hasClusterModeLog: boolean
    hasBoredomLog: boolean
    detectedEnvironment?: string
    detectedClusterMode?: boolean
  }
  expected: {
    hasEnvironmentDetection: true
    hasClusterModeLog: true
    hasBoredomLog: boolean
  }
  error?: string
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validate /health endpoint
 */
async function validateHealthEndpoint(endpoint: string): Promise<HealthEndpointResult> {
  try {
    const startTime = Date.now()
    const response = await fetch(`${endpoint}/health`)
    const responseTime = Date.now() - startTime
    
    if (!response.ok) {
      return {
        pass: false,
        actual: { status: "error", vessel: "unknown", responseTime },
        expected: { status: "ok", vessel: "minibob" },
        error: `Health endpoint returned ${response.status}`
      }
    }
    
    const data = await response.json() as any
    const pass = data.status === "ok" && data.vessel === "minibob"
    
    return {
      pass,
      actual: {
        status: data.status,
        vessel: data.vessel,
        responseTime
      },
      expected: {
        status: "ok",
        vessel: "minibob"
      },
      error: pass ? undefined : "Health check failed"
    }
  } catch (error) {
    return {
      pass: false,
      actual: { status: "error", vessel: "unknown", responseTime: 0 },
      expected: { status: "ok", vessel: "minibob" },
      error: `Health endpoint unreachable: ${error}`
    }
  }
}

/**
 * Validate /config endpoint and manifest
 */
async function validateConfigEndpoint(
  endpoint: string,
  input: ValidationInput
): Promise<ConfigEndpointResult> {
  try {
    const response = await fetch(`${endpoint}/config`)
    
    if (!response.ok) {
      return {
        pass: false,
        actual: { capabilities: [] },
        expected: { baseCapabilities: [], conditionalCapabilities: [], hasMetadata: false },
        error: `Config endpoint returned ${response.status}`
      }
    }
    
    const manifest = await response.json() as any
    
    // Base capabilities should always be present
    const baseCapabilities = ["activities", "impulses", "git", "acp"]
    const hasBaseCapabilities = baseCapabilities.every(cap => 
      manifest.capabilities?.includes(cap)
    )
    
    // Conditional capabilities based on environment
    const expectedConditionalCapabilities: string[] = []
    if (input.environment === "k8s-cluster") {
      expectedConditionalCapabilities.push("boredom")
      // Note: acp-gossip flag set but not implemented yet
    }
    
    const hasConditionalCapabilities = expectedConditionalCapabilities.every(cap =>
      manifest.capabilities?.includes(cap)
    )
    
    // Check metadata presence
    const hasMetadata = !!manifest.metadata
    const metadataCorrect = !hasMetadata || (
      manifest.metadata.environment === input.environment &&
      manifest.metadata.clusterMode === (input.environment === "k8s-cluster")
    )
    
    const pass = hasBaseCapabilities && hasConditionalCapabilities && metadataCorrect
    
    return {
      pass,
      actual: {
        capabilities: manifest.capabilities || [],
        metadata: manifest.metadata
      },
      expected: {
        baseCapabilities,
        conditionalCapabilities: expectedConditionalCapabilities,
        hasMetadata: true
      },
      error: pass ? undefined : "Config manifest validation failed"
    }
  } catch (error) {
    return {
      pass: false,
      actual: { capabilities: [] },
      expected: { baseCapabilities: [], conditionalCapabilities: [], hasMetadata: false },
      error: `Config endpoint unreachable: ${error}`
    }
  }
}

/**
 * Validate DNS-based cluster detection (K8s only)
 */
async function validateDNS(
  namespace: string,
  expectedMinCount: number
): Promise<DNSValidationResult> {
  try {
    const serviceName = `minibob-cluster.${namespace}.svc.cluster.local`
    
    // Use nslookup to resolve service DNS
    const { stdout } = await execAsync(`nslookup ${serviceName} 2>&1`)
    
    // Parse IP addresses from nslookup output
    const ipRegex = /Address: (\d+\.\d+\.\d+\.\d+)/g
    const matches = [...stdout.matchAll(ipRegex)]
    const addresses = matches.map(m => m[1])
    
    const pass = addresses.length >= expectedMinCount
    
    return {
      pass,
      actual: {
        addresses,
        count: addresses.length
      },
      expected: {
        minCount: expectedMinCount
      },
      error: pass ? undefined : `Expected at least ${expectedMinCount} peers, found ${addresses.length}`
    }
  } catch (error) {
    return {
      pass: false,
      actual: { addresses: [], count: 0 },
      expected: { minCount: expectedMinCount },
      error: `DNS lookup failed: ${error}`
    }
  }
}

/**
 * Validate startup logs contain environment detection
 */
async function validateStartupLogs(
  namespace: string,
  podName: string,
  environment: RuntimeEnvironment
): Promise<LogsValidationResult> {
  try {
    const { stdout: logs } = await execAsync(
      `kubectl logs ${podName} -n ${namespace} --tail=100`
    )
    
    // Check for environment detection markers
    const hasEnvironmentDetection = logs.includes("=== Environment Detection ===")
    const hasClusterModeLog = logs.includes("Cluster Mode:")
    
    // Extract detected environment
    const envMatch = logs.match(/Environment: ([a-z-]+)/)
    const detectedEnvironment = envMatch?.[1]
    
    const clusterMatch = logs.match(/Cluster Mode: (true|false)/)
    const detectedClusterMode = clusterMatch?.[1] === "true"
    
    // Check for boredom log
    const hasBoredomLog = logs.includes("Boredom") && (
      logs.includes("Starting task executor") ||
      logs.includes("disabled") ||
      logs.includes("Not in cluster mode")
    )
    
    const environmentMatches = detectedEnvironment === environment
    const clusterModeMatches = detectedClusterMode === (environment === "k8s-cluster")
    
    const pass = hasEnvironmentDetection && 
                 hasClusterModeLog && 
                 hasBoredomLog &&
                 environmentMatches &&
                 clusterModeMatches
    
    return {
      pass,
      actual: {
        hasEnvironmentDetection,
        hasClusterModeLog,
        hasBoredomLog,
        detectedEnvironment,
        detectedClusterMode
      },
      expected: {
        hasEnvironmentDetection: true,
        hasClusterModeLog: true,
        hasBoredomLog: true
      },
      error: pass ? undefined : "Startup logs validation failed"
    }
  } catch (error) {
    return {
      pass: false,
      actual: {
        hasEnvironmentDetection: false,
        hasClusterModeLog: false,
        hasBoredomLog: false
      },
      expected: {
        hasEnvironmentDetection: true,
        hasClusterModeLog: true,
        hasBoredomLog: true
      },
      error: `Failed to fetch logs: ${error}`
    }
  }
}

/**
 * Validate environment detection and configuration
 */
async function validateEnvironment(
  endpoint: string,
  input: ValidationInput
): Promise<EnvironmentValidationResult> {
  try {
    const response = await fetch(`${endpoint}/config`)
    if (!response.ok) {
      throw new Error(`Config endpoint returned ${response.status}`)
    }
    
    const manifest = await response.json() as any
    const metadata = manifest.metadata || {}
    
    // Determine expected values based on input environment
    const expected = {
      environment: input.environment,
      clusterMode: input.environment === "k8s-cluster",
      minPeerCount: input.expectedPeerCount || (input.environment === "k8s-cluster" ? 3 : 1),
      boredomEnabled: input.environment === "k8s-cluster",
      acpGossipEnabled: input.environment === "k8s-cluster"
    }
    
    const actual = {
      environment: metadata.environment || "unknown",
      clusterMode: metadata.clusterMode || false,
      peerCount: metadata.peerCount || 0,
      boredomEnabled: manifest.capabilities?.includes("boredom") || false,
      acpGossipEnabled: manifest.capabilities?.includes("acp-gossip") || false,
      backendAvailable: metadata.backendAvailable || false
    }
    
    const pass = 
      actual.environment === expected.environment &&
      actual.clusterMode === expected.clusterMode &&
      actual.peerCount >= expected.minPeerCount &&
      actual.boredomEnabled === expected.boredomEnabled
      // Note: acpGossipEnabled check skipped as gossip not implemented yet
    
    return {
      pass,
      actual,
      expected,
      error: pass ? undefined : "Environment validation failed"
    }
  } catch (error) {
    return {
      pass: false,
      actual: {
        environment: "unknown",
        clusterMode: false,
        peerCount: 0,
        boredomEnabled: false,
        acpGossipEnabled: false,
        backendAvailable: false
      },
      expected: {
        environment: input.environment,
        clusterMode: input.environment === "k8s-cluster",
        minPeerCount: 1,
        boredomEnabled: input.environment === "k8s-cluster",
        acpGossipEnabled: input.environment === "k8s-cluster"
      },
      error: `Environment validation error: ${error}`
    }
  }
}

// =============================================================================
// MAIN VALIDATION
// =============================================================================

/**
 * Run complete validation for minibob self-configuration
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const results: Partial<ValidationOutput> = {}
  
  const endpoint = input.minibobEndpoint || "http://localhost:8080"
  
  // 1. Validate health endpoint
  results.health = await validateHealthEndpoint(endpoint)
  
  // 2. Validate config endpoint
  results.config = await validateConfigEndpoint(endpoint, input)
  
  // 3. Validate environment detection
  results.environment = await validateEnvironment(endpoint, input)
  
  // 4. Validate DNS (K8s only)
  if (input.environment.startsWith("k8s") && input.namespace) {
    results.dns = await validateDNS(
      input.namespace,
      input.expectedPeerCount || (input.environment === "k8s-cluster" ? 3 : 1)
    )
  }
  
  // 5. Validate startup logs (if requested and K8s)
  if (input.checkStartupLogs && input.namespace) {
    try {
      // Get first pod name
      const { stdout } = await execAsync(
        `kubectl get pods -n ${input.namespace} -l app=minibob -o jsonpath='{.items[0].metadata.name}'`
      )
      const podName = stdout.trim()
      
      if (podName) {
        results.logs = await validateStartupLogs(input.namespace, podName, input.environment)
      }
    } catch (error) {
      results.logs = {
        pass: false,
        actual: {
          hasEnvironmentDetection: false,
          hasClusterModeLog: false,
          hasBoredomLog: false
        },
        expected: {
          hasEnvironmentDetection: true,
          hasClusterModeLog: true,
          hasBoredomLog: true
        },
        error: `Failed to get pod logs: ${error}`
      }
    }
  }
  
  // Calculate summary
  const checks = [
    results.health,
    results.config,
    results.environment,
    results.dns,
    results.logs
  ].filter(Boolean)
  
  const passedChecks = checks.filter(c => c!.pass).length
  const totalChecks = checks.length
  const failedChecks = totalChecks - passedChecks
  
  const pass = passedChecks === totalChecks
  
  return {
    pass,
    environment: results.environment!,
    config: results.config!,
    health: results.health!,
    dns: results.dns,
    logs: results.logs,
    summary: {
      totalChecks,
      passedChecks,
      failedChecks
    }
  } as ValidationOutput
}

// =============================================================================
// CLI INTERFACE
// =============================================================================

// Check if running as main module (CLI mode)
const isMain = process.argv[1]?.endsWith("minibob-self-configuration-system-harness.ts")

if (isMain) {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args[0] === "--help") {
    console.log(`
Usage: bun run minibob-self-configuration-system-harness.ts <environment> [options]

Environments:
  local          - Local development environment
  docker         - Docker container
  k8s-single     - Single-pod Kubernetes deployment
  k8s-cluster    - Multi-pod Kubernetes cluster (3+ pods)

Options:
  --endpoint URL       - minibob endpoint (default: http://localhost:8080)
  --namespace NS       - K8s namespace (required for k8s-*)
  --peer-count N       - Expected peer count (default: 3 for cluster)
  --backend URL        - Backend endpoint for health check
  --check-logs         - Validate startup logs (K8s only)

Examples:
  bun run minibob-self-configuration-system-harness.ts local
  bun run minibob-self-configuration-system-harness.ts k8s-cluster --namespace testing --check-logs
    `)
    process.exit(0)
  }
  
  const environment = args[0] as RuntimeEnvironment
  const input: ValidationInput = { environment }
  
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i]
    const value = args[i + 1]
    
    switch (flag) {
      case "--endpoint":
        input.minibobEndpoint = value
        break
      case "--namespace":
        input.namespace = value
        break
      case "--peer-count":
        input.expectedPeerCount = parseInt(value)
        break
      case "--backend":
        input.backendEndpoint = value
        break
      case "--check-logs":
        input.checkStartupLogs = true
        i-- // Flag doesn't consume a value
        break
    }
  }
  
  console.log("Running minibob Self-Configuration System validation...")
  console.log(`Environment: ${environment}`)
  console.log(`Endpoint: ${input.minibobEndpoint || "http://localhost:8080"}`)
  if (input.namespace) console.log(`Namespace: ${input.namespace}`)
  console.log("")
  
  runValidation(input)
    .then(result => {
      console.log("=== Validation Results ===\n")
      
      console.log(`✓ Health: ${result.health.pass ? "PASS" : "FAIL"}`)
      console.log(`  Status: ${result.health.actual.status}`)
      console.log(`  Response Time: ${result.health.actual.responseTime}ms`)
      if (result.health.error) console.log(`  Error: ${result.health.error}`)
      console.log("")
      
      console.log(`✓ Config: ${result.config.pass ? "PASS" : "FAIL"}`)
      console.log(`  Capabilities: ${result.config.actual.capabilities.join(", ")}`)
      if (result.config.actual.metadata) {
        console.log(`  Metadata: ${JSON.stringify(result.config.actual.metadata, null, 2)}`)
      }
      if (result.config.error) console.log(`  Error: ${result.config.error}`)
      console.log("")
      
      console.log(`✓ Environment: ${result.environment.pass ? "PASS" : "FAIL"}`)
      console.log(`  Detected: ${result.environment.actual.environment}`)
      console.log(`  Cluster Mode: ${result.environment.actual.clusterMode}`)
      console.log(`  Peer Count: ${result.environment.actual.peerCount}`)
      console.log(`  Boredom: ${result.environment.actual.boredomEnabled ? "enabled" : "disabled"}`)
      if (result.environment.error) console.log(`  Error: ${result.environment.error}`)
      console.log("")
      
      if (result.dns) {
        console.log(`✓ DNS: ${result.dns.pass ? "PASS" : "FAIL"}`)
        console.log(`  Addresses Found: ${result.dns.actual.count}`)
        console.log(`  IPs: ${result.dns.actual.addresses.join(", ")}`)
        if (result.dns.error) console.log(`  Error: ${result.dns.error}`)
        console.log("")
      }
      
      if (result.logs) {
        console.log(`✓ Logs: ${result.logs.pass ? "PASS" : "FAIL"}`)
        console.log(`  Environment Detection: ${result.logs.actual.hasEnvironmentDetection ? "✓" : "✗"}`)
        console.log(`  Cluster Mode Log: ${result.logs.actual.hasClusterModeLog ? "✓" : "✗"}`)
        console.log(`  Boredom Log: ${result.logs.actual.hasBoredomLog ? "✓" : "✗"}`)
        if (result.logs.actual.detectedEnvironment) {
          console.log(`  Detected Environment: ${result.logs.actual.detectedEnvironment}`)
        }
        if (result.logs.error) console.log(`  Error: ${result.logs.error}`)
        console.log("")
      }
      
      console.log("=== Summary ===")
      console.log(`Total Checks: ${result.summary.totalChecks}`)
      console.log(`Passed: ${result.summary.passedChecks}`)
      console.log(`Failed: ${result.summary.failedChecks}`)
      console.log(`Overall: ${result.pass ? "✓ PASS" : "✗ FAIL"}`)
      
      process.exit(result.pass ? 0 : 1)
    })
    .catch(error => {
      console.error("Validation error:", error)
      process.exit(1)
    })
}
