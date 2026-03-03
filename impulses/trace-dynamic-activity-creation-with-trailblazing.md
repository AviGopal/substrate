# Trace Analysis: Dynamic Activity Creation with Trailblazing

## Specification

**Name**: dynamic-activity-creation-with-trailblazing

**Goal**: Enable create-activity, evolve-activity, and debug-activity templates to build tasks dynamically turn-by-turn using trailblazing, with intelligent context injection via lifecycle hooks and memory prediction.

**User Intent**: Activity templates (create-activity, evolve-activity, debug-activity) should use trailblazing to dynamically build tasks turn-by-turn, leveraging lifecycle hooks to inject similar activities as impulses and memory hooks to predict needed context, always invoking the LLM during execution.

---

## Current State Analysis

### Infrastructure Components

#### 1. **Activity Tool Executor** (`activity.ts:1129-1135`)
- **Current**: Executes activities with optional trailblazing via parameter. Default: OFF.
- **Gap**: No special handling for meta-templates (create/evolve/debug-activity)
- **Needed**: Auto-enable trailblazing for meta-templates, inject similar activities as impulses

#### 2. **Trailblazing Executor** (`trailblazing-executor.ts:58-361`)
- **Current**: Handles failure recovery with AI-generated prompts
- **Gap**: Only reactive (failure recovery), not proactive (task generation)
- **Needed**: Turn-by-turn task injection, allow LLM to propose new tasks dynamically

#### 3. **Lifecycle Hooks** (`turn-lifecycle-hooks.ts:20-531`)
- **Current**: Pre-turn hooks for memory management (priority 10), activity recommendations (priority 15), metabob context (priority 20)
- **Gap**: No activity-specific context injection hook
- **Needed**: New hook 'activity-context-injection' at priority 5 (before memory management)

#### 4. **Turn Lifecycle System** (`turn-lifecycle.ts`)
- **Current**: Supports pre-turn and post-turn hooks around main agent execution
- **Gap**: No pre-activity hook phase (activity-specific lifecycle events)
- **Needed**: registerActivityHook() method for activity-specific events

#### 5. **Session Memory Agent** (`memory-agent.ts:1-100`)
- **Current**: Creates impulses for files, metabob issues, history, memos, bash output
- **Gap**: No activityExecution impulse type, no similarity search for activities
- **Needed**: Add activityExecution impulse type, query backend for similar executions

#### 6. **Template Service Client** (`template-service-client.ts`)
- **Current**: searchTemplates() for semantic template search
- **Gap**: No API for querying similar activity executions (only template definitions)
- **Needed**: searchSimilarActivities(templateId, variables) → execution history

#### 7. **Impulse Resolver** (`impulse-resolver.ts`)
- **Current**: Resolves file, metabobIssue, activityOutput, bashOutput, memo, custom pointers
- **Gap**: No activityExecution pointer resolution
- **Needed**: Add case for activityExecution: fetch from API and format as impulse

---

## Template Analysis

### Create Activity Template (`create-activity-self-contained.json`)
- **Current**: Static 4-task workflow, no trailblazing, no impulse refs
- **Needed**: 
  - Add `trailblazing: {enabled: true, maxRecoveryAttempts: 3}`
  - Add `impulse_refs: ['similar-create-activities']`
  - Allow dynamic task addition if design insufficient

### Evolve Activity Template (`evolve-activity-self-contained.json`)
- **Current**: Static 4-task workflow, no trailblazing, no parent context
- **Needed**:
  - Add `trailblazing: {enabled: true, maxRecoveryAttempts: 3}`
  - Add `impulse_refs: ['parent-activity', 'similar-evolutions']`
  - Load parent activity execution history

### Debug Activity Template (`debug-activity-self-contained.json`)
- **Current**: Static 2-task workflow, no trailblazing, no error patterns
- **Needed**:
  - Add `trailblazing: {enabled: true, maxRecoveryAttempts: 3}`
  - Add `impulse_refs: ['similar-errors', 'successful-fixes']`
  - Allow dynamic diagnostic tasks

---

## Data Flow (Desired State)

```
1. User invokes create-activity/evolve-activity/debug-activity
   ↓
2. Activity tool detects meta-template (isMetaTemplate check)
   ↓
3. Lifecycle hook 'activity-context-injection' fires (priority 5)
   ↓
4. Hook queries: searchSimilarActivities(templateId, variables)
   ↓
5. Backend returns: similar executions + outcomes + patterns
   ↓
6. Hook creates impulses:
   - similar-executions (past activity runs)
   - successful-patterns (what worked)
   - common-pitfalls (what failed)
   ↓
7. Memory agent (priority 10) predicts context from impulses
   ↓
8. Activity executor auto-enables trailblazing for meta-templates
   ↓
9. Trailblazing executor injects impulses into task prompts
   ↓
10. LLM executes tasks with historical context
    ↓
11. LLM can propose new tasks via continuation prompts
    ↓
12. Activity completes, stores execution for future similarity search
```

