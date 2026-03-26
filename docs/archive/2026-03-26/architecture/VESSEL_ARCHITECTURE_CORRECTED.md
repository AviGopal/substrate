# Vessel Architecture - Corrected Understanding

**Date:** 2026-03-03  
**Status:** Authoritative Reference  
**Purpose:** Consolidate corrected vessel architecture understanding after clarification session

---

## Executive Summary

Vessels are **collections of ideas and intent in the instructional state** that extend functionality via:
- **Tools** (MCP, CLI binaries, APIs)
- **Activities** (structured workflows)
- **Lifecycle hooks** (bootstrap, activate, shutdown)
- **Data bridges** (impulses, validators)
- **Dependencies** (other vessels, services)

**Critical Corrections:**
1. ✅ **No explicit stages** - Vessels don't progress through predefined stages
2. ✅ **Activities for everything** - All behaviors are activities (managing, using, learning, introspecting)
3. ✅ **Boredom activities** - Prefilled instructions for autonomous improvement when idle
4. ✅ **Foundational pair** - metabob-cli + metabob-opencode provide vessel management functionality
5. ✅ **Learning loops** - Metrics-driven optimization with silent failure detection

---

## Core Principles

### 1. **Activity-Centric Execution**

Everything is done via activities:

```typescript
// User-directed work
await activity({ templateId: "add-feature-complete", ... })
await activity({ templateId: "fix-bug-complete", ... })

// Activity development
await activity({ templateId: "create-activity", ... })
await activity({ templateId: "evolve-activity-self-contained", ... })
await activity({ templateId: "debug-activity-self-contained", ... })

// Autonomous improvement (boredom)
await activity({ templateId: "improve-activity-template", ... })  // From metabob
await activity({ templateId: "debug-failed-activity", ... })      // From metabob
await activity({ templateId: "merge-similar-activities", ... })   // From metabob
```

**Rationale:** Activities provide structure, reusability, learning, and validation.

---

### 2. **Two Execution Modes**

#### **Mode 1: User-Directed Sessions** (Active Work)
- User provides instructions
- Activities execute to accomplish goals
- Metrics recorded for learning

#### **Mode 2: Boredom Activities** (Autonomous Improvement)
- Idle threshold: 5+ minutes of inactivity
- Fetch improvement opportunities from metabob backend
- Execute highest-priority activity autonomously
- Cancel if user returns

**Boredom Activities:**
- Have **prefilled instructions** guiding autonomous work
- Prioritized by **improvement gradient** (0.0-1.0, higher = more to gain)
- Examples from metabob vessel:
  - `improve-activity-template` - Fix activities with low success rates
  - `debug-failed-activity` - Investigate recent failures
  - `merge-similar-activities` - Consolidate duplicate templates
  - `create-missing-activity` - Detect patterns and create new activities
  - `optimize-impulse-system` - Improve impulse load times

---

### 3. **Foundational Vessel Pair**

**metabob-opencode** (Execution Runtime):
- **Meta-capability:** Vessel Loader
- Can install/load/run/uninstall other vessels
- Provides: LLM orchestration, filesystem, shell, activity execution
- Exposes tools: read, write, bash, activity, search_activities, impulse_create, etc.

**metabob-cli** (State/Coordination):
- **Meta-capability:** Vessel Registry
- Tracks activities, impulses, vessels in SurrealDB
- Provides: Activity management, impulse storage, learning metrics
- Exposes tools: metabob_search_codebase_issues, metabob_annotate_component, etc.

**Together:** Bootstrap platform for vessel development.

**Why:** Most vessels don't need these meta-capabilities—they have domain-specific activities.

---

### 4. **No Explicit Stages**

❌ **INCORRECT:** Vessels progress from "Stage 1: External Management" → "Stage 2: Algorithmic Discovery" → "Stage 3: Internal Decomposition"

✅ **CORRECT:** Vessels exist on a **continuous spectrum** with no predefined stages:
- Some vessels are barely decomposed (few activities, low success rates)
- Some vessels are highly decomposed (many activities, high success rates)
- Boredom system continuously improves vessels via measured outcomes
- No "graduation" event—just continuous evolution

**Rationale:** Stages imply linear progression. Reality is continuous learning and adaptation.

---

### 5. **Vessel Development Workflow**

When developing with metabob, the workflow is:

#### **Step 1: Interact with Codebase**
- Read code, understand structure
- Execute code, observe behavior
- Modify code, test changes

