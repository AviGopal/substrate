# Vessel Development Architecture - Technical Design

## Module Structure

```
repos/minibob/src/
├── vessel/                      # NEW: Vessel development module
│   ├── index.ts                 # Module exports
│   ├── definition.ts            # Vessel definition loader
│   ├── template-cache.ts        # Local template caching
│   ├── template-validator.ts    # Pre-registration validation
│   └── promotion-hooks.ts       # Success-driven promotion
├── lifecycle-hooks.ts           # MODIFY: Add promotion hook types
├── vessel-registry.ts           # MODIFY: Add execution tracking
└── activity.ts                  # MODIFY: Cache-first loading
```

## Type Definitions

### Vessel Definition

```typescript
// vessel/definition.ts

export interface VesselDefinition {
  id: string
  name: string
  version: string

  // Development mode configuration
  development?: {
    enabled: boolean
    cacheStrategy: 'local-first' | 'backend-first' | 'hybrid'
    promotion: {
      minExecutions: number      // Default: 3
      minSuccessRate: number     // Default: 0.8
      autoPromote: boolean       // Default: true
    }
  }

  // Template sources (in priority order)
  templates: {
    local?: string[]             // Relative paths: ./templates/*.json
    cached?: boolean             // Use .minibob/vessels/<id>/templates/
    remote?: boolean             // Fetch from backend
  }

  // Lifecycle hooks (activity IDs to run)
  hooks?: {
    onTemplateSuccess?: string[]
    onTemplateFailure?: string[]
    onVesselBootstrap?: string[]
  }
}

export function loadVesselDefinition(vesselPath: string): VesselDefinition | null {
  const defPath = path.join(vesselPath, '.minibob', 'vessel.json')
  if (!existsSync(defPath)) return null
  return JSON.parse(readFileSync(defPath, 'utf-8'))
}

export function isDevelopmentVessel(vesselPath: string): boolean {
  const def = loadVesselDefinition(vesselPath)
  return def?.development?.enabled ?? false
}

export function getVesselId(vesselPath: string): string {
  const def = loadVesselDefinition(vesselPath)
  return def?.id ?? path.basename(vesselPath)
}
```

### Template Cache

