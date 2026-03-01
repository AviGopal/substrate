# Multi-Instance Work Distribution System Design

**Date**: 2026-02-28  
**Goal**: Organize activity execution across independent instances with impulse-based data federation  
**Principle**: Instances work independently on isolated resources, coordinated via work queue and impulses

---

## Core Philosophy: Instance Independence

**Key Insight**: Prevent interference by isolating resources, not by coordinating access to shared resources.

```
ANTI-PATTERN (Shared Resources):
Instance A ──┐
             ├──> Shared Codebase ──> Git Conflicts, File Locks, Race Conditions
Instance B ──┘

PATTERN (Isolated Resources):
Instance A ──> Codebase A ──> Independent Work
Instance B ──> Codebase B ──> Independent Work
Instance C ──> Codebase C ──> Independent Work
             ↑
        Work Queue (Redis)
   "Who can work on what?"
```

**Result**: No conflicts because each instance has exclusive access to its resources.

---

## System Architecture

### Layer 1: Instance Registry (Resource Tracking)

Each instance registers its **capabilities** and **data availability**:

```typescript
interface InstanceProfile {
  instanceId: string              // "devbob-0", "devbob-backend-1", "local-primary"
  
  // Resource access
  codebases: CodebaseAccess[]     // Which repos/paths this instance can access
  
  // Data availability
  dataLocality: DataLocality      // What data this instance has locally
  
  // Capabilities
  capabilities: Capability[]      // What this instance can do
  
  // Load tracking
  currentLoad: {
    activeActivities: number
    memoryUsage: number
    cpuUsage: number
  }
  
  // Coordination
  status: "available" | "busy" | "draining" | "offline"
  lastHeartbeat: number
}

interface CodebaseAccess {
  repoPath: string                // "/workspace/repos/metabob-opencode"
  branch: string                  // "main", "feature-xyz"
  accessType: "read-write" | "read-only"
  gitRemote: string              // For identifying same repo across instances
}

interface DataLocality {
  databases: DatabaseAccess[]     // SurrealDB, Redis connections
  filesets: FilesetAccess[]       // Local file caches
  impulses: ImpulseCache          // Locally cached impulses
}

interface Capability {
  type: "language" | "tool" | "service"
  name: string                    // "typescript", "python", "docker", "k8s"
  version?: string
}
```

**Storage**: Redis hash + SurrealDB for persistence

```redis
# Redis (fast lookups)
HSET instance:devbob-0 profile '{"instanceId": "devbob-0", ...}'
ZADD instances:by_load devbob-0 2  # Sorted set for load balancing

# SurrealDB (persistent registry)
CREATE instance:devbob-0 CONTENT {
  instanceId: "devbob-0",
  codebases: [...],
  dataLocality: {...},
  capabilities: [...],
  registeredAt: time::now()
}
```

### Layer 2: Work Queue (Activity Distribution)

Work items contain **requirements** that get matched against instance profiles:

```typescript
interface WorkItem {
  workId: string                  // "work_abc123"
  activityTemplateId: string      // "add-rest-endpoint"
  variables: Record<string, any>  // Template variables
  
  // Requirements (used for matching)
  requirements: WorkRequirements
  
  // Metadata
  priority: number                // Higher = more urgent
  createdAt: number
  claimedBy?: string             // Instance that claimed this work
  claimedAt?: number
  leaseExpiration?: number       // Auto-reclaim if expired
  
  // Data sharing
  sharedImpulses: ImpulseReference[]  // Data needed for this work
}

interface WorkRequirements {
  // Codebase requirements
  codebase: {
    repoPath?: string             // Must have access to this repo
    branch?: string               // Must be on this branch
    accessType: "read-write" | "read-only"
  }
  
  // Data requirements
  data: {
    databases?: string[]          // Must have access to these DBs
    impulses?: string[]           // Must be able to resolve these impulses
  }
  
  // Capability requirements
  capabilities: {
    languages?: string[]          // Must support these languages
    tools?: string[]              // Must have these tools
    services?: string[]           // Must have access to these services
  }
  
  // Resource requirements
  resources: {
    minMemory?: number            // Minimum available memory (MB)
    estimatedDuration?: number    // Estimated time (seconds)
  }
}

interface ImpulseReference {
  impulseId: string
  type: string                    // Impulse type
  pointer: any                    // Impulse pointer (for resolution)
  required: boolean               // Is this impulse required or optional?
  availableOn?: string[]          // Instances that have this data locally
}
```

