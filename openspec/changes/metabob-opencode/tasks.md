# OpenCode ↔ MiniBob Integration - Implementation Tasks

**Status:** Draft
**Created:** 2026-03-23
**Updated:** 2026-03-23

---

## Overview

**Key Insight:** OpenCode changes are MINIMAL (~100 LOC). Most work is backend intelligence (~500 LOC).

**Total Duration:** 3-4 weeks (15-20 work days)

**LOC Breakdown:**
- OpenCode: ~100 LOC (observer + skill + client)
- Backend: ~500 LOC (endpoints + intelligence)

**Reference:** [design.md](./design.md) for architecture details.

---

## Phase 1: OpenCode Integration (Week 1)

### Task 1.1: Implement Observer (~40 LOC) ❌

**Description:** Watch Bus events, forward to backend (NO processing, NO intelligence).

**File:** `packages/opencode/src/metabob/observer.ts`

**Subtasks:**
- [ ] Subscribe to `Session.Updated`, `Session.Diff` events
- [ ] Send raw events to `backend.observe_session()`
- [ ] Async/non-blocking event handling
- [ ] Graceful error handling (never crash OpenCode)

**Acceptance Criteria:**
- Events forwarded to backend
- No processing in OpenCode
- No crashes when backend offline
- < 5ms overhead per event

**Dependencies:** None

**Reference:** [design.md](./design.md) - Observer section

---

### Task 1.2: Implement Static Skill (~40 LOC) ❌

**Description:** ONE skill `/minibob` that calls backend for everything.

**File:** `packages/opencode/src/metabob/index.ts`

**Subtasks:**
- [ ] Register `/minibob` skill
- [ ] Gather session context (messages, files, directory)
- [ ] Call `backend.minibob_help({ message, context })`
- [ ] Display backend response (markdown message)
- [ ] Handle user confirmation ("yes" → `backend.execute_template()`)

**Acceptance Criteria:**
- Skill invokable with `/minibob <message>`
- Backend handles ALL intelligence
- User sees formatted response
- Confirmation triggers execution

**Dependencies:** None

**Reference:** [design.md](./design.md) - Static Skill section

---

### Task 1.3: Implement Backend Client (~20 LOC) ❌

**Description:** Thin MCP wrapper with error handling.

**File:** `packages/opencode/src/metabob/backend-client.ts`

**Subtasks:**
- [ ] Wrap `@metabob/minibob` MCPClient
- [ ] Implement `call(method, params)` with error handling
- [ ] Graceful degradation when backend offline
- [ ] Client-side caching (5-minute TTL)

**Acceptance Criteria:**
- Can call backend MCP endpoints
- Works offline (fallback responses)
- Caching reduces redundant calls

**Dependencies:** None

**Reference:** [design.md](./design.md) - Backend Client section

---

### Task 1.4: OpenCode Integration Test ❌

**Description:** Verify OpenCode components work end-to-end.

**Subtasks:**
- [ ] Test skill registration
- [ ] Test backend unavailable handling
- [ ] Test event forwarding
- [ ] Measure performance overhead (< 5% target)

**Acceptance Criteria:**
- Integration initializes without errors
- Graceful degradation works
- Performance acceptable

**Dependencies:** Tasks 1.1-1.3

---

## Phase 2: Backend Intelligence (Week 2-3)

### Task 2.1: Implement `minibob_help()` Endpoint (~100 LOC) ⚠️

**Description:** Main entry point - intent detection, Thompson Sampling, response formatting.

**Location:** `repos/metabob-activity-api/src/routes/minibob.ts` (NEW FILE)

**Subtasks:**
- [ ] Parse user intent from message + context
- [ ] Call Thompson Sampling for recommendations
- [ ] Format response as user-friendly markdown
- [ ] Handle template/goal-seeking/improvisation modes
- [ ] Return action hints for skill

**Acceptance Criteria:**
- Intent extracted from session context
- Thompson Sampling returns ranked recommendations
- Response formatted for user display
- All three modes supported

**Dependencies:** Backend exists

**Reference:** [design.md](./design.md) - `minibob_help()` section

---

### Task 2.2: Implement `execute_template()` Endpoint (~80 LOC) ⚠️

**Description:** Execute activity template via MiniBob ActivityExecutor.

**Location:** `repos/metabob-activity-api/src/routes/minibob.ts`

