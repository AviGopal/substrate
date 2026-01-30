# Incremental DevBob Dogfooding Plan

**Status**: Pragmatic Implementation Plan  
**Created**: January 27, 2026  
**Philosophy**: Use what exists, add minimally, dogfood incrementally

---

## Current Toolkit Audit

### ✅ What We Already Have

#### 1. **Impulse System** (Fully Functional)
- `impulse_create` - Create knowledge containers
- `impulse_load` - Load impulse content into context
- `impulse_list` - List available impulses
- `impulse_update` - Modify impulse metadata
- `impulse_delete` - Remove impulses
- `impulse_unload` - Free memory

**Pointer Types**:
- `memo` - In-memory content
- `file` - File on disk
- `git` - Git-tracked file

**Scopes**:
- `session` - Available in current session
- `activity` - Available during activity execution

**Already Supports**:
- Budget management (token allocation)
- Priority (high/medium/low)
- Type categorization (any string)
- Metadata (arbitrary key-value)
- Cross-activity sharing via `shareImpulses` in `acp_delegate`

#### 2. **Activity System** (Fully Functional)
- `opencode activity list` - List activities
- `opencode activity template` - Manage templates
- `opencode activity run` - Execute activity
- `activity_replay` - Resume failed activities
- Activity templates in `.metabob/activities/`

#### 3. **Metabob CLI Integration** (Running as MCP Sidecar)
- `metabob-cli analyze` - Submit files for analysis
- `metabob-cli config` - Show configuration
- `metabob-cli mcp` - MCP server (auto-started by OpenCode)
- `metabob-cli restore` - Sync from backend

**MCP Tools Available** (via OpenCode):
- `metabob_search_codebase_issues`
- `metabob_get_priority_issues`
- `metabob_mark_problem_complete`
- `metabob_annotate_component`
- `metabob_analyze_change_impact`
- `metabob_list_file_components`
- `metabob_assess_deletion_safety`
- `metabob_suggest_related_changes`

#### 4. **ACP Delegation** (Working in Containers)
- `acp_delegate` - Delegate tasks to other containers
- Supports `shareImpulses` parameter
- Supports `timeout`, `taskDescription`, `prompt`

#### 5. **Git Integration**
- All containers have git repositories mounted
- Can track changes, commits, history

---

## What We DON'T Need to Build

### ❌ Skip These (Already Exists)
1. ~~Impulse system~~ - Already fully functional
2. ~~Activity templates~~ - Already in use
3. ~~Metabob MCP integration~~ - Already running
4. ~~ACP delegation~~ - Already working
5. ~~Basic persistence~~ - Already has volumes

### ❌ Skip These (Premature Optimization)
1. ~~GNN co-change model~~ - Use `metabob_suggest_related_changes` instead
2. ~~Custom trace collector~~ - Use test output + activity logs
3. ~~Complex validation engine~~ - Use simple bash checks
4. ~~Centralized knowledge API~~ - Use git commits + annotations

---

## Incremental Dogfooding Strategy

**Core Principle**: Use DevBob containers to develop DevBob capabilities, one small step at a time.

### Increment 1: Specification-Driven Development (Week 1)
**Goal**: Use impulses for specifications, delegate to DevBob

**What to Build**: Nothing new! Just use existing tools:

```typescript
// Step 1: Create specification as impulse (in host)
await impulse_create({
  id: "spec-fix-network-access",
  pointer: {
    type: "memo",
    content: `# Fix DevBob Network Access

## Problem
ACP servers running but not accessible from host.

## Requirements
- Diagnose port mapping or hostname binding issue
- Fix docker-compose.yaml or entrypoint.sh
- Test delegation to all 4 containers

## Success Criteria
- curl http://localhost:3001/acp/sessions returns JSON
- acp_delegate works from host to all containers
    `
  },
  budget: 3000,
  priority: "high",
  type: "specification"
});

// Step 2: Delegate to DevBob (in host)
await acp_delegate({
  target: "docker://devbob-opencode-agent",
  taskDescription: "Fix DevBob network access",
  prompt: `Fix the DevBob network access issue.

Load the specification impulse: spec-fix-network-access

Follow the requirements and verify success criteria.

Use metabob_suggest_related_changes to find related config files.`,
  shareImpulses: ["spec-fix-network-access"],
  timeout: 600
});

// Step 3: DevBob implements (automatically in container)
// - Loads impulse with impulse_load
// - Reads specification
// - Queries metabob_suggest_related_changes
// - Makes changes
// - Tests
// - Annotates with metabob_annotate_component
```

**New Functionality Needed**: NONE! Everything exists.

**Deliverable**: Working pattern for specification-driven delegation.

---

