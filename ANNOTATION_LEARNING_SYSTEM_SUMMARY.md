# Metabob Learning System Architecture - Complete Overview

**Version**: 3.0.0 (Double-Blind Architecture)  
**Created**: January 2026  
**Last Updated**: January 30, 2026  
**Status**: ✅ Architecture Complete | ⚠️ RPC Backend Pending (6 weeks)

---

## Quick Navigation

The Metabob learning system enables continuous improvement through double-blind A/B testing with Thompson Sampling, where agents execute tasks without seeing learning internals, and the system learns optimal strategies from outcomes. The architecture enforces strict separation of concerns: metabob-opencode executes tasks, metabob-cli analyzes code structure, and metabob-rpc-api learns from outcomes.

### Documentation Map

**Start here if you want to understand...**

1. **[SEPARATION_OF_CONCERNS.md](SEPARATION_OF_CONCERNS.md)** - Component boundaries and responsibilities  
   → Read this FIRST to understand architectural principles. Defines what each component does and does NOT do.

2. **[LEARNING_SYSTEM_INTEGRATION_STATUS.md](LEARNING_SYSTEM_INTEGRATION_STATUS.md)** - Current state and quick reference  
   → Read this to understand what works TODAY vs. what needs implementation. Includes usage examples.

3. **[LEARNING_SYSTEM_ACTIVITY_INTEGRATION.md](LEARNING_SYSTEM_ACTIVITY_INTEGRATION.md)** - Complete integration guide  
   → Read this for detailed integration patterns, workflows, and implementation details. Most comprehensive guide.

4. **[LEARNING_SYSTEM_INTEGRATION_SUMMARY.md](LEARNING_SYSTEM_INTEGRATION_SUMMARY.md)** - Session accomplishments  
   → Read this for context on what was built, key insights, and recommendations.

---

## Architecture at a Glance

**Core Principle**: Each component has ONE responsibility with zero overlap. metabob-opencode executes tasks and coordinates agents but never parses code or stores learning data. metabob-cli provides pure CPG analysis via MCP but never returns scores or makes recommendations. metabob-rpc-api learns from outcomes and provides opaque recommendations but never executes tasks or parses code. This separation prevents bias, enables double-blind experiments, and ensures clean boundaries.

### System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                     USER REQUEST                                 │
│              "Fix memory leak in session"                        │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│                   metabob-opencode                               │
│         RESPONSIBILITY: Task Execution & Coordination            │
│                                                                  │
│  • Execute activity templates                                   │
│  • Coordinate agents via ACP                                    │
│  • Make task decisions                                          │
│  • Query for recommendations (HTTP)                             │
│  • Post feedback after execution                                │
│                                                                  │
│  ✅ DOES: Execute, coordinate, decide                           │
│  ❌ DOES NOT: Parse code, store learning, implement Thompson   │
└────────┬─────────────────────────────────┬─────────────────────┘
         │                                 │
         │ MCP (stdio)                     │ HTTP/REST
         │ Pure CPG                        │ Learning
         ▼                                 ▼
┌─────────────────────┐         ┌──────────────────────────────────┐
│   metabob-cli       │         │   metabob-rpc-api                │
│   (MCP Mode)        │         │                                  │
│                     │         │  RESPONSIBILITY: Learning        │
│  RESP: Pure CPG     │         │                                  │
│                     │         │  • Thompson Sampling             │
│  • cpg-inference    │         │  • Association graph             │
│  • Component IDs    │         │  • Opaque recommendations        │
│  • Dependencies     │         │  • Feedback processing           │
│  • Impact analysis  │         │  • SurrealDB storage             │
│  • <10ms latency    │         │  • Celery Beat learning          │
│                     │         │                                  │
│  ✅ DOES: Analyze   │         │  ✅ DOES: Learn, recommend       │
│  ❌ DOES NOT: Score,│         │  ❌ DOES NOT: Parse, execute     │
│     recommend       │         │     expose internals             │
└─────────────────────┘         └──────────────────────────────────┘

