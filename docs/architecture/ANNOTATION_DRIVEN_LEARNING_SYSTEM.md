# Metabob-DevBob Architecture: Complete System Overview

**Status**: Implementation Ready  
**Created**: January 30, 2026  
**Last Updated**: January 30, 2026  
**Version**: 3.0.0 (Double-Blind Learning Architecture)

## Quick Navigation

The **metabob-devbob system** implements a double-blind learning architecture where agents make task decisions while the server learns from outcomes without any mixing or bias. This creates a self-improving development system that continuously learns what approaches work for each component while keeping all learning metrics hidden from agents to prevent gaming.

### Documentation Index

**Essential Reading (Start Here)**:
1. **[FINAL_ARCHITECTURE_SUMMARY.md](../../FINAL_ARCHITECTURE_SUMMARY.md)** - Executive overview of entire system with 6-week implementation timeline
2. **[docs/DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](../DOUBLE_BLIND_LEARNING_ARCHITECTURE.md)** - Core technical design explaining agent isolation and Thompson Sampling
3. **[docs/DISTRIBUTED_ARCHITECTURE_FINAL.md](../DISTRIBUTED_ARCHITECTURE_FINAL.md)** - Client-server distribution patterns and MCP integration

**Implementation Details**:
4. **[CPG_INTEGRATION_SUMMARY.md](../../CPG_INTEGRATION_SUMMARY.md)** - CPG embeddings and code analysis integration patterns
5. **[docs/CPG_EMBEDDING_INTEGRATION.md](../CPG_EMBEDDING_INTEGRATION.md)** - Detailed CPG/text embedding implementation with 32-dim vectors
6. **[METABOB_RPC_ORCHESTRATION_SUMMARY.md](../../METABOB_RPC_ORCHESTRATION_SUMMARY.md)** - RPC API orchestration patterns for learning systems
7. **[docs/RPC_API_IMPLEMENTATION_GUIDE.md](../RPC_API_IMPLEMENTATION_GUIDE.md)** - Week-by-week implementation timeline and REST endpoints

**Deep Technical Details**:
8. **[docs/architecture/RPC_API_ANNOTATION_ORCHESTRATION.md](./RPC_API_ANNOTATION_ORCHESTRATION.md)** - Server-side orchestration, SurrealDB schema, Celery Beat
9. **[docs/architecture/LEARNING_SYSTEM_FLOW.md](./LEARNING_SYSTEM_FLOW.md)** - Thompson Sampling algorithms and association learning data flows
10. **[ANNOTATION_LEARNING_SYSTEM_SUMMARY.md](../../ANNOTATION_LEARNING_SYSTEM_SUMMARY.md)** - Summary of annotation-driven learning patterns

**User Guides**:
11. **[docs/QUICK_START_LEARNING_SYSTEM.md](../QUICK_START_LEARNING_SYSTEM.md)** - Getting started guide for developers
12. **[docs/SELF_IMPROVING_DEVELOPMENT_SYSTEM.md](../SELF_IMPROVING_DEVELOPMENT_SYSTEM.md)** - System overview with practical examples

## Architecture at a Glance

**Core Principle**: Agents make decisions using pure CPG analysis while the server learns from task outcomes through opaque impression tracking. This double-blind separation prevents gaming while enabling continuous improvement through Thompson Sampling and association learning.

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT LAYER (Decision Making)                │
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ devbob-opencode │  │ devbob-rpc-api  │  │  devbob-cli     │ │
│  │                 │  │                 │  │                 │ │
│  │ Gets pure CPG   │  │ Gets pure CPG   │  │ Gets pure CPG   │ │
│  │ analysis via    │  │ analysis via    │  │ analysis via    │ │
│  │ MCP tools       │  │ MCP tools       │  │ MCP tools       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│           │                      │                      │       │
└───────────┼──────────────────────┼──────────────────────┼───────┘
            │ NO LEARNING METRICS  │                      │
            │ NO SIMILARITY SCORES │                      │
            │ NO VARIANT INFO      │                      │
            ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              metabob-cli MCP SIDECAR (Pure Analysis)            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  CPG Analysis Engine (cpg-inference)                     │ │
│  │  • Component extraction & embedding (32-dim)             │ │
│  │  • FAISS similarity search                               │ │
│  │  • SQLite caching for performance                        │ │
│  │  • Returns: component IDs, dependencies, structure       │ │
│  │  • NEVER: similarity scores, recommendations, metrics    │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
            │ REST API calls for recommendations
            ▼