```typescript
// vessel/template-cache.ts

export interface CachedTemplate {
  template: ActivityTemplate
  metadata: {
    cachedAt: number
    registeredAt?: number
    registered: boolean
    sourceExecutionId?: string
    localExecutions: number
    localSuccesses: number
    localFailures: number
  }
}

export interface TemplateCache {
  load(vesselId: string, templateId: string): Promise<CachedTemplate | null>
  save(vesselId: string, template: ActivityTemplate, meta?: Partial<CachedTemplate['metadata']>): Promise<void>
  markRegistered(vesselId: string, templateId: string): Promise<void>
  invalidate(vesselId: string, templateId: string): Promise<void>
  list(vesselId: string): Promise<string[]>
  getPromotionCandidates(vesselId: string, threshold: PromotionThreshold): Promise<CachedTemplate[]>
}

export interface PromotionThreshold {
  minExecutions: number
  minSuccessRate: number
}

// Implementation
export class FileSystemTemplateCache implements TemplateCache {
  private basePath = os.homedir() + '/.minibob/vessels'

  private getCachePath(vesselId: string, templateId: string): string {
    return path.join(this.basePath, vesselId, 'templates', `${templateId}.json`)
  }

  async load(vesselId: string, templateId: string): Promise<CachedTemplate | null> {
    const cachePath = this.getCachePath(vesselId, templateId)
    if (!existsSync(cachePath)) return null

    const data = JSON.parse(await Bun.file(cachePath).text())
    return data as CachedTemplate
  }

  async save(vesselId: string, template: ActivityTemplate, meta?: Partial<CachedTemplate['metadata']>): Promise<void> {
    const cachePath = this.getCachePath(vesselId, template.id)
    await mkdir(path.dirname(cachePath), { recursive: true })

    const existing = await this.load(vesselId, template.id)
    const cached: CachedTemplate = {
      template,
      metadata: {
        cachedAt: Date.now(),
        registered: false,
        localExecutions: 0,
        localSuccesses: 0,
        localFailures: 0,
        ...existing?.metadata,
        ...meta
      }
    }

    await Bun.write(cachePath, JSON.stringify(cached, null, 2))
  }

  async markRegistered(vesselId: string, templateId: string): Promise<void> {
    const cached = await this.load(vesselId, templateId)
    if (!cached) return

    cached.metadata.registered = true
    cached.metadata.registeredAt = Date.now()
    await this.save(vesselId, cached.template, cached.metadata)
  }

  async recordExecution(vesselId: string, templateId: string, success: boolean): Promise<void> {
    const cached = await this.load(vesselId, templateId)
    if (!cached) return

    cached.metadata.localExecutions++
    if (success) {
      cached.metadata.localSuccesses++
    } else {
      cached.metadata.localFailures++
    }
    await this.save(vesselId, cached.template, cached.metadata)
  }

  async getPromotionCandidates(vesselId: string, threshold: PromotionThreshold): Promise<CachedTemplate[]> {
    const templates = await this.list(vesselId)
    const candidates: CachedTemplate[] = []

    for (const templateId of templates) {
      const cached = await this.load(vesselId, templateId)
      if (!cached || cached.metadata.registered) continue

      const { localExecutions, localSuccesses } = cached.metadata
      if (localExecutions < threshold.minExecutions) continue

      const successRate = localSuccesses / localExecutions
      if (successRate >= threshold.minSuccessRate) {
        candidates.push(cached)
      }
    }

    return candidates
  }

  async list(vesselId: string): Promise<string[]> {
    const dir = path.join(this.basePath, vesselId, 'templates')
    if (!existsSync(dir)) return []

    const files = await readdir(dir)
    return files
      .filter(f => f.endsWith('.json') && !f.startsWith('_'))
      .map(f => f.replace('.json', ''))
  }

  async invalidate(vesselId: string, templateId: string): Promise<void> {
    const cachePath = this.getCachePath(vesselId, templateId)
    if (existsSync(cachePath)) {
      await unlink(cachePath)
    }
  }
}
```

### Template Validator

```typescript
// vessel/template-validator.ts

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateTemplate(template: ActivityTemplate): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Required fields
  if (!template.id) errors.push('Missing template id')
  if (!template.name) errors.push('Missing template name')
  if (!template.tasks?.length) errors.push('Template must have at least one task')

  // 2. Category validation
  const validCategories = ['feature', 'bugfix', 'refactor', 'tool', 'infrastructure']
  if (!validCategories.includes(template.category)) {
    errors.push(`Invalid category: ${template.category}`)
  }

  // 3. Variable reference validation
  const definedVars = new Set(template.variables?.map(v => v.name) ?? [])
  for (const task of template.tasks ?? []) {
    const matches = task.prompt?.template?.match(/\{\{(\w+)\}\}/g) ?? []
    for (const match of matches) {
      const varName = match.slice(2, -2)
      if (!definedVars.has(varName)) {
        errors.push(`Task ${task.id} uses undefined variable: {{${varName}}}`)
      }
    }
  }

  // 4. Task ID uniqueness
  const taskIds = new Set<string>()
  for (const task of template.tasks ?? []) {
    if (taskIds.has(task.id)) {
      errors.push(`Duplicate task id: ${task.id}`)
    }
    taskIds.add(task.id)
  }

  // 5. Dependency validation
  for (const task of template.tasks ?? []) {
    for (const dep of task.dependencies ?? []) {
      if (!taskIds.has(dep)) {
        errors.push(`Task ${task.id} depends on undefined task: ${dep}`)
      }
    }
  }

  // 6. Circular dependency check
  if (hasCyclicDependencies(template.tasks ?? [])) {
    errors.push('Task dependencies contain cycles')
  }

  // 7. Warnings (non-blocking)
  if (!template.description) {
    warnings.push('Template has no description')
  }
  if (!template.inputSchema?.required?.length) {
    warnings.push('Template has no inputSchema - may not match goals well')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

function hasCyclicDependencies(tasks: ActivityTask[]): boolean {
  const graph = new Map<string, string[]>()
  for (const task of tasks) {
    graph.set(task.id, task.dependencies ?? [])
  }

  const visited = new Set<string>()
  const stack = new Set<string>()

  function dfs(node: string): boolean {
    if (stack.has(node)) return true  // Cycle found
    if (visited.has(node)) return false

    visited.add(node)
    stack.add(node)

    for (const dep of graph.get(node) ?? []) {
      if (dfs(dep)) return true
    }

    stack.delete(node)
    return false
  }

  for (const task of tasks) {
    if (dfs(task.id)) return true
  }
  return false
}
```

