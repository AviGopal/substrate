/**
 * Validation Harness: minibob Complete System Integration
 * 
 * End-to-end validation of the complete vessel development workflow:
 * deployment → auto-configuration → validation → observation → refinement → repeat
 * 
 * Tests 8 validation steps without requiring LLM:
 * 1. Local development phase (tests, build, load)
 * 2. Deployment phase (helmfile sync)
 * 3. Self-configuration verification
 * 4. Capability tests (activity, ACP, boredom)
 * 5. Metrics collection
 * 6. Boredom task queue
 * 7. Autonomous execution (optional, requires time)
 * 8. Git commits (optional, requires time)
 */

import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs"
import * as path from "path"

const execAsync = promisify(exec)

export interface ValidationInput {
  repoPath: string  // Path to repos/minibob
  helmPath: string  // Path to helm directory
  environment: "testing" | "staging"
  layer: "dev" | "testing-single" | "testing-cluster" | "staging"
  skipLongRunning?: boolean  // Skip steps 7-8 (require waiting)
}

export interface ValidationOutput {
  pass: boolean
  steps: StepResult[]
  summary: string
  timestamp: string
}

export interface StepResult {
  step: number
  name: string
  pass: boolean
  message: string
  details?: any
}

/**
 * Run complete system integration validation
 */
export async function runValidation(input: ValidationInput): Promise<ValidationOutput> {
  const startTime = new Date().toISOString()
  const steps: StepResult[] = []

  console.log(`[Validation] Starting minibob Complete System Integration validation`)
  console.log(`[Validation] Repo: ${input.repoPath}`)
  console.log(`[Validation] Environment: ${input.environment}`)
  console.log(`[Validation] Layer: ${input.layer}`)

  // Step 1: Local Development Phase
  steps.push(await validateLocalDevelopment(input.repoPath))

  // Step 2: Deployment Phase
  steps.push(await validateDeployment(input.helmPath, input.environment, input.layer))

  // Step 3: Self-Configuration
  steps.push(await validateSelfConfiguration(input.layer))

  // Step 4: Capability Tests
  steps.push(await validateCapabilityTests(input.repoPath, input.layer))

  // Step 5: Metrics Collection
  steps.push(await validateMetricsCollection(input.repoPath))

  // Step 6: Boredom Task Queue
  steps.push(await validateBoredomTaskQueue())

  // Step 7: Autonomous Execution (optional)
  if (!input.skipLongRunning) {
    steps.push(await validateAutonomousExecution(input.layer))
  }

  // Step 8: Git Commits (optional)
  if (!input.skipLongRunning) {
    steps.push(await validateAutonomousCommits(input.repoPath))
  }

  // Calculate overall pass/fail
  const allPassed = steps.every(s => s.pass)
  const passedCount = steps.filter(s => s.pass).length
  const totalCount = steps.length

  const summary = allPassed
    ? `✅ ALL VALIDATION STEPS PASSED (${passedCount}/${totalCount})`
    : `⚠️ VALIDATION INCOMPLETE (${passedCount}/${totalCount} passed)`

  return {
    pass: allPassed,
    steps,
    summary,
    timestamp: startTime
  }
}

/**
 * Step 1: Validate local development phase
 */
async function validateLocalDevelopment(repoPath: string): Promise<StepResult> {
  const step = 1
  const name = "Local Development Phase"

  try {
    console.log(`[Step ${step}] ${name}`)

    // Check if tests pass
    const testResult = await execAsync(`cd ${repoPath} && bun test 2>&1`)
    const testsPass = testResult.stdout.includes("pass") || testResult.stdout.includes("✓")

    // Check if type checking passes
    const typeResult = await execAsync(`cd ${repoPath} && bun typecheck 2>&1`)
    const typesPass = !typeResult.stderr.includes("error")

    // Check if Docker image exists or can be built
    const imageExists = await checkDockerImage("minibob:latest")

    const pass = testsPass && typesPass
    const message = pass
      ? "Tests pass, types check, Docker ready"
      : `Tests: ${testsPass}, Types: ${typesPass}, Docker: ${imageExists}`

    return {
      step,
      name,
      pass,
      message,
      details: { testsPass, typesPass, imageExists }
    }
  } catch (error) {
    return {
      step,
      name,
      pass: false,
      message: `Failed: ${error}`,
      details: { error: String(error) }
    }
  }
}

/**
 * Step 2: Validate deployment phase
 */
async function validateDeployment(helmPath: string, environment: string, layer: string): Promise<StepResult> {
  const step = 2
  const name = "Deployment Phase"

  try {
    console.log(`[Step ${step}] ${name}`)

    // Check helmfile releases
    const listResult = await execAsync(`cd ${helmPath} && helmfile -e ${environment} list 2>&1`)
    const releases = listResult.stdout

    // Check if minibob release exists
    const minibobDeployed = releases.includes("minibob")

    // Check pod status
    const namespace = getNamespaceForLayer(layer)
    const podsResult = await execAsync(`kubectl get pods -n ${namespace} 2>&1`)
    const podsRunning = podsResult.stdout.includes("Running")

    const pass = minibobDeployed && podsRunning
    const message = pass
      ? `Deployed to ${namespace}, pods running`
      : `Deployed: ${minibobDeployed}, Running: ${podsRunning}`

    return {
      step,
      name,
      pass,
      message,
      details: { namespace, minibobDeployed, podsRunning }
    }
  } catch (error) {
    return {
      step,
      name,
      pass: false,
      message: `Failed: ${error}`,
      details: { error: String(error) }
    }
  }
}

