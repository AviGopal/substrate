# Documentation Index: Annotation-Driven Double-Blind Learning System

**Last Updated**: January 30, 2026  
**Current Architecture Version**: 3.0.0 (Double-Blind Learning)

---

## 📚 Start Here

New to the project? Read these in order:

1. **[FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md)** ⭐
   - 5-minute executive summary
   - Complete system overview
   - Implementation checklist (6 weeks)

2. **[ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)** ⭐
   - Architecture at a glance
   - Key decisions and rationale
   - Document navigation guide

3. **[DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md)** ⭐
   - Core technical design (v3.0.0)
   - Agent-opaque recommendation system
   - Thompson Sampling implementation

---

## 📖 Documentation Structure

### Executive Summaries (Start Here)
- [FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md) - Complete system (8KB)
- [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) - Architecture guide (12KB)
- [CPG_INTEGRATION_SUMMARY.md](../CPG_INTEGRATION_SUMMARY.md) - Embedding integration (11KB)
- [METABOB_RPC_ORCHESTRATION_SUMMARY.md](../METABOB_RPC_ORCHESTRATION_SUMMARY.md) - RPC API overview (14KB)
- [ANNOTATION_LEARNING_SYSTEM_SUMMARY.md](../ANNOTATION_LEARNING_SYSTEM_SUMMARY.md) - Learning system overview (6KB)

### Core Architecture Documents
- [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) ⭐ **v3.0.0 CURRENT** - Agent-opaque learning (28KB)
- [DISTRIBUTED_ARCHITECTURE_FINAL.md](./DISTRIBUTED_ARCHITECTURE_FINAL.md) - Client-server distribution (26KB)
- [architecture/RPC_API_ANNOTATION_ORCHESTRATION.md](./architecture/RPC_API_ANNOTATION_ORCHESTRATION.md) - RPC API details (23KB)
- [architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md](./architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md) - Learning algorithms (35KB)

