# Multi-Instance Work Distribution: Summary

**Date**: 2026-02-28  
**Status**: ✅ **DESIGN COMPLETE, READY FOR IMPLEMENTATION**

---

## What We've Created

### 1. Comprehensive Design Document
**File**: `MULTI_INSTANCE_WORK_DISTRIBUTION_DESIGN.md` (17KB)

**Key Concepts**:
- **Instance Independence**: No shared resources = no conflicts
- **Work Queue**: Redis-backed priority queue for activity distribution
- **Instance Registry**: Tracks capabilities, data locality, and load
- **Instance Matcher**: Smart work assignment based on requirements
- **Impulse Federation**: Three-tier data resolution (local → remote → shared)

### 2. Implementation Activity Template
**File**: `templates/setup-work-distribution-system.json` (17KB)

**6 Tasks**:
1. Create instance registry (instance profiles, capabilities tracking)
2. Create work queue (push/claim/complete with lease expiration)
3. Implement work claimer (claim loop, execution, heartbeat)
4. Integrate with vessel bootstrap and activity tool
5. Add comprehensive tests (unit, integration, e2e)
6. Create documentation and examples

**Estimated Effort**: 24-32 hours (can be done in parallel across instances!)

---

## Core Architecture

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        Work Queue (Redis)                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │ Work Item  │  │ Work Item  │  │ Work Item  │  │ Work Item  ││
│  │ Priority:  │  │ Priority:  │  │ Priority:  │  │ Priority:  ││
│  │ 100        │  │ 90         │  │ 80         │  │ 70         ││
│  │            │  │            │  │            │  │            ││
│  │ Requires:  │  │ Requires:  │  │ Requires:  │  │ Requires:  ││
│  │ Backend    │  │ Frontend   │  │ Docs       │  │ Platform   ││
│  │ Codebase   │  │ Codebase   │  │ Codebase   │  │ Codebase   ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
└─────────────────────────────────────────────────────────────────┘
         ↓                  ↓                  ↓                ↓
    ┌─────────┐        ┌─────────┐       ┌─────────┐    ┌─────────┐
    │Instance │        │Instance │       │Instance │    │Instance │
    │    A    │        │    B    │       │    C    │    │    D    │
    │         │        │         │       │         │    │         │
    │Backend  │        │Frontend │       │  Docs   │    │Platform │
    │Codebase │        │Codebase │       │Codebase │    │Codebase │
    └─────────┘        └─────────┘       └─────────┘    └─────────┘
         ↓                  ↓                  ↓                ↓
    [Executes]         [Executes]        [Executes]      [Executes]
    [Work 1]           [Work 2]          [Work 3]        [Work 4]
    
    NO CONFLICTS - Each instance works on independent resources!
```

### Instance Profile Example

```typescript
{
  instanceId: "devbob-backend-1",
  codebases: [
    {
      repoPath: "/workspace/repos/backend",
      branch: "main",
      accessType: "read-write",
      gitRemote: "git@github.com:company/backend.git"
    }
  ],
  dataLocality: {
    databases: ["surrealdb:localhost:8000", "redis:localhost:6379"],
    impulses: ["design-doc-123", "api-spec-456"]
  },
  capabilities: [
    { type: "language", name: "typescript" },
    { type: "language", name: "python" },
    { type: "tool", name: "docker" }
  ],
  currentLoad: {
    activeActivities: 2,
    memoryUsage: 45,
    cpuUsage: 30
  },
  status: "available"
}
```

### Work Item Example

```typescript
{
  workId: "work_abc123",
  activityTemplateId: "implement-api-endpoint",
  variables: {
    method: "POST",
    path: "/api/users"
  },
  requirements: {
    codebase: {
      repoPath: "/workspace/repos/backend",
      accessType: "read-write"
    },
    capabilities: {
      languages: ["typescript"],
      tools: ["npm", "git"]
    }
  },
  sharedImpulses: [
    {
      impulseId: "api-design-789",
      type: "memo",
      pointer: { type: "memo", content: "..." },
      required: true,
      availableOn: ["devbob-architect-1"]
    }
  ],
  priority: 100
}
```

---

## Key Innovations

### 1. Instance Independence > Coordination

**Traditional Approach** (what we're NOT doing):
```
Multiple instances → Shared codebase → Need locks, conflict resolution, complex coordination
```

**Our Approach**:
```
Multiple instances → Isolated codebases → No conflicts, simple work distribution
```

### 2. Impulse-Based Data Federation

**Problem**: Instances don't have the same data

**Solution**: Three-tier resolution
1. **Local**: Instance has data locally (0ms latency) ✅
2. **Remote**: Fetch from instance that has it (5-50ms latency)
3. **Shared**: Retrieve from SurrealDB (50-200ms latency)

**Example**:
```typescript
// Instance A creates design document
await impulse_create({
  id: "api-design",
  type: "memo",
  pointer: { type: "memo", content: "Design: ..." }
})