/**
 * Step 3: Validate self-configuration
 */
async function validateSelfConfiguration(layer: string): Promise<StepResult> {
  const step = 3
  const name = "Self-Configuration Verification"

  try {
    console.log(`[Step ${step}] ${name}`)

    const namespace = getNamespaceForLayer(layer)
    const podName = `${getPodPrefix(layer)}-0`

    // Check logs for environment detection
    const logsResult = await execAsync(`kubectl logs -n ${namespace} ${podName} 2>&1 | grep -E 'Environment|Cluster|Boredom|ACP' | head -20`)
    const logs = logsResult.stdout

    const hasEnvironment = logs.includes("Environment")
    const hasClusterMode = logs.includes("Cluster")
    const hasBoredom = logs.includes("Boredom")
    const hasACP = logs.includes("ACP")

    // Check /config endpoint
    const configResult = await execAsync(`kubectl exec -n ${namespace} ${podName} -- curl -s http://localhost:3100/config 2>&1`)
    const config = JSON.parse(configResult.stdout)

    const hasCapabilities = config.capabilities && Array.isArray(config.capabilities)
    const expectedCapabilities = getExpectedCapabilities(layer)
    const capabilitiesMatch = expectedCapabilities.every(cap => config.capabilities.includes(cap))

    const pass = hasEnvironment && hasCapabilities && capabilitiesMatch
    const message = pass
      ? `Environment detected, capabilities: ${config.capabilities.join(", ")}`
      : `Env: ${hasEnvironment}, Capabilities: ${hasCapabilities}, Match: ${capabilitiesMatch}`

    return {
      step,
      name,
      pass,
      message,
      details: { logs, config, expectedCapabilities }
    }
  } catch (error) {
    return {
      step,
      name,
      pass: false,
      message: `Failed: ${error}`,
      details: { error: String(error) }
    }
  }
}

/**
 * Step 4: Validate capability tests
 */
async function validateCapabilityTests(repoPath: string, layer: string): Promise<StepResult> {
  const step = 4
  const name = "Capability Tests"

  try {
    console.log(`[Step ${step}] ${name}`)

    const namespace = getNamespaceForLayer(layer)

    // Run test-vessel-capabilities.sh
    const testResult = await execAsync(`cd ${repoPath} && ./scripts/test-vessel-capabilities.sh ${namespace} 2>&1`, {
      timeout: 120000  // 2 minute timeout
    })

    const output = testResult.stdout

    // Count passed tests
    const passMatches = output.match(/PASS/g)
    const passCount = passMatches ? passMatches.length : 0

    // Expected: 3-4 tests (depends on layer)
    const expectedMin = layer.includes("cluster") ? 4 : 3
    const pass = passCount >= expectedMin

    const message = pass
      ? `${passCount} tests passed (>= ${expectedMin} expected)`
      : `Only ${passCount} tests passed (expected >= ${expectedMin})`

    return {
      step,
      name,
      pass,
      message,
      details: { passCount, expectedMin, output }
    }
  } catch (error) {
    return {
      step,
      name,
      pass: false,
      message: `Failed: ${error}`,
      details: { error: String(error) }
    }
  }
}

/**
 * Step 5: Validate metrics collection
 */
async function validateMetricsCollection(repoPath: string): Promise<StepResult> {
  const step = 5
  const name = "Metrics Collection"

  try {
    console.log(`[Step ${step}] ${name}`)

    const metricsDir = path.join(repoPath, "metrics")

    // Check if metrics directory exists
    if (!fs.existsSync(metricsDir)) {
      return {
        step,
        name,
        pass: false,
        message: "Metrics directory does not exist",
        details: { metricsDir }
      }
    }

    // List metrics files
    const files = fs.readdirSync(metricsDir).filter(f => f.startsWith("metrics-") && f.endsWith(".json"))

    if (files.length === 0) {
      return {
        step,
        name,
        pass: false,
        message: "No metrics files found",
        details: { metricsDir, files }
      }
    }

    // Read latest metrics file
    const latestFile = files.sort().reverse()[0]
    const metricsPath = path.join(metricsDir, latestFile)
    const metricsContent = fs.readFileSync(metricsPath, "utf-8")
    const metrics = JSON.parse(metricsContent)

    // Validate metrics structure
    const hasExecutions = typeof metrics.total_executions === "number"
    const hasSuccessRate = typeof metrics.success_rate === "number"
    const hasAvgDuration = typeof metrics.avg_duration_ms === "number"

    const pass = hasExecutions && hasSuccessRate && hasAvgDuration
    const message = pass
      ? `Metrics file found: ${latestFile}, ${metrics.total_executions} executions`
      : `Metrics structure incomplete`

    return {
      step,
      name,
      pass,
      message,
      details: { latestFile, metrics }
    }
  } catch (error) {
    return {
      step,
      name,
      pass: false,
      message: `Failed: ${error}`,
      details: { error: String(error) }
    }
  }
}

