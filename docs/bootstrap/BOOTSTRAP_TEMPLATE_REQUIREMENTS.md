# Bootstrap Template Requirements

**Date**: 2026-02-20  
**Purpose**: Define minimum set of activity templates required for metabob-proto initialization  
**Status**: In Progress

---

## Overview

This document outlines the minimum required set of activity templates that must be stored in `metabob-proto/activities/bootstrap/` to initialize SurrealDB with starter templates when deploying devbob.

### Goal: Instructional → Functional State Bridge

We're establishing templates that bridge the gap between instructional state (tokens in context) and functional state (codebase mutations). By measuring execution sequences and outcomes, we learn what context is needed for LLMs to choose correct functional transitions.

---

## Current State Analysis

### Bootstrap Templates in metabob-proto
Located in: `repos/metabob-proto/activities/bootstrap/`

| Template | Status | Success Rate | Notes |
|----------|--------|--------------|-------|
| `hello-world-minimal.json` | ✅ Working | 100% (2 executions) | Minimal test, verified working |
| `create-activity-self-contained.json` | ✅ Fixed | NEW (0 executions) | Recently renamed and improved |
| `debug-activity-self-contained.json` | ✅ Fixed | NEW (0 executions) | MCP compliant, 89% code reduction |
| `evolve-activity-self-contained.json` | ⚠️ Untested | NEW (0 executions) | Needs validation |
| `manage-session-memory.json` | ⚠️ Untested | NEW (0 executions) | Complex, 5 tasks |

### Missing Critical Templates

According to `metabob-proto/README.md`, we need:

**Core Development Templates**:
- ❌ `add-feature-complete.json` - NOT IN BOOTSTRAP
- ❌ `fix-bug-complete.json` - NOT IN BOOTSTRAP (exists locally but 0% success)
- ❌ `refactor-with-tests.json` - NOT IN BOOTSTRAP

**Meta-Activities**:
- ✅ `create-activity-self-contained.json` (renamed from activity-create.json)
- ✅ `debug-activity-self-contained.json` (renamed from activity-debug.json)
- ✅ `evolve-activity-self-contained.json` (renamed from activity-evolve.json)

---

## Minimum Required Set

### Tier 1: Essential Bootstrap (Must Have)
These enable the system to run and self-improve:

1. **hello-world-minimal**
   - Purpose: Smoke test, validation
   - Status: ✅ Working (100% success)
   - Keep as-is

2. **create-activity-self-contained**
   - Purpose: Create new activity templates
   - Status: ✅ Fixed, needs testing
   - Required for: System self-improvement

3. **debug-activity-self-contained**
   - Purpose: Debug failed activity executions
   - Status: ✅ Fixed (MCP compliant)
   - Required for: Troubleshooting workflows

4. **evolve-activity-self-contained**
   - Purpose: Improve existing templates
   - Status: ⚠️ Needs validation
   - Required for: Template optimization

### Tier 2: Core Development (High Priority)
These enable typical development workflows:

5. **add-feature-complete**
   - Purpose: Implement new features with tests
   - Status: ❌ Missing from bootstrap
   - Required for: Feature development
   - Action: Create based on opencode-dev/add-rest-endpoint pattern

6. **fix-bug-complete**
   - Purpose: Comprehensive bug fixing workflow
   - Status: ❌ Exists locally but 0% success, not in bootstrap
   - Required for: Bug fixes
   - Action: Debug why failing, move to bootstrap when working

7. **refactor-with-tests**
   - Purpose: Code refactoring with test preservation
   - Status: ❌ Missing
   - Required for: Code cleanup
   - Action: Create new template

### Tier 3: Advanced (Optional for v1)
These enable advanced scenarios:

8. **manage-session-memory**
   - Purpose: Pre-turn memory management
   - Status: ⚠️ Complex (5 tasks), untested
   - Required for: Context optimization
   - Action: Validate or simplify

---

## Recent Fixes Applied

### 1. Schema Compliance ✅
- **Fix**: Changed `task_id` → `id` in all templates
- **Commit**: `67369f1`
- **Impact**: Enables template parsing

### 2. Variable Resolution ✅
- **Fix**: Removed Handlebars filters `{{var | kebabCase}}`
- **Commit**: `4a0becf`
- **Impact**: Enables variable interpolation

### 3. Architecture Compliance ✅
- **Fix**: Rewrote debug-activity to use MCP tools
- **Commit**: `50cf1c7`
- **Impact**: 89% code reduction, follows MCP Gateway pattern

### 4. Naming Clarity ✅
- **Fix**: Renamed `create-activity-self-contained` → `create-activity`
- **Commit**: `b497925`
- **Impact**: Intent-based naming

---

## Action Plan

### Phase 1: Validate Existing Templates (Immediate)

1. **Test hello-world-minimal**
   ```bash
   # Verify it still works
   activity({
     templateId: "hello-world-minimal",
     variables: { testId: "bootstrap-test", name: "Bootstrap" },
     reason: "Validate bootstrap template execution"
   })
   ```

2. **Test create-activity-self-contained**
   ```bash
   # Create a simple test template
   activity({
     templateId: "create-activity-self-contained",
     variables: {
       templateName: "Test Simple Workflow",
       templateDescription: "Test template creation",
       category: "infrastructure"
     },
     reason: "Validate create-activity works"
   })
   ```

3. **Test debug-activity-self-contained**
   ```bash
   # Debug a failed execution
   activity({
     templateId: "debug-activity-self-contained",
     variables: { executionId: "<some-failed-execution-id>" },
     reason: "Validate debug-activity works"
   })
   ```

### Phase 2: Create Missing Core Templates (High Priority)

