# CPG & Co-Change Integration Documentation

**Complete guide to leveraging CPG-inference and co-change prediction across the Metabob DevBob stack**

---

## 📚 Documentation Index

### 🎯 **START HERE**
**[CPG_QUICK_REFERENCE.md](./CPG_QUICK_REFERENCE.md)** - One-page quick reference
- Available MCP tools and when to use them
- Key files and configuration
- Top 3 quick wins to implement (4-6 hours each)
- Common debugging tips

---

### 📖 For Developers

**[CPG_COCHANGE_MAXIMIZATION_GUIDE.md](./CPG_COCHANGE_MAXIMIZATION_GUIDE.md)** ⭐ **IMPLEMENTATION GUIDE**
- Complete code examples for all enhancements
- Step-by-step implementation instructions
- 4-phase action plan with effort estimates
- Configuration best practices
- Metrics and monitoring guidance

**[CPG_DATA_FLOW_DIAGRAM.md](./CPG_DATA_FLOW_DIAGRAM.md)** - Visual data flow diagrams
- Complete data flow from file change to CPG update
- Query workflow (agent → MCP → CPGManager → cpg-inference)
- Learning workflow (activity completion → backend → model fine-tuning)
- Performance characteristics and optimization points

---

### 📋 For Architects & Product

**[CPG_INTEGRATION_SUMMARY.md](./CPG_INTEGRATION_SUMMARY.md)** - Executive summary
- Current integration status across all components
- Critical gaps and opportunities
- Top 3 quick wins with ROI analysis
- 4-phase implementation roadmap
- Success criteria and metrics

**[CPG_COCHANGE_INTEGRATION_ARCHITECTURE.md](./CPG_COCHANGE_INTEGRATION_ARCHITECTURE.md)** - Architecture deep dive
- Component hierarchy and integration points
- Current state analysis (metabob-cli, metabob-opencode, metabob-rpc-api)
- Architecture diagrams
- Storage and performance details

---

## 🚀 Quick Start

### For Immediate Implementation
1. Read **CPG_QUICK_REFERENCE.md** (5 minutes)
2. Pick one quick win from the reference card
3. Follow implementation guide in **CPG_COCHANGE_MAXIMIZATION_GUIDE.md**
4. Measure impact and iterate

### For Architecture Planning
1. Read **CPG_INTEGRATION_SUMMARY.md** (10 minutes)
2. Review 4-phase roadmap
3. Prioritize phases based on business goals
4. Allocate resources (Phase 1 = 1-2 days)

### For Deep Understanding
1. Read **CPG_COCHANGE_INTEGRATION_ARCHITECTURE.md** (20 minutes)
2. Study **CPG_DATA_FLOW_DIAGRAM.md** (15 minutes)
3. Review cpg-inference library documentation
4. Explore implementation in metabob-cli and metabob-opencode

---

## 🎯 Top 3 Quick Wins (Start Here!)

### 1. Activity-Driven Co-Change Workflow 🔥
**Effort**: 4 hours  
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`  
**Impact**: Prevent regression bugs, improve code consistency  
**ROI**: High - immediate quality improvement

**What**: After each activity task, automatically suggest related files with issues and add follow-up tasks for the agent.

**See**: `CPG_COCHANGE_MAXIMIZATION_GUIDE.md` Section 1 for complete code

---

### 2. Impulse Context Prioritization via CPG 🔥
**Effort**: 3 hours  
**File**: `repos/metabob-opencode/packages/opencode/src/impulse/resolver.ts`  
**Impact**: Better context utilization, focus on high-impact components  
**ROI**: High - more efficient context usage

**What**: Score impulses by CPG impact and prioritize high-impact components when context budget is tight.

**See**: `CPG_COCHANGE_MAXIMIZATION_GUIDE.md` Section 2 for complete code

---

### 3. CPG-Powered Test Selection 🔥
**Effort**: 6 hours  
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`  
**Impact**: 50-70% reduction in test execution time  
**ROI**: Medium-High - faster CI/CD pipelines

**What**: New MCP tool that uses CPG dependency analysis to select only affected tests.

**See**: `CPG_COCHANGE_MAXIMIZATION_GUIDE.md` Section 3 for complete code

---

## 📊 Current Integration Status

| Component | Status | Integration Level |
|-----------|--------|-------------------|
| **metabob-cli** | ✅ Full | CPGManager, 8 MCP tools, file watcher |
| **metabob-opencode** | ⚠️ Partial | Activity tracking, context scoring |
| **metabob-rpc-api** | ❌ None | Package installed but unused |
| **cpg-inference** | ✅ Production | v0.5.2, 1400+ LOC, comprehensive tests |