┌─────────────────────────────────────────────────────────────────┐
│               LEARNING LAYER (Hidden from Agents)               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  metabob-rpc-api SERVER                                   │ │
│  │  • Thompson Sampling (Beta distribution parameters)      │ │
│  │  • Component-impulse association weights                 │ │
│  │  • Vector search (32-dim embeddings + text similarity)   │ │
│  │  • Activity variant assignment (A/B testing)             │ │
│  │  • Returns: activity + context impulses + impression_id  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  SurrealDB Storage                                        │ │
│  │  • All learning state (hidden from agents)               │ │
│  │  • Component embeddings, variant parameters              │ │
│  │  • Success/failure tracking, association weights         │ │
│  │  • Vector indexes for similarity search                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Celery Beat (Background Learning)                        │ │
│  │  • Thompson parameter updates (15-min cycles)            │ │
│  │  • Association weight recalculation (hourly)             │ │
│  │  • Weak association pruning (weekly)                     │ │
│  │  • Analytics generation (daily, humans only)             │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

• **Double-blind separation**: Agents never see learning metrics, similarity scores, or variant assignments
• **Pure MCP tools**: metabob-cli provides unbiased CPG analysis without any learning data mixed in
• **Thompson Sampling**: Bayesian exploration/exploitation using Beta distributions for activity selection
• **Opaque impression tracking**: Clean feedback loops via impression IDs that agents cannot interpret
• **Vector similarity search**: 32-dimensional embeddings with SurrealDB for component and text matching
• **Association learning**: Component-impulse relationships weighted by historical success rates
• **Async learning**: All parameter updates happen in background without blocking agent operations
• **Minimal agent interfaces**: Only essential task data exposed through recommendation endpoints

## Data Flow Example: Fix Memory Leak

**Step 1: Agent Requests Analysis**
```
devbob-opencode → metabob-cli MCP: metabob_search_codebase_issues("memory leak session messages")
← Returns: Pure component IDs + dependencies (NO scores, NO metrics)
```

**Step 2: Agent Requests Recommendation**
```
Agent → metabob-rpc-api: POST /api/v1/activities/recommend
{
  "task_description": "Fix memory leak in session messages", 
  "component_ids": ["src/session/index.ts::messages"]
}
← Returns: { activity: "fix-bug-complete", context_impulses: ["impulse_xyz"], impression_id: "abc123" }
```

**Step 3: Agent Executes Task**
```
Agent runs activity "fix-bug-complete" with context impulses
Makes code changes, runs tests, validates success
```

**Step 4: Agent Reports Outcome**
```
Agent → metabob-rpc-api: POST /api/v1/feedback/record
{
  "impression_id": "abc123",
  "success": true,
  "duration": 12000,
  "cost": 0.04
}
← Returns: { status: "recorded" } (NO internal metrics exposed)
```

**Step 5: Background Learning (Hidden from Agent)**
```
Celery Beat processes feedback:
• Updates Thompson parameters: fix-bug-complete success rate ↑
• Updates associations: src/session/messages ↔ impulse_xyz weight ↑  
• Prunes weak associations: removes unhelpful patterns
• Generates analytics for human dashboards (agents cannot access)
```

## Implementation Status

### ✅ Completed
- **CPG Analysis Engine**: cpg-inference module with 32-dim embeddings and FAISS indexing
- **MCP Tool Interface**: metabob-cli provides pure component analysis via MCP protocol
- **Base Architecture Design**: Complete technical specifications for all system components
- **Documentation Suite**: Comprehensive architecture documentation with implementation guides

### 🔄 In Progress  
- **Development Environment**: Docker containers (devbob-opencode, devbob-rpc-api, devbob-cli)
- **Integration Testing**: Cross-container communication and MCP protocol validation

### ⏳ Not Started (6-Week Implementation Plan)
- **Week 1**: RPC API foundation (text embeddings, SurrealDB schema, vector indexes)
- **Week 2**: Variant assignment (Thompson Sampling, context selection, recommendation endpoint)  
- **Week 3**: Feedback processing (outcome tracking, parameter updates, Celery integration)
- **Week 4**: Background learning (Celery Beat, periodic updates, association pruning)
- **Week 5**: End-to-end testing (bias verification, load testing, Thompson convergence)
- **Week 6**: Production deployment (monitoring, dashboards, performance validation)

## Success Criteria

### Learning Quality Metrics
- **Thompson Sampling convergence**: Beta parameters should converge to true activity success rates within 100 trials
- **Association accuracy**: Component-impulse weights should reflect actual utility (measured via holdout validation) 
- **Recommendation improvement**: Success rates with recommended activities should exceed random baseline by 20%+
- **Context selection effectiveness**: Tasks using recommended context should succeed 15% more than generic context

### System Performance Metrics
- **MCP tool response time**: <10ms for CPG analysis (local cpg-inference performance)
- **Recommendation endpoint latency**: <100ms for activity + context selection (vector search performance)
- **Background learning latency**: Parameter updates complete within cycle windows (15min/1hr/1week)
- **Database query performance**: Vector similarity searches scale sub-linearly with component count

### Agent Behavior Metrics (Double-Blind Validation)
- **Metric isolation**: Zero correlation between agent decisions and exposed similarity scores
- **Gaming prevention**: Agent success rates should not increase when internal metrics accidentally exposed
- **Bias elimination**: Statistical tests confirm no confounding between learning signals and agent choices
- **Clean feedback**: Impression ID tracking provides learning signal without exposing internal state

