# Architecture Alignment Plan - Dynamic Variant Serving

**Date**: February 12, 2026  
**Goal**: Transform activity system to support dynamic variant serving for data collection and algorithm refinement

---

## Strategic Vision

### Current State (Problematic)
- OpenCode caches templates locally
- Assumes templates are static
- Backend variants are ignored
- Legacy save() tries to persist cached templates back

### Target State (Goal)
- Backend (metabob-rpc-api) as **intelligent variant provider**
- Each activity request → Backend selects optimal variant based on:
  - Historical success/failure data
  - Current context
  - Experimentation needs (A/B testing)
- OpenCode executes variant → Reports outcome → Backend learns
- **No local caching** - Always get fresh variant from backend

### Why This Matters
```
Old Model: Templates as static procedures
          → Same template every time
          → No learning or optimization

New Model: Templates as dynamic algorithms  
          → Backend chooses variant based on data
          → Success/failure feeds back to backend
          → System learns optimal approaches
          → LLM handles edge cases, not routine tasks
```

---

## Architecture Goals

### 1. Minimize LLM Usage Cost
**Principle**: Regularize behaviors into deterministic algorithms

```
Expensive: LLM reasons through same problem every time
Cheap:     Backend provides proven algorithm, LLM handles exceptions

Example:
  Task: "Add REST endpoint"
  ❌ Old: LLM figures out all steps from scratch ($$$)
  ✅ New: Backend provides "add-rest-endpoint-v3" template (proven 85% success)
         LLM executes template + handles edge cases ($$)
```

### 2. Data-Driven Template Evolution
**Principle**: Backend learns which variants work best

```
Backend tracks:
  - add-rest-endpoint-v1: 60% success rate
  - add-rest-endpoint-v2: 75% success rate  
  - add-rest-endpoint-v3: 85% success rate ← Serve this one!

As OpenCode executes and reports outcomes:
  - Backend adjusts probabilities
  - Phases out low-performing variants
  - Promotes high-performing variants
  - Experiments with new variants
```

### 3. Context-Aware Variant Selection
**Principle**: Right template for right situation

```
Request: activity("add-feature")

Backend considers:
  - Codebase language (Python vs TypeScript)
  - Project type (REST API vs CLI tool)
  - Recent failures (avoid recently-failed variants)
  - User preferences (if specified)
  - Experimentation quota (try new variants 5% of time)

→ Returns variant optimized for THIS context
```

---

## Implementation Plan

### Phase 1: Remove Local Caching ✅ IMMEDIATE

#### Step 1.1: Disable TemplateCache
**File**: `packages/opencode/src/session/template-loader.ts`

**Changes**:
```typescript
// Step 1: Remove cache checks in load()
export async function load(id: string, options: LoadOptions = {}, sessionID?: string) {
  // REMOVE:
  // const cached = TemplateCache.get(id, options.version)
  // if (cached) return { template: cached, source: "cache" }
  
  // ALWAYS call MCP to get fresh variant:
  const template = await MetabobCLI.getActivityTemplate(id, sessionID)
  
  // DO NOT cache result
  // REMOVE: TemplateCache.put(template)
  
  return { template, source: "backend" }
}
```

**Impact**:
- Every activity request → Fresh MCP call → Backend selects variant
- Backend can serve different variants for same activity_id
- OpenCode always executes latest/best variant

#### Step 1.2: Remove TemplateCache.put() calls
**Locations to modify**:
- Line 305: After MCP load
- Line 535: After variant resolution
- Line 594: After template load
- Line 656: After save (already disabled)

**Action**: Comment out or remove all `TemplateCache.put()` calls

#### Step 1.3: Keep TemplateCache class (for now)
**Rationale**: May need for other caching (not templates)
**Action**: Leave class definition, remove usage

---

### Phase 2: Fix Template Save/Create Flow ✅ SHORT-TERM

#### Step 2.1: Find Legacy save() Caller
**Current Problem**: Unknown code calls save() after load()

**Search Strategy**:
```bash
cd repos/metabob-opencode

# Find all save() calls
rg "TemplateRepository\.save\(" packages/opencode/src --type ts -B5 -A2

# Check template-library.ts specifically
rg "registerWithMetabob|syncUnregistered" packages/opencode/src/session/template-library.ts

# Find any auto-registration hooks
rg "autoRegister|auto.*register" packages/opencode/src --type ts -i
```

**Expected Culprits**:
- `template-library.ts::syncUnregisteredToMetabob()`
- `template-library.ts::registerWithMetabob()`
- Post-load hooks in TemplateRepository

#### Step 2.2: Remove Legacy Save Caller
**Action**: Delete or disable the code calling save() after load()

**Principle**: Templates from backend should NEVER be saved back to backend

#### Step 2.3: Re-enable save() for Legitimate Uses
**Legitimate uses**:
1. **Template Creation** (activity-create template)
   - User creates NEW template via trailblazing
   - OpenCode → MCP → Backend POST /v2/activities/templates
   - Backend assigns variant_id, stores template

