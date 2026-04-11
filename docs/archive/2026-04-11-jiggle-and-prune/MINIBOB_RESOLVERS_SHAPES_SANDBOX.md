# MiniBob Resolvers, Shapes, and Sandbox Testing

## Overview

MiniBob uses a **resolver-based architecture** where different resolvers handle different types of data transformations. Shapes describe what data looks like, enabling type-safe activity composition and validation.

---

## 1. Available Resolvers

### Core Resolvers

| Resolver | Purpose | Input Shapes | Output Shapes |
|----------|---------|--------------|---------------|
| **LLM Resolver** | Reasoning and generation | Any text/code | source_code, documentation, analysis |
| **Git Resolver** | Version control operations | source_code, goal | patch, commit_message |
| **Bash Resolver** | Shell command execution | command, environment | execution_result, file_changes |
| **File Resolver** | File operations | file_path, content | source_code, config_file |
| **Validation Resolver** | Behavioral validation | source_code, test_suite | validation_result |
| **External Validation** | Real-world validation | Any | external_validation_result |
| **Pre-validation Resolver** | Early checks | template, environment | validation_result |

### Resolver Interface

All resolvers implement:

```typescript
interface Resolver {
  name: string
  enabled: boolean
  resolve(impulseRefs: ImpulseRef[], config: ResolverConfig): Promise<Impulse[]>
}
```

**Key points:**
- **Uniform interface** - All resolvers use same API
- **Runtime control** - Enable/disable via environment
- **Impulse-based** - Everything flows through impulses
- **Metadata first** - Decide before loading content

---

## 2. Shape System

### What are Shapes?

**Shapes** are named constraints that describe data:
- Type information (what it is)
- Validation rules (what it must satisfy)
- Resolution strategies (how to get it)

### Canonical Shapes

From `shape-resolver.ts`:

#### Input Shapes (What activities consume)

| Shape | Description | Examples |
|-------|-------------|----------|
| `goal` | Task objectives | "Fix the login bug", "Add rate limiting" |
| `source_code` | Code files | TypeScript, Python, Go files |
| `error` | Error messages | Exceptions, stack traces |
| `trace` | Execution logs | Stack traces, debug output |
| `execution_trace` | Activity execution records | Full trace with state snapshots |
| `activity_template` | Template definitions | Activity JSON specs |
| `activity_metrics` | Performance stats | Success rates, durations, costs |
| `test_suite` | Test files | Unit tests, integration tests |
| `sql_schema` | Database schemas | CREATE TABLE, ALTER statements |
| `config_file` | Configuration | JSON, YAML, TOML configs |
| `documentation` | Docs and comments | README, API docs |

#### Output Shapes (What activities produce)

| Shape | Description | Validators |
|-------|-------------|-----------|
| `patch` | Code changes | file_exists, lint_passes |
| `test_suite` | Test code | tests_pass |
| `source_code` | New/modified code | typescript_compiles, builds |
| `documentation` | Documentation | markdown_valid |
| `sql_schema` | Database schema | sql_valid |
| `config_file` | Configuration | json_valid, yaml_valid |
| `analysis` | Analysis report | json_valid |
| `validation_result` | Validation outcome | json_valid |
| `external_validation_result` | External checks | json_schema |

### Shape Inference

MiniBob automatically infers shapes from goals:

```typescript
// Goal: "Fix the authentication bug in login.ts"
// Inferred input shapes:
// - "goal" (explicit task)
// - "source_code" (.ts file mentioned)
// - "error" ("bug" keyword)
// - "trace" (debugging context)
```

Pattern matching from `extractImpliedShapes()`:
- File extensions → `source_code`
- Error keywords → `error`, `trace`
- Test keywords → `test_suite`
- Metric keywords → `activity_metrics`
- Security keywords → `error`, `source_code`
- Database keywords → `sql_schema`

---

## 3. Validators (Shape Validation)

### Built-in Validators

From `validators/index.ts`:

| Validator | Shape | Description | Example |
|-----------|-------|-------------|---------|
| `file_exists` | Any | File exists at path | Check output created |
| `executable` | Any | File is executable | Verify script permissions |
| `json_valid` | config_file | Valid JSON syntax | Config file validation |
| `json_schema` | config_file | Matches JSON schema | Strict config validation |
| `typescript_compiles` | source_code | TypeScript compiles | No type errors |
| `typescript_strict` | source_code | Strict mode compiles | Stricter validation |
| `tests_pass` | test_suite | Tests execute successfully | Unit/integration tests |
| `builds` | source_code | Build succeeds | Compilation check |
| `lint_passes` | source_code | Linting passes | Code style validation |
| `markdown_valid` | documentation | Valid markdown | Doc validation |
| `yaml_valid` | config_file | Valid YAML syntax | Config validation |