PROTOCOL BOUNDARIES:
• opencode ↔ cli: MCP over stdio (pure data, no opinions)
• opencode ↔ rpc-api: HTTP/REST (opaque recommendations)
• cli ↔ rpc-api: Minimal/none (optional embeddings for CPG indexing)
```

### Key Architectural Decisions

- **Single Responsibility per Component**: Each component does ONE job only
- **Protocol-Based Communication**: MCP for CPG, HTTP for learning, minimal cross-talk
- **Stateless CPG Analysis**: metabob-cli maintains no state, returns pure structural data
- **Double-Blind Learning**: metabob-rpc-api hides all learning internals (scores, probabilities, parameters) from agents
- **Opaque Recommendations**: Agents receive only activity IDs and context, never metrics or confidence scores
- **No Responsibility Bleed**: Strict anti-patterns prevent CPG in opencode, learning in cli, or execution in rpc-api
- **Thompson Sampling Isolation**: All variant assignment, impression tracking, and parameter updates happen exclusively in rpc-api
- **Validation Gates**: Quality checks prevent bad commits (impact, integration, completeness, effectiveness)

---

## Data Flow Example

**Scenario**: Agent needs to fix a memory leak in session messages

### Step 1: Agent Receives Task
```
User: "Fix the memory leak in session messages"
```

### Step 2: Agent Queries Activities (Current - Works Today)
```typescript
// Agent searches for relevant activity
await search_activities({ category: "bugfix" })
// → Returns: fix-bug-complete, component-targeted-fix-with-learning, etc.
```

### Step 3: Query Learning System (Future - Requires RPC Backend)
```typescript
// Agent queries rpc-api for recommendation
POST http://api-server:8080/api/v1/recommendations/get
{
  task: "Fix memory leak in session messages",
  component_ids: ["src/session/index.ts::messages"],
  task_type: "fix_bug"
}

// Server (hidden from agent):
// 1. Embeds task text → 32-dim vector
// 2. Queries SurrealDB for similar components
// 3. Loads association graph (component → impulse weights)
// 4. Thompson Sampling: Sample Beta(alpha, beta) for each variant
// 5. Select variant with highest sample
// 6. Select context impulses (top weighted, within budget)
// 7. Generate impression_id, log assignment

// Response (opaque, no scores):
{
  recommended_activity: "fix-bug-complete",
  context_impulses: [
    {id: "imp_xyz", type: "pattern", content: "Add default limit to prevent unbounded growth"}
  ],
  impression_id: "imp_abc123"
}
```

### Step 4: Agent Uses CPG Analysis (Current - Works Today)
```typescript
// Agent calls metabob-cli via MCP
await metabob_search_codebase_issues({ query: "memory leak" })
// → Returns: [{component_id: "src/session/index.ts::messages", ...}]

await metabob_analyze_change_impact({
  file_path: "src/session/index.ts",
  component_name: "messages"
})
// → Returns: {affects_issue_area: true, dependency_graph: [...]}
```

### Step 5: Agent Executes Activity (Current - Works Today)
```typescript
await activity({
  templateId: "fix-bug-complete",
  variables: {
    bugDescription: "Memory leak in session messages",
    files: ["src/session/index.ts"]
  },
  reason: "Fix memory leak reported by user"
})

// Activity internally:
// - Uses metabob CPG tools for analysis
// - Applies recommended context (if available)
// - Runs validation gates before commit
// - Measures metric improvement
```

### Step 6: Post Feedback (Future - Requires RPC Backend)
```typescript
POST http://api-server:8080/api/v1/feedback/record
{
  impression_id: "imp_abc123",
  outcome: "success",
  metrics: {
    cost: 0.12,
    duration: 45000,
    tokens: {input: 5000, output: 3000, cache: 2000}
  }
}

// Server (hidden from agent):
// 1. Look up assignment: imp_abc123 → fix-bug-complete
// 2. Update Thompson: alpha = 24 → 25 (success)
// 3. Update associations: impulse_xyz weight++ for session::messages
// 4. Trigger Celery: update_parameters.delay()
// 5. Persist to SurrealDB