### Implementation Guides
- [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - 6-week implementation plan (18KB)
- [QUICK_START_LEARNING_SYSTEM.md](./QUICK_START_LEARNING_SYSTEM.md) - Getting started guide (14KB)
- [SELF_IMPROVING_DEVELOPMENT_SYSTEM.md](./SELF_IMPROVING_DEVELOPMENT_SYSTEM.md) - System overview with examples (26KB)

### Technical Deep Dives
- [architecture/LEARNING_SYSTEM_FLOW.md](./architecture/LEARNING_SYSTEM_FLOW.md) - Flow diagrams (11KB)
- [CPG_EMBEDDING_INTEGRATION.md](./CPG_EMBEDDING_INTEGRATION.md) - CPG-inference integration (15KB)

---

## 🎯 Find What You Need

### I want to understand...

**...the overall system**
→ [FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md)

**...why agents can't see learning metrics**
→ [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) (see "Why This Works")

**...how CPG embeddings work**
→ [CPG_INTEGRATION_SUMMARY.md](../CPG_INTEGRATION_SUMMARY.md)

**...how recommendations are made**
→ [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) (see "Variant Assignment")

**...how learning happens**
→ [architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md](./architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md)

**...how to implement this**
→ [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md)

### I need to...

**...get started quickly**
→ [QUICK_START_LEARNING_SYSTEM.md](./QUICK_START_LEARNING_SYSTEM.md)

**...understand the data flow**
→ [architecture/LEARNING_SYSTEM_FLOW.md](./architecture/LEARNING_SYSTEM_FLOW.md)

**...see implementation code examples**
→ [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md)

**...understand Thompson Sampling**
→ [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) (see "Thompson Sampling")

**...set up SurrealDB schemas**
→ [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) (see "SurrealDB Schema")

**...configure Celery Beat**
→ [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) (see "Celery Beat Tasks")

---

## 📊 Architecture Evolution

### v1.0.0: Annotation-Driven Learning (Deprecated)
**Problem**: Agents had access to similarity scores → biased decisions

**Documents**:
- [architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md](./architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md) (superseded)
- [ANNOTATION_LEARNING_SYSTEM_SUMMARY.md](../ANNOTATION_LEARNING_SYSTEM_SUMMARY.md) (superseded)

### v2.0.0: Distributed Architecture (Superseded)
**Improvement**: Added client-side CPG (metabob-cli MCP)

**Problem**: Still exposed learning metrics to agents

**Documents**:
- [DISTRIBUTED_ARCHITECTURE_FINAL.md](./DISTRIBUTED_ARCHITECTURE_FINAL.md) (superseded by v3.0.0)

### v3.0.0: Double-Blind Learning (Current) ✅
**Solution**: Agents see NO internal metrics → clean experimental outcomes

**Documents**:
- **[DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md)** ⭐ CURRENT
- [FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md) ⭐ CURRENT
- [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) ⭐ CURRENT

---

## 🔑 Key Concepts

### Double-Blind Learning
Agents make task decisions without seeing learning metrics (scores, probabilities, reasons). Server tracks everything internally and learns from outcomes. Eliminates bias.

**Read**: [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md)

### Thompson Sampling
Bayesian algorithm for exploration/exploitation tradeoff. Each variant has Beta(alpha, beta) distribution. Sample from each, select max. Update alpha/beta based on outcome.

**Read**: [DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) - "Thompson Sampling with Logging"

### CPG Embeddings
32-dim vectors from GNN trained on code structure. Computed client-side by metabob-cli MCP. Used for similarity search (components, tasks, impulses).

**Read**: [CPG_INTEGRATION_SUMMARY.md](../CPG_INTEGRATION_SUMMARY.md)

### Association Learning
Track success/failure for (component, impulse) pairs. Weight = success / (success + failure). Use for context selection. Prune weak associations.

**Read**: [architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md](./architecture/ANNOTATION_DRIVEN_LEARNING_SYSTEM.md) - "Feedback-Driven Association Graph"

### MCP Sidecar
metabob-cli runs cpg-inference locally. Provides pure CPG analysis via MCP tools. No learning data exposed. Fast (<10ms).

**Read**: [DISTRIBUTED_ARCHITECTURE_FINAL.md](./DISTRIBUTED_ARCHITECTURE_FINAL.md) - "MCP Tools"

---

## 🚀 Implementation Plan

### Week 1: RPC API Foundation
- Text embedding service
- SurrealDB schema with vector indexes
- Component sync endpoint

**Guide**: [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - Week 1

### Week 2: Variant Assignment
- Thompson Sampling implementation
- Context selection (association-based)
- Recommendation endpoint (agent-visible)

**Guide**: [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - Week 2

### Week 3: Feedback Processing
- Feedback endpoint (agent-visible)
- Parameter updates (alpha/beta)
- Association weight updates

**Guide**: [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - Week 3

### Week 4: Celery Beat
- Periodic parameter updates
- Batch processing
- Association pruning

**Guide**: [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - Week 4

### Week 5: Testing
- End-to-end flow
- Verify agent opacity
- Load testing

**Guide**: [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - Week 5

### Week 6: Production
- Deploy with monitoring
- Analytics dashboard (humans only)
- Validate convergence

**Guide**: [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - Week 6

---

## 📝 Document Changelog

### January 30, 2026
- Created v3.0.0 (Double-Blind Learning) architecture
- Added FINAL_ARCHITECTURE_SUMMARY.md
- Added ARCHITECTURE_OVERVIEW.md
- Updated all documents with cross-references
- Marked v1.0.0 and v2.0.0 as superseded

### Previous
- Created v2.0.0 (Distributed Architecture)
- Created v1.0.0 (Annotation-Driven Learning)

---

## 🤝 Contributing

When adding new documents:
1. Add entry to this index
2. Cross-reference related documents
3. Mark superseded documents with warnings
4. Update ARCHITECTURE_OVERVIEW.md if architecture changes

---

## 📧 Contact

For questions about the architecture:
- Architecture decisions: See [ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md)
- Implementation details: See [RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md)
- Getting started: See [QUICK_START_LEARNING_SYSTEM.md](./QUICK_START_LEARNING_SYSTEM.md)

---

**Quick Links**:
- [📄 FINAL_ARCHITECTURE_SUMMARY.md](../FINAL_ARCHITECTURE_SUMMARY.md) - Start here!
- [📐 ARCHITECTURE_OVERVIEW.md](./ARCHITECTURE_OVERVIEW.md) - Architecture guide
- [🔬 DOUBLE_BLIND_LEARNING_ARCHITECTURE.md](./DOUBLE_BLIND_LEARNING_ARCHITECTURE.md) - Core design
- [⚙️ RPC_API_IMPLEMENTATION_GUIDE.md](./RPC_API_IMPLEMENTATION_GUIDE.md) - Implementation
- [🚀 QUICK_START_LEARNING_SYSTEM.md](./QUICK_START_LEARNING_SYSTEM.md) - Getting started