### Increment 2: Cross-Container Coordination (Week 2)
**Goal**: Multiple DevBob containers work on related changes

**What to Build**: Simple convention for MESSAGE_FOR in annotations

**Pattern**:

```typescript
// DevBob RPC API makes a change
await metabob_annotate_component({
  file_path: "src/auth/jwt.ts",
  component_name: "verifyToken",
  component_type: "function",
  reason: `Updated JWT verification to support RS256 algorithm.
           Breaking change: now requires 'algorithm' parameter.
           MESSAGE_FOR:dashboard,cli - Update auth calls to pass algorithm.`
});

// Dashboard agent queries for messages
const issues = await metabob_search_codebase_issues({
  query: "MESSAGE_FOR:dashboard"
});

// Returns annotations with MESSAGE_FOR:dashboard
// Dashboard agent reads and implements required changes
```

**New Functionality Needed**: 
- Convention: Use `MESSAGE_FOR:target` in annotations
- Helper script: `find-messages-for.sh` (uses grep)

**Deliverable**: Cross-repo coordination via annotations.

---

### Increment 3: Test Outcome Tracking (Week 3)
**Goal**: Track what works and what doesn't

**What to Build**: Simple test result logging to impulses

**Pattern**:

```typescript
// Run tests and capture output
const testOutput = await bash({ 
  command: "npm test 2>&1" 
});

// Create test result impulse
await impulse_create({
  id: `test-result-${Date.now()}`,
  pointer: {
    type: "memo",
    content: testOutput
  },
  budget: 1000,
  type: "test-result",
  metadata: {
    passed: testOutput.includes("All tests passed"),
    timestamp: new Date().toISOString(),
    files: ["src/auth.ts", "tests/auth.test.ts"]
  }
});

// Query test history
const testResults = await impulse_list({ type: "test-result" });
const recentFailures = testResults.filter(
  r => !r.metadata.passed && Date.parse(r.metadata.timestamp) > Date.now() - 86400000
);
```

**New Functionality Needed**: NONE! Use existing impulse system.

**Deliverable**: Test history tracking via impulses.

---

### Increment 4: Design Decision Documentation (Week 4)
**Goal**: Capture WHY decisions were made

**What to Build**: Structured annotation format

**Pattern**:

```typescript
// After implementing a feature, document the design
await metabob_annotate_component({
  file_path: "src/auth/jwt.ts",
  component_name: "verifyToken",
  component_type: "function",
  reason: `
DESIGN_DECISION: Use RS256 instead of HS256
WHY: Better security, asymmetric keys
ALTERNATIVES: HS256 (simpler), ES256 (faster)
TRADEOFFS: Complexity for security
CONSTRAINTS: Must support existing HS256 tokens during migration
VALIDATED_BY: test-result-1706389200000
  `.trim()
});

// Query design decisions
const decisions = await metabob_search_codebase_issues({
  query: "DESIGN_DECISION"
});
```

**New Functionality Needed**: NONE! Use existing annotations with convention.

**Deliverable**: Design decision corpus for learning.

---

### Increment 5: Activity Outcome Persistence (Week 5)
**Goal**: Don't lose activity results on container restart

**What to Build**: Activity result summary impulses

**Pattern**:

```typescript
// At end of activity execution (add to activity template)
await impulse_create({
  id: `activity-result-${activityId}`,
  pointer: {
    type: "memo",
    content: JSON.stringify({
      activityId,
      templateId,
      success: true,
      duration: 300000,
      cost: 0.25,
      filesChanged: ["src/auth.ts", "tests/auth.test.ts"],
      testsRan: 15,
      testsPassed: 15,
      annotations: 3,
      summary: "Implemented RS256 JWT support with migration path"
    }, null, 2)
  },
  budget: 1000,
  type: "activity-result",
  metadata: {
    activityId,
    templateId,
    success: true,
    timestamp: new Date().toISOString()
  }
});

// On container restart, query recent activity results
const recentActivities = await impulse_list({ type: "activity-result" });
// Use to resume or learn from past work
```

**New Functionality Needed**: 
- Add final task to activity templates: "Create activity result impulse"

**Deliverable**: Activity history survives restarts.

---

### Increment 6: Simple Co-Change Prediction (Week 6)
**Goal**: Suggest related files without ML

**What to Build**: Use existing `metabob_suggest_related_changes`

**Pattern**:

```typescript
// Before implementing changes, ask Metabob
const relatedChanges = await metabob_suggest_related_changes({
  changed_files: ["src/auth/jwt.ts"]
});

// Returns:
// {
//   suggestions: [
//     { file: "tests/auth/jwt.test.ts", reason: "Test file for jwt.ts" },
//     { file: "src/auth/index.ts", reason: "Exports from jwt.ts" },
//     { file: "docs/auth.md", reason: "Documentation for auth" }
//   ]
// }

// Create todo list from suggestions
const todos = relatedChanges.suggestions.map(s => ({
  file: s.file,
  action: `Check if changes needed: ${s.reason}`,
  priority: "medium"
}));
```