// Instance B receives work with impulse reference
const work = {
  sharedImpulses: [
    { 
      impulseId: "api-design",
      availableOn: ["instance-a"]  // Hint for federation
    }
  ]
}

// Instance B resolves impulse:
// 1. Try local (not found)
// 2. Fetch from instance-a via ACP ✅
// 3. Cache locally for future use
```

### 3. Pull Model (Instances Claim Work)

**Why Pull > Push**:
- Instances know their own capacity
- Self-regulating load balancing
- No orchestrator bottleneck
- Automatic failover (lease expiration)

**How It Works**:
```typescript
// Each instance runs claim loop
while (true) {
  // 1. Check capacity
  if (currentLoad >= MAX_CONCURRENT) {
    sleep(5s)
    continue
  }
  
  // 2. Find work we can handle
  const work = await findClaimableWork(myProfile)
  
  // 3. Claim atomically (Redis SET NX)
  if (await workQueue.claim(work.id, myId, 300)) {
    // 4. Execute in background
    executeWorkAsync(work)
  }
}
```

### 4. Smart Matching with Data Locality

**Scoring Algorithm**:
```typescript
score = 0

// Huge win - avoid network transfer
if (instance.hasImpulseLocally(work.impulses)) {
  score += 100
}

// Load balancing
score -= instance.currentLoad * 10

// Affinity (already working on this codebase)
if (instance.isWorkingOn(work.codebase)) {
  score += 50
}

// Resource availability
if (instance.memoryUsage < 70) {
  score += 20
}

// Assign to highest scoring instance
```

---

## What This Enables

### Use Case 1: Parallel Independent Work

```typescript
// Submit 5 analyses
for (const repo of ["backend", "frontend", "docs", "platform", "mobile"]) {
  await WorkQueue.push({
    templateId: "analyze-code-quality",
    variables: { repo },
    requirements: { codebase: { repoPath: `/workspace/repos/${repo}` } }
  })
}

// 5 instances claim work (each gets their own repo)
// Result: 5x speedup, zero conflicts
```

### Use Case 2: Multi-Stage Pipeline

```typescript
// Stage 1: Design
const designWork = await WorkQueue.push({
  templateId: "design-api"
})

// Wait for completion
const designResult = await WorkQueue.waitFor(designWork.id)

// Stage 2: Implementation (with design impulse)
await WorkQueue.push({
  templateId: "implement-api",
  sharedImpulses: [
    {
      impulseId: designResult.impulsesCreated[0],
      availableOn: [designResult.completedBy]
    }
  ]
})

// Instance claims impl work, fetches design via impulse federation
```

### Use Case 3: Multi-Codebase Feature

```typescript
// Create shared spec
const specId = await impulse_create({
  id: "feature-spec",
  type: "memo",
  pointer: { type: "memo", content: "Feature: Authentication..." }
})

// Submit parallel work
await Promise.all([
  WorkQueue.push({
    templateId: "implement-backend",
    requirements: { codebase: { repoPath: "/workspace/repos/backend" } },
    sharedImpulses: [{ impulseId: specId }]
  }),
  WorkQueue.push({
    templateId: "implement-frontend",
    requirements: { codebase: { repoPath: "/workspace/repos/frontend" } },
    sharedImpulses: [{ impulseId: specId }]
  }),
  WorkQueue.push({
    templateId: "write-docs",
    requirements: { codebase: { repoPath: "/workspace/repos/docs" } },
    sharedImpulses: [{ impulseId: specId }]
  })
])