### Validator Principles

1. **No LLM** - All deterministic
2. **Fast** - Quick checks with caching
3. **Composable** - Combine validators
4. **Configurable** - Accept options
5. **Observable** - Logged for learning

### Early Exit

Activities can exit early when all output shapes validate:

```typescript
import { checkEarlyExit } from './validators'

const result = await checkEarlyExit([
  { shape: 'file_exists', pointer: { type: 'file', path: '/path/to/output.ts' } },
  { shape: 'typescript_compiles', pointer: { type: 'file', path: '/path/to/output.ts' } },
  { shape: 'tests_pass', pointer: { type: 'file', path: '/path/to/project' } },
])

if (result.canExit) {
  console.log('All constraints satisfied - early exit!')
  // Activity succeeded, no need to continue
}
```

**Benefits:**
- Faster execution (no redundant work)
- Clear success criteria
- Deterministic validation
- Feeds Thompson Sampling with quality signals

---

## 4. External Validation

From `resolvers/external-validation-resolver.ts`:

### Validation Types

#### 1. **Database Validation**
```typescript
{
  validationType: 'database',
  databaseType: 'postgresql',
  connectionString: 'postgresql://...',
  dryRun: true  // Don't execute, just validate syntax
}
```

**Checks:**
- SQL syntax validation
- Schema compatibility
- Dry-run execution
- Transaction safety

#### 2. **API Validation**
```typescript
{
  validationType: 'api',
  endpoint: 'https://api.example.com/health',
  method: 'GET',
  expectedStatus: 200,
  expectedResponse: { status: 'ok' }
}
```

**Checks:**
- HTTP request/response
- Status code validation
- Response schema matching
- Timeout handling

#### 3. **Test Suite Validation**
```typescript
{
  validationType: 'test_suite',
  testCommand: 'bun test',
  workingDirectory: '/path/to/project',
  timeout: 60000
}
```

**Checks:**
- Execute test command
- Parse test results
- Coverage reporting
- Performance benchmarks

#### 4. **Command Validation**
```typescript
{
  validationType: 'command',
  command: './scripts/validate.sh',
  workingDirectory: '/path',
  expectedExitCode: 0
}
```

**Checks:**
- Command execution
- Exit code validation
- Output parsing
- Error classification

#### 5. **Script Validation**
```typescript
{
  validationType: 'script',
  scriptPath: './validate.ts',
  args: ['--strict'],
  timeout: 30000
}
```

**Checks:**
- Custom validation logic
- Script execution
- Result parsing
- Structured feedback

### Error Classification

External validator classifies errors for Thompson Sampling:

**Error Types:**
- `syntax_error` - Malformed code/config (low retriability)
- `semantic_error` - Logic errors (medium retriability)
- `runtime_error` - Execution failures (high retriability)
- `environment_error` - Setup issues (very high retriability)
- `validation_error` - Constraint violations (low retriability)
- `execution_error` - Validator crashes (very high retriability)

**Failure Categories:**
- `code_quality` - Linting, formatting issues
- `correctness` - Logic errors, test failures
- `performance` - Too slow, too expensive
- `compatibility` - Version mismatches
- `environment` - Missing dependencies

---

## 5. Activities MiniBob Can Create

### Activity Types by Category

From analyzing embedded templates and capabilities:

#### A. **Feature Development**
```typescript
{
  category: "feature",
  inputShapes: ["goal", "source_code"],
  outputShapes: ["source_code", "test_suite"],
  resolvers: ["llm", "file", "bash", "validation"]
}
```

**Examples:**
- Add new endpoints
- Implement authentication
- Create UI components
- Build data pipelines

#### B. **Bug Fixes**
```typescript
{
  category: "bugfix",
  inputShapes: ["goal", "error", "trace", "source_code"],
  outputShapes: ["patch", "test_suite"],
  resolvers: ["llm", "git", "validation"]
}
```

**Examples:**
- Fix failing tests
- Resolve runtime errors
- Patch security vulnerabilities
- Debug performance issues