**Storage**: Redis sorted set (priority queue)

```redis
# Priority queue (score = priority + timestamp factor)
ZADD work:pending <priority-score> '{"workId": "work_123", ...}'

# Claimed work tracking
HSET work:claimed work_123 '{"claimedBy": "devbob-0", "leaseExpiration": 1234567890}'

# Work status index
HSET work:status work_123 "claimed"
```

### Layer 3: Instance Matcher (Smart Work Assignment)

The matcher finds the **best instance** for each work item:

```typescript
class InstanceMatcher {
  /**
   * Find best instance for work item based on:
   * 1. Can it access required codebase?
   * 2. Does it have required data locally? (data locality)
   * 3. Does it have required capabilities?
   * 4. What's its current load?
   * 5. Affinity: is it already working on related activities?
   */
  async findBestInstance(work: WorkItem): Promise<InstanceProfile | null> {
    // Step 1: Filter by hard requirements
    let candidates = await this.getAvailableInstances()
    
    candidates = candidates.filter(instance => 
      this.matchesCodebaseRequirement(instance, work.requirements.codebase) &&
      this.matchesDataRequirements(instance, work.requirements.data) &&
      this.matchesCapabilityRequirements(instance, work.requirements.capabilities) &&
      this.hasEnoughResources(instance, work.requirements.resources)
    )
    
    if (candidates.length === 0) {
      return null // No instance can handle this work
    }
    
    // Step 2: Score by soft preferences
    const scored = candidates.map(instance => ({
      instance,
      score: this.calculateScore(instance, work)
    }))
    
    // Step 3: Return best match
    scored.sort((a, b) => b.score - a.score)
    return scored[0].instance
  }
  
  private calculateScore(instance: InstanceProfile, work: WorkItem): number {
    let score = 0
    
    // Data locality bonus (huge win - avoids network transfer)
    const localImpulses = work.sharedImpulses.filter(imp =>
      instance.dataLocality.impulses.has(imp.impulseId)
    ).length
    score += localImpulses * 100
    
    // Load balancing (prefer less loaded instances)
    const loadPenalty = instance.currentLoad.activeActivities * 10
    score -= loadPenalty
    
    // Affinity bonus (already working on this codebase)
    const affinityBonus = this.hasCodebaseAffinity(instance, work.requirements.codebase) ? 50 : 0
    score += affinityBonus
    
    // Resource availability bonus
    const resourceBonus = (instance.currentLoad.memoryUsage < 70) ? 20 : 0
    score += resourceBonus
    
    return score
  }
}
```

### Layer 4: Impulse Federation (Data Access Across Instances)

Instances share data via **impulse references** with three resolution strategies:

```typescript
namespace ImpulseFederation {
  /**
   * Strategy 1: Local Resolution (fastest, no network)
   * Instance has the data locally
   */
  async function resolveLocal(impulse: ImpulseReference): Promise<string> {
    // Use existing ImpulseResolver
    return await ImpulseResolver.resolve(impulse.pointer)
  }
  
  /**
   * Strategy 2: Remote Resolution via ACP (medium speed)
   * Request data from instance that has it locally
   */
  async function resolveRemote(
    impulse: ImpulseReference,
    fromInstance: string
  ): Promise<string> {
    // Call acp_request_impulse_content on instance that has data
    const result = await fetch(`http://${fromInstance}:3000/acp/impulse`, {
      method: "POST",
      body: JSON.stringify({
        impulseId: impulse.impulseId,
        pointer: impulse.pointer
      })
    })
    
    return await result.text()
  }
  
  /**
   * Strategy 3: Shared Storage Resolution (slowest, most reliable)
   * Retrieve from shared storage (SurrealDB, S3)
   */
  async function resolveShared(impulse: ImpulseReference): Promise<string> {
    // Query SurrealDB for impulse content
    const result = await db.query(
      "SELECT content FROM impulse WHERE id = $id",
      { id: impulse.impulseId }
    )
    
    if (result.length > 0) {
      return result[0].content
    }
    
    // Fall back to re-resolution if possible
    throw new Error(`Impulse ${impulse.impulseId} not found in shared storage`)
  }
  
  /**
   * Smart resolution with fallback chain
   */
  async function resolve(
    impulse: ImpulseReference,
    currentInstance: string,
    instanceRegistry: InstanceRegistry
  ): Promise<string> {
    try {
      // Try local first (0ms latency)
      return await resolveLocal(impulse)
    } catch (localError) {
      try {
        // Try remote instance with data (5-50ms latency)
        const instancesWithData = impulse.availableOn || []
        if (instancesWithData.length > 0) {
          const nearestInstance = await instanceRegistry.findNearestInstance(
            currentInstance,
            instancesWithData
          )
          return await resolveRemote(impulse, nearestInstance)
        }
      } catch (remoteError) {
        // Fall back to shared storage (50-200ms latency)
        return await resolveShared(impulse)
      }
    }
  }
}
```

---

## Activity Execution Flow

### Step 1: Activity Submission

User/agent creates activity request:

```typescript
// Via activity tool
const result = await activity({
  templateId: "add-rest-endpoint",
  variables: {
    method: "POST",
    path: "/api/users",
    codebase: "/workspace/repos/metabob-opencode"
  },
  reason: "Add user creation endpoint"
})

// Behind the scenes: Create work item
const workItem: WorkItem = {
  workId: generateId(),
  activityTemplateId: "add-rest-endpoint",
  variables: {...},
  requirements: {
    codebase: {
      repoPath: "/workspace/repos/metabob-opencode",
      branch: "main",
      accessType: "read-write"
    },
    capabilities: {
      languages: ["typescript"],
      tools: ["git", "npm"]
    }
  },
  sharedImpulses: [],  // Will be populated from template context
  priority: 100,
  createdAt: Date.now()
}

// Add to work queue
await WorkQueue.push(workItem)
```

### Step 2: Instance Claims Work

Each instance runs **claim loop** independently:

```typescript
class WorkClaimer {
  async claimLoop(instanceId: string) {
    while (true) {
      try {
        // Get instance profile
        const profile = await InstanceRegistry.get(instanceId)
        
        // Check if we can take more work
        if (profile.currentLoad.activeActivities >= MAX_CONCURRENT_ACTIVITIES) {
          await sleep(5000)
          continue
        }
        
        // Find work we can handle
        const work = await this.findClaimableWork(profile)
        
        if (!work) {
          await sleep(2000)  // No work available
          continue
        }
        
        // Claim work (atomic operation via Redis)
        const claimed = await WorkQueue.claim(work.workId, instanceId, LEASE_DURATION)
        
        if (claimed) {
          log.info("claimed work", { workId: work.workId, instanceId })
          
          // Execute activity in background
          this.executeWorkAsync(work, profile)
        }
        
      } catch (error) {
        log.error("claim loop error", { error, instanceId })
        await sleep(5000)
      }
    }
  }
  
  private async findClaimableWork(profile: InstanceProfile): Promise<WorkItem | null> {
    // Get pending work items (sorted by priority)
    const pendingWork = await WorkQueue.getPending(limit: 20)
    
    // Find first item we can handle
    for (const work of pendingWork) {
      const matcher = new InstanceMatcher()
      const canHandle = await matcher.matchesRequirements(profile, work.requirements)
      
      if (canHandle) {
        return work
      }
    }
    
    return null
  }
  
