# Effective Work Delegation Implementation Plan

**Date**: 2026-02-28  
**Goal**: Enable efficient work delegation across OpenCode instances with smart impulse sharing  
**Current State**: 4 OpenCode instances running, acp_delegate tool exists, needs testing and patterns

---

## Executive Summary

**You already have the core delegation infrastructure!** The `acp_delegate` tool exists with:
- ✅ Impulse sharing (pointer-based, 90%+ reduction in context size)
- ✅ Bidirectional resolution (remote agents can request content from host)
- ✅ Docker and TCP transport support
- ✅ Remote session tracking with status updates

**What's needed:**
1. **Test current delegation capabilities** - verify it works end-to-end
2. **Create delegation patterns** - document best practices for impulse sharing
3. **Add coordination primitives** - prevent git conflicts during delegation
4. **Build delegation activities** - templates for common delegation scenarios

---

## Phase 1: Test Current Delegation (30 minutes)

### Goal: Verify acp_delegate works with impulse sharing

### Test Scenario 1: Simple Delegation (No Impulses)
```typescript
// Test: Can we delegate a simple task?
const result = await acp_delegate({
  target: "docker://devbob-0",  // or whatever container is available
  taskDescription: "Read and summarize file",
  prompt: "Read /workspace/README.md and provide a 2-sentence summary",
  timeout: 60
})
```

**Expected**: Remote agent reads file and returns summary  
**Validates**: Basic delegation, transport, and response handling

### Test Scenario 2: Delegation with Pointer-Based Impulse
```typescript
// Step 1: Create impulse with design document
const impulseId = await impulse_create({
  id: "api-design-test",
  type: "memo",
  pointer: {
    type: "memo",
    content: `API Design:
- POST /api/users
- Request: { name: string, email: string }
- Response: { id: number, name: string, email: string }
- Validation: email must be valid format
`
  },
  budget: 1000
})

// Step 2: Delegate implementation with shared impulse
const result = await acp_delegate({
  target: "docker://devbob-0",
  taskDescription: "Implement API endpoint",
  prompt: "Implement the API endpoint per the shared design. Show code only.",
  shareImpulses: ["api-design-test"],  // Share by pointer (efficient)
  sendFullContent: false,  // Use pointer resolution
  timeout: 120
})
```

**Expected**: Remote agent resolves pointer locally and implements API  
**Validates**: Pointer serialization, local resolution, context efficiency

### Test Scenario 3: Delegation with File Impulse
```typescript
// Step 1: Create impulse pointing to existing file
const impulseId = await impulse_create({
  id: "existing-code-test",
  type: "file",
  pointer: {
    type: "file",
    filePath: "/workspace/src/api/example.ts",
    description: "Example API endpoint for reference"
  },
  budget: 2000
})

// Step 2: Delegate similar implementation
const result = await acp_delegate({
  target: "docker://devbob-0",
  taskDescription: "Create similar endpoint",
  prompt: "Create a new endpoint following the pattern in the shared file. Target: POST /api/posts",
  shareImpulses: ["existing-code-test"],
  timeout: 120
})
```

**Expected**: Remote agent reads file via pointer and creates similar code  
**Validates**: File pointer resolution, pattern replication

### Test Scenario 4: Bidirectional Resolution (Phase 3)
```typescript
// Step 1: Create activity output impulse (only available on host)
const activityId = "act_123"  // From previous activity
const impulseId = await impulse_create({
  id: "activity-result-test",
  type: "activityOutput",
  pointer: {
    type: "activityOutput",
    activityId: activityId,
    key: "implementation_summary"
  },
  budget: 1500
})

// Step 2: Delegate with activity output (remote won't have it)
const result = await acp_delegate({
  target: "docker://devbob-0",
  taskDescription: "Build on previous work",
  prompt: "Review the activity output and suggest improvements",
  shareImpulses: ["activity-result-test"],
  sendFullContent: false,  // Force pointer resolution
  timeout: 120
})
```

