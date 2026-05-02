# VesselProvider Interface Specification

## Overview

The VesselProvider interface defines the contract that all vessels must implement to participate in the microplastic composition. This enables multiple vessels to share an impulse state space while maintaining clear boundaries.

## Core Interface

```typescript
/**
 * VesselProvider - The contract for composable vessels
 *
 * A vessel is a bundle of capabilities that can:
 * - Resolve certain impulse pointer types
 * - Provide activity templates
 * - Participate in the execution lifecycle
 */
interface VesselProvider {
  // =========================================================================
  // IDENTITY
  // =========================================================================

  /** Unique identifier for this vessel instance */
  readonly id: string

  /** Human-readable name */
  readonly name: string

  /** Semantic version */
  readonly version: string

  /** One-line description */
  readonly description: string

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  /**
   * Initialize the vessel with shared context
   * Called once when microplastic starts
   *
   * @param context - Shared context including impulse store and config
   * @throws VesselInitError if initialization fails (non-recoverable)
   */
  initialize(context: VesselContext): Promise<void>

  /**
   * Gracefully shutdown the vessel
   * Called when microplastic exits
   * Should cleanup resources, flush buffers, close connections
   */
  shutdown(): Promise<void>

  /**
   * Health check - is the vessel operational?
   * Called periodically and on-demand
   */
  healthCheck(): Promise<VesselHealth>

  // =========================================================================
  // CAPABILITIES
  // =========================================================================

  /**
   * Declare what this vessel can do
   * Used for discovery and routing
   */
  getCapabilities(): VesselCapability[]

  /**
   * Check if this vessel can resolve a specific pointer type
   * Used for resolver routing
   *
   * @param pointer - The impulse pointer to check
   * @returns true if this vessel can resolve this pointer type
   */
  canResolve(pointer: ImpulsePointer): boolean

  /**
   * Resolve an impulse - load content from pointer
   * Only called if canResolve returned true
   *
   * @param impulse - The impulse to resolve
   * @returns Resolved content (string or structured with metadata)
   * @throws ResolverError if resolution fails
   */
  resolve(impulse: Impulse): Promise<ResolverResult>

  // =========================================================================
  // ACTIVITIES
  // =========================================================================

  /**
   * Get activity templates provided by this vessel
   * Templates are merged into the global registry
   */
  getActivityTemplates(): ActivityTemplate[]

  /**
   * Get bootstrap templates that cannot be overridden
   * These are registered before user templates
   */
  getBootstrapTemplates?(): ActivityTemplate[]
}
```

## Supporting Types

```typescript
/**
 * Context provided to vessels on initialization
 */
interface VesselContext {
  /** Shared impulse store - all vessels read/write here */
  impulseStore: ImpulseStore

  /** Configuration for this vessel */
  config: VesselConfig

  /** Reference to other vessels (for rare direct communication) */
  vessels: Map<string, VesselProvider>

  /** Event emitter for lifecycle events */
  events: VesselEventEmitter

  /** Logger scoped to this vessel */
  logger: VesselLogger
}

/**
 * Vessel configuration
 */
interface VesselConfig {
  /** Whether development mode is enabled */
  developmentMode: boolean

  /** Working directory for file operations */
  workingDirectory: string

  /** Environment variables available to the vessel */
  environment: Record<string, string>

  /** Vessel-specific configuration */
  options: Record<string, unknown>
}

/**
 * Vessel health status
 */
interface VesselHealth {
  /** Overall status */
  status: 'healthy' | 'degraded' | 'unhealthy'

  /** Individual check results */
  checks: VesselHealthCheck[]

  /** When the check was performed */
  timestamp: number
}

interface VesselHealthCheck {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message?: string
  duration?: number
}

/**
 * Vessel capability declaration
 */
interface VesselCapability {
  /** Capability identifier */
  id: string

  /** Human-readable name */
  name: string

  /** Description of what this capability provides */
  description: string

  /** Category for grouping */
  category: 'resolver' | 'activity' | 'tool' | 'ui' | 'integration'

  /** Pointer types this capability can resolve (if resolver) */
  resolves?: string[]

  /** Tools this capability provides (if tool) */
  tools?: string[]
}
```

## Lifecycle Events

Vessels can subscribe to lifecycle events via the context:

```typescript
interface VesselEventEmitter {
  /** Activity execution started */
  on(event: 'activity:start', handler: (execution: ActivityExecution) => void): void

  /** Activity execution completed */
  on(event: 'activity:complete', handler: (execution: ActivityExecution) => void): void

  /** Activity execution failed */
  on(event: 'activity:fail', handler: (execution: ActivityExecution, error: Error) => void): void

  /** Impulse created */
  on(event: 'impulse:create', handler: (impulse: Impulse) => void): void

  /** Impulse resolved */
  on(event: 'impulse:resolve', handler: (impulse: Impulse, result: ResolverResult) => void): void

  /** Goal submitted */
  on(event: 'goal:submit', handler: (goal: string, context: GoalContext) => void): void

  /** Goal completed */
  on(event: 'goal:complete', handler: (goal: string, success: boolean) => void): void
}
```

## Implementation Requirements

### Minimum Implementation

A valid VesselProvider must:

1. Return stable `id`, `name`, `version` values
2. Implement `initialize` (can be no-op)
3. Implement `shutdown` (can be no-op)
4. Implement `healthCheck` returning at least status
5. Implement `getCapabilities` returning at least empty array
6. Implement `canResolve` (can always return false)
7. Implement `resolve` (can throw if canResolve always false)
8. Implement `getActivityTemplates` returning at least empty array

### Error Handling