#### **Step 2: Decompose Codebase**
Extract conceptual structure:
- **Dataflows:** User Request → Auth → Query DB → Transform → Response
- **Intents:** "Why components exist" (design decisions, constraints)
- **Impulses:** Data + context flowing through system
- **Activities:** Structured operations (authenticate-user, query-db, etc.)
- **Validators:** Black-box tests using impulse history

#### **Step 3: Align Codebase** (Ripple Development)
Ensure **instructional state** (intents, goals) matches **functional state** (implementation):
- Change Component A to match intent
- Detect: Component B depends on A
- Validate: Does B still work with new A?
- If NO → Ripple: Update B to align with new A
- Continue rippling until all dependents align

#### **Step 4: Incorporate as Vessel**
Add integration points:
- **Lifecycle hooks:** bootstrap, activate, deactivate, shutdown
- **Tools:** MCP tools for external access (if needed)
- **Data bridges:** activity ↔ code data passing
- **Activity registry:** Register vessel's activities

---

### 6. **Managing vs Using Vessels**

#### **Managing the Codebase** (Modify Functional State)
When you have **write access** and want to change code:
```typescript
await activity({
  templateId: "add-feature-complete",  // metabob activity
  variables: { featureName: "Add roles endpoint", files: ["src/api.ts"] },
  reason: "Add role querying capability"
})
// Result: Code modified, tests added, committed
```

#### **Using the Codebase** (Execute Functional State)
When you **use the vessel** without modifying it:
```typescript
await activity({
  templateId: "authenticate-user-jwt",  // vessel activity
  variables: { auth_impulse_id: "user-request-123" },
  reason: "Authenticate incoming API request"
})
// Result: Code executed, no modification
```

**Both modes** record executions for learning.

---

### 7. **Learning & Optimization Loop**

#### **Activity Execution Recording**
Every activity execution is recorded:
```typescript
{
  activity_id: "authenticate-user-jwt",
  execution_id: "exec_xyz",
  timestamp: 1234567890,
  success: true,
  duration_ms: 45,
  cost_usd: 0.0012,
  input_impulses: ["user-request-123"],
  output_impulses: ["auth-result-456"],
  validation_passed: true
}
```

#### **Failure Detection**

**Explicit Failures** (easy):
```typescript
{ success: false, error: "JWT signature verification failed" }
```

**Silent Failures** (hard—requires heuristics):
```typescript
{
  success: true,  // ← claimed
  signals: [
    "Next activity failed immediately",
    "User sent follow-up error report",
    "Retry pattern detected (3 attempts in 30s)",
    "Output impulse missing expected fields"
  ],
  actual_success: false,
  failure_mode: "silent_partial_success"
}
```

#### **Optimization Based on Measurements**
```typescript
// Analyze metrics
const metrics = await analyzeActivityMetrics("authenticate-user-jwt")
// metrics = { success_rate: 0.95, failure_modes: { expired_token: 30 } }

// Detect improvement opportunity
if (metrics.failure_modes.expired_token > 10) {
  await suggestActivityVariant({
    optimization: "Add token expiry pre-check",
    expected_improvement: { success_rate: +0.03, avg_duration: -10 }
  })
}
```

---

## Vessel Manifest Structure

```json
{
  "vessel": {
    "id": "user-api-vessel",
    "name": "User Management API Vessel",
    "version": "2.1.0",
    "codebase": {
      "type": "local",
      "path": "./repos/user-api",
      "entrypoint": "src/server.ts"
    },
    
    "decomposition": {
      "dataflows": ["auth-flow.json", "user-query-flow.json"],
      "intents": ["intentions/auth-service.md"],
      "impulses": ["impulses/auth-*.json"],
      "activities": ["activities/authenticate-user-jwt.json", "activities/query-user-db.json"],
      "validators": ["validators/auth-validator.test.ts"]
    },
    
    "lifecycle": {
      "activate": "vessel-hooks.ts::onVesselActivate",
      "deactivate": "vessel-hooks.ts::onVesselDeactivate"
    },
    
    "integration": {
      "tools": "tools.ts::vesselTools",
      "data_bridge": "bridge.ts::activityToCode",
      "activity_registry": "activities/*.json"
    },
    
    "capabilities": {
      "can_modify": true,       // Supports "managing" (write access)
      "can_execute": true,       // Supports "using" (activity execution)
      "provides_tools": true,    // Exposes MCP tools
      "tracks_learning": true    // Records executions
    },
    
    "dependencies": {
      "vessels": ["metabob-cli", "metabob-opencode"],
      "services": [
        {"name": "postgres", "required": true},
        {"name": "redis", "required": false}
      ]
    },
    
    "learning": {
      "metrics_storage": "surrealdb",
      "impulse_history": true,
      "failure_tracking": true,
      "silent_failure_detection": true,
      
      "boredom_config": {
        "enabled": true,
        "idle_threshold_ms": 300000,
        "min_improvement_gradient": 0.3,
        "max_concurrent_boredom": 1
      }
    },
    
    "state": {
      "namespace": "user_api_vessel",
      "storage": "surrealdb"
    }
  }
}
```