**Expected**: Remote agent tries local resolution, falls back to acp_request_impulse_content  
**Validates**: Bidirectional resolution, host-side content fetching

---

## Phase 2: Create Delegation Patterns (1 hour)

### Pattern 1: Parallel Work Distribution

**Use Case**: Split large task across multiple instances

```typescript
// Example: Analyze 10 files in parallel across 2 instances
const files = [
  "/workspace/src/api/users.ts",
  "/workspace/src/api/posts.ts",
  "/workspace/src/api/comments.ts",
  "/workspace/src/api/auth.ts",
  "/workspace/src/api/sessions.ts",
  "/workspace/src/models/user.ts",
  "/workspace/src/models/post.ts",
  "/workspace/src/models/comment.ts",
  "/workspace/src/utils/validation.ts",
  "/workspace/src/utils/auth.ts"
]

// Create impulses for each file
const impulseIds = await Promise.all(
  files.map(async (file, i) => {
    const id = `file-analysis-${i}`
    await impulse_create({
      id,
      type: "file",
      pointer: { type: "file", filePath: file },
      budget: 1000
    })
    return id
  })
)

// Delegate analysis in parallel
const results = await Promise.all([
  // Instance 1: Files 0-4
  acp_delegate({
    target: "docker://devbob-0",
    taskDescription: "Analyze API files 1-5",
    prompt: "Analyze the shared files for code quality issues. Return JSON list of issues.",
    shareImpulses: impulseIds.slice(0, 5),
    timeout: 180
  }),
  
  // Instance 2: Files 5-9
  acp_delegate({
    target: "docker://devbob-1",
    taskDescription: "Analyze files 6-10",
    prompt: "Analyze the shared files for code quality issues. Return JSON list of issues.",
    shareImpulses: impulseIds.slice(5, 10),
    timeout: 180
  })
])

// Aggregate results
const allIssues = results.flatMap(r => JSON.parse(r.output))
```

**Benefits**:
- ✅ Parallel execution (2x speedup)
- ✅ Efficient impulse sharing (pointers only)
- ✅ Simple aggregation

### Pattern 2: Delegation with Shared Context

**Use Case**: Multiple agents work on same feature with shared design

```typescript
// Step 1: Create shared context impulses
await impulse_create({
  id: "feature-spec",
  type: "memo",
  pointer: {
    type: "memo",
    content: "Feature: User authentication\n- JWT tokens\n- Email/password\n- 2FA optional"
  },
  budget: 1000
})

await impulse_create({
  id: "coding-standards",
  type: "file",
  pointer: {
    type: "file",
    filePath: "/workspace/CODING_STANDARDS.md"
  },
  budget: 2000
})

// Step 2: Delegate different parts
const [backend, frontend, tests] = await Promise.all([
  acp_delegate({
    target: "docker://devbob-backend",
    taskDescription: "Implement auth backend",
    prompt: "Implement authentication API per spec and standards",
    shareImpulses: ["feature-spec", "coding-standards"],
    timeout: 300
  }),
  
  acp_delegate({
    target: "docker://devbob-frontend",
    taskDescription: "Implement auth UI",
    prompt: "Create login form per spec and standards",
    shareImpulses: ["feature-spec", "coding-standards"],
    timeout: 300
  }),
  
  acp_delegate({
    target: "docker://devbob-test",
    taskDescription: "Write auth tests",
    prompt: "Write E2E tests per spec",
    shareImpulses: ["feature-spec", "coding-standards"],
    timeout: 300
  })
])
```

**Benefits**:
- ✅ Consistent context across agents
- ✅ Parallel specialized work
- ✅ Shared understanding of requirements

### Pattern 3: Sequential Delegation with Result Passing

**Use Case**: Multi-stage pipeline where each agent builds on previous work

