# DevBob Dogfooding Quick Start

**Use DevBob to Build DevBob - Starting Today**

---

## Current State

### ✅ What Works
- Impulse system (create, load, list, update, delete)
- Activity templates
- Metabob MCP tools (8 tools available)
- ACP delegation with `shareImpulses`
- Git integration

### ❌ What's Missing
- Network access from host (Phase 0 blocker)
- Conventions for using existing tools

---

## Today: First Dogfooding Experience

### Step 1: Fix Network Access (Manual for Now)

Since we can't delegate yet, fix manually:

```bash
# Check port mapping
docker ps --filter name=devbob-rpc-api --format "{{.Ports}}"

# Should show: 0.0.0.0:3001->3001/tcp
# If not, update docker-compose.devbob.yaml

# Check ACP hostname binding
docker exec devbob-rpc-api sh -c 'ps aux | grep "opencode acp"'
# Should show: --hostname 0.0.0.0

# Test from host
curl http://localhost:3001/acp/sessions
# Should return: [] or session list
```

**Document the fix** - we'll use this as our first specification later.

---

### Step 2: First Specification Impulse (Test Pattern)

Once network works, create your first specification:

```typescript
// In host OpenCode session
await impulse_create({
  id: "spec-test-impulse-system",
  pointer: {
    type: "memo",
    content: `# Test Impulse System

## Purpose
Verify impulse system works for specifications across containers.

## Requirements
- Create specification impulse in host
- Share with DevBob container via acp_delegate
- DevBob loads impulse and implements simple feature
- DevBob creates test-result impulse
- DevBob creates activity-result impulse

## Success Criteria
- Impulses transfer across containers
- DevBob can read specification
- Pattern is reusable

## Test Feature
Add a simple utility function:
- File: src/utils/hello.ts
- Function: sayHello(name: string) => string
- Returns: "Hello, {name}!"
- Test: tests/utils/hello.test.ts
    `
  },
  budget: 3000,
  priority: "high",
  type: "specification",
  metadata: {
    targetRepository: ["metabob-opencode"],
    constraints: ["< 10 lines of code"],
    testFeature: true
  }
});
```

---

### Step 3: First Delegation

```typescript
// In host OpenCode session
const result = await acp_delegate({
  target: "docker://devbob-opencode-agent",
  taskDescription: "Test specification-driven implementation",
  prompt: `Implement the test feature from specification.

IMPORTANT:
1. Load impulse: spec-test-impulse-system
2. Read the specification
3. Implement the simple feature (sayHello function)
4. Write tests
5. Create test-result impulse with output
6. Create activity-result impulse with summary

This is a test to validate our dogfooding pattern.`,
  shareImpulses: ["spec-test-impulse-system"],
  timeout: 300
});

console.log("Result:", result);
```

---

### Step 4: Verify Pattern Works

```typescript
// Query impulses created by DevBob
const testResults = await impulse_list({ type: "test-result" });
console.log("Test results:", testResults);

const activityResults = await impulse_list({ type: "activity-result" });
console.log("Activity results:", activityResults);

// Check if files were created
await bash({ command: "ls -la /path/to/devbob-opencode/src/utils/hello.ts" });
await bash({ command: "ls -la /path/to/devbob-opencode/tests/utils/hello.test.ts" });
```

**Success**: If impulses are created and files exist, pattern works! 🎉

---

## This Week: Real Dogfooding

### Use Case 1: Implement Activity Persistence

```typescript
// Day 2: Create specification
await impulse_create({
  id: "spec-activity-persistence",
  pointer: {
    type: "memo",
    content: `# Activity Persistence

## Purpose
Save activity execution results so they survive container restarts.

## Requirements
- Checkpoint activity state after each task
- Save to .opencode/activities/checkpoints/
- Resume interrupted activities on container start
- Store in Docker volume for persistence

## Success Criteria
- Container restart resumes interrupted activity
- No data loss on crash
- Checkpoints < 100KB each
    `
  },
  budget: 5000,
  type: "specification"
});

// Delegate to DevBob
await acp_delegate({
  target: "docker://devbob-opencode-agent",
  taskDescription: "Implement activity persistence",
  prompt: "Implement activity persistence per specification. Use specification-driven-implementation activity template if available.",
  shareImpulses: ["spec-activity-persistence"]
});
```

### Use Case 2: Cross-Container Message System

```typescript
// Day 3: Test MESSAGE_FOR pattern
await impulse_create({
  id: "spec-message-for-pattern",
  pointer: {
    type: "memo",
    content: `# MESSAGE_FOR Pattern

## Purpose
Enable cross-container coordination via Metabob annotations.