#### C. **Refactoring**
```typescript
{
  category: "refactor",
  inputShapes: ["source_code", "activity_metrics"],
  outputShapes: ["source_code", "documentation"],
  resolvers: ["llm", "file", "validation"]
}
```

**Examples:**
- Extract functions/modules
- Improve code structure
- Optimize performance
- Update dependencies

#### D. **Testing**
```typescript
{
  category: "test",
  inputShapes: ["source_code", "goal"],
  outputShapes: ["test_suite"],
  resolvers: ["llm", "file", "bash", "validation"]
}
```

**Examples:**
- Write unit tests
- Create integration tests
- Add coverage for edge cases
- Performance benchmarks

#### E. **Infrastructure**
```typescript
{
  category: "infrastructure",
  inputShapes: ["goal", "config_file"],
  outputShapes: ["config_file", "documentation"],
  resolvers: ["file", "bash", "external-validation"]
}
```

**Examples:**
- CI/CD pipeline setup
- Docker configuration
- Database migrations
- Deployment scripts

#### F. **Tool/Meta Activities**
```typescript
{
  category: "tool",
  inputShapes: ["execution_trace", "activity_metrics"],
  outputShapes: ["activity_template", "analysis"],
  resolvers: ["llm", "mcp"]
}
```

**Examples:**
- Debug failed activities
- Optimize templates
- Create variants
- Analyze execution patterns

### Activity Constraints

**What MiniBob CAN do:**
- ✅ Read/write files
- ✅ Execute shell commands
- ✅ Git operations
- ✅ Run tests
- ✅ Code generation
- ✅ Analysis and debugging
- ✅ Configuration management
- ✅ API interactions (via bash/curl)

**What MiniBob CANNOT do** (without extensions):
- ❌ GUI interactions (no browser automation by default)
- ❌ Real-time collaboration (no shared state)
- ❌ Long-running services (activities are tasks)
- ❌ External system access (without API keys)

**Resolver Availability:**
- LLM Resolver: Optional (requires API key)
- All others: Always available
- External validation: Requires external systems

---

## 6. Creating Speculative Activities in Sandbox

### Goal: Safe Experimentation

Create and test activities in isolated Docker containers to:
1. **Improvise** - Try new approaches without risk
2. **Reflect** - Analyze what worked/failed
3. **Learn** - Extract patterns for templates
4. **Optimize** - Measure correctness and efficiency

### Sandbox Architecture

```
┌─────────────────────────────────────┐
│  Host (MiniBob)                     │
│  - Activity orchestration           │
│  - Template management              │
│  - Learning system                  │
└──────────┬──────────────────────────┘
           │
           │ Docker API
           ▼
┌─────────────────────────────────────┐
│  Docker Container (Sandbox)         │
│  - Fresh environment                │
│  - Activity execution               │
│  - Validation checks                │
│  - Result collection                │
└─────────────────────────────────────┘
```

### Implementation

#### Step 1: Create Sandbox Docker Image

```dockerfile
# repos/minibob/sandbox/Dockerfile
FROM node:20-alpine

# Install common tools
RUN apk add --no-cache \
    git \
    bash \
    curl \
    jq \
    python3 \
    py3-pip

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Create workspace
WORKDIR /workspace

# Copy MiniBob minimal runtime
COPY --from=minibob-runtime /app/minibob /usr/local/bin/minibob

# Default command: Wait for activities
CMD ["tail", "-f", "/dev/null"]
```

#### Step 2: Create Sandbox Manager