  private async executeWorkAsync(work: WorkItem, profile: InstanceProfile) {
    try {
      // Extend lease periodically (heartbeat)
      const heartbeatInterval = setInterval(() => {
        WorkQueue.extendLease(work.workId, LEASE_DURATION)
      }, LEASE_DURATION / 2)
      
      // Load template
      const template = await ActivityTemplate.load(work.activityTemplateId)
      
      // Prepare impulses (federation)
      const impulses = await this.prepareImpulses(work.sharedImpulses, profile)
      
      // Execute activity
      const result = await executeActivityInline({
        template,
        variables: work.variables,
        impulses,
        instanceId: profile.instanceId
      })
      
      // Mark complete
      await WorkQueue.complete(work.workId, result)
      
      clearInterval(heartbeatInterval)
      
      log.info("work completed", { workId: work.workId, duration: result.duration })
      
    } catch (error) {
      log.error("work execution failed", { workId: work.workId, error })
      
      // Release work back to queue (will be retried)
      await WorkQueue.release(work.workId, error.message)
    }
  }
  
  private async prepareImpulses(
    impulseRefs: ImpulseReference[],
    profile: InstanceProfile
  ): Promise<ActivityTemplate.Impulse.Schema[]> {
    return await Promise.all(
      impulseRefs.map(async ref => {
        // Resolve impulse content using federation
        const content = await ImpulseFederation.resolve(
          ref,
          profile.instanceId,
          InstanceRegistry
        )
        
        return {
          id: ref.impulseId,
          type: ref.type,
          pointer: ref.pointer,
          budget: 2000,  // Default budget
          loaded: true,
          content,
          tokenCount: content.length / 4  // Rough estimate
        }
      })
    )
  }
}
```

### Step 3: Work Completion & Result Publishing

When work completes, results are published for other instances:

```typescript
class WorkQueue {
  async complete(workId: string, result: ActivityResult) {
    // Store result in shared storage
    await db.create(`work_result:${workId}`, {
      workId,
      completedBy: result.instanceId,
      completedAt: Date.now(),
      status: "success",
      duration: result.duration,
      
      // Activity outputs (may be used by other activities)
      outputs: result.outputs,
      
      // Impulses created during execution
      impulsesCreated: result.impulsesCreated,
      
      // Files modified (for git coordination if needed)
      filesModified: result.filesModified,
    })
    
    // Update work status
    await redis.hset("work:status", workId, "completed")
    await redis.del(`work:claimed:${workId}`)
    
    // Publish completion event (for dependent work)
    await redis.publish("work:completed", JSON.stringify({
      workId,
      activityTemplateId: result.activityTemplateId,
      outputs: result.outputs,
      impulsesCreated: result.impulsesCreated
    }))
    
    log.info("work completed and published", { workId })
  }
}
```

---

## Use Cases

### Use Case 1: Parallel Independent Activities

**Scenario**: Analyze 5 different codebases in parallel

```typescript
// Submit 5 work items
const workItems = [
  {
    templateId: "analyze-codebase-quality",
    variables: { codebasePath: "/workspace/repos/metabob-opencode" },
    requirements: {
      codebase: { repoPath: "/workspace/repos/metabob-opencode", accessType: "read-only" }
    }
  },
  {
    templateId: "analyze-codebase-quality",
    variables: { codebasePath: "/workspace/repos/platform" },
    requirements: {
      codebase: { repoPath: "/workspace/repos/platform", accessType: "read-only" }
    }
  },
  // ... 3 more
]

// Push all to queue
for (const item of workItems) {
  await WorkQueue.push(item)
}

// Instances claim work based on codebase access
// Instance A: Handles metabob-opencode (has it locally)
// Instance B: Handles platform (has it locally)
// Instance C: Handles repo3
// etc.

