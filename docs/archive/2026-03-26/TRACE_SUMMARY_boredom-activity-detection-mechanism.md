# Trace Analysis: Boredom Activity Detection Mechanism

**Specification**: boredom-activity-detection-mechanism  
**Date**: 2026-02-27  
**Status**: Detection infrastructure COMPLETE, Improvement workflow MISSING

## Executive Summary

The boredom activity detection mechanism is **fully implemented** for identifying struggling templates but **lacks the improvement workflow** to actually improve them. The system can detect idle time, query backend for templates with low improvement gradients, and execute activities - but there are no templates to execute.

**Key Finding**: Infrastructure is complete. Need 3 critical activity templates to enable autonomous template improvement.

## Data Flow (5 Stages)

```
1. Idle Detection (5+ min no activity)
   └─> BoredomManager.checkIdleAndExecute
   
2. Fetch Boredom Activities
   └─> metabob_fetch_boredom_activities MCP tool
   
3. Backend Filtering
   └─> GET /api/v1/learning-loop/boredom-activities
   └─> SurrealDB: WHERE improvement_gradient < 0.7
   
4. Execute Improvement
   └─> BoredomManager.executeBoredomActivity
   └─> Activity with isBoredom=true, branch='boredom-activity'
   
5. Report Results
   └─> metabob_post_activity_result
   └─> Update template_metrics
```

## Current State vs Desired State

### ✅ COMPLETE Components

| Component | File | Status |
|-----------|------|--------|
| Idle Detection | `boredom-manager.ts:156-197` | ✅ Working |
| Backend API | `learning_loop.py:336-374` | ✅ Working |
| Metrics Tracking | `template_metrics.py:217-269` | ✅ Working |
| Activity Execution | `boredom-manager.ts:250-389` | ✅ Working |
| Session Integration | `index.ts:261,415` `prompt.ts:1221` | ✅ Working |

**Improvement Gradient Formula**: `success_rate * min(1.0, executions / 10.0)`  
- Requires both success AND experience (10+ executions for full weight)
- Templates below 0.7 gradient are "struggling"

### ❌ MISSING Components

| Component | Priority | Gap |
|-----------|----------|-----|
| **improve-template.json** | 🔴 CRITICAL | No template to improve low success rate templates |
| **debug-failures.json** | 🟠 HIGH | No template to debug failure patterns |
| **optimize-performance.json** | 🟠 HIGH | No template to optimize degrading trends |
| Impulse Recommendation System | 🟡 MEDIUM | No mechanism to suggest impulse creation |
| Activity Composition Analyzer | 🟡 MEDIUM | No tool to suggest decomposition |
| LLM Reduction Dashboard | 🟢 LOW | No visibility into progress |

## Recommended Actions (Priority Order)

### 1. 🔴 CRITICAL: Create improve-template.json

**Problem**: System detects struggling templates but has no workflow to improve them.

**Template Structure**:
```json
{
  "name": "improve-template",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "fetch-template",
      "description": "Fetch template definition and execution history",
      "prompt": "Fetch template {{template_id}} from backend..."
    },
    {
      "id": "analyze-failures", 
      "description": "Group and analyze failure patterns",
      "dependencies": ["fetch-template"],
      "prompt": "Analyze failure patterns: {{failure_patterns}}..."
    },
    {
      "id": "identify-impulses",
      "description": "Identify repeated context for impulse creation",
      "dependencies": ["analyze-failures"],
      "prompt": "Find repeated context patterns that should become impulses..."
    },
    {
      "id": "suggest-refactoring",
      "description": "Suggest template refactoring",
      "dependencies": ["identify-impulses"],
      "prompt": "Suggest improvements: create impulses, decompose tasks..."
    },
    {
      "id": "track-improvement",
      "description": "Track improvement metrics",
      "dependencies": ["suggest-refactoring"],
      "prompt": "Compare metrics before/after..."
    }
  ],
  "prompt": {
    "variables": [
      {"name": "template_id", "type": "string", "required": true},
      {"name": "success_rate", "type": "number", "required": true},
      {"name": "avg_cost", "type": "number", "required": true},
      {"name": "failure_patterns", "type": "string", "required": true},
      {"name": "execution_count", "type": "number", "required": true}
    ]
  }
}
```