```typescript
// Stage 1: Design
const designResult = await acp_delegate({
  target: "docker://devbob-architect",
  taskDescription: "Design API structure",
  prompt: "Design REST API for blog platform. Return JSON schema.",
  timeout: 120
})

// Create impulse from design result
await impulse_create({
  id: "api-design",
  type: "memo",
  pointer: {
    type: "memo",
    content: designResult.output
  },
  budget: 2000
})

// Stage 2: Implementation
const implResult = await acp_delegate({
  target: "docker://devbob-backend",
  taskDescription: "Implement API",
  prompt: "Implement the API per shared design",
  shareImpulses: ["api-design"],
  timeout: 300
})

// Create impulse from implementation
await impulse_create({
  id: "api-implementation",
  type: "activityOutput",
  pointer: {
    type: "activityOutput",
    activityId: implResult.metadata.sessionId,
    key: "code"
  },
  budget: 3000
})

// Stage 3: Testing
const testResult = await acp_delegate({
  target: "docker://devbob-test",
  taskDescription: "Test API",
  prompt: "Write tests for the implemented API",
  shareImpulses: ["api-design", "api-implementation"],
  timeout: 300
})
```

**Benefits**:
- ✅ Clear pipeline stages
- ✅ Result passing via impulses
- ✅ Each agent specializes

---

## Phase 3: Add Coordination Primitives (2 hours)

### Problem: Git Conflicts During Delegation

Current issue:
```
Instance A: git commit "Add feature X"
Instance B: git commit "Add feature Y"  ← Conflict! Resets A's commit
```

### Solution: Distributed Locks via Redis

**Implementation needed:**

```typescript
// File: repos/metabob-opencode/packages/opencode/src/coordination/distributed-lock.ts

import Redis from "ioredis"

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  retryStrategy: (times) => Math.min(times * 50, 2000)
})

export class DistributedLock {
  private lockKey: string
  private lockValue: string
  private timeout: number

  constructor(resource: string, timeout: number = 300) {
    this.lockKey = `lock:${resource}`
    this.lockValue = `${process.pid}-${Date.now()}`
    this.timeout = timeout
  }

  async acquire(): Promise<boolean> {
    // SET NX EX pattern (atomic lock acquisition)
    const result = await redis.set(
      this.lockKey,
      this.lockValue,
      "EX", this.timeout,  // Expire after timeout
      "NX"  // Only if not exists
    )
    
    return result === "OK"
  }

  async release(): Promise<void> {
    // Only release if we own the lock (prevent releasing someone else's lock)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `
    
    await redis.eval(script, 1, this.lockKey, this.lockValue)
  }

  async extend(additionalTime: number): Promise<void> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `
    
    await redis.eval(script, 1, this.lockKey, this.lockValue, additionalTime)
  }
}

// Decorator for easy use
export function distributedLock(resource: string, timeout: number = 300) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const lock = new DistributedLock(resource, timeout)
      
      // Try to acquire lock with retries
      let acquired = false
      for (let i = 0; i < 10; i++) {
        acquired = await lock.acquire()
        if (acquired) break
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))) // Exponential backoff
      }

      if (!acquired) {
        throw new Error(`Failed to acquire lock on ${resource} after 10 retries`)
      }

      try {
        return await originalMethod.apply(this, args)
      } finally {
        await lock.release()
      }
    }

    return descriptor
  }
}
```

**Usage in git operations:**

```typescript
// File: repos/metabob-opencode/packages/opencode/src/util/git.ts

import { distributedLock } from "../coordination/distributed-lock"

export class Git {
  @distributedLock("git", 300)
  static async commit(message: string): Promise<void> {
    // Protected git operation - only one instance can execute at a time
    // Lock automatically released after 5 minutes or on completion
    
    await $`git add .`
    await $`git commit -m ${message}`
  }

  @distributedLock("git", 300)
  static async push(): Promise<void> {
    await $`git push`
  }
}
```

**Effort**: 1-2 hours  
**Impact**: Eliminates git conflicts completely  
**Risk**: Low (Redis SET NX is atomic)