## FAQ Section

**Q: Why double-blind instead of showing agents the learning data?**
A: Showing similarity scores or success rates would bias agent decisions, creating feedback loops that corrupt the learning signal. Agents might choose activities based on past performance rather than current task requirements.

**Q: How does Thompson Sampling work for activity selection?**  
A: Each activity variant has Beta distribution parameters (alpha=successes+1, beta=failures+1). Thompson Sampling draws from each Beta distribution and selects the variant with highest sample. This balances exploration of new variants with exploitation of proven ones.

**Q: What prevents the association graph from growing unbounded?**
A: Weekly pruning removes associations with low weight and high confidence (reliably unhelpful patterns). Stale associations not updated in 90+ days are also removed.

**Q: How do agents get recommendations without seeing learning metrics?**
A: The recommendation endpoint returns only: activity template ID, context impulse IDs, and opaque impression ID. No similarity scores, confidence values, or variant assignments are exposed.

**Q: What if the cpg-inference model gives bad component embeddings?**
A: The system degrades gracefully - Thompson Sampling will learn that recommendations based on bad embeddings don't work and will explore alternatives. The learning system adapts to whatever CPG analysis quality is available.

**Q: How does context selection work without showing agents the association weights?**
A: Component-impulse associations are stored server-side. When an agent requests recommendations, the server internally uses association weights to select optimal context impulses, but only returns the impulse IDs without explaining why they were selected.

## Related Documents

### **Executive & Planning**
- **[FINAL_ARCHITECTURE_SUMMARY.md](../../FINAL_ARCHITECTURE_SUMMARY.md)** - Complete system overview with 6-week implementation timeline
- **[BOOTSTRAP_GUIDE.md](../../BOOTSTRAP_GUIDE.md)** - Step-by-step setup and getting started guide
- **[STATUS.md](../../STATUS.md)** - Current development status and progress tracking

### **Core Architecture**
- **[docs/DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](../DOUBLE_BLIND_LEARNING_ARCHITECTURE.md)** - Double-blind learning technical design (agents isolated from metrics)
- **[docs/DISTRIBUTED_ARCHITECTURE_FINAL.md](../DISTRIBUTED_ARCHITECTURE_FINAL.md)** - Client-server distribution patterns with MCP integration
- **[docs/architecture/LEARNING_SYSTEM_FLOW.md](./LEARNING_SYSTEM_FLOW.md)** - Thompson Sampling algorithms and association learning flows

### **Implementation Guides**
- **[CPG_INTEGRATION_SUMMARY.md](../../CPG_INTEGRATION_SUMMARY.md)** - CPG embeddings integration patterns and vector search
- **[docs/RPC_API_IMPLEMENTATION_GUIDE.md](../RPC_API_IMPLEMENTATION_GUIDE.md)** - REST API endpoints and database schemas
- **[docs/architecture/RPC_API_ANNOTATION_ORCHESTRATION.md](./RPC_API_ANNOTATION_ORCHESTRATION.md)** - Server-side orchestration with SurrealDB and Celery Beat

### **Developer Resources**
- **[docs/QUICK_START_LEARNING_SYSTEM.md](../QUICK_START_LEARNING_SYSTEM.md)** - Getting started guide for new developers
- **[docs/SELF_IMPROVING_DEVELOPMENT_SYSTEM.md](../SELF_IMPROVING_DEVELOPMENT_SYSTEM.md)** - System overview with practical examples
- **[ANNOTATION_LEARNING_SYSTEM_SUMMARY.md](../../ANNOTATION_LEARNING_SYSTEM_SUMMARY.md)** - Summary of annotation-driven learning patterns

### **Technical Deep Dives**
- **[docs/CPG_EMBEDDING_INTEGRATION.md](../CPG_EMBEDDING_INTEGRATION.md)** - Detailed CPG/text embedding implementation with 32-dim vectors
- **[METABOB_RPC_ORCHESTRATION_SUMMARY.md](../../METABOB_RPC_ORCHESTRATION_SUMMARY.md)** - RPC API orchestration patterns for learning systems

---

**This overview document serves as the entry point for understanding the complete metabob-devbob double-blind learning architecture. Start with FINAL_ARCHITECTURE_SUMMARY.md for implementation planning, then dive into specific technical documents based on your area of focus.**

---

## Related Documents

- [INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md](./INTENT_DRIVEN_DATAFLOW_ORCHESTRATION.md)
- [METABOB_INTEGRATION_GUIDE.md](./METABOB_INTEGRATION_GUIDE.md)
- [ACTIVITY_SYSTEM_DESIGN.md](./ACTIVITY_SYSTEM_DESIGN.md)

---

**Status**: Design Complete - Ready for Implementation  
**Estimated Effort**: 5 weeks (3 engineers)  
**Dependencies**: Metabob CPG, Activity System, Annotation API