---

## Implementation Plan

### Phase 1: Infrastructure (Foundation)
1. Add `activityExecution` impulse type to `memory-agent.ts`
2. Add `activityExecution` pointer resolution to `impulse-resolver.ts`
3. Add `searchSimilarActivities()` to `template-service-client.ts`
4. Add `isMetaTemplate()` utility to `activity-template.ts`

### Phase 2: Lifecycle Hooks
1. Register `activity-context-injection` hook in `turn-lifecycle-hooks.ts` (priority 5)
2. Hook queries `searchSimilarActivities` when meta-template detected
3. Hook creates impulses for similar executions
4. Hook injects impulses into activity context

### Phase 3: Trailblazing
1. Add auto-enable logic for meta-templates in `activity.ts`
2. Update `trailblazing-executor.ts` to support task continuation
3. Allow LLM to propose new tasks via continuation prompts
4. Store task proposals in activity execution log

### Phase 4: Templates
1. Update `create-activity-self-contained.json`: add trailblazing + impulse_refs
2. Update `evolve-activity-self-contained.json`: add trailblazing + impulse_refs
3. Update `debug-activity-self-contained.json`: add trailblazing + impulse_refs
4. Test each template with trailblazing enabled

### Phase 5: Backend API (metabob-rpc-api)
1. Implement `POST /v2/activities/search-similar` endpoint
2. Add similarity scoring: template + variables + outcomes
3. Return execution history with patterns and recommendations
4. Store execution outcomes for learning loop

---

## Expected Behavior

### Create Activity
1. Trailblazing auto-enabled
2. Similar create-activity executions loaded as impulses
3. LLM sees successful patterns and common pitfalls
4. Can add tasks dynamically if template design requires more steps
5. Execution stored for future similarity search

### Evolve Activity
1. Trailblazing auto-enabled
2. Parent activity execution history loaded
3. Similar evolution patterns loaded as impulses
4. LLM sees what improvements worked before
5. Can add validation tasks if needed
6. Learns from past evolution outcomes

### Debug Activity
1. Trailblazing auto-enabled
2. Similar error patterns loaded as impulses
3. Successful fix patterns loaded
4. LLM can add diagnostic tasks dynamically
5. Learns from successful debugging workflows

---

## Architectural Separation

### metabob-opencode (Execution Engine)
✅ **Owns**:
- Activity execution (trailblazing-executor.ts)
- Lifecycle hooks (turn-lifecycle-hooks.ts)
- Impulse resolution (impulse-resolver.ts)
- Memory prediction (memory-agent.ts)
- Template loading/execution (activity.ts)

❌ **Does NOT touch**:
- Template storage (metabob-cli)
- Backend API endpoints (metabob-rpc-api)
- Metrics calculation (metabob-rpc-api)

### metabob-cli (Template Storage)
✅ **Owns**:
- Template storage (activity-template-repository.ts)
- Template registration (register_activity_template tool)
- Template search (template-service-client.ts)
- Activity execution history query

❌ **Does NOT touch**:
- Execution engine logic (metabob-opencode)
- Lifecycle hooks (metabob-opencode)

### metabob-rpc-api (Backend Services)
✅ **Owns**:
- Similar activity search endpoint
- Execution history storage
- Pattern extraction from executions
- Thompson sampling for template selection

❌ **Does NOT touch**:
- Execution logic (metabob-opencode)
- Template definitions (metabob-cli)

---

## Risks & Mitigations

1. **Risk**: Impulse token budget increases significantly with similar activities
   - **Mitigation**: Limit to top 3 most relevant executions

2. **Risk**: Trailblazing cost increases
   - **Mitigation**: Conservative cost limits for meta-templates ($1 per task, $5 total)

3. **Risk**: Dynamic task creation creates infinite loops
   - **Mitigation**: Hard cap at 10 tasks per activity

4. **Risk**: Similar activity search is slow
   - **Mitigation**: Index executions by template + variables

---

## Validation Criteria

✅ **Success Indicators**:
1. create-activity executes with trailblazing enabled by default
2. Similar create-activity executions appear in impulses section
3. LLM can propose new tasks mid-execution
4. Activity execution history is queryable via searchSimilarActivities
5. Memory agent predicts needed context for meta-templates
6. Lifecycle hook 'activity-context-injection' fires before task execution

---

## JSON Summary

```json
{
  "specification": "dynamic-activity-creation-with-trailblazing",
  "status": "traced",
  "components_identified": 10,
  "phases": 5,
  "architectural_compliance": "enforced",
  "next_step": "enforcement (implement infrastructure)"
}
```