**Expected Variables** (from BoredomManager.executeBoredomActivity:272-280):
- `template_id`: Template to improve
- `success_rate`: Current success rate
- `avg_cost`: Average cost in USD  
- `avg_duration_ms`: Average duration
- `execution_count`: Total executions
- `failure_patterns`: JSON array of error patterns
- `performance_trends`: JSON object with trend data
- `last_execution`: JSON object with last execution metadata

### 2. 🟠 HIGH: Create debug-failures.json

**Purpose**: Templates with increasing failure patterns need debugging workflow.

**Workflow**:
1. Fetch failure history: `GET /api/v1/learning-loop/templates/{id}/failures`
2. Group by error_type, identify most frequent
3. Review task prompts for ambiguous instructions, missing context
4. Review validation rules for over-constraint
5. Suggest fixes to template definition

### 3. 🟠 HIGH: Create optimize-performance.json

**Purpose**: Templates with degrading performance trends need optimization.

**Workflow**:
1. Analyze performance trends (duration, cost, tokens over time)
2. Identify monolithic tasks (>8000 tokens, >60s)
3. Suggest decomposition into smaller units
4. Estimate parallelization opportunities
5. Track improvement

## Code Locations

**Detection & Execution**:
- `repos/metabob-opencode/packages/opencode/src/session/boredom-manager.ts` - Core logic
- `repos/metabob-opencode/packages/opencode/src/session/activity.ts:350-360` - Schema
- `repos/metabob-opencode/packages/opencode/src/tool/activity.ts:1190+` - Execution

**Backend API**:
- `repos/metabob-cli/src/metabob_cli/mcp/activity_template_tools.py:365-460` - MCP tool
- `repos/metabob-rpc-api/server/routes/learning_loop.py:336-374` - API endpoint
- `repos/metabob-rpc-api/server/db/operations/template_metrics.py:217-269` - DB operations

**Session Integration**:
- `repos/metabob-opencode/packages/opencode/src/session/index.ts:261` - startMonitoring
- `repos/metabob-opencode/packages/opencode/src/session/index.ts:415` - stopMonitoring  
- `repos/metabob-opencode/packages/opencode/src/session/prompt.ts:1221` - trackActivity

## Testing Status

**Existing Tests** ✅:
- `tests/validation-harnesses/boredom-activity-detection-mechanism-harness.ts` - Detection markers
- `test-boredom-api.py` - Backend API structure
- `test-boredom-idle-detection.ts` - Idle detection flow
- `test-session-lifecycle-boredom.ts` - Session integration

**Missing Tests** ❌:
- Test improve-template activity execution with mock metrics
- Test debug-failures activity with sample failure patterns
- Test optimize-performance activity with degrading trends

## Next Steps

1. Create `templates/infrastructure/improve-template.json` with 5-task workflow
2. Create `templates/infrastructure/debug-failures.json` 
3. Create `templates/infrastructure/optimize-performance.json`
4. Test with mock struggling template (low gradient, failure patterns)
5. Iterate based on actual improvement results

## Goal: Large LLMs → Small LLMs → No LLMs

**Vision**: Organize learned behaviors into composable units that reduce LLM dependence.

**Mechanisms**:
- **Impulses**: Reusable context (files, analysis, patterns) reduces repeated LLM queries
- **Composition**: Smaller activities composed together → less monolithic prompts
- **Learning**: Metrics track what works → more deterministic, less generative

**Missing**: Need templates that actually implement this vision by analyzing context reuse, suggesting impulse creation, and tracking LLM call reduction.

---

**Impulse ID**: `trace-boredom-activity-detection-mechanism`  
**Token Budget**: 5000  
**Format**: JSON trace with component analysis, data flow, gaps, recommendations
