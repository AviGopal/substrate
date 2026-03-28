# OpenCode ↔ MiniBob Integration - Proposal

**Status:** Draft
**Created:** 2026-03-23
**Author:** System (via Claude Code)
**Type:** System Integration

---

## Problem Statement

Currently, development work happens in OpenCode sessions (metabob-opencode fork) with no learning or pattern recognition:

1. **No Learning Loop:** Each session starts from scratch, doesn't learn from past successes
2. **No Activity Recommendations:** System can't suggest "this worked before for similar goals"
3. **No Template Extraction:** Successful patterns aren't captured as reusable templates
4. **No Measurement:** No success rates, cost tracking, or performance metrics
5. **Isolated Knowledge:** OpenCode sessions don't contribute to system-wide improvement

## Domain Context

This integration operates across multiple domains:

### Primary: Learning & Optimization Domain

**Vessel (Instructional State):**
- OpenCode session definitions (conversation + context)
- Activity templates extracted from successful sessions
- Dynamic skill definitions (populated with recommendations)

**Becoming (Process-of-Becoming):**
- MiniBob observer watching Bus events (non-invasive)
- Session execution (tool calls, state changes streaming)
- Backend learning (Thompson Sampling, pattern recognition)
- Ribosome extracting successful patterns

**Instance (Functional State):**
- Execution traces stored in SurrealDB
- Updated success rate metrics (per template, per pattern)
- Extracted activity templates (successful patterns → vessels)
- Modified codebase (the work that was done)

**What's Learned:**
- Which tool sequences achieve specific goals
- Which patterns succeed/fail in different contexts
- Optimal activity selection for given intents
- Cost/duration characteristics per approach

### Secondary: Software Development Domain

The actual work being observed happens in Development domain (bash, read, write, edit, git tools), but the LEARNING from that work is what we're building.

**Key Insight:** This integration makes OpenCode a **learning vessel** - every session contributes to system improvement through the continuous becoming.