---

## 🎓 Key Concepts

### What is CPG?
**Code Property Graph**: A unified graph representation of your codebase where:
- **Nodes**: Functions, classes, methods
- **Edges**: Calls, imports, dependencies, inheritance
- **Analysis**: Dependency traversal, impact scoring, change propagation

### What is Co-Change Prediction?
**GNN-based prediction** of files that should change together:
- Uses **structural similarity** (SimHash fingerprints)
- Uses **semantic similarity** (GNN embeddings)
- Trained on **historical co-change patterns**
- Returns **confidence scores** (0-1) for file pairs

### Why Does This Matter?
- ✅ **Prevent bugs**: Catch related files that need updates
- ✅ **Improve consistency**: Apply patterns across co-changed files
- ✅ **Faster development**: Focus on high-impact components first
- ✅ **Better testing**: Run only relevant tests based on dependencies
- ✅ **Risk assessment**: Understand blast radius before refactoring

---

## 🔧 Technical Stack

### CPG-Inference Library
- **Version**: 0.5.2
- **Languages**: Python, Java, JavaScript, TypeScript, C/C++, Ruby, PHP
- **Parsing**: tree-sitter (AST extraction)
- **Embeddings**: GNN (ONNX inference), 32-dim vectors
- **Storage**: SQLite (default), Redis (optional)
- **Model**: Bundled GCN (69KB), AUC 0.9999

### Performance
- **File update**: 36-156ms per file
- **CPG query**: 9-19ms typical
- **Cold start**: 25-170ms first query
- **Memory**: ~1-5MB per 100 files

---

## 📈 Success Criteria

### Target Metrics
- Co-change accuracy: **>70%**
- CPG query p95 latency: **<20ms**
- Test selection time savings: **>50%**
- Regression bugs: **-20%** via related file checks
- Context efficiency: High-impact components prioritized

### Expected Outcomes
✅ Agents proactively mention related files during implementation  
✅ High-impact issues surfaced before low-impact ones  
✅ Test runs complete faster without missing relevant tests  
✅ Co-change predictions improve over time (learning pipeline)

---

## 🛠️ Implementation Phases

### Phase 1: Quick Wins (1-2 days) ⭐
- Activity co-change workflow
- Impulse CPG prioritization
- CPG metrics tracking

### Phase 2: High-Impact Features (1 week)
- Test selection tool
- Activity learning pipeline
- Proactive issue detection

### Phase 3: Infrastructure (2 weeks)
- REST API exposure (metabob-rpc-api)
- Distributed CPG (Redis)
- Visualization dashboard

### Phase 4: Advanced (1 month)
- Model fine-tuning pipeline
- CPG cache warming
- Advanced analytics

---

## 🐛 Common Issues

### "CPG returning 0 dependencies"
**Solution**: Use `list_file_components()` to verify exact component names, then retry with exact name.

### "Co-change predictions inaccurate"
**Solution**: Check if learning pipeline is enabled. Review activity completion data. Consider Phase 4 model fine-tuning.

### "Slow query performance"
**Solution**: Check cache size (`~/.metabob/.metabob/cpg_cache.db`). Consider Redis backend for distributed caching.

### "File watcher not updating CPG"
**Solution**: Check logs for IPC errors. Verify CPGManager initialization. Ensure project_root is correct.

---

## 📞 Support

**Questions about**:
- Architecture → See `CPG_COCHANGE_INTEGRATION_ARCHITECTURE.md`
- Implementation → See `CPG_COCHANGE_MAXIMIZATION_GUIDE.md`
- Quick reference → See `CPG_QUICK_REFERENCE.md`
- Data flow → See `CPG_DATA_FLOW_DIAGRAM.md`
- Executive summary → See `CPG_INTEGRATION_SUMMARY.md`

---

## 🎯 Recommended Next Steps

1. **Read** `CPG_QUICK_REFERENCE.md` (5 minutes)
2. **Review** top 3 quick wins
3. **Pick** Quick Win #1 (highest ROI)
4. **Implement** following `CPG_COCHANGE_MAXIMIZATION_GUIDE.md`
5. **Measure** impact and document results
6. **Iterate** to Phases 2-4

---

**Start with Quick Win #1: Activity-Driven Co-Change Workflow** - 4 hours of work for immediate quality improvements! 🚀
