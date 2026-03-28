# Canary Environment Strategy: Safe Self-Improvement

## Core Principle

**"Try it in a container first. If it works, adopt it. If it fails, we learned something."**

Before any self-improvement change touches production (host system), we:
1. Test it in `devbob-clean` container (isolated canary)
2. Validate it works and can be repeated
3. Document the knowledge gained
4. Demonstrate that knowledge by repeating the activity
5. Only then adopt it to host/production

---

## The Philosophy: Knowledge Through Repetition

### What We're Building
- **Not just**: "Try something and hope it works"
- **But**: "Try → Learn → Document → Demonstrate → Adopt"

### Why This Matters
1. **Safety**: Containers are disposable, host is not
2. **Repeatability**: If we can't repeat it, we didn't learn it
3. **Knowledge Retention**: Document HOW we did it, not just WHAT we did
4. **Confidence**: Demonstrate twice before trusting it in production

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CANARY WORKFLOW                              │
└─────────────────────────────────────────────────────────────────┘

Step 1: EXPERIMENT (devbob-clean container)
┌─────────────────────────────────────────────────────────────────┐
│  devbob-clean (ephemeral)                                        │
│  ┌──────────────────────────────────────────────────┐           │
│  │ • Fresh environment (no code)                     │           │
│  │ • Execute experimental activity                   │           │
│  │ • Capture: commands, files, errors, decisions    │           │
│  │ • Outcome: SUCCESS or FAILURE                    │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
              ↓ (if SUCCESS)
Step 2: LEARN (capture knowledge)
┌─────────────────────────────────────────────────────────────────┐
│  Knowledge Extraction                                            │
│  ┌──────────────────────────────────────────────────┐           │
│  │ • What did we build?                              │           │
│  │ • How did we build it? (steps, commands)         │           │
│  │ • Why did it work? (insights, patterns)          │           │
│  │ • What can go wrong? (failure modes)             │           │
│  │ • How to verify? (tests, validation)             │           │
│  └──────────────────────────────────────────────────┘           │
│  Output: Activity template + Documentation                       │
└─────────────────────────────────────────────────────────────────┘
              ↓
Step 3: DEMONSTRATE (repeat in fresh container)
┌─────────────────────────────────────────────────────────────────┐
│  devbob-clean (new instance)                                     │
│  ┌──────────────────────────────────────────────────┐           │
│  │ • Use the activity template created in Step 2    │           │
│  │ • NO manual intervention                          │           │
│  │ • Must succeed independently                      │           │
│  │ • Outcome: REPEATABLE or INCOMPLETE              │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
              ↓ (if REPEATABLE)
Step 4: ADOPT (deploy to host)
┌─────────────────────────────────────────────────────────────────┐
│  Host System (production)                                        │
│  ┌──────────────────────────────────────────────────┐           │
│  │ • Run the validated activity on host             │           │
│  │ • With rollback plan ready                        │           │
│  │ • With monitoring enabled                         │           │
│  │ • Outcome: DEPLOYED                               │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current Container Infrastructure

### Existing Setup
```
./devbob - CLI wrapper for container management

Containers Available:
  • devbob-clean      - Clean testing environment (no code)
  • devbob-opencode   - OpenCode with mounted code
  • devbob-rpc-api    - Backend API container
  • devbob-cli        - CLI-focused container
  • devbob-dashboard  - Dashboard-focused container

Backend Services:
  • redis             - Shared cache
  • surreal           - Shared database
  • metabob-rpc-api   - Shared backend (http://localhost:8080)
```

### Key Insight
**`devbob-clean` is perfect for canary testing** because:
- ✅ Fresh environment (no pre-existing code)
- ✅ Isolated from host
- ✅ Disposable (can destroy and recreate)
- ✅ Connected to shared backend (learning persists)
- ✅ OpenCode + metabob-cli installed

---

## Canary Workflow Activities

### Activity 1: `canary-test-and-learn`
**Purpose**: Execute experimental activity in canary, capture knowledge