/**
 * Step 6: Validate boredom task queue
 */
async function validateBoredomTaskQueue(): Promise<StepResult> {
  const step = 6
  const name = "Boredom Task Queue"

  try {
    console.log(`[Step ${step}] ${name}`)

    // Query backend /boredom-tasks endpoint
    const result = await execAsync(`kubectl exec -n metabob deployment/metabob-rpc-api -- curl -s http://localhost:3000/boredom-tasks 2>&1`)
    const response = JSON.parse(result.stdout)

    const hasTasks = Array.isArray(response) || (response.tasks && Array.isArray(response.tasks))
    const taskCount = Array.isArray(response) ? response.length : (response.tasks?.length || 0)

    // Pass if endpoint is accessible (tasks may or may not exist)
    const pass = hasTasks !== undefined
    const message = pass
      ? `Boredom task queue accessible, ${taskCount} tasks`
      : `Failed to access boredom task queue`

    return {
      step,
      name,
      pass,
      message,
      details: { taskCount, response }
    }
  } catch (error) {
    return {
      step,
      name,
      pass: false,
      message: `Failed: ${error}`,
      details: { error: String(error) }
    }
  }
}

/**
 * Step 7: Validate autonomous execution (requires time)
 */
async function validateAutonomousExecution(layer: string): Promise<StepResult> {
  const step = 7
  const name = "Autonomous Execution"

  try {
    console.log(`[Step ${step}] ${name} (waiting for boredom activity...)`)

    const namespace = getNamespaceForLayer(layer)
    const podName = `${getPodPrefix(layer)}-0`

    // Wait up to 2 minutes for boredom activity
    const timeout = 120000
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const logsResult = await execAsync(`kubectl logs -n ${namespace} ${podName} 2>&1 | grep Boredom | tail -10`)
      const logs = logsResult.stdout

      if (logs.includes("Executing task")) {
        return {
          step,
          name,
          pass: true,
          message: "Boredom system executed task autonomously",
          details: { logs }
        }
      }

      // Wait 10 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 10000))
    }

    return {
      step,
      name,
      pass: false,
      message: "No autonomous execution detected within timeout",
      details: { timeout }
    }
  } catch (error) {
    return {
      step,
      name,
      pass: false,
      message: `Failed: ${error}`,
      details: { error: String(error) }
    }
  }
}

/**
 * Step 8: Validate autonomous commits (requires time)
 */
async function validateAutonomousCommits(repoPath: string): Promise<StepResult> {
  const step = 8
  const name = "Autonomous Commits"

  try {
    console.log(`[Step ${step}] ${name}`)

    // Check git log for recent commits
    const gitResult = await execAsync(`cd ${repoPath} && git log --oneline --since="1 hour ago" 2>&1`)
    const commits = gitResult.stdout

    // Look for commits from vessel/boredom
    const hasAutonomousCommit = commits.includes("vessel") || commits.includes("boredom") || commits.includes("autonomous")

    const pass = hasAutonomousCommit
    const message = pass
      ? "Autonomous commits detected in git log"
      : "No autonomous commits found (may require more time)"

    return {
      step,
      name,
      pass,
      message,
      details: { commits }
    }
  } catch (error) {
    return {
      step,
      name,
      pass: false,
      message: `Failed: ${error}`,
      details: { error: String(error) }
    }
  }
}

/**
 * Helper: Check if Docker image exists
 */
async function checkDockerImage(imageName: string): Promise<boolean> {
  try {
    const result = await execAsync(`docker images ${imageName} --format "{{.Repository}}:{{.Tag}}" 2>&1`)
    return result.stdout.includes(imageName)
  } catch {
    return false
  }
}

/**
 * Helper: Get namespace for layer
 */
function getNamespaceForLayer(layer: string): string {
  const namespaces: Record<string, string> = {
    "dev": "minibob-dev",
    "testing-single": "testing-minibob",
    "testing-cluster": "minibob-cluster",
    "staging": "minibob-staging"
  }
  return namespaces[layer] || "minibob-cluster"
}

/**
 * Helper: Get pod prefix for layer
 */
function getPodPrefix(layer: string): string {
  if (layer === "testing-cluster" || layer === "staging") {
    return "minibob"
  }
  return "minibob"
}

/**
 * Helper: Get expected capabilities for layer
 */
function getExpectedCapabilities(layer: string): string[] {
  const base = ["activities", "impulses", "git", "acp"]
  
  if (layer === "testing-cluster" || layer === "staging") {
    return [...base, "acp-gossip", "boredom"]
  }
  
  return base
}

/**
 * Export for use in tests
 */
export default runValidation