// No conflicts - each instance works on different codebase
```

### Use Case 2: Pipeline with Data Passing

**Scenario**: Design → Implement → Test pipeline

```typescript
// Step 1: Submit design work
const designWork = await WorkQueue.push({
  templateId: "design-api-structure",
  variables: { feature: "user-authentication" },
  requirements: {
    capabilities: { languages: ["typescript"] }
  }
})

// Wait for design completion
const designResult = await WorkQueue.waitForCompletion(designWork.workId)

// Step 2: Submit implementation work with design impulse
const implWork = await WorkQueue.push({
  templateId: "implement-api",
  variables: { feature: "user-authentication" },
  requirements: {
    codebase: { repoPath: "/workspace/repos/backend", accessType: "read-write" },
    capabilities: { languages: ["typescript"], tools: ["npm"] }
  },
  sharedImpulses: [
    {
      impulseId: designResult.impulsesCreated[0],  // Design document
      type: "activityOutput",
      pointer: {
        type: "activityOutput",
        activityId: designResult.activityId,
        key: "design"
      },
      required: true,
      availableOn: [designResult.completedBy]  // Instance that has it
    }
  ]
})

// Instance claims impl work
// - Checks if it has design impulse locally (probably not)
// - Fetches from designResult.completedBy instance via ACP
// - Executes implementation with design context
```

### Use Case 3: Multi-Codebase Feature

**Scenario**: Add feature that spans backend + frontend + docs

```typescript
// Create shared context impulse
const specImpulseId = await impulse_create({
  id: "feature-spec-auth",
  type: "memo",
  pointer: {
    type: "memo",
    content: "Feature spec: JWT authentication with refresh tokens..."
  },
  budget: 2000
})

// Submit 3 parallel work items with shared spec
const works = await Promise.all([
  WorkQueue.push({
    templateId: "implement-backend-feature",
    variables: { feature: "authentication" },
    requirements: {
      codebase: { repoPath: "/workspace/repos/backend", accessType: "read-write" }
    },
    sharedImpulses: [
      {
        impulseId: specImpulseId,
        type: "memo",
        pointer: { type: "memo", content: "..." },
        required: true
      }
    ]
  }),
  
  WorkQueue.push({
    templateId: "implement-frontend-feature",
    variables: { feature: "authentication" },
    requirements: {
      codebase: { repoPath: "/workspace/repos/frontend", accessType: "read-write" }
    },
    sharedImpulses: [{ impulseId: specImpulseId, ... }]
  }),
  
  WorkQueue.push({
    templateId: "write-feature-docs",
    variables: { feature: "authentication" },
    requirements: {
      codebase: { repoPath: "/workspace/repos/docs", accessType: "read-write" }
    },
    sharedImpulses: [{ impulseId: specImpulseId, ... }]
  })
])

// Different instances claim each work item
// - Backend instance: Works on backend repo
// - Frontend instance: Works on frontend repo
// - Docs instance: Works on docs repo
// All share the same spec via impulse federation
// No conflicts - completely isolated codebases
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Goal**: Basic work queue and instance registry

**Tasks**:
1. Implement InstanceRegistry (Redis + SurrealDB)
2. Create InstanceProfile registration on bootstrap
3. Build WorkQueue with push/claim/complete operations
4. Add basic InstanceMatcher (codebase matching only)

**Deliverable**: Can submit work and instances can claim it based on codebase access

**Effort**: 8-12 hours

### Phase 2: Impulse Federation (Week 2)

**Goal**: Enable data sharing via impulses

**Tasks**:
1. Extend ImpulseReference schema
2. Implement ImpulseFederation.resolveLocal
3. Add acp_request_impulse_content endpoint for remote resolution
4. Create impulse cache tracking in InstanceProfile

**Deliverable**: Instances can share impulses across network

**Effort**: 6-8 hours

### Phase 3: Smart Matching (Week 3)

**Goal**: Intelligent work assignment based on data locality and load

**Tasks**:
1. Implement calculateScore in InstanceMatcher
2. Add data locality tracking
3. Add capability matching
4. Add load balancing metrics

**Deliverable**: Work assigned to best-fit instance automatically