```typescript
// repos/minibob/src/sandbox/manager.ts

import Docker from 'dockerode'
import { ActivityTemplate, ActivityExecution } from '../types'
import { getLogger } from '../logger'

const log = getLogger('SandboxManager')

export interface SandboxConfig {
  image: string
  timeout: number
  memoryLimit: string
  cpuLimit: number
  networkMode: 'none' | 'bridge' | 'host'
}

export class SandboxManager {
  private docker: Docker

  constructor(private config: SandboxConfig = {
    image: 'minibob-sandbox:latest',
    timeout: 300000,  // 5 minutes
    memoryLimit: '512m',
    cpuLimit: 1.0,
    networkMode: 'bridge'
  }) {
    this.docker = new Docker()
  }

  /**
   * Execute activity in isolated sandbox
   */
  async executeInSandbox(
    template: ActivityTemplate,
    variables: Record<string, unknown>,
    options: {
      workdir?: string
      env?: Record<string, string>
      validateBefore?: boolean
      validateAfter?: boolean
    } = {}
  ): Promise<ActivityExecution> {
    const startTime = Date.now()
    const executionId = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    log.info(`Starting sandbox execution: ${executionId}`)

    // Create container
    const container = await this.docker.createContainer({
      Image: this.config.image,
      Cmd: ['/bin/sh', '-c', 'sleep infinity'],
      WorkingDir: options.workdir || '/workspace',
      Env: this.buildEnvironment(options.env || {}),
      HostConfig: {
        Memory: this.parseMemoryLimit(this.config.memoryLimit),
        NanoCpus: Math.floor(this.config.cpuLimit * 1e9),
        NetworkMode: this.config.networkMode,
        AutoRemove: true,
      },
      Labels: {
        'minibob.execution_id': executionId,
        'minibob.template_id': template.id,
        'minibob.type': 'sandbox',
      }
    })

    try {
      // Start container
      await container.start()
      log.debug(`Container started: ${container.id}`)

      // Pre-validation (optional)
      if (options.validateBefore) {
        const preValidation = await this.runValidation(container, 'pre')
        if (!preValidation.passed) {
          throw new Error(`Pre-validation failed: ${preValidation.message}`)
        }
      }

      // Execute activity
      const execution = await this.executeActivity(container, template, variables)

      // Post-validation (optional)
      if (options.validateAfter) {
        const postValidation = await this.runValidation(container, 'post')
        execution.validation = postValidation
      }

      // Collect results
      execution.duration_ms = Date.now() - startTime
      execution.sandbox = {
        container_id: container.id,
        image: this.config.image,
        isolated: this.config.networkMode === 'none'
      }

      log.info(`Sandbox execution completed: ${executionId} (${execution.success ? 'SUCCESS' : 'FAILURE'})`)

      return execution

    } catch (error) {
      log.error(`Sandbox execution failed: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    } finally {
      // Cleanup
      try {
        await container.stop({ t: 1 })
        // AutoRemove will delete the container
      } catch (cleanupError) {
        log.warn(`Cleanup error: ${cleanupError}`)
      }
    }
  }

  /**
   * Execute activity tasks in container
   */
  private async executeActivity(
    container: Docker.Container,
    template: ActivityTemplate,
    variables: Record<string, unknown>
  ): Promise<ActivityExecution> {
    const execution: ActivityExecution = {
      execution_id: `exec_${Date.now()}`,
      template_id: template.id,
      started_at: new Date().toISOString(),
      tasks: [],
      success: false,
    }

    for (const task of template.tasks) {
      const taskStart = Date.now()

      // Build command to execute task
      const command = this.buildTaskCommand(task, variables)

      // Execute in container
      const exec = await container.exec({
        Cmd: ['/bin/sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
      })

      const stream = await exec.start({})
      const output = await this.collectOutput(stream)

      // Get exit code
      const inspect = await exec.inspect()
      const exitCode = inspect.ExitCode

      execution.tasks.push({
        task_id: task.id,
        status: exitCode === 0 ? 'completed' : 'failed',
        duration_ms: Date.now() - taskStart,
        output,
        exit_code: exitCode,
      })

      if (exitCode !== 0) {
        execution.success = false
        execution.error = `Task ${task.id} failed with exit code ${exitCode}`
        break
      }
    }

    execution.success = execution.tasks.every(t => t.status === 'completed')
    execution.completed_at = new Date().toISOString()

    return execution
  }

  /**
   * Run validation checks
   */
  private async runValidation(
    container: Docker.Container,
    phase: 'pre' | 'post'
  ): Promise<{ passed: boolean; message?: string }> {
    // Run environment checks, dependency verification, etc.
    const command = phase === 'pre'
      ? 'which bun && which git && which node'
      : 'echo "Post-validation placeholder"'

    const exec = await container.exec({
      Cmd: ['/bin/sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
    })

    const stream = await exec.start({})
    const inspect = await exec.inspect()

    return {
      passed: inspect.ExitCode === 0,
      message: inspect.ExitCode === 0 ? undefined : 'Validation check failed'
    }
  }

  private buildEnvironment(env: Record<string, string>): string[] {
    return Object.entries({
      ...env,
      MINIBOB_SANDBOX: 'true',
      PATH: '/usr/local/bin:/usr/bin:/bin:/root/.bun/bin'
    }).map(([k, v]) => `${k}=${v}`)
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([kmg])?$/i)
    if (!match) throw new Error(`Invalid memory limit: ${limit}`)

    const value = parseInt(match[1]!)
    const unit = (match[2] || '').toLowerCase()

    const multipliers = { '': 1, k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 }
    return value * (multipliers[unit as keyof typeof multipliers] || 1)
  }

  private buildTaskCommand(task: any, variables: Record<string, unknown>): string {
    // Simplified task execution
    return `echo "Executing task: ${task.id}"`
  }

  private async collectOutput(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = []
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      stream.on('error', reject)
    })
  }
}
```

#### Step 3: Create Speculative Activity Tester

```typescript
// repos/minibob/src/sandbox/speculative-tester.ts