2. **Template Updates** (activity-evolve template)
   - Template performance data triggers evolution
   - OpenCode → MCP → Backend PUT /v2/activities/templates/{id}
   - Backend creates new variant

**Action**: 
```typescript
export async function save(template: ActivityTemplate.Schema, _backends?: Backend[]): Promise<void> {
  // Remove debug disable code
  // Re-enable actual save:
  await TemplateLoader.save(template)
  log.debug("save completed", { id: template.id })
}
```

---

### Phase 3: Implement Outcome Reporting 🔧 MEDIUM-TERM

#### Step 3.1: Add Execution Outcome Tracking
**File**: `packages/opencode/src/tool/activity.ts`

**Changes**:
```typescript
async function executeActivity() {
  const startTime = Date.now()
  let success = false
  let errorMessage = undefined
  
  try {
    // Execute activity tasks...
    success = true
  } catch (error) {
    success = false
    errorMessage = error.message
  } finally {
    // Report outcome to backend
    await MetabobCLI.reportActivityOutcome({
      activityId: template.id,
      variantId: template.variant_id,
      sessionId: sessionID,
      success,
      duration: Date.now() - startTime,
      errorMessage,
      contextUsed: gatherContext(),  // What impulses/files were accessed
    })
  }
}
```

#### Step 3.2: Add Backend Endpoint for Outcomes
**Backend** (metabob-rpc-api):
```
POST /v2/activities/executions
{
  "activity_id": "feature-impl",
  "variant_id": "feature-impl-abc123",
  "session_id": "ses_...",
  "success": true,
  "duration_ms": 15000,
  "error_message": null,
  "context": {
    "impulses_loaded": ["file1.ts", "file2.ts"],
    "tools_used": ["bash", "edit"],
    "token_count": 5000
  }
}
```

#### Step 3.3: Backend Learning Logic
**Backend** stores outcomes and adjusts probabilities:
```python
def select_variant(activity_id: str, context: dict) -> str:
    variants = get_variants(activity_id)
    
    # Score each variant based on historical data
    for variant in variants:
        success_rate = calculate_success_rate(variant.id)
        context_match = calculate_context_similarity(variant, context)
        recency = variant.last_updated
        
        variant.score = (
            success_rate * 0.6 +
            context_match * 0.3 +
            recency * 0.1
        )
    
    # 95% exploit (best variant), 5% explore (random for learning)
    if random() < 0.95:
        return max(variants, key=lambda v: v.score)
    else:
        return random.choice(variants)
```

---

### Phase 4: Activity Creation Reliability 🎯 CRITICAL

#### Problem: activity-create template must work reliably

**Current Status**: Unknown - needs testing

**Test Plan**:
```javascript
// Test 1: Create simple template
activity({
  activityId: "infrastructure-0013e379",  // activity-create
  variables: {
    template_name: "test-hello-world",
    template_description: "Test template creation",
    category: "infrastructure",
    tasks: JSON.stringify([{
      subagent: "general",
      prompt: "Echo 'Hello World'",
      validation: { type: "output_contains", value: "Hello" }
    }])
  },
  reason: "Test template creation flow"
})

// Expected: New template created in backend
// Verify: search_activities({ query: "test-hello-world" })
```

**If Fails**: Debug using same systematic approach
1. Add logging to activity-create execution
2. Trace where it fails (MCP call? Backend? Validation?)
3. Fix identified issue
4. Repeat until reliable

#### Success Criteria:
- ✅ Can create simple 1-task template
- ✅ Can create multi-task template
- ✅ Created template appears in search
- ✅ Created template can be executed
- ✅ Self-hosting works (activity-create creates activity-create-v2)

---

## Codebase Cleanup for Session Memory

### Goal: Help memory agent prepare relevant context

#### Step 1: Create Architecture Guide
**File**: `ARCHITECTURE_PRINCIPLES.md` (in workspace root)

**Content**:
```markdown
# OpenCode Activity System - Architecture Principles

## Core Ethos

1. **Backend as Single Source of Truth**
   - All templates stored in metabob-rpc-api PostgreSQL
   - OpenCode never caches templates locally
   - Every execution gets fresh variant from backend

2. **Data-Driven Template Evolution**
   - Backend tracks execution outcomes (success/failure)
   - Variant selection based on historical performance
   - System learns optimal approaches over time

3. **Minimize LLM Usage via Regularization**
   - Encode proven workflows as templates
   - LLM executes templates, handles edge cases
   - Reduce costs by avoiding repeated reasoning

4. **Dynamic Variant Serving**
   - Same activity_id → Different variants based on context
   - Backend experiments with new variants (5% explore)
   - Promotes high-performing variants (95% exploit)

## Key Flows

### Activity Execution (Read Path)
```
User → activity(id) 
  → OpenCode → MCP → Backend → SELECT VARIANT
  → Return variant → OpenCode executes
  → Report outcome → Backend learns