4. **Create add-feature-complete.json**
   - Base on: `opencode-dev/add-rest-endpoint.json`
   - Generalize for: Any feature type
   - Tasks: Plan → Implement → Test → Commit → Annotate
   - Validation: Tests pass, no HIGH severity metabob issues

5. **Fix or Replace fix-bug-complete.json**
   - Current: 0% success rate (5 executions, 4 tasks)
   - Options:
     - A. Debug why it's failing
     - B. Simplify (reduce to 2-3 tasks)
     - C. Create from scratch based on working pattern
   - Required: >70% success rate before promoting to bootstrap

6. **Create refactor-with-tests.json**
   - Purpose: Safe refactoring with test preservation
   - Tasks: Analyze → Refactor → Run tests → Fix failures → Commit
   - Validation: All existing tests pass

### Phase 3: Update metabob-proto Structure (Medium Priority)

7. **Organize templates in metabob-proto**
   ```
   metabob-proto/activities/bootstrap/
   ├── hello-world-minimal.json          # Tier 1: Smoke test
   ├── create-activity-self-contained.json  # Tier 1: Meta
   ├── debug-activity-self-contained.json   # Tier 1: Meta
   ├── evolve-activity-self-contained.json  # Tier 1: Meta
   ├── add-feature-complete.json         # Tier 2: Core dev
   ├── fix-bug-complete.json             # Tier 2: Core dev
   ├── refactor-with-tests.json          # Tier 2: Core dev
   └── manage-session-memory.json        # Tier 3: Advanced
   ```

8. **Verify seed_activities.py**
   - Confirm it loads from `activities/bootstrap/`
   - Test seeding locally
   - Verify templates appear in `search_activities()`

### Phase 4: Integration Testing (Final)

9. **End-to-end validation**
   - Fresh SurrealDB instance
   - Run `seed_activities.py`
   - Verify all 7-8 templates load
   - Test each template with simple execution
   - Measure success rates

10. **Document patterns and learnings**
    - What context requirements work best?
    - What task granularity is optimal?
    - What validation patterns catch errors?

---

## Success Metrics

### Template Quality
- ✅ Schema compliant (variant_id, activity_id, tasks[].id)
- ✅ MCP architecture compliant (no direct API calls)
- ✅ Clear, focused tasks (2-4 tasks optimal, 5-7 max)
- ✅ Proper validation (required patterns, forbidden patterns)
- ✅ No hardcoded assumptions (paths, URLs, ports)

### Execution Quality
- 🎯 Target: ≥80% success rate per template
- 🎯 Target: <$0.50 average cost per execution
- 🎯 Target: <10 minutes average duration

### System Completeness
- ✅ Tier 1 templates: 5/5 working
- ⏳ Tier 2 templates: 0/3 in bootstrap
- ⏳ Tier 3 templates: 0/1 validated

---

## Template Design Principles

### What Makes a Good Bootstrap Template

1. **Self-Contained**
   - No dependencies on specific project structure
   - No git state assumptions
   - Works in /tmp or any directory

2. **Focused Tasks**
   - 2-3 tasks ideal (linear workflow)
   - 4-5 tasks acceptable (some parallelism)
   - 6-7 tasks maximum (complex workflows only)

3. **MCP Compliant**
   - Use MCP tools for backend access
   - Never direct API calls (curl, httpx, etc.)
   - Let MCP handle auth and abstraction

4. **Clear Validation**
   - Required patterns: What MUST appear in output
   - Forbidden patterns: What MUST NOT appear
   - Commands: Concrete tests (npm test, typecheck, etc.)

5. **Instructional Clarity**
   - Prompts explain "why" not just "what"
   - Examples show correct patterns
   - Variables are well-documented

---

## Next Steps

### Immediate (Today)
1. ✅ Document current state (this file)
2. ⏳ Test hello-world-minimal (verify working)
3. ⏳ Test create-activity-self-contained (recent fixes)
4. ⏳ Test debug-activity-self-contained (MCP compliance)

### Short-term (This Week)
5. ⏳ Create add-feature-complete.json
6. ⏳ Fix or replace fix-bug-complete.json
7. ⏳ Create refactor-with-tests.json
8. ⏳ Seed and test all templates

### Long-term (Ongoing)
9. ⏳ Measure success rates
10. ⏳ Evolve templates based on learnings
11. ⏳ Document instructional → functional patterns

---

## Key Learning Objectives

**What we're learning by building these templates**:

1. **Context Requirements**
   - What files/impulses are truly needed?
   - How much context is optimal vs. excessive?
   - What types of context (metabob, files, history) matter most?

2. **Task Granularity**
   - Are 2-task templates too coarse?
   - Are 7-task templates too fine?
   - Where's the sweet spot for different workflow types?

3. **Validation Patterns**
   - What forbidden patterns catch the most issues?
   - What required patterns ensure correctness?
   - What commands provide best verification?

4. **Functional State Transitions**
   - What sequence of operations is most reliable?
   - What are common failure modes?
   - How do we measure and learn from outcomes?

**These learnings feed back into template evolution** - the system becomes itself by observing its own execution patterns.

---

## Conclusion

We need **7-8 well-functioning bootstrap templates** to initialize devbob:

**Tier 1 (Meta-capabilities)**: 4 templates
- hello-world-minimal ✅
- create-activity-self-contained ⚠️
- debug-activity-self-contained ⚠️
- evolve-activity-self-contained ⚠️

**Tier 2 (Core development)**: 3 templates
- add-feature-complete ❌
- fix-bug-complete ❌
- refactor-with-tests ❌

**Current Status**: 1/7 confirmed working, 3/7 recently fixed but untested, 3/7 missing

**Next Action**: Test the 4 Tier 1 templates, then create the 3 Tier 2 templates.