**New Functionality Needed**: NONE! Already exists in Metabob MCP.

**Deliverable**: Co-change awareness without ML.

---

## Dogfooding Workflow

### Phase 1: Fix Network Access (Dogfood Specifications)

```bash
# In host OpenCode session
opencode run "Create a specification impulse for fixing DevBob network access, then delegate to devbob-opencode container"
```

**What happens**:
1. Host creates `spec-fix-network-access` impulse
2. Host delegates to `devbob-opencode-agent` with `shareImpulses`
3. DevBob loads impulse, reads spec, fixes issue
4. DevBob annotates changes with design decisions
5. DevBob creates test result impulse
6. DevBob creates activity result impulse

**Learning**: Specifications work! Pattern validated.

---

### Phase 2: Implement Activity Persistence (Dogfood Cross-Container)

```bash
# In host
opencode run "Create spec for activity persistence. Delegate implementation to devbob-opencode, testing to devbob-cli"
```

**What happens**:
1. Host creates `spec-activity-persistence` impulse
2. Host delegates to `devbob-opencode` for implementation
3. DevBob-opencode implements, adds `MESSAGE_FOR:cli` annotation
4. Host delegates to `devbob-cli` to test
5. DevBob-cli queries for `MESSAGE_FOR:cli`, finds persistence feature
6. DevBob-cli writes tests, validates
7. Both report results via impulses

**Learning**: Cross-container coordination works!

---

### Phase 3: Build Central Activity Registry (Dogfood Everything)

```bash
# In host
opencode run "Create spec for central activity registry API in metabob-rpc-api. Coordinate implementation across devbob-rpc-api, testing in devbob-cli, and docs in devbob-dashboard"
```

**What happens**:
1. Host creates specification impulse
2. Host delegates to all 3 containers with shared spec
3. DevBob-rpc-api implements API
4. DevBob-rpc-api annotates with `MESSAGE_FOR:cli,dashboard`
5. DevBob-cli reads message, implements CLI commands
6. DevBob-dashboard reads message, implements UI
7. All agents create test result impulses
8. All agents create activity result impulses
9. System learns from coordinated effort

**Learning**: Multi-agent tool building works!

---

## Activity Templates for Dogfooding

### Template 1: specification-driven-implementation.json

```json
{
  "name": "Specification-Driven Implementation",
  "description": "Implement a feature from a specification impulse",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1",
      "description": "Load and analyze specification",
      "prompt": {
        "template": "Load specification impulse {{specId}}. Analyze requirements and constraints. Query metabob_suggest_related_changes for potentially affected files."
      }
    },
    {
      "id": "task-2",
      "description": "Implement changes",
      "dependencies": ["task-1"],
      "prompt": {
        "template": "Implement the requirements. Follow constraints. Update all related files identified."
      }
    },
    {
      "id": "task-3",
      "description": "Test and validate",
      "dependencies": ["task-2"],
      "prompt": {
        "template": "Run tests. Capture output as test-result impulse. Validate against specification success criteria."
      }
    },
    {
      "id": "task-4",
      "description": "Document and annotate",
      "dependencies": ["task-3"],
      "prompt": {
        "template": "Annotate key components with design decisions (use DESIGN_DECISION format). Add MESSAGE_FOR if other repos affected. Create activity-result impulse."
      }
    }
  ]
}
```

### Template 2: cross-container-coordination.json

```json
{
  "name": "Cross-Container Coordination",
  "description": "Coordinate changes across multiple repositories",
  "category": "feature",
  "tasks": [
    {
      "id": "task-1",
      "description": "Check for cross-container messages",
      "prompt": {
        "template": "Query metabob_search_codebase_issues for MESSAGE_FOR:{{containerName}}. List all pending coordination requests."
      }
    },
    {
      "id": "task-2",
      "description": "Implement coordinated changes",
      "dependencies": ["task-1"],
      "prompt": {
        "template": "Implement changes requested in MESSAGE_FOR annotations. Follow design decisions from origin annotations."
      }
    },
    {
      "id": "task-3",
      "description": "Validate integration",
      "dependencies": ["task-2"],
      "prompt": {
        "template": "Test integration with other containers. Verify API contracts. Create test-result impulse."
      }
    },
    {
      "id": "task-4",
      "description": "Report completion",
      "dependencies": ["task-3"],
      "prompt": {
        "template": "Annotate completed work. Reference origin MESSAGE_FOR. Create activity-result impulse."
      }
    }
  ]
}
```