import { SandboxManager } from './manager'
import { ActivityTemplate } from '../types'
import { getLogger } from '../logger'

const log = getLogger('SpeculativeTester')

export interface SpeculativeTestConfig {
  iterations: number
  variantStrategies: string[]
  measureCorrectness: boolean
  measureEfficiency: boolean
  extractTemplateOnSuccess: boolean
}

export class SpeculativeTester {
  constructor(
    private sandbox: SandboxManager,
    private config: SpeculativeTestConfig = {
      iterations: 5,
      variantStrategies: ['default', 'optimized', 'defensive'],
      measureCorrectness: true,
      measureEfficiency: true,
      extractTemplateOnSuccess: true,
    }
  ) {}

  /**
   * Test activity with multiple variants and strategies
   */
  async testSpeculatively(
    template: ActivityTemplate,
    testCases: Array<{ variables: Record<string, unknown>; expectedOutput?: any }>
  ): Promise<SpeculativeTestResult> {
    const results: SpeculativeTestResult = {
      template_id: template.id,
      iterations: this.config.iterations,
      variants: [],
      metrics: {
        correctness: [],
        efficiency: [],
      }
    }

    // Test each variant strategy
    for (const strategy of this.config.variantStrategies) {
      log.info(`Testing variant strategy: ${strategy}`)

      const variantResult = await this.testVariant(
        template,
        strategy,
        testCases
      )

      results.variants.push(variantResult)
    }

    // Analyze results
    results.analysis = this.analyzeResults(results)

    // Extract best template
    if (this.config.extractTemplateOnSuccess) {
      const bestVariant = results.variants
        .filter(v => v.successRate > 0.8)
        .sort((a, b) => b.efficiency - a.efficiency)[0]

      if (bestVariant) {
        results.extractedTemplate = await this.extractTemplate(bestVariant)
      }
    }

    return results
  }

  private async testVariant(
    template: ActivityTemplate,
    strategy: string,
    testCases: Array<{ variables: Record<string, unknown>; expectedOutput?: any }>
  ): Promise<VariantTestResult> {
    const executions = []
    let successCount = 0
    let totalDuration = 0
    let totalCost = 0

    for (let i = 0; i < this.config.iterations; i++) {
      for (const testCase of testCases) {
        log.debug(`Iteration ${i + 1}/${this.config.iterations} - ${strategy}`)

        try {
          const execution = await this.sandbox.executeInSandbox(
            template,
            testCase.variables,
            {
              validateBefore: true,
              validateAfter: this.config.measureCorrectness,
            }
          )

          executions.push(execution)

          if (execution.success) {
            successCount++

            // Measure correctness
            if (this.config.measureCorrectness && testCase.expectedOutput) {
              const correct = await this.verifyCorrectness(
                execution,
                testCase.expectedOutput
              )
              if (!correct) successCount-- // Penalize incorrect successes
            }
          }

          totalDuration += execution.duration_ms || 0
          totalCost += execution.cost_usd || 0

        } catch (error) {
          log.error(`Execution failed: ${error}`)
          executions.push({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          } as any)
        }
      }
    }

    const totalTests = this.config.iterations * testCases.length

    return {
      strategy,
      executions,
      successCount,
      failureCount: totalTests - successCount,
      successRate: successCount / totalTests,
      avgDuration: totalDuration / totalTests,
      totalCost,
      efficiency: this.calculateEfficiency(successCount, totalTests, totalDuration, totalCost)
    }
  }

  private async verifyCorrectness(
    execution: any,
    expected: any
  ): Promise<boolean> {
    // Compare actual vs expected output
    // This is simplified - real implementation would use shape validators
    return execution.success && execution.validation?.passed
  }