// Response (no details):
{ recorded: true }
```

### Step 7: Background Learning (Future - Celery Beat)
```
Every 15 min: Batch update Thompson parameters
Every hour: Update association weights
Every week: Prune weak associations (<0.2 weight)
Daily: Generate analytics (humans only)
```

**Result**: Next time someone fixes a similar issue, the system recommends the proven approach with optimized context.

---

## Implementation Status

### ✅ Completed (Works Today)

**Activity System**:
- [x] 15+ activity templates operational
- [x] Template execution with validation
- [x] Activity debugging and replay
- [x] Quality gates configured
- [x] Manual activity selection

**Metabob CPG Integration**:
- [x] cpg-inference running locally (<10ms)
- [x] 5 MCP tools available:
  - metabob_search_codebase_issues
  - metabob_analyze_change_impact
  - metabob_suggest_related_changes
  - metabob_assess_deletion_safety
  - metabob_list_file_components
- [x] Pure CPG analysis (no learning data)
- [x] MCP protocol integration (stdio)

**Activity-Based Development**:
- [x] CPG-guided task decomposition
- [x] Component targeting
- [x] Impact analysis
- [x] Related change detection
- [x] Manual validation gates

**Documentation**:
- [x] Separation of concerns defined
- [x] Integration patterns documented
- [x] Usage examples provided
- [x] Implementation roadmap created
- [x] Validation activity template

### 🔄 In Progress (Design Complete, Implementation Pending)

**None** - Architecture design phase complete, awaiting implementation approval

### ⏳ Not Started (Requires 6-Week Build)

**metabob-rpc-api Backend** (Weeks 1-2):
- [ ] Recommendation endpoint (POST /api/v1/recommendations/get)
- [ ] SurrealDB schema and setup
- [ ] Text embeddings service (sentence-transformers)
- [ ] Thompson Sampling service
- [ ] Impression tracking and logging

**Learning Features** (Weeks 3-4):
- [ ] Feedback endpoint (POST /api/v1/feedback/record)
- [ ] Parameter update logic (alpha/beta)
- [ ] Association graph storage
- [ ] Context selection algorithm
- [ ] Annotation budget enforcement
- [ ] Celery Beat tasks

**Validation Integration** (Week 5):
- [ ] Quality gates in activity system
- [ ] Pre-commit validation hooks
- [ ] Impact/integration/effectiveness checks
- [ ] Validation reporting

**Production Deployment** (Week 6):
- [ ] Deploy to devbob containers
- [ ] End-to-end testing
- [ ] Double-blind verification
- [ ] Analytics dashboard
- [ ] Monitor learning convergence

---

## Success Criteria

### Learning Quality Metrics

**After 10 fixes, target metrics:**
- 🎯 **First-attempt success rate**: 85%+ (current: ~20%)
- 🎯 **Lines of code per fix**: <100 (current: 17,000+ in memory leak disaster)
- 🎯 **No orphaned code commits**: 0% (current: 100% of failed attempts)
- 🎯 **Thompson Sampling convergence**: Variants stabilize after 50 impressions
- 🎯 **Association weight stability**: <10% change per week after 100 fixes

### System Performance Metrics

**Operational targets:**
- 🎯 **Recommendation latency**: <200ms (p95)
- 🎯 **CPG analysis latency**: <10ms (p99) ✅ Already achieved
- 🎯 **Feedback recording**: <50ms (p95)
- 🎯 **Context selection**: <5 impulses per recommendation
- 🎯 **Storage efficiency**: <1MB per 100 components

### Agent Behavior Metrics (Double-Blind Verification)

**Ensure no bias:**
- ✅ **Agents cannot see scores**: Recommendations include only activity ID + context
- ✅ **Agents cannot see probabilities**: No Thompson Sampling parameters exposed
- ✅ **Agents cannot see weights**: No association graph data visible
- ✅ **Feedback is opaque**: Simple ack responses, no learning data returned
- ✅ **Task-based decisions**: Agents choose based on task requirements, not optimization

---

## FAQ Section

### Q: Why separate metabob-cli from metabob-rpc-api?

**A**: Separation of concerns. CPG analysis (parsing code structure) is fundamentally different from learning (tracking what works). Mixing them would:
- Contaminate pure CPG data with learning bias
- Make it impossible to run "pure analysis" mode
- Prevent using CPG tools without learning system
- Violate single responsibility principle

**Design**: cli is stateless and fast (<10ms), rpc-api is stateful and learns over time.

### Q: Why hide learning internals from agents?

**A**: **Double-blind experiments**. If agents see "this activity has 85% success rate", they'll bias toward it even when inappropriate. Hidden parameters ensure:
- Agents make task-based decisions (not metric-based)
- Thompson Sampling explores fairly (no gaming)
- Learning converges to true effectiveness (not popularity)
- Clean experimental design (no contamination)

### Q: What if the RPC backend fails or is unavailable?

**A**: **Graceful degradation**. metabob-opencode works fully without rpc-api:
- Activities execute normally with manual selection
- CPG analysis still available via metabob-cli MCP
- No learning optimization, but no functionality lost
- System is usable today without backend

### Q: Why Thompson Sampling instead of epsilon-greedy or UCB?

**A**: **Bayesian optimization with exploration**. Thompson Sampling:
- Naturally balances exploration vs. exploitation
- Provides probability matching (sample from posterior)
- Handles non-stationary environments (activities evolve)
- Converges faster than epsilon-greedy
- More intuitive than UCB (alpha/beta have meaning)

### Q: How do validation gates prevent disasters like the memory leak?

**A**: **Four-layer validation**:
1. **Impact check**: Does change affect problem area? (CPG call graph analysis)
2. **Integration check**: Is new code actually used? (liveness check)
3. **Completeness check**: All related files updated? (co-change patterns)
4. **Effectiveness check**: Does metric improve? (before/after measurement)

The memory leak fix would have failed at step 1 (SessionMemoryManager had no execution path to the leak) and step 2 (no callers).

### Q: Can we use learning system without activities?

**A**: **No**. Activities provide:
- Structured workflows (reproducible)
- Validation integration (quality gates)
- Feedback collection points (learning data)
- Template versioning (evolution tracking)

Without activities, we can't track "what worked" because there's no structured execution.

### Q: How does the system handle component renaming or refactoring?

**A**: **Embeddings and similarity**. Components are embedded to 32-dim vectors:
- Similar components (even with different names) cluster
- Embeddings capture semantic similarity
- Association graph uses embeddings, not string matching
- Refactoring updates embeddings but preserves learned associations

### Q: What prevents annotation bloat over time?

**A**: **Budget enforcement** (in rpc-api):
- Max 5 annotations per component
- Max 2500 tokens per component
- Relevance scoring (success boosts, failure penalizes)
- Automatic eviction of low-scoring annotations
- Compression of similar annotations

Without budgets, context grows unbounded and prompts degrade.

---

## Related Documents

### Core Architecture
- **SEPARATION_OF_CONCERNS.md** - Component boundaries (PRIMARY, START HERE)
- **FINAL_ARCHITECTURE_SUMMARY.md** - Double-blind architecture design (v3.0.0)
- **docs/DOUBLE_BLIND_LEARNING_ARCHITECTURE.md** - Technical specification

### Integration & Usage
- **LEARNING_SYSTEM_INTEGRATION_STATUS.md** - What works today vs. future
- **LEARNING_SYSTEM_ACTIVITY_INTEGRATION.md** - Complete integration guide
- **LEARNING_SYSTEM_INTEGRATION_SUMMARY.md** - Session summary and insights

### Templates & Implementation
- **templates/validation/component-targeted-fix-with-learning.json** - Learning-enabled activity
- **templates/validation/validate-learning-activity-integration.json** - Validation workflow
- **component-targeted-fix-with-learning.json** - Advanced learning template

### Historical Context
- **docs/SELF_IMPROVING_DEVELOPMENT_SYSTEM.md** - Original design (superseded)
- **Memory leak analysis docs** - What went wrong (17,789 lines of useless code)

---

## Getting Started

### For Users (Today - No Backend Needed)

```bash
# Use activities for development work
activity({
  templateId: 'fix-bug-complete',
  variables: { bugDescription: '...', files: ['...'] },
  reason: 'Fix reported bug'
})