```typescript
{
  "id": "canary-test-and-learn",
  "name": "Canary Test and Learn",
  "category": "infrastructure",
  "description": "Execute activity in devbob-clean, capture knowledge if successful",
  
  "variables": [
    {
      "name": "activityId",
      "type": "string",
      "required": true,
      "description": "Activity template to test in canary"
    },
    {
      "name": "variables",
      "type": "object",
      "required": true,
      "description": "Variables for the activity"
    }
  ],
  
  "tasks": [
    {
      "id": "task-1",
      "description": "Start devbob-clean container",
      "prompt": "Start fresh devbob-clean container: ./devbob start devbob-clean"
    },
    {
      "id": "task-2",
      "description": "Execute experimental activity in container",
      "dependencies": ["task-1"],
      "prompt": "Execute activity {{activityId}} with variables {{variables}} via ACP in devbob-clean container"
    },
    {
      "id": "task-3",
      "description": "If successful, extract knowledge",
      "dependencies": ["task-2"],
      "prompt": "Extract knowledge from successful execution:\n1. What was built?\n2. How was it built? (commands, steps)\n3. Why did it work? (patterns, decisions)\n4. What are failure modes?\n5. How to verify success?\n\nCreate knowledge document: CANARY_KNOWLEDGE_{{activityId}}.md"
    },
    {
      "id": "task-4",
      "description": "Export artifacts from container",
      "dependencies": ["task-3"],
      "prompt": "Copy artifacts from devbob-clean:\n- Modified files\n- Generated code\n- Test results\n- Logs\n\nStore in: canary-artifacts/{{activityId}}/"
    },
    {
      "id": "task-5",
      "description": "Stop and remove container",
      "dependencies": ["task-4"],
      "prompt": "Stop devbob-clean container: ./devbob stop devbob-clean"
    }
  ]
}
```

---

### Activity 2: `canary-demonstrate-knowledge`
**Purpose**: Prove we learned by repeating in fresh environment

```typescript
{
  "id": "canary-demonstrate-knowledge",
  "name": "Canary Demonstrate Knowledge",
  "category": "infrastructure",
  "description": "Repeat activity in fresh canary to prove knowledge retention",
  
  "variables": [
    {
      "name": "activityId",
      "type": "string",
      "required": true,
      "description": "Activity to demonstrate"
    },
    {
      "name": "knowledgeDoc",
      "type": "string",
      "required": true,
      "description": "Path to knowledge document from canary-test-and-learn"
    }
  ],
  
  "tasks": [
    {
      "id": "task-1",
      "description": "Start fresh devbob-clean container",
      "prompt": "Start NEW fresh devbob-clean container: ./devbob start devbob-clean"
    },
    {
      "id": "task-2",
      "description": "Execute activity using documented knowledge",
      "dependencies": ["task-1"],
      "prompt": "Execute activity {{activityId}} in fresh container.\nUSE the knowledge from {{knowledgeDoc}} to ensure success.\nNO manual intervention allowed - must be fully automated."
    },
    {
      "id": "task-3",
      "description": "Validate results match first execution",
      "dependencies": ["task-2"],
      "prompt": "Compare results with canary-artifacts/{{activityId}}/:\n- Same files created?\n- Same tests passing?\n- Same behavior?\n\nIf matches: KNOWLEDGE VALIDATED ✓\nIf differs: KNOWLEDGE INCOMPLETE ✗"
    },
    {
      "id": "task-4",
      "description": "Update knowledge document with demonstration results",
      "dependencies": ["task-3"],
      "prompt": "Update {{knowledgeDoc}} with:\n- Demonstration date/time\n- Success: YES/NO\n- Differences found (if any)\n- Confidence level: HIGH/MEDIUM/LOW"
    }
  ]
}
```

---

### Activity 3: `canary-adopt-to-host`
**Purpose**: Deploy validated change to host system with rollback capability