  private calculateEfficiency(
    successCount: number,
    totalTests: number,
    totalDuration: number,
    totalCost: number
  ): number {
    const successRate = successCount / totalTests
    const avgDuration = totalDuration / totalTests
    const avgCost = totalCost / totalTests

    // Efficiency = success_rate / (normalized_duration * normalized_cost)
    // Higher is better
    const normalizedDuration = avgDuration / 10000 // Assume 10s is baseline
    const normalizedCost = avgCost / 0.01 // Assume $0.01 is baseline

    return successRate / (normalizedDuration * normalizedCost)
  }

  private analyzeResults(results: SpeculativeTestResult): any {
    // Statistical analysis
    return {
      bestStrategy: results.variants
        .sort((a, b) => b.efficiency - a.efficiency)[0]?.strategy,
      avgSuccessRate: results.variants.reduce((sum, v) => sum + v.successRate, 0) / results.variants.length,
      totalCost: results.variants.reduce((sum, v) => sum + v.totalCost, 0),
    }
  }

  private async extractTemplate(variant: VariantTestResult): Promise<ActivityTemplate> {
    // Extract successful executions into template
    const successfulExecution = variant.executions.find(e => e.success)

    // Use ribosome pattern to extract template
    // This is simplified - real implementation in backend
    return {
      id: `extracted_${Date.now()}`,
      name: `Extracted from ${variant.strategy}`,
      category: 'feature',
      tasks: [], // Would extract from execution trace
    } as ActivityTemplate
  }
}

interface SpeculativeTestResult {
  template_id: string
  iterations: number
  variants: VariantTestResult[]
  metrics: {
    correctness: any[]
    efficiency: any[]
  }
  analysis?: any
  extractedTemplate?: ActivityTemplate
}

interface VariantTestResult {
  strategy: string
  executions: any[]
  successCount: number
  failureCount: number
  successRate: number
  avgDuration: number
  totalCost: number
  efficiency: number
}
```

#### Step 4: Usage Example

```typescript
// Example: Test speculative activity

import { SandboxManager } from './sandbox/manager'
import { SpeculativeTester } from './sandbox/speculative-tester'

// Create sandbox manager
const sandbox = new SandboxManager({
  image: 'minibob-sandbox:latest',
  timeout: 300000,
  memoryLimit: '512m',
  cpuLimit: 1.0,
  networkMode: 'none',  // Isolated
})

// Create speculative tester
const tester = new SpeculativeTester(sandbox, {
  iterations: 5,
  variantStrategies: ['default', 'optimized', 'defensive'],
  measureCorrectness: true,
  measureEfficiency: true,
  extractTemplateOnSuccess: true,
})

// Define test cases
const testCases = [
  {
    variables: { filename: 'test.txt', content: 'Hello' },
    expectedOutput: { file_exists: true, content_matches: true }
  },
  {
    variables: { filename: 'output.json', content: '{"key": "value"}' },
    expectedOutput: { file_exists: true, json_valid: true }
  },
]

// Run speculative tests
const results = await tester.testSpeculatively(myTemplate, testCases)

console.log(`Best strategy: ${results.analysis.bestStrategy}`)
console.log(`Avg success rate: ${(results.analysis.avgSuccessRate * 100).toFixed(1)}%`)
console.log(`Total cost: $${results.analysis.totalCost.toFixed(4)}`)

if (results.extractedTemplate) {
  console.log('Extracted template from best variant:')
  console.log(JSON.stringify(results.extractedTemplate, null, 2))

  // Submit to registry
  await submitTemplate(results.extractedTemplate)
}
```

---

## 7. Optimizing for Correctness and Efficiency

### Correctness Metrics

**Shape-based validation:**
```typescript
{
  correctness: {
    // All required output shapes validated
    shapesValidated: ['source_code', 'test_suite'],
    shapesValid: true,

    // External validation passed
    externalValidation: {
      tests_pass: true,
      builds: true,
      lint_passes: true
    },

    // Expected behavior achieved
    behavioralCorrectness: {
      functionWorks: true,
      edgeCasesHandled: true,
      errorHandling: true
    }
  }
}
```

**Measurement:**
1. **Deterministic validation** - All validators pass
2. **Expected output shapes** - Correct shapes produced
3. **Behavioral checks** - External validation confirms
4. **Regression prevention** - No new failures introduced

### Efficiency Metrics

**Cost and performance:**
```typescript
{
  efficiency: {
    duration_ms: 1234,
    cost_usd: 0.0123,
    tokens_used: {
      input: 5000,
      output: 2000,
      cache_hit: 3000
    },

    // Efficiency score
    score: success_rate / (normalized_duration * normalized_cost),

    // Resource usage
    resources: {
      llm_calls: 3,
      tool_calls: 12,
      file_operations: 8
    }
  }
}
```

**Measurement:**
1. **Execution time** - How long did it take?
2. **Token usage** - How many LLM tokens?
3. **Cost** - How much did it cost?
4. **Resource efficiency** - Tool calls, file ops
5. **Success rate** - How often does it work?

### Optimization Strategies

#### 1. **Caching**
```typescript
// Cache validation results
const validationCache = new Map<string, ValidationResult>()