**Reference:** [openspec/meta/domain-mappings.md](../../meta/domain-mappings.md#learning-optimization)

---

## Proposed Solution

Integrate MiniBob library into OpenCode using **non-invasive observation pattern**:

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     OpenCode Session                          │
│  User: "/minibob add authentication to the API"              │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼ (1) User invokes /minibob skill
┌──────────────────────────────────────────────────────────────┐
│              OpenCode (Minimal Changes)                       │
│                                                               │
│  1. Observer watches Bus events → sends to backend           │
│  2. ONE static skill: /minibob → calls backend               │
│  3. Backend client (simple MCP wrapper)                      │
│                                                               │
│  That's it! No intelligence in OpenCode.                     │
└──────────────────────────────────────────────────────────────┘
                             │
                             │ MCP: getHelp(sessionContext)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              MiniBob Backend (ALL Intelligence)               │
│                                                               │
│  (1) Receives session context (messages, files, directory)   │
│  (2) Detects intent from conversation                        │
│  (3) Thompson Sampling recommends best approach              │
│  (4) Formats response for user                               │
│  (5) Executes if user confirms (via ActivityExecutor)        │
│  (6) Learns from outcome (Thompson Sampling, ribosome)       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼ Returns formatted message
┌──────────────────────────────────────────────────────────────┐
│              OpenCode Displays Response                       │
│                                                               │
│  MiniBob: I can help with that using a proven template:      │
│           **add-auth-v3** (78% success rate, avg 45s)        │
│                                                               │
│           What it will do:                                    │
│           1. Read existing API structure                      │
│           2. Create auth module                               │
│           3. Add middleware                                   │
│           4. Run tests                                        │
│                                                               │
│           Would you like me to execute this template?         │
│           - Reply "yes" to execute automatically              │
│           - Or follow along manually                          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼ User: yes
                             │
                             ▼ MCP: executeTemplate(templateId)
                             │
┌──────────────────────────────────────────────────────────────┐
│              MiniBob Executes via ActivityExecutor            │
│  - Loads template                                             │
│  - Executes tasks via OpenCode tools (delegated back)        │
│  - Captures trace                                             │
│  - Updates Thompson Sampling                                  │
│  - Returns results                                            │
└──────────────────────────────────────────────────────────────┘
```

### Three Simple Components (OpenCode Side)

**1. Observer (`packages/opencode/src/metabob/observer.ts`)**
- Subscribe to OpenCode Bus events (Session.*, Tool.*)
- Send raw session data to MiniBob backend
- No intelligence, just observation and forwarding

**2. Static Skill (`packages/opencode/src/metabob/index.ts`)**
- ONE skill: `/minibob` (always available)
- Just calls backend `getHelp()`
- Displays whatever backend returns

**3. Backend Client (`packages/opencode/src/metabob/backend-client.ts`)**
- Thin MCP wrapper
- Handles connectivity, errors
- No business logic

### Integration with MiniBob Backend

**Key Insight:** OpenCode sends raw session data to MiniBob backend. Backend does ALL the intelligence (intent detection, recommendations, execution, learning).

```typescript
// packages/opencode/src/metabob/index.ts
import { MCPClient } from '@metabob/minibob';
import { Skill } from '@/skill';
import { Observer } from './observer';

export function initializeMiniBob(config: MiniBobConfig) {
  if (!config.enabled) return;

  const client = new MCPClient({ endpoint: config.backendUrl });

  // 1. Start observer (watches Bus events, sends to backend)
  const observer = new Observer(client);
  observer.initialize();

  // 2. Register ONE static skill
  Skill.register({
    name: 'minibob',
    description: 'Get help from MiniBob',
    handler: async (message?: string) => {
      // Just call backend - it handles everything
      const response = await client.call('minibob_help', {
        sessionId: Session.current()?.id,
        message,
        context: await gatherContext()
      });

      return response.message; // Display what backend returns
    }
  });
}

// Simple context gathering (OpenCode data → backend)
async function gatherContext() {
  const session = Session.current();
  return {
    directory: session?.directory,
    files: await File.list(session?.directory),
    messages: await Session.getMessages(session?.id),
    recentActivity: observer.getRecentActivity()
  };
}
```

**Benefits:**
1. **Minimal OpenCode Changes:** ~100 LOC total (observer + skill + client)
2. **All Intelligence in Backend:** Intent, recommendations, execution, learning
3. **Easy to Disable:** Just set `enabled: false` in config
4. **No Breaking Changes:** Pure addition, no modifications to OpenCode core
5. **Backend Evolution:** Can improve intelligence without touching OpenCode

---

## Scope

### In Scope

**Core Integration:**
- ✅ Observer subscribing to Bus events
- ✅ Trace conversion (OpenCode → MiniBob format)
- ✅ Backend communication (recommendations, trace storage)
- ✅ Dynamic skill injection
- ✅ Basic ribosome (pattern detection)

**Learning Loop:**
- ✅ Thompson Sampling recommendations
- ✅ Success/failure tracking
- ✅ Cost and duration metrics
- ✅ Template extraction triggers

**Configuration:**
- ✅ Enable/disable in OpenCode config
- ✅ Backend URL configuration
- ✅ Capture mode settings

### Out of Scope (Future Work)

- ❌ UI for template management (dashboard domain)
- ❌ Advanced pattern recognition (requires ML models)
- ❌ Cross-vessel coordination (multiple OpenCode instances)
- ❌ Real-time collaboration features
- ❌ Template editing/customization UI

### Deferred Decisions

- **Granularity:** Per-session vs per-intent trace capture (start with per-session)
- **Ribosome triggers:** Automatic vs manual extraction (start with manual)
- **Execution delegation:** When to delegate to MiniBob ActivityExecutor (start with observation only)

---

## Success Criteria

**Phase 1: Observation (2 weeks)**
- ✅ Observer captures all session events
- ✅ Traces converted to MiniBob format
- ✅ Traces stored in backend (SurrealDB)
- ✅ No performance impact on OpenCode execution

**Phase 2: Recommendations (2 weeks)**
- ✅ Backend returns recommendations via Thompson Sampling
- ✅ Dynamic skill injected with recommendations
- ✅ User can invoke `/metabob:implement`
- ✅ Recommendations improve success rate by 10%+

**Phase 3: Learning Loop (2 weeks)**
- ✅ Ribosome extracts successful patterns
- ✅ Extracted templates available for future sessions
- ✅ Success rates tracked and displayed
- ✅ System learns from at least 50 sessions

**Metrics:**
- Session success rate (% of sessions that complete goal)
- Template reuse rate (% of sessions using extracted templates)
- Cost reduction (average cost per goal achievement)
- Time savings (average duration per goal)

---

## Risks and Mitigation

**Risk 1: Bus event overhead**
- Impact: High (could slow down OpenCode)
- Mitigation: Async event handling, batched backend POSTs
- Fallback: Disable observation if latency > 100ms

**Risk 2: Backend unavailable**
- Impact: Medium (no recommendations, no learning)
- Mitigation: Graceful degradation, local caching
- Fallback: OpenCode works normally without integration

**Risk 3: Trace format misalignment**
- Impact: Medium (backend can't learn from traces)
- Mitigation: Strict schema validation, version tracking
- Fallback: Log validation errors, don't block execution

**Risk 4: Poor recommendation quality**
- Impact: Low (users ignore bad suggestions)
- Mitigation: Thompson Sampling exploration, user feedback
- Fallback: Users just don't invoke skill

---

## Dependencies

**Existing Components:**
- ✅ @metabob/minibob library (repos/minibob)
- ✅ metabob-activity-api (repos/metabob-activity-api)
- ✅ OpenCode Bus system (repos/metabob-opencode/packages/opencode/src/bus)
- ✅ SurrealDB schema (openspec/contracts/surrealdb-schema.md)

**New Components:**
- ❌ packages/opencode/src/metabob/ (NOT YET CREATED)

**Configuration:**
- ❌ OpenCode config schema extension
- ❌ MiniBob backend endpoint configuration

---

## Timeline

**Week 1-2:** Observer + Trace Converter
- Implement Bus event subscription
- Build trace conversion logic
- Validate trace format

**Week 3-4:** Backend Integration + Recommendations
- Backend client implementation
- Thompson Sampling query
- Dynamic skill injection

**Week 5-6:** Ribosome + Learning Loop
- Pattern detection
- Template extraction
- Success rate tracking

**Total:** 6 weeks for full integration

---

## Related Changes

- [analysis-api-extraction](../analysis-api-extraction/) - Similar MiniBob library integration pattern
- [cloud-dashboard-implementation](../cloud-dashboard-implementation/) - Will visualize learned templates

## References

- [OPENCODE_INTEGRATION_NOTES.md](../../../OPENCODE_INTEGRATION_NOTES.md) - Original design notes
- [openspec/meta/ontology-foundation.md](../../meta/ontology-foundation.md) - Three-state model
- [openspec/meta/improvisation-spectrum.md](../../meta/improvisation-spectrum.md) - Execution modes
- [openspec/meta/goal-seeking-architecture.md](../../meta/goal-seeking-architecture.md) - Thompson Sampling