```typescript
{
  "id": "canary-adopt-to-host",
  "name": "Canary Adopt to Host",
  "category": "infrastructure",
  "description": "Deploy validated activity to host with rollback",
  
  "variables": [
    {
      "name": "activityId",
      "type": "string",
      "required": true,
      "description": "Activity to deploy to host"
    },
    {
      "name": "knowledgeDoc",
      "type": "string",
      "required": true,
      "description": "Validated knowledge document"
    }
  ],
  
  "tasks": [
    {
      "id": "task-1",
      "description": "Verify knowledge was demonstrated",
      "prompt": "Check {{knowledgeDoc}} for:\n- Demonstration: YES\n- Success: YES\n- Confidence: HIGH\n\nIf not all YES → ABORT deployment"
    },
    {
      "id": "task-2",
      "description": "Create rollback point",
      "dependencies": ["task-1"],
      "prompt": "Create git branch: canary-rollback-{{activityId}}-{{timestamp}}\nCommit current state as rollback point"
    },
    {
      "id": "task-3",
      "description": "Execute activity on host",
      "dependencies": ["task-2"],
      "prompt": "Execute activity {{activityId}} on HOST (not container).\nUse knowledge from {{knowledgeDoc}} for guidance."
    },
    {
      "id": "task-4",
      "description": "Validate deployment",
      "dependencies": ["task-3"],
      "prompt": "Run validation checks:\n- Tests pass?\n- No regressions?\n- Feature works?\n\nIf ANY fail → rollback to branch from task-2"
    },
    {
      "id": "task-5",
      "description": "Mark as adopted",
      "dependencies": ["task-4"],
      "prompt": "Update {{knowledgeDoc}} with:\n- Adopted to host: YES\n- Adoption date: {{timestamp}}\n- Rollback branch: canary-rollback-{{activityId}}-{{timestamp}}\n- Status: PRODUCTION"
    }
  ]
}
```

---

## Knowledge Document Format

**File**: `CANARY_KNOWLEDGE_{{activityId}}.md`

```markdown
# Canary Knowledge: {{activityId}}

## Status
- ✅ Canary Test: SUCCESS
- ✅ Demonstrated: SUCCESS (2 times)
- ✅ Adopted to Host: YES
- 🔒 Confidence: HIGH

## What We Built
[Description of what was created/changed]

## How We Built It

### Prerequisites
- System requirements
- Dependencies needed
- Environment setup

### Steps
1. [Step 1 with exact commands]
2. [Step 2 with exact commands]
3. ...

### Key Decisions
- Why we chose approach X over Y
- Tradeoffs considered
- Patterns followed

## Why It Works
- Root cause of success
- Critical dependencies
- Success factors

## Failure Modes
- What can go wrong?
- How to detect failures?
- How to recover?

## Validation
- Tests to run
- Expected outputs
- Health checks

## Demonstration History
1. **First Demo** ({{date}}): SUCCESS
   - Container: devbob-clean-{{id1}}
   - Duration: 15min
   - Issues: None
   
2. **Second Demo** ({{date}}): SUCCESS
   - Container: devbob-clean-{{id2}}
   - Duration: 12min
   - Issues: None

## Adoption History
- **Adopted to Host**: {{date}}
- **Rollback Branch**: canary-rollback-{{activityId}}-{{timestamp}}
- **Production Status**: ACTIVE
- **Incidents**: 0

## Related Knowledge
- Links to similar patterns
- Dependencies on other capabilities
- Future improvements
```

---

## Safe Experimentation Workflow

### Phase 1: Experiment (Low Risk)
```bash
# Start clean container
./devbob start devbob-clean

# Execute canary test
opencode activity execute canary-test-and-learn \
  --variables '{
    "activityId": "create-step-library-system",
    "variables": {...}
  }' \
  --reason "Safe experimentation in isolated canary"

# Result: CANARY_KNOWLEDGE_create-step-library-system.md created
```

### Phase 2: Demonstrate (Build Confidence)
```bash
# Fresh container (destroy previous)
./devbob stop devbob-clean
./devbob start devbob-clean

# Prove we can repeat it
opencode activity execute canary-demonstrate-knowledge \
  --variables '{
    "activityId": "create-step-library-system",
    "knowledgeDoc": "CANARY_KNOWLEDGE_create-step-library-system.md"
  }' \
  --reason "Demonstrate repeatability of learned knowledge"

# Result: Knowledge document updated with demonstration proof
```

### Phase 3: Adopt (Production Deployment)
```bash
# Deploy to host with rollback ready
opencode activity execute canary-adopt-to-host \
  --variables '{
    "activityId": "create-step-library-system",
    "knowledgeDoc": "CANARY_KNOWLEDGE_create-step-library-system.md"
  }' \
  --reason "Deploy validated capability to production"

# Result: Host system upgraded, rollback branch created
```