---

## Minimal New Code Required

### 1. Helper Script: find-messages-for.sh

```bash
#!/bin/bash
# Find MESSAGE_FOR annotations for a specific target

TARGET=$1
REPO_PATH=${2:-.}

cd "$REPO_PATH"

# Search annotations in metabob backend
metabob-cli restore 2>/dev/null

# Grep for MESSAGE_FOR in annotation files
find .metabob -name "*.json" -exec grep -l "MESSAGE_FOR:$TARGET" {} \; | while read file; do
  echo "=== $file ==="
  cat "$file" | jq -r '.annotations[] | select(.reason | contains("MESSAGE_FOR:'$TARGET'")) | .reason'
done
```

### 2. Activity Template Task Addition

Add to all feature templates:

```json
{
  "id": "task-final",
  "description": "Create activity result impulse",
  "dependencies": ["task-N"],
  "prompt": {
    "template": "Create activity-result impulse with summary: success/failure, duration, files changed, tests ran, annotations created."
  }
}
```

### 3. Convention Documentation

Create `docs/IMPULSE_CONVENTIONS.md`:

```markdown
# Impulse Conventions

## Impulse Types
- `specification` - Feature/fix requirements
- `design-decision` - Why choices were made
- `test-result` - Test execution output
- `activity-result` - Activity execution summary
- `api-contract` - Interface definitions

## Annotation Conventions
- `DESIGN_DECISION:` - Mark design rationale
- `MESSAGE_FOR:target` - Cross-container coordination
- `VALIDATED_BY:impulseId` - Link to test results
- `WHY:` - Explain reasoning
- `ALTERNATIVES:` - Other options considered
- `TRADEOFFS:` - What was sacrificed
```

---

## Success Metrics

### Week 1: Specification-Driven
- [ ] 1+ feature implemented from specification impulse
- [ ] Specification pattern documented
- [ ] DevBob agents can read and follow specifications

### Week 2: Cross-Container
- [ ] 1+ coordinated change across 2+ containers
- [ ] MESSAGE_FOR pattern working
- [ ] Agents query and respond to cross-repo messages

### Week 3: Test Tracking
- [ ] Test results captured as impulses
- [ ] Test history queryable
- [ ] Failed tests trigger re-implementation

### Week 4: Design Decisions
- [ ] 5+ design decisions documented
- [ ] Design decision corpus searchable
- [ ] New implementations reference past decisions

### Week 5: Activity Persistence
- [ ] Activity results persist across restarts
- [ ] Activity history queryable
- [ ] Learning from past activity outcomes

### Week 6: Co-Change Awareness
- [ ] metabob_suggest_related_changes used in all features
- [ ] Forgotten files reduced by 80%
- [ ] Test coverage improved

---

## Benefits of Incremental Approach

### 1. **No New Infrastructure**
- Use existing impulse system (fully functional)
- Use existing Metabob MCP tools
- Use existing activity templates
- Use existing ACP delegation

### 2. **Immediate Dogfooding**
- Start using DevBob to build DevBob TODAY
- Learn what works, what doesn't
- Iterate based on real usage

### 3. **Low Risk**
- No complex new systems
- Conventions, not code
- Easy to change course

### 4. **Incremental Value**
- Week 1: Specifications work
- Week 2: Cross-container coordination
- Week 3: Test tracking
- Each week adds value

### 5. **Natural Evolution**
- Patterns emerge from usage
- Pain points become obvious
- Build what's actually needed

---

## Next Steps

### Today
1. Fix network access (Phase 0 from previous roadmap)
2. Test `acp_delegate` with `shareImpulses`
3. Create first specification impulse

### This Week (Week 1)
1. Implement Increment 1 (Specification-Driven)
2. Dogfood: Use DevBob to fix one issue
3. Document learnings

### Next Week (Week 2)
1. Implement Increment 2 (Cross-Container)
2. Dogfood: Coordinate change across 2 containers
3. Refine conventions

### Week 3-6
1. One increment per week
2. Dogfood each increment
3. Build up to full tool-building capability

---

## Related Documents
- [DEVBOB_SELF_SUSTAINING_ROADMAP.md](./DEVBOB_SELF_SUSTAINING_ROADMAP.md) - Infrastructure work
- [GNN_COCHANGE_TOOLING_ARCHITECTURE.md](./GNN_COCHANGE_TOOLING_ARCHITECTURE.md) - Future vision
- [IMPULSE_SYSTEM_GUIDE.md](./IMPULSE_SYSTEM_GUIDE.md) - How impulses work

---

**Status**: Ready to Start  
**First Task**: Create specification impulse for network fix  
**Timeline**: 6 weeks to full capability, starting TODAY