```

### Template Creation (Write Path)
```
User → activity("activity-create", variables)
  → OpenCode executes creation tasks
  → MCP → Backend POST → Create template
  → Assign variant_id → Return success
```

## Anti-Patterns to Avoid

❌ Caching templates in OpenCode (defeats variant serving)
❌ Saving templates loaded from backend (causes duplicates)
❌ Static template selection (prevents learning)
❌ Using LLM for routine tasks (expensive)

## Files to Understand

- `template-loader.ts` - Load templates (NO CACHE)
- `activity.ts` - Execute activities, report outcomes
- `metabob.ts` - MCP communication layer
- `activity-template-repository.ts` - CRUD operations
```

#### Step 2: Clean Up Legacy Comments
**Action**: Remove references to old architecture
```bash
cd repos/metabob-opencode

# Find legacy comments
rg "local file|file.*storage|sync.*backend" packages/opencode/src --type ts -i

# Remove or update to reflect new architecture
```

#### Step 3: Add Inline Documentation
**Key functions need clear purpose statements**:

```typescript
/**
 * Load activity template from backend (via MCP).
 * 
 * IMPORTANT: Does NOT cache. Each call returns a fresh variant selected
 * by the backend based on historical performance and current context.
 * 
 * Architecture: Backend is single source of truth, dynamically serves
 * optimal variants for data-driven template evolution.
 */
export async function load(id: string, sessionID?: string): Promise<LoadResult>
```

#### Step 4: Create Session Memory Hints
**File**: `.opencode/session-memory-guide.md`

**Content**:
```markdown
# Session Memory Context Guide

## For Memory Agent: What to Load

When preparing context for activity-related tasks, prioritize:

1. **Architecture principles** (ARCHITECTURE_PRINCIPLES.md)
   - Backend as source of truth
   - No local caching
   - Dynamic variant serving

2. **Current activity status** (ACTIVITY_SYSTEM_NOW_WORKING.md)
   - What's working (execution, search)
   - What's not (template creation needs testing)

3. **Recent debugging** (DATA_FLOW_ANALYSIS_FEB12.md)
   - Lessons learned from investigations
   - Common pitfalls to avoid

## Key Ethos to Reinforce

- Minimize LLM cost via regularization
- Let data guide template evolution
- Report outcomes for backend learning
- Test activity-create reliability

## Files to Exclude

- Old architecture docs (pre-Feb 12)
- Deprecated sync logic references
- Local file storage comments
```

---

## Short-Term Action Items (Priority Order)

### 1. Remove Caching (Highest Priority)
- [ ] Comment out TemplateCache.get() checks in load()
- [ ] Remove TemplateCache.put() calls
- [ ] Test activity execution without cache
- [ ] Verify fresh MCP call on every execution

### 2. Fix Save Flow
- [ ] Find legacy code calling save() after load()
- [ ] Remove/disable auto-registration logic
- [ ] Re-enable save() for legitimate uses
- [ ] Test that templates can be created

### 3. Test Activity Creation
- [ ] Execute activity-create template with simple test case
- [ ] Debug any failures systematically
- [ ] Verify created template appears in backend
- [ ] Verify created template can be executed
- [ ] Document any issues found

### 4. Commit Clean Code
- [ ] Remove debug logging (keep as comments)
- [ ] Update inline documentation
- [ ] Create ARCHITECTURE_PRINCIPLES.md
- [ ] Commit with clear message explaining changes

### 5. Cleanup for Session Memory
- [ ] Create session-memory-guide.md
- [ ] Remove outdated architecture references
- [ ] Add clear comments explaining ethos
- [ ] Test that memory agent loads relevant context

---

## Success Metrics

### Technical
- ✅ No TemplateCache usage in execution path
- ✅ Every activity call → Fresh MCP call → Backend variant selection
- ✅ save() only called for NEW template creation
- ✅ activity-create template creates templates reliably
- ✅ No 500 errors from duplicate creation attempts

### Architectural
- ✅ Backend proven as single source of truth
- ✅ Variant serving functional (different variants for same ID)
- ✅ Outcome reporting in place
- ✅ Documentation reflects current architecture

### Strategic
- ✅ Foundation for data-driven evolution ready
- ✅ Cost minimization through regularization possible
- ✅ System can learn from execution outcomes
- ✅ Clear path to A/B testing variants

---

## Timeline

**Immediate** (Today):
1. Remove caching
2. Find/remove legacy save() caller
3. Test activity execution

**Short-term** (This Week):
1. Test activity-create reliability
2. Commit clean code
3. Update documentation
4. Cleanup for session memory

**Medium-term** (Next Week):
1. Implement outcome reporting
2. Backend learning logic
3. Variant A/B testing
4. Performance analytics

---

**Status**: Plan complete, ready to execute ✅