// 3 instances work in parallel, all share same spec via impulses
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1) - 8-12 hours
- [ ] Instance registry (Redis + SurrealDB)
- [ ] Work queue (push/claim/complete)
- [ ] Instance matcher (basic codebase matching)
- **Deliverable**: Can submit work and instances can claim it

### Phase 2: Impulse Federation (Week 2) - 6-8 hours
- [ ] Impulse references in work items
- [ ] Local resolution (existing ImpulseResolver)
- [ ] Remote resolution (via ACP)
- [ ] Shared resolution (SurrealDB)
- **Deliverable**: Instances can share data across network

### Phase 3: Smart Matching (Week 3) - 4-6 hours
- [ ] Data locality scoring
- [ ] Capability matching
- [ ] Load balancing
- [ ] Affinity tracking
- **Deliverable**: Work assigned to best-fit instance

### Phase 4: Production Ready (Week 4) - 6-8 hours
- [ ] Comprehensive tests
- [ ] Monitoring dashboard
- [ ] Documentation
- [ ] Examples
- **Deliverable**: Ready for production use

---

## Success Metrics

### Performance
- ✅ Work distribution latency: <5 seconds (submit → claimed)
- ✅ Impulse resolution: Local <10ms, Remote <100ms, Shared <500ms
- ✅ Parallel speedup: 1.8x with 2 instances, 2.5x with 3 instances

### Reliability
- ✅ Work completion rate: >95%
- ✅ Impulse resolution success: >99%
- ✅ Lease expiration rate: <5%

### Efficiency
- ✅ Data locality hit rate: >70% (work goes to instances with data)
- ✅ Load distribution fairness: CV <0.2
- ✅ Instance utilization: 60-80%

---

## Next Steps

### Option 1: Register and Execute Template (Automated)

```bash
# Register template
cd /home/avi/documents/work/exp-repo/metabob-devbob
register_activity_template({
  file_path: "templates/setup-work-distribution-system.json"
})

# Execute activity
activity({
  templateId: "setup-work-distribution-system",
  variables: {},
  reason: "Implement multi-instance work distribution to enable parallel activity execution across independent OpenCode instances with impulse-based data federation"
})
```

**Time**: 24-32 hours (activity execution)  
**Result**: Complete work distribution system

### Option 2: Implement Manually (Phased)

Start with Phase 1 only:
1. Create instance-registry.ts
2. Create work-queue.ts
3. Test basic claim/execute flow
4. Add more features incrementally

**Time**: 8-12 hours for Phase 1  
**Result**: MVP work distribution

### Option 3: Test Current Capabilities First

Before building new infrastructure, validate what exists:
1. Test acp_delegate with impulse sharing
2. Verify impulse resolution works
3. Test parallel delegation manually
4. Measure performance and identify gaps

**Time**: 1-2 hours  
**Result**: Understand what works today before building new system

---

## Recommendation

**I recommend Option 3 → Option 2 → Option 1**:

1. **Test current capabilities** (1-2 hours)
   - Validate acp_delegate + impulse sharing works
   - Identify what's missing
   - Measure baseline performance

2. **Implement Phase 1 manually** (8-12 hours)
   - Build MVP work distribution
   - Learn what works in practice
   - Adjust design based on reality

3. **Complete full system via activity** (optional)
   - Once Phase 1 validated, run full activity
   - Or continue manual implementation if preferred

**Why this order?**
- Test before building (avoid over-engineering)
- Learn incrementally (fail fast on bad assumptions)
- Validate demand (do we actually need all this?)

---

## Key Takeaways

1. **Your goal is achievable** - Split work across instances by isolating resources
2. **Design is solid** - Instance independence + impulse federation is the right approach
3. **Implementation is clear** - 6-task activity template ready to execute
4. **Impulse system is key** - Leverage existing architecture for data federation
5. **Start simple** - Test what exists before building new infrastructure

**Bottom line**: You have a complete design and implementation plan for organizing activity execution across multiple independent instances with impulse-based data sharing. The system prevents interference through resource isolation rather than coordination complexity.

---

**Status**: READY FOR IMPLEMENTATION  
**Effort**: 24-32 hours full system, 8-12 hours MVP  
**Documents Created**: 3 (Design, Template, Summary)  
**Lines of Code to Write**: ~2000-3000 (estimated)