**Subtasks:**
- [ ] Load template from SurrealDB
- [ ] Execute via `ActivityExecutor` (delegates tools to OpenCode)
- [ ] Update Thompson Sampling on completion
- [ ] Return formatted result
- [ ] Store execution trace

**Acceptance Criteria:**
- Templates execute successfully
- Tool calls delegated back to OpenCode
- Thompson Sampling updated
- Traces stored

**Dependencies:** Task 2.1, existing ActivityExecutor

**Reference:** [design.md](./design.md) - Template Execution section

---

### Task 2.3: Implement `execute_goal()` Endpoint (~80 LOC) ⚠️

**Description:** Goal-seeking mode - adaptive execution with LLM guidance.

**Location:** `repos/metabob-activity-api/src/routes/minibob.ts`

**Subtasks:**
- [ ] Find similar successful sessions (vector search)
- [ ] Synthesize approach from similar traces
- [ ] Extract impulses (relevant code, logs, etc.)
- [ ] Execute with LLM + impulses
- [ ] Store trace for future recommendations

**Acceptance Criteria:**
- Similar goals found via similarity search
- Approach synthesized from patterns
- Impulses extracted and loaded
- Execution adapts based on feedback

**Dependencies:** Task 2.1

**Reference:** [specs/recommendation.md](./specs/recommendation.md)

---

### Task 2.4: Implement `observe_session()` Endpoint (~60 LOC) ⚠️

**Description:** Receive session events from OpenCode, store for learning.

**Location:** `repos/metabob-activity-api/src/routes/minibob.ts`

**Subtasks:**
- [ ] Store raw session events in SurrealDB
- [ ] On session complete, convert to trace
- [ ] Update Thompson Sampling from trace
- [ ] Consider template extraction (ribosome)

**Acceptance Criteria:**
- Raw events stored
- Traces created on completion
- Thompson Sampling updates
- Pattern extraction considered

**Dependencies:** None

**Reference:** [design.md](./design.md) - Session Observer section

---

### Task 2.5: Implement Trace Converter (~100 LOC) ⚠️

**Description:** Convert OpenCode session events → MiniBob ActivityExecutionTrace.

**Location:** `repos/metabob-activity-api/src/services/trace-converter.ts` (NEW FILE)

**Subtasks:**
- [ ] Extract tool calls from session events
- [ ] Convert tool calls → tasks
- [ ] Build state transitions from diffs
- [ ] Infer category from session content
- [ ] Calculate cost, duration, tokens

**Acceptance Criteria:**
- Sessions convert to valid traces
- Tool sequences preserved
- State transitions accurate
- Category inference works

**Dependencies:** Task 2.4

**Reference:** [specs/trace-converter.md](./specs/trace-converter.md)

---

### Task 2.6: Implement Ribosome Extractor (~80 LOC) ⚠️

**Description:** Detect successful patterns, extract as templates.

**Location:** `repos/metabob-activity-api/src/services/ribosome.ts` (NEW FILE)

**Subtasks:**
- [ ] Check eligibility (success, multi-task, non-duplicate)
- [ ] Count similar traces (recurrence check: 3+)
- [ ] Extract template from trace
- [ ] Synthesize readable name
- [ ] Store template in SurrealDB

**Acceptance Criteria:**
- Templates extracted from patterns
- Duplicates avoided (similarity check)
- Recurrence threshold enforced
- Templates usable for recommendations

**Dependencies:** Task 2.5

**Reference:** [specs/ribosome.md](./specs/ribosome.md)

---

### Task 2.7: Backend Integration Tests ⚠️

**Description:** Verify backend endpoints work end-to-end.

**Subtasks:**
- [ ] Test `minibob_help()` with different intents
- [ ] Test `execute_template()` with sample template
- [ ] Test `execute_goal()` with goal-seeking
- [ ] Test `observe_session()` with session events
- [ ] Test trace conversion accuracy
- [ ] Test ribosome extraction

**Acceptance Criteria:**
- All endpoints functional
- Traces convert correctly
- Templates extract as expected
- Thompson Sampling updates

**Dependencies:** Tasks 2.1-2.6

---

## Phase 3: Testing & Polish (Week 4)

### Task 3.1: End-to-End Integration Test ❌

**Description:** Verify full flow: OpenCode → backend → learning loop.