# Activities automatically use metabob CPG tools
# Manual selection, but fully functional
```

### For Implementers (Building RPC Backend)

**Week 1**: RPC API foundation
1. Set up metabob-rpc-api project structure
2. Implement recommendation endpoint skeleton
3. Set up SurrealDB with schema
4. Create text embeddings service (sentence-transformers)
5. Basic health checks

**See**: FINAL_ARCHITECTURE_SUMMARY.md for detailed 6-week checklist

### For Template Authors

```json
{
  "name": "My Activity Template",
  "metabob": {
    "enabled": true,
    "learningMode": true,
    "targetContextTokens": 5000,
    "annotationStrategy": "component-specific"
  },
  "integration": {
    "qualityGates": [
      {
        "name": "impact_check",
        "metabob_tool": "metabob_analyze_change_impact",
        "required_condition": "affects_issue_area == true"
      }
    ]
  }
}
```

---

## Conclusion

The Metabob learning system creates a **self-improving development environment** where:

1. **Agents focus on tasks** without bias from visible metrics
2. **Server learns from outcomes** using Thompson Sampling and association graphs
3. **Activities provide structure** with templates and validation gates
4. **Metabob provides analysis** with CPG decomposition and impact analysis
5. **Validation prevents disasters** with four-layer quality gates
6. **System evolves continuously** through template specialization

**Current State**: Architecture complete, activities operational, metabob-cli integrated. **RPC backend requires 6-week build** to enable learning features.

**Key Principle**: Each component has ONE job. No overlap. No responsibility bleed. This separation enables double-blind experiments, clean boundaries, and continuous improvement without bias.

**Next Step**: Review SEPARATION_OF_CONCERNS.md, then start Week 1 of RPC API implementation.

---

**Last Updated**: January 30, 2026  
**Version**: 3.0.0 (Double-Blind Architecture)  
**Status**: ✅ Design Complete | ⏳ Implementation Pending