### Promotion Hooks

```typescript
// vessel/promotion-hooks.ts

export interface PromotionContext {
  templateId: string
  vesselId: string
  executionId: string
  success: boolean
  localStats: {
    executions: number
    successes: number
    failures: number
    successRate: number
  }
}

export interface PromotionDecision {
  shouldPromote: boolean
  reason: string
}

export type PromotionHook = (context: PromotionContext) => Promise<PromotionDecision>

const defaultPromotionHook: PromotionHook = async (context) => {
  const { localStats } = context
  const threshold = getPromotionThreshold(context.vesselId)

  if (localStats.executions < threshold.minExecutions) {
    return {
      shouldPromote: false,
      reason: `Not enough executions: ${localStats.executions}/${threshold.minExecutions}`
    }
  }

  if (localStats.successRate < threshold.minSuccessRate) {
    return {
      shouldPromote: false,
      reason: `Success rate too low: ${(localStats.successRate * 100).toFixed(1)}%/${threshold.minSuccessRate * 100}%`
    }
  }

  return {
    shouldPromote: true,
    reason: `Threshold met: ${localStats.executions} executions, ${(localStats.successRate * 100).toFixed(1)}% success rate`
  }
}

export async function checkPromotion(context: PromotionContext): Promise<PromotionDecision> {
  return defaultPromotionHook(context)
}

export async function executePromotion(
  templateId: string,
  vesselId: string,
  cache: TemplateCache,
  mcp: MCPClient
): Promise<{ success: boolean; error?: string }> {
  const cached = await cache.load(vesselId, templateId)
  if (!cached) {
    return { success: false, error: 'Template not found in cache' }
  }

  if (cached.metadata.registered) {
    return { success: true }  // Already registered, idempotent
  }

  // Validate before registration
  const validation = validateTemplate(cached.template)
  if (!validation.valid) {
    return { success: false, error: `Validation failed: ${validation.errors.join(', ')}` }
  }

  // Register with backend
  try {
    await mcp.registerTemplate(cached.template)
    await cache.markRegistered(vesselId, templateId)
    console.log(`[Promotion] Template ${templateId} registered to backend`)
    return { success: true }
  } catch (error) {
    if (error.status === 409) {
      // Already exists - mark as registered locally
      await cache.markRegistered(vesselId, templateId)
      return { success: true }
    }
    return { success: false, error: String(error) }
  }
}
```

## Integration Points

### Modified: activity.ts