// Cache LLM responses
const llmCache = new Map<string, string>()

// Cache file reads
const fileCache = new Map<string, string>()
```

#### 2. **Early Exit**
```typescript
// Exit as soon as all output shapes validate
if (allShapesValid) {
  return { success: true, earlyExit: true }
}
```

#### 3. **Parallelization**
```typescript
// Run independent validations in parallel
const [tsResult, testResult, lintResult] = await Promise.all([
  validateTypeScript(),
  runTests(),
  checkLint(),
])
```

#### 4. **Incremental Validation**
```typescript
// Validate after each task, not at the end
for (const task of tasks) {
  await executeTask(task)

  // Check if we're done
  const valid = await validateOutputShapes()
  if (valid) break  // Early exit
}
```

#### 5. **Selective LLM Usage**
```typescript
// Only use LLM when deterministic methods fail
if (canBeDeterministic(task)) {
  return executeDeterministically(task)
} else {
  return executewithLLM(task)
}
```

### Thompson Sampling Integration

**Feed metrics back:**
```typescript
// After each execution
await recordExecution({
  template_id: 'my-template',
  success: correctnessMetrics.allValid,
  duration_ms: efficiencyMetrics.duration_ms,
  cost_usd: efficiencyMetrics.cost_usd,

  // Quality signals
  correctness_score: calculateCorrectnessScore(correctnessMetrics),
  efficiency_score: efficiencyMetrics.score,

  // For Thompson Sampling
  outcome: success ? 'success' : 'failure',
  retriable: errorClassification.retriable,
  failure_category: errorClassification.category,
})
```

**Thompson Sampling learns:**
- High correctness + high efficiency → α increases significantly
- High correctness + low efficiency → α increases, note for optimization
- Low correctness → β increases, create variant
- Environment errors → Don't penalize template

---

## 8. Complete Workflow

### Improvise → Reflect → Learn → Optimize

```bash
# 1. Create sandbox image
cd repos/minibob/sandbox
docker build -t minibob-sandbox:latest .

# 2. Run speculative tests
bun run sandbox-test.ts --template my-template --iterations 5

# 3. Review results
# - Correctness: 95% (19/20 test cases passed)
# - Efficiency: 0.85 (normalized score)
# - Best strategy: "optimized"
# - Avg cost: $0.0089

# 4. Extract successful template
# Template extracted: activity:my-template:optimized

# 5. Submit to registry
minibob doctor tutor extracted-template.json

# 6. Verify in production
minibob --single "test the new template"

# 7. Monitor Thompson Sampling
minibob doctor health --deep --verbose
# ✓ Template: activity:my-template:optimized
#   α=15, β=1 (94% confidence)
```

---

## 9. Next Steps

1. **Build sandbox image**
   ```bash
   cd repos/minibob/sandbox
   docker build -t minibob-sandbox:latest .
   ```

2. **Create test suite**
   ```bash
   mkdir -p repos/minibob/test/sandbox
   # Add test cases for your activities
   ```

3. **Run speculative tests**
   ```bash
   bun run test-sandbox.ts
   ```

4. **Extract and submit templates**
   ```bash
   minibob doctor tutor --from-execution <exec-id>
   ```

5. **Monitor and iterate**
   ```bash
   minibob doctor health --deep --verbose
   ```

---

## Resources

- **Resolvers README**: `repos/minibob/src/resolvers/README.md`
- **Validators Index**: `repos/minibob/src/validators/index.ts`
- **Shape Resolver**: `repos/minibob/src/shape-resolver.ts`
- **External Validation**: `repos/minibob/src/resolvers/external-validation-resolver.ts`
- **Foundation Doc**: `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