```typescript
/**
 * Base error for vessel operations
 */
class VesselError extends Error {
  constructor(
    message: string,
    public readonly vesselId: string,
    public readonly code: string,
    public readonly recoverable: boolean = true
  ) {
    super(`[${vesselId}] ${message}`)
    this.name = 'VesselError'
  }
}

/**
 * Initialization failed
 */
class VesselInitError extends VesselError {
  constructor(vesselId: string, message: string) {
    super(message, vesselId, 'INIT_FAILED', false)
  }
}

/**
 * Resolution failed
 */
class ResolverError extends VesselError {
  constructor(
    vesselId: string,
    pointerType: string,
    message: string,
    recoverable = true
  ) {
    super(`Failed to resolve ${pointerType}: ${message}`, vesselId, 'RESOLVE_FAILED', recoverable)
  }
}
```

## Example Implementations

### MiniBob Vessel

```typescript
class MiniBobVessel implements VesselProvider {
  readonly id = '@metabob/minibob'
  readonly name = 'MiniBob Execution Engine'
  readonly version = '0.1.0'
  readonly description = 'Activity execution, impulse management, ribosome'

  private core: MiniBobCore
  private context: VesselContext

  async initialize(context: VesselContext): Promise<void> {
    this.context = context
    this.core = new MiniBobCore({
      workingDirectory: context.config.workingDirectory,
      impulseStore: context.impulseStore,
      // ... other config
    })
  }

  async shutdown(): Promise<void> {
    await this.core.shutdown()
  }

  async healthCheck(): Promise<VesselHealth> {
    return {
      status: 'healthy',
      checks: [
        { name: 'core', status: 'pass' },
        { name: 'llm', status: this.core.hasLLM() ? 'pass' : 'warn' }
      ],
      timestamp: Date.now()
    }
  }

  getCapabilities(): VesselCapability[] {
    return [
      {
        id: 'file-resolver',
        name: 'File Resolver',
        category: 'resolver',
        description: 'Resolves file impulses from filesystem',
        resolves: ['file', 'memo']
      },
      {
        id: 'activity-execution',
        name: 'Activity Execution',
        category: 'activity',
        description: 'Executes activity templates with LLM'
      },
      {
        id: 'ribosome',
        name: 'Ribosome',
        category: 'activity',
        description: 'Extracts activity templates from successful traces'
      }
    ]
  }

  canResolve(pointer: ImpulsePointer): boolean {
    return pointer.type === 'file' || pointer.type === 'memo'
  }

  async resolve(impulse: Impulse): Promise<ResolverResult> {
    if (impulse.pointer.type === 'file') {
      return this.resolveFile(impulse.pointer as FilePointer)
    }
    if (impulse.pointer.type === 'memo') {
      return this.resolveMemo(impulse.pointer as MemoPointer)
    }
    throw new ResolverError(this.id, impulse.pointer.type, 'Unknown pointer type')
  }

  getActivityTemplates(): ActivityTemplate[] {
    return this.core.getTemplates()
  }

  getBootstrapTemplates(): ActivityTemplate[] {
    return [
      // Level 0: Primordial (immutable)
      createActivityTemplateTemplate,
      executeGoalTemplate,
      validateTemplateTemplate
    ]
  }
}
```

### TUI Vessel

```typescript
class TUIVessel implements VesselProvider {
  readonly id = '@metabob/tui'
  readonly name = 'Narrative TUI'
  readonly version = '0.1.0'
  readonly description = 'Terminal UI that presents work as narrative'

  private renderer: NarrativeRenderer
  private context: VesselContext

  async initialize(context: VesselContext): Promise<void> {
    this.context = context
    this.renderer = new NarrativeRenderer()

    // Subscribe to events to update narrative
    context.events.on('activity:start', (exec) => {
      this.updateNarrative({ type: 'activity-start', execution: exec })
    })
    context.events.on('goal:complete', (goal, success) => {
      this.updateNarrative({ type: 'goal-complete', goal, success })
    })
  }

  canResolve(pointer: ImpulsePointer): boolean {
    return pointer.type === 'ui_component' || pointer.type === 'narrative'
  }

  async resolve(impulse: Impulse): Promise<ResolverResult> {
    // TUI resolution is a side-effect (rendering) + return confirmation
    if (impulse.pointer.type === 'narrative') {
      this.renderer.render(impulse.pointer as NarrativePointer)
      return { content: 'rendered', metadata: { rendered: true } }
    }
    // ... handle ui_component
  }

  getCapabilities(): VesselCapability[] {
    return [{
      id: 'narrative-ui',
      name: 'Narrative UI',
      category: 'ui',
      description: 'Renders execution state as readable narrative',
      resolves: ['ui_component', 'narrative']
    }]
  }

  getActivityTemplates(): ActivityTemplate[] {
    return [
      // TUI choreography templates
      updateNarrativeTemplate,
      requestClarificationTemplate
    ]
  }
}
```

## Registration Order

When microplastic starts, vessels are registered in order:

1. **MiniBob** - Core execution, file resolution
2. **MCP** - Analysis, CPG, embeddings
3. **TUI** - Narrative rendering

Bootstrap templates are loaded before any execution.

## Resolver Precedence

When multiple vessels can resolve a pointer type:

1. First registered wins (for same pointer type)
2. More specific pointer types take precedence over wildcards
3. Vessels can decline resolution by returning `canResolve: false`

## Testing Requirements

Each VesselProvider implementation must pass:

1. **Lifecycle test**: Initialize -> healthCheck -> shutdown works
2. **Resolution test**: canResolve accurate, resolve returns valid content
3. **Template test**: getActivityTemplates returns valid templates
4. **Error test**: Errors are properly typed and include vesselId