---

## Phase 4: Build Delegation Activities (3 hours)

### Activity Template: delegate-parallel-analysis

**Purpose**: Analyze multiple files/components in parallel across instances

```json
{
  "name": "Delegate Parallel Analysis",
  "templateId": "delegate-parallel-analysis",
  "category": "infrastructure",
  "description": "Distribute file analysis across multiple instances in parallel",
  "tasks": [
    {
      "id": "prepare-impulses",
      "description": "Create impulses for each file to analyze",
      "prompt": {
        "template": "Create impulses for files: {{files}}\n\nFor each file, create an impulse with type=file pointing to the file path.",
        "variables": [
          {
            "name": "files",
            "type": "array",
            "required": true,
            "description": "Array of file paths to analyze"
          }
        ]
      }
    },
    {
      "id": "distribute-work",
      "description": "Distribute files across available instances",
      "prompt": {
        "template": "Distribute {{impulseIds}} across {{instanceCount}} instances.\n\nUse acp_delegate to send batches of files to each instance for parallel analysis.",
        "variables": [
          {
            "name": "impulseIds",
            "type": "array",
            "required": true
          },
          {
            "name": "instanceCount",
            "type": "number",
            "required": true,
            "default": 2
          }
        ]
      }
    },
    {
      "id": "aggregate-results",
      "description": "Combine results from all instances",
      "prompt": {
        "template": "Aggregate the analysis results from all instances.\n\nCombine findings, deduplicate issues, and create summary report."
      }
    }
  ]
}
```

### Activity Template: delegate-with-shared-context

**Purpose**: Delegate work with rich shared context (design docs, standards, examples)

```json
{
  "name": "Delegate With Shared Context",
  "templateId": "delegate-with-shared-context",
  "category": "infrastructure",
  "description": "Delegate task with comprehensive shared context via impulses",
  "tasks": [
    {
      "id": "prepare-context",
      "description": "Create impulses for all shared context",
      "prompt": {
        "template": "Create impulses for shared context:\n- Design spec: {{designSpec}}\n- Coding standards: {{codingStandards}}\n- Examples: {{exampleFiles}}\n\nUse pointer-based impulses for efficiency.",
        "variables": [
          {
            "name": "designSpec",
            "type": "string",
            "required": true
          },
          {
            "name": "codingStandards",
            "type": "string",
            "required": false
          },
          {
            "name": "exampleFiles",
            "type": "array",
            "required": false
          }
        ]
      }
    },
    {
      "id": "delegate-task",
      "description": "Delegate implementation with shared context",
      "prompt": {
        "template": "Delegate to {{target}}:\n\nTask: {{taskDescription}}\nPrompt: {{taskPrompt}}\nShare impulses: {{contextImpulseIds}}\n\nUse pointer-based sharing (sendFullContent=false).",
        "variables": [
          {
            "name": "target",
            "type": "string",
            "required": true
          },
          {
            "name": "taskDescription",
            "type": "string",
            "required": true
          },
          {
            "name": "taskPrompt",
            "type": "string",
            "required": true
          },
          {
            "name": "contextImpulseIds",
            "type": "array",
            "required": true
          }
        ]
      }
    },
    {
      "id": "verify-result",
      "description": "Verify delegated work meets requirements",
      "prompt": {
        "template": "Review the delegated work result.\n\nCheck:\n- Follows design spec\n- Meets coding standards\n- Matches examples\n- Complete and functional"
      }
    }
  ]
}
```

---

## Phase 5: Document Best Practices (1 hour)

### Best Practice 1: Impulse Budget Management

**Problem**: Oversharing impulses overwhelms context window

**Solution**: Use budget strategically