---

## Integration with Self-Improvement Plan

### Modified Phase 1 Workflow

**Original**: Execute `create-step-library-system` on host

**New (Safe)**:
1. **Canary Test**: Execute in devbob-clean
2. **Learn**: Capture knowledge document
3. **Demonstrate**: Repeat in fresh container
4. **Adopt**: Deploy to host with rollback

**Benefits**:
- ✅ Safe: Mistakes happen in disposable containers
- ✅ Repeatable: Prove we can do it twice
- ✅ Documented: Knowledge captured automatically
- ✅ Recoverable: Rollback branch always ready

---

## Rollback Mechanisms

### Automatic Rollback Triggers
1. **Tests fail** after adoption
2. **Regression detected** in validation
3. **Manual rollback** requested

### Rollback Procedure
```bash
# Identify rollback point
git branch --list "canary-rollback-*"

# Rollback
git checkout canary-rollback-{{activityId}}-{{timestamp}}
git checkout -b recovery-from-{{activityId}}

# Restore state
npm install
npm test

# Verify recovery
opencode activity execute validate-system-health
```

---

## Knowledge Retention System

### Knowledge Database
```
canary-knowledge/
├── CANARY_KNOWLEDGE_create-step-library-system.md
├── CANARY_KNOWLEDGE_create-workflow-composer.md
├── CANARY_KNOWLEDGE_create-optimizer.md
├── ...
└── INDEX.md (catalog of all knowledge)
```

### Knowledge Index
```markdown
# Canary Knowledge Index

## Active (Adopted to Host)
- ✅ create-step-library-system (Confidence: HIGH, Demos: 2)
- ✅ create-workflow-composer (Confidence: HIGH, Demos: 2)

## Validated (Ready for Adoption)
- 🟡 create-metrics-engine (Confidence: MEDIUM, Demos: 1)

## Experimental (In Canary)
- 🔬 create-optimizer (Testing in progress)

## Failed (Learned from Failure)
- ❌ attempt-full-rewrite (Failure mode: Too complex)
```

---

## Success Metrics

### Canary Testing
- ✅ 100% of self-improvement changes tested in canary first
- ✅ 90%+ canary tests successful (high experiment quality)
- ✅ 0 production breakages from self-improvement

### Knowledge Retention
- ✅ 100% of successful changes documented
- ✅ 100% of changes demonstrated (repeated) successfully
- ✅ <15 minutes from second demo (proof of automation)

### Recovery
- ✅ Rollback available for 100% of adoptions
- ✅ <5 minutes to rollback on detection
- ✅ 0 unrecoverable states

---

## Implementation Priority

### Immediate (Today)
1. Create `canary-test-and-learn` activity template
2. Create knowledge document template
3. Test with small change (e.g., "add-hello-world-function")

### This Week
4. Create `canary-demonstrate-knowledge` activity
5. Create `canary-adopt-to-host` activity
6. Validate full workflow with real self-improvement task

### Ongoing
7. Build knowledge index automatically
8. Add metrics tracking (success rates, demo times)
9. Create "knowledge replay" tool (re-run all demonstrations)

---

## The Beautiful Part

**This isn't just safety - it's learning.**

Every canary test teaches us:
- What works (documented knowledge)
- What doesn't work (documented failures)
- How to repeat success (demonstrated competence)
- How to recover from failure (rollback mechanisms)

**The system doesn't just improve - it learns HOW to improve safely.**

This is the foundation for true autonomous operation.

---

## Ready to Begin?

Start with a simple canary test:

```bash
# Create the canary-test-and-learn activity template
opencode activity execute create-activity-template \
  --variables '{
    "templateName": "canary-test-and-learn",
    "category": "infrastructure",
    "description": "See CANARY_ENVIRONMENT_STRATEGY.md for spec"
  }' \
  --reason "Build safe experimentation infrastructure"
```

**Then use it for all self-improvement work.**

No more "hope and pray" deployments. Every change is:
1. ✅ Tested in isolation
2. ✅ Knowledge captured
3. ✅ Repeatability proven
4. ✅ Rollback ready

**Safe. Repeatable. Documented. Recoverable.** 🚀