---

## Boredom Activity Prefilled Instructions

Metabob vessel provides boredom activities with **prefilled instructions**:

### Example: `improve-activity-template`

```
You are improving an activity template with poor performance.

Context:
- Template: {{templateId}}
- Current success rate: {{currentSuccessRate}}
- Failure patterns: {{failurePatterns}}
- Target success rate: {{improvementGoal}}

Tasks:
1. Load template and recent failed executions
2. Analyze failure patterns using metabob_search_codebase_issues
3. Identify root causes (unclear prompts, missing validation, etc.)
4. Propose specific improvements
5. Test improvements on sample inputs
6. Update template if validation passes
7. Document changes and expected improvement

Expected outcome: Success rate improves by 20%+ points
```

**Key Insight:** Agent knows **what to improve** (metrics-driven) and **how to improve** (template instructions).

---

## Continuous Development Cycle

```
User Session (Active)
  ↓
1. Execute activities (user-directed)
  ↓
2. Record metrics
  ↓
3. User goes idle (5+ min)
  ↓
4. Boredom Manager activates
  ↓
5. Fetch improvement opportunities (high-gradient activities)
  ↓
6. Execute boredom activity (autonomous)
  ↓
7. Report results, update metrics
  ↓
8. Metrics improve → Lower gradient → Different priority
  ↓
9. User returns OR next boredom cycle
  ↓
10. Repeat (continuous improvement)
```

---

## Vessel Instantiation

**Vessel as Definition** (Package/Blueprint):
- Static code, configs, activity templates
- Stored in git repositories, container images, npm packages

**Vessel as Instantiation** (Running Process):
- Loaded into memory, tools activated
- Lifecycle hooks executed
- Activities registered in ActivityLibrary
- State namespaced per instance

**Example:**
- `metabob-opencode:1.2.3` (definition) → Running in `devbob-0` pod (instantiation)
- Instance can load other vessels dynamically (e.g., load `metabob-cli` vessel)

---

## References

- **Plugin/Vessel Architecture:** [PLUGIN_VESSEL_ARCHITECTURE.md](./PLUGIN_VESSEL_ARCHITECTURE.md)
- **Boredom System:** [BOREDOM_ACTIVITY_SYSTEM_ARCHITECTURE.md](./BOREDOM_ACTIVITY_SYSTEM_ARCHITECTURE.md)
- **Activity System:** [ACTIVITY_CENTRIC_EXECUTION_MODEL.md](./ACTIVITY_CENTRIC_EXECUTION_MODEL.md)
- **Impulse System:** [IMPULSE_ACTIVITY_ARCHITECTURE_EXPLAINED.md](./IMPULSE_ACTIVITY_ARCHITECTURE_EXPLAINED.md)
- **Vessel Quickstart:** [../guides/VESSEL_QUICKSTART.md](../guides/VESSEL_QUICKSTART.md)

---

## Anti-Patterns (Common Mistakes)

❌ **Don't:** Describe vessels as progressing through stages  
✅ **Do:** Describe vessels as continuously evolving on a spectrum

❌ **Don't:** Separate "managing" and "becoming" as distinct phases  
✅ **Do:** Describe managing (modify) and using (execute) as parallel capabilities

❌ **Don't:** Treat metabob-cli and metabob-opencode as special cases  
✅ **Do:** Recognize they're vessels that **provide vessel management functionality**

❌ **Don't:** Describe boredom as "learning to become"  
✅ **Do:** Describe boredom as "autonomous improvement via prefilled instructions"

❌ **Don't:** Use example activity names that don't exist in codebase  
✅ **Do:** Reference actual activities: create-activity, evolve-activity-self-contained, debug-activity-self-contained

---

## Summary

Vessels are **instructional state** (ideas, intents, capacities) manifested through:
- **Activities** for all behaviors (everything is an activity)
- **Boredom activities** for autonomous improvement (prefilled instructions, metrics-driven)
- **Foundational pair** (metabob-cli + metabob-opencode) providing vessel management
- **Continuous learning** via metrics, failure detection, and optimization
- **No stages** - just continuous evolution on a spectrum

This architecture enables **any codebase** to become a vessel through decomposition, integration, and measurement.