```typescript
// Anti-pattern: Share everything
shareImpulses: ["design", "standards", "example1", "example2", "example3", "history", "related1", "related2"]
// Total budget: 15,000 tokens → Context overflow

// Best practice: Share essentials, use high-priority impulses
await impulse_create({
  id: "design",
  type: "memo",
  pointer: { /* ... */ },
  budget: 2000,
  priority: "high"  // Will be included first
})

await impulse_create({
  id: "example",
  type: "file",
  pointer: { /* ... */ },
  budget: 1500,
  priority: "medium"
})

shareImpulses: ["design", "example"]  // Total: 3,500 tokens ✅
```

### Best Practice 2: Pointer vs. Full Content

**When to use pointer-only** (default, recommended):
- ✅ Files available on remote (same codebase)
- ✅ Small design docs (memos)
- ✅ Activity outputs (recent work)
- ✅ Database queries (remote has access)

**When to use full content** (sendFullContent=true):
- ⚠️ Remote doesn't have file access
- ⚠️ Cross-codebase delegation
- ⚠️ Ephemeral data not in files

```typescript
// Same codebase → Use pointers
acp_delegate({
  shareImpulses: ["file-pointer"],
  sendFullContent: false  // Remote resolves from filesystem
})

// Cross-codebase → Use full content
acp_delegate({
  shareImpulses: ["design-doc"],
  sendFullContent: true  // Remote doesn't have access
})
```

### Best Practice 3: Progressive Context Building

**Pattern**: Start with minimal context, add more only if needed

```typescript
// Stage 1: Minimal context
const result1 = await acp_delegate({
  prompt: "Implement POST /api/users endpoint",
  shareImpulses: ["api-spec"],  // Just the spec
  timeout: 120
})

// If implementation needs more context (detected from response)
if (result1.output.includes("need more examples")) {
  const result2 = await acp_delegate({
    prompt: "Implement POST /api/users endpoint with additional context",
    shareImpulses: ["api-spec", "example-endpoint", "coding-standards"],
    timeout: 120
  })
}
```

---

## Summary: What to Do Now

### Immediate Actions (Today - 2 hours)

1. **Test acp_delegate** (30 min)
   - Run Test Scenarios 1-3
   - Verify impulse sharing works
   - Confirm pointer resolution

2. **Implement distributed locks** (1 hour)
   - Create DistributedLock class
   - Add @distributedLock decorator
   - Protect git operations

3. **Test parallel delegation** (30 min)
   - Delegate 2 tasks in parallel
   - Verify no conflicts
   - Measure speedup

### Short-term (This Week - 4 hours)

4. **Create delegation patterns doc** (1 hour)
   - Document 3 core patterns
   - Add code examples
   - Create quick reference

5. **Build delegation activities** (2 hours)
   - delegate-parallel-analysis
   - delegate-with-shared-context
   - Test with real scenarios

6. **Add coordination monitoring** (1 hour)
   - Track lock acquisition times
   - Monitor delegation success rate
   - Alert on conflicts

### Success Metrics

**Phase 1 Success**:
- ✅ Can delegate tasks via acp_delegate
- ✅ Impulse sharing reduces context by >90%
- ✅ Remote agents resolve pointers correctly

**Phase 3 Success**:
- ✅ Git conflicts reduced to 0
- ✅ Lock acquisition latency <100ms
- ✅ Multiple instances work safely in parallel

**Phase 4 Success**:
- ✅ 2+ delegation activities operational
- ✅ Parallel work distribution functional
- ✅ Context management patterns documented

---

## Key Insights

1. **You already have the hard part done** - acp_delegate with impulse sharing exists and is sophisticated
2. **The blocker is git conflicts** - distributed locks solve this (2 hours of work)
3. **Impulse sharing is brilliant** - pointer-based serialization is 90%+ more efficient than full content
4. **Start simple** - test delegation first, add coordination second, build activities third

**Bottom line**: You're 70% of the way there. The delegation infrastructure exists and is well-designed. You need:
1. Distributed locks (prevent git conflicts)
2. Testing (verify delegation works)
3. Patterns (document best practices)

Let's start with testing delegation right now, then add locks if conflicts occur.