## Requirements
- Convention: Add "MESSAGE_FOR:target" to annotations
- Helper script: find-messages-for.sh
- Test with RPC API → Dashboard coordination

## Test Case
1. DevBob-rpc-api updates auth API
2. Annotates with MESSAGE_FOR:dashboard
3. DevBob-dashboard queries for messages
4. DevBob-dashboard implements required changes
    `
  },
  budget: 3000,
  type: "specification"
});

// Delegate to RPC API agent
await acp_delegate({
  target: "docker://devbob-rpc-api",
  taskDescription: "Test cross-container messaging",
  prompt: "Make a small auth change. Annotate with MESSAGE_FOR:dashboard. Test the pattern.",
  shareImpulses: ["spec-message-for-pattern"]
});
```

---

## Conventions to Start Using Today

### 1. Impulse Types

```typescript
type: "specification"     // Feature/fix requirements
type: "test-result"       // Test execution output
type: "activity-result"   // Activity execution summary
type: "design-decision"   // Why choices were made
type: "api-contract"      // Interface definitions
```

### 2. Annotation Format

```typescript
await metabob_annotate_component({
  file_path: "src/component.ts",
  component_name: "ComponentName",
  component_type: "class",
  reason: `
DESIGN_DECISION: <what was decided>
WHY: <reasoning>
ALTERNATIVES: <other options>
TRADEOFFS: <what was sacrificed>
VALIDATED_BY: test-result-<id>
MESSAGE_FOR:<target> - <action needed>
  `.trim()
});
```

### 3. Activity Result Format

```typescript
await impulse_create({
  id: `activity-result-${activityId}`,
  pointer: {
    type: "memo",
    content: JSON.stringify({
      activityId,
      templateId,
      specId,
      success: true,
      duration: 300000,
      filesChanged: ["file1.ts", "file2.ts"],
      testsRan: 10,
      testsPassed: 10,
      annotations: 3,
      summary: "Brief description"
    }, null, 2)
  },
  budget: 1000,
  type: "activity-result"
});
```

---

## Weekly Goals

### Week 1: Validate Pattern
- [ ] Fix network access
- [ ] First specification impulse
- [ ] First delegation with specification
- [ ] Pattern documented and working

### Week 2: Real Features
- [ ] Implement activity persistence via specification
- [ ] Test MESSAGE_FOR cross-container pattern
- [ ] 2+ features built with dogfooding

### Week 3: Refinement
- [ ] Improve specification format based on learnings
- [ ] Create helper scripts for common patterns
- [ ] Document what works, what doesn't

### Week 4: Scaling
- [ ] 5+ features built via dogfooding
- [ ] Multi-container coordination working
- [ ] DevBob agents building DevBob autonomously

---

## Troubleshooting

### Impulse Not Transferred
```typescript
// Check if impulse exists in source
await impulse_list({ type: "specification" });

// Check if shareImpulses parameter correct
acp_delegate({
  shareImpulses: ["spec-id"],  // ← Array of impulse IDs
  ...
});
```

### DevBob Can't Load Impulse
```typescript
// In DevBob container, check impulses
const impulses = await impulse_list({});
// If empty, sharing didn't work

// Manually test impulse_load
const impulse = await impulse_load({ id: "spec-id" });
console.log(impulse.pointer.content);
```

### Activity Template Not Found
```bash
# List templates
ls -la .metabob/activities/

# If missing, copy from templates/
cp templates/specification-driven-implementation.json .metabob/activities/
```

---

## Success Metrics

### Pattern Validation (Week 1)
- [ ] Impulses transfer across containers
- [ ] DevBob can read and implement specifications
- [ ] Test results captured as impulses
- [ ] Activity results persist

### Real Usage (Week 2-4)
- [ ] 5+ features built via dogfooding
- [ ] 0 manual implementations (all via specifications)
- [ ] Cross-container coordination working
- [ ] Pattern refined and documented

---

## Next Steps

### Right Now
1. Fix network access (if not working)
2. Create first test specification
3. Delegate to DevBob
4. Verify pattern works

### Today
1. Document learnings
2. Refine specification format
3. Create 1-2 more specifications

### This Week
1. Build real features via dogfooding
2. Test cross-container coordination
3. Iterate on patterns

---

**Start Now**: Create your first specification impulse and delegate to DevBob! 🚀

**Related Docs**:
- [INCREMENTAL_DEVBOB_DOGFOODING.md](./INCREMENTAL_DEVBOB_DOGFOODING.md) - Full plan
- [DEVBOB_SELF_SUSTAINING_ROADMAP.md](./DEVBOB_SELF_SUSTAINING_ROADMAP.md) - Infrastructure