**Subtasks:**
- [ ] Session 1: User invokes `/minibob add auth`
- [ ] Verify backend returns recommendation
- [ ] User confirms execution
- [ ] Verify template executes
- [ ] Verify trace stored
- [ ] Session 2-3: Repeat pattern
- [ ] Verify template extracted
- [ ] Session 4: Same goal → template recommended

**Acceptance Criteria:**
- Full loop works end-to-end
- Pattern recognition functional
- Extraction happens after 3 occurrences
- Extracted template recommended

**Dependencies:** All Phase 1-2 tasks

---

### Task 3.2: Performance Validation ❌

**Description:** Ensure < 5% overhead on OpenCode execution.

**Subtasks:**
- [ ] Measure observer event handling time
- [ ] Measure backend call latency
- [ ] Measure trace conversion time
- [ ] Profile memory usage
- [ ] Optimize bottlenecks if needed

**Acceptance Criteria:**
- Observer: < 5ms per event
- Backend calls: < 200ms
- Trace conversion: < 100ms
- Total overhead: < 5%

**Dependencies:** Task 3.1

---

### Task 3.3: Error Handling & Recovery ❌

**Description:** Graceful degradation and error recovery.

**Subtasks:**
- [ ] Test backend offline scenarios
- [ ] Test network failures
- [ ] Test malformed responses
- [ ] Verify OpenCode never crashes
- [ ] Verify error messages clear

**Acceptance Criteria:**
- No crashes when backend unavailable
- Graceful fallback messages
- Errors logged appropriately
- User experience smooth

**Dependencies:** Task 3.1

---

### Task 3.4: Documentation ❌

**Description:** User and developer documentation.

**Subtasks:**
- [ ] Update OpenCode README (integration section)
- [ ] Document `/minibob` skill usage
- [ ] Document configuration options
- [ ] Add troubleshooting guide
- [ ] Create usage examples
- [ ] Update CHANGELOG

**Acceptance Criteria:**
- Clear setup instructions
- Usage examples provided
- Troubleshooting guide helpful
- Architecture documented

**Dependencies:** All tasks

---

### Task 3.5: Deployment & CI ❌

**Description:** Finalize deployment and CI/CD integration.

**Subtasks:**
- [ ] Add integration tests to CI
- [ ] Test on clean install
- [ ] Document deployment steps
- [ ] Set sensible defaults
- [ ] Verify easy to enable/disable

**Acceptance Criteria:**
- CI runs integration tests
- Clean install works
- Deployment documented
- Easy to configure

**Dependencies:** All tasks

---

## Summary

**Total Duration:** 3-4 weeks (15-20 work days)

**LOC Distribution:**
- OpenCode: ~100 LOC total (minimal changes!)
- Backend: ~500 LOC new endpoints
- Tests: ~200 LOC

**Critical Path:**
1. Phase 1 (Week 1): OpenCode integration - observer, skill, client
2. Phase 2 (Week 2-3): Backend intelligence - endpoints, learning, ribosome
3. Phase 3 (Week 4): Testing, polish, documentation

**Risk Mitigation:**
- Phases independently valuable (can ship incrementally)
- OpenCode changes minimal (easy to disable/rollback)
- Backend intelligence isolated (can evolve independently)
- No breaking changes to OpenCode core

**Success Metrics:**
- Session capture rate: > 95%
- Recommendation accuracy: > 60%
- Template extraction rate: > 10% of sessions
- Template reuse rate: > 30% of future sessions
- Performance overhead: < 5%
- OpenCode LOC changed: < 150

---

## Deferred (Future Work)

### Not in MVP:
- ❌ Real-time collaboration features
- ❌ Template editing UI
- ❌ Advanced pattern recognition (ML models)
- ❌ Cross-vessel coordination
- ❌ Search-first execution mode (currently improvisation only)

### Possible Future Phases:
- ⏭️ Search-first execution (hybrid reuse + creativity)
- ⏭️ Pure improvisation mode enhancements
- ⏭️ Template variants (A/B testing)
- ⏭️ Custom ribosome triggers
- ⏭️ Template analytics dashboard
- ⏭️ Template marketplace

---

## References

- [proposal.md](./proposal.md) - Full proposal
- [design.md](./design.md) - Architecture details (PRIMARY REFERENCE)
- [specs/](./specs/) - Component specifications