**Effort**: 4-6 hours

### Phase 4: Monitoring & Debugging (Week 4)

**Goal**: Observability into work distribution

**Tasks**:
1. Create work queue monitoring dashboard
2. Add instance load metrics
3. Implement work distribution fairness metrics
4. Add alerting for stuck work

**Deliverable**: Can see what's happening in the distributed system

**Effort**: 6-8 hours

---

## Key Design Decisions

### Decision 1: Isolated Resources > Coordinated Access

**Why**: Preventing conflicts is better than resolving them

**Trade-off**: Requires resource allocation planning (which instance gets which codebase)

**Benefit**: Zero git conflicts, zero file locks, simpler reasoning

### Decision 2: Impulse-Based Data Federation

**Why**: Leverage existing impulse system for data sharing

**Trade-off**: Not suitable for real-time high-frequency data (uses pointer resolution)

**Benefit**: Consistent with existing architecture, efficient serialization

### Decision 3: Pull Model (Instances Claim Work)

**Why**: Instances know their own capacity and state better than orchestrator

**Trade-off**: Slightly more complex than push model

**Benefit**: Self-regulating, no orchestrator bottleneck, automatic load balancing

### Decision 4: Capability-Based Matching

**Why**: Ensures work only goes to instances that can handle it

**Trade-off**: Requires accurate capability declarations

**Benefit**: No failed work due to missing dependencies

---

## Success Metrics

### Performance Metrics

- **Work Distribution Latency**: <5 seconds from submit to claim
- **Impulse Federation Latency**: 
  - Local: <10ms
  - Remote (ACP): <100ms
  - Shared (DB): <500ms
- **Load Balancing Fairness**: Coefficient of variation <0.2

### Reliability Metrics

- **Work Completion Rate**: >95%
- **Lease Expiration Rate**: <5% (instances not crashing)
- **Impulse Resolution Success Rate**: >99%

### Efficiency Metrics

- **Data Locality Hit Rate**: >70% (work assigned to instances with data)
- **Instance Utilization**: 60-80% (not idle, not overloaded)
- **Parallel Speedup**: 1.8x with 2 instances, 2.5x with 3 instances

---

## Migration Path

### Current State: Manual Delegation

```typescript
// Today: Manual acp_delegate
await acp_delegate({
  target: "docker://devbob-backend",
  taskDescription: "Implement API",
  prompt: "...",
  shareImpulses: ["design-doc"]
})
```

### Near Future: Work Queue

```typescript
// Soon: Submit to work queue
await WorkQueue.push({
  templateId: "implement-api",
  variables: { feature: "auth" },
  requirements: { codebase: { repoPath: "/workspace/repos/backend" } },
  sharedImpulses: [{ impulseId: "design-doc", ... }]
})

// Instance claims and executes automatically
```

### Far Future: Orchestration Activities

```typescript
// Future: Orchestration templates
await activity({
  templateId: "multi-instance-feature-implementation",
  variables: {
    feature: "authentication",
    codebases: ["backend", "frontend", "docs"],
    spec: "..."
  }
})

// Template internally:
// 1. Creates shared spec impulse
// 2. Submits 3 work items (backend, frontend, docs)
// 3. Waits for all completions
// 4. Aggregates results
// 5. Returns combined outcome
```

---

## Conclusion

This design achieves your goal of **splitting work across independent instances** by:

1. **Preventing interference** - Isolated resources (no shared codebases)
2. **Organizing execution** - Work queue with smart matching
3. **Handling data differences** - Impulse federation with three-tier resolution
4. **Leveraging existing systems** - Built on impulse architecture

**Key Innovation**: Using impulses not just for prompt context, but as the **data federation layer** for distributed execution.

**Next Step**: Implement Phase 1 (foundation) to get basic work distribution working.

---

**Status**: Design Complete, Ready for Implementation  
**Estimated Total Effort**: 4-6 weeks for full system  
**Estimated Phase 1 Effort**: 8-12 hours for MVP