```typescript
// In loadTemplateFromMCPOrLocal

async function loadTemplateFromMCPOrLocal(
  templateIdOrPath: string,
  options?: {
    vesselId?: string
    strategy?: 'local-first' | 'backend-first' | 'hybrid'
  }
): Promise<ActivityTemplate> {
  // If path, load directly
  if (templateIdOrPath.includes('/') || templateIdOrPath.endsWith('.json')) {
    return loadTemplate(templateIdOrPath)
  }

  const { vesselId, strategy = 'hybrid' } = options ?? {}

  // LOCAL-FIRST: Check cache before backend
  if (vesselId && (strategy === 'local-first' || strategy === 'hybrid')) {
    const cache = new FileSystemTemplateCache()
    const cached = await cache.load(vesselId, templateIdOrPath)
    if (cached) {
      console.log(`[Activity] Loaded from cache: ${templateIdOrPath}`)
      return cached.template
    }
  }

  // BACKEND: Fetch via MCP
  if (isMCPEnabled()) {
    const mcp = getMCPClient()
    if (mcp) {
      const template = await mcp.getActivityTemplate(templateIdOrPath)
      if (template) {
        // Cache for future use
        if (vesselId) {
          const cache = new FileSystemTemplateCache()
          await cache.save(vesselId, template)
        }
        return template
      }
    }
  }

  // FALLBACK: Local templates directory
  const localPath = `templates/${templateIdOrPath}.json`
  return loadTemplate(localPath)
}
```

### Modified: lifecycle-hooks.ts

```typescript
// Add new hook type

export interface Hooks {
  // Existing
  onBeforePrompt?: (context: TaskContext) => Promise<void>
  onAfterPrompt?: (context: TaskContext, result: TaskResult) => Promise<void>
  onActivityComplete?: (execution: ActivityExecution) => Promise<void>
  onActivityFailed?: (execution: ActivityExecution, error: Error) => Promise<void>

  // NEW: Promotion hooks
  onPromotionCheck?: (context: PromotionContext) => Promise<PromotionDecision>
  onTemplateRegistered?: (templateId: string, vesselId: string) => Promise<void>
}

// In executeActivityCompleteHooks
export async function executeActivityCompleteHooks(
  execution: ActivityExecution,
  vesselId?: string
): Promise<void> {
  // Existing hooks
  await registeredHooks.onActivityComplete?.(execution)

  // NEW: Promotion flow (if in development vessel)
  if (vesselId && isDevelopmentVessel(process.cwd())) {
    const cache = new FileSystemTemplateCache()

    // Record execution
    await cache.recordExecution(vesselId, execution.templateId, execution.status === 'completed')

    // Check promotion
    const cached = await cache.load(vesselId, execution.templateId)
    if (cached && !cached.metadata.registered) {
      const { localExecutions, localSuccesses } = cached.metadata
      const context: PromotionContext = {
        templateId: execution.templateId,
        vesselId,
        executionId: execution.id,
        success: execution.status === 'completed',
        localStats: {
          executions: localExecutions,
          successes: localSuccesses,
          failures: localExecutions - localSuccesses,
          successRate: localExecutions > 0 ? localSuccesses / localExecutions : 0
        }
      }

      const decision = await checkPromotion(context)
      if (decision.shouldPromote) {
        const mcp = getMCPClient()
        if (mcp) {
          const result = await executePromotion(execution.templateId, vesselId, cache, mcp)
          if (result.success) {
            await registeredHooks.onTemplateRegistered?.(execution.templateId, vesselId)
          }
        }
      }
    }
  }
}
```

## MiniBob Self-Development Integration

To use MiniBob to implement this feature:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob

# 1. Create the vessel directory structure
bun run index.ts goal "Create .minibob/vessels directory structure with vessel.json schema"

# 2. Implement template cache
bun run index.ts goal "Implement FileSystemTemplateCache class in src/vessel/template-cache.ts"

# 3. Implement validator
bun run index.ts goal "Implement template validator with dependency cycle detection"

# 4. Integrate with activity executor
bun run index.ts goal "Modify loadTemplateFromMCPOrLocal to support cache-first strategy"

# 5. Add promotion hooks
bun run index.ts goal "Add promotion hooks to lifecycle-hooks.ts for auto-registration"
```

Each goal will:
1. Search for existing templates
2. Execute matching template OR improvise
3. Capture execution trace
4. If successful in development mode → cache template
5. If threshold met → register to backend

This creates a self-improving loop where MiniBob develops its own vessel development capabilities.
