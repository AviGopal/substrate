# Documentation Index

## Quick Start
- [`../README.md`](../README.md) - Main project overview and quick start guide
- [`../VERSION.md`](../VERSION.md) - Version information

## 📁 Documentation Structure

### Core Systems (412 files organized)

#### Activity System (24 files)
**Location**: `docs/activity-system/`

Key documents:
- Activity execution guides and specifications
- Template flow analysis
- Activity replay and debugging workflows
- System proofs and test results

#### Learning Loop (11 files)
**Location**: `docs/learning-loop/`

Key documents:
- `LEARNING_LOOP_OPERATIONAL_VALIDATION.md` - 6/6 conditions met ✅
- `LEARNING_LOOP_FINAL_STATUS.md` - Complete implementation status
- Template creation and promotion guides
- Phase 2 instrumentation and impulse learning
- Extracted rules and learning patterns

#### Ratchet Cycles (0 files here, see tmp/)
**Location**: `../tmp/template-evolution/`

The ratchet cycle documentation lives in `tmp/` as it's actively updated:
- `RATCHET_CYCLE_1_COMPLETE.md` - Manual cycle (19x improvement)
- `AUTOMATED_RATCHET_SUCCESS.md` - First autonomous cycle (8.12% improvement)
- `TEST_RESULTS_CYCLE_1.md` - Validation results
- `execute-ratchet-cycle-fixed.json` - Working template (Mustache-only)

#### CPG (Code Property Graph) (11 files)
**Location**: `docs/cpg/`

Key documents:
- CPG implementation and integration guides
- Co-change analysis and learning
- Data flow diagrams and quick references
- Test results and validation

#### Architecture (110 files)
**Location**: `docs/architecture/`

Comprehensive system design documents:
- Component boundaries and separation of concerns
- State transformation paradigms
- Impulse and lifecycle management
- Context window utilization
- Functional state loop architecture
- Boredom manager and execution metrics
- Variant system and embeddings integration

### Guides & References (46 files)

#### Guides (26 files)
**Location**: `docs/guides/`

Practical how-to documentation:
- Quick references (Activity, CPG, Impulse, Alignment)
- Deployment guides (Helmfile, Docker)
- Integration guides (Boredom Manager, CPG co-change)
- Quick start and quick deploy workflows
- Plugin integration

#### Reports (26 files)
**Location**: `docs/reports/`

Test results and system reports:
- Activity execution data reports
- Database configuration reports
- Deployment validation reports
- Version consistency audits
- Violations scans
- Validation results

### Development History (156 files)

#### Sessions (64 files)
**Location**: `docs/sessions/`

Chronological development logs:
- Implementation sessions
- Bug fixing sessions
- Architecture evolution sessions
- Feature development sessions

#### Historical (92 files)
**Location**: `docs/historical/`

Archived implementation and debugging documentation:
- Bug fixes and debug sessions
- Implementation completions
- Status summaries and session reports
- Deployment and workflow iterations
- Test results and verification evidence

### Supporting Documentation (15 files)

#### Bootstrap (10 files)
**Location**: `docs/bootstrap/`

System initialization and template bootstrapping:
- Bootstrap template requirements and validation
- Integration verification
- Functional state integration

#### Data Flows (13 files)
**Location**: `docs/data-flows/`

Data flow analysis and archaeology:
- Context window utilization diagrams
- State transformation tracking
- Impulse usage tracking

#### Reference (20 files)
**Location**: `docs/reference/`

Technical reference materials

#### API (2 files)
**Location**: `docs/api/`

API documentation and specifications

#### Changes (3 files)
**Location**: `docs/changes/`

Change logs and tracking

## 🎯 Key Entry Points

### For New Users
1. **[README](../README.md)** - Start here
2. **[Activity Execution Guide](activity-system/)** - Learn to use activities
3. **[Learning Loop Validation](learning-loop/LEARNING_LOOP_OPERATIONAL_VALIDATION.md)** - Understand the system

### For Developers
1. **[Architecture Overview](architecture/)** - System design (110 docs)
2. **[CPG Integration](cpg/)** - Code analysis features
3. **[Activity System](activity-system/)** - Core workflow engine

### For System Improvement
1. **[Ratchet Strategy](../tmp/template-evolution/RATCHET_STRATEGY.md)** - Self-improvement design
2. **[Automated Ratchet Success](../tmp/template-evolution/AUTOMATED_RATCHET_SUCCESS.md)** - Proof of concept
3. **[Learning Loop](learning-loop/)** - Metrics and feedback

## 📊 System Metrics

### Performance Achievements
| Component | Metric | Value |
|-----------|--------|-------|
| Template Creation | Success Rate | 100% (was 5.3%) |
| Ratchet Execution | Tasks Completed | 5/5 ✅ |
| Fast Failures | Reduction | 50% |
| Overall Improvement | First Cycle | 8.12% |
| Validation Proof | Improvement | 19x |

### Investment & ROI
| Phase | Investment | Achievement |
|-------|------------|-------------|
| Infrastructure | $5.36 | Learning loop operational |
| Manual Ratchet | $0.77 | Root cause identified |
| Testing | $0.63 | 19x improvement proven |
| Automation | $1.20 | First autonomous cycle ✅ |
| **Total** | **$7.96** | **Self-improving system operational** |

**Long-term ROI**: ∞ (continuous autonomous improvement)

## 🚀 Usage Examples

### Run Automated Ratchet
```bash
opencode activity execute-ratchet-cycle-fixed \
  --domain activity-system \
  --max_cycles 3 \
  --improvement_threshold 10 \
  --auto_commit false
```

### Create Activity Template
```bash
opencode activity create-activity-template-self-contained \
  --templateName "My Workflow" \
  --templateDescription "Automates X" \
  --category infrastructure \
  --purpose "Streamline process Y"
```

### Query Learning Loop
```bash
# Check template metrics
curl http://localhost:8080/api/v1/templates

# Query execution history
curl http://localhost:8080/api/v1/executions?template_id=execute-ratchet-cycle-fixed
```

## 🔄 Continuous Improvement

The system is now **fully autonomous**:
1. **Ratchet runs** → Identifies bottlenecks (18.4% fast failures found)
2. **Fixes applied** → System improves (Handlebars bug fixed autonomously)
3. **Metrics tracked** → Progress measured (8.12% improvement, 50% failure reduction)
4. **Cycle repeats** → Continuous optimization

**No human intervention required after setup.** 🚀

## 📂 Directory Summary

```
docs/
├── activity-system/     24 files - Activity execution and templates
├── learning-loop/       11 files - Learning loop implementation
├── cpg/                 11 files - Code Property Graph integration
├── architecture/       110 files - System design and specifications
├── guides/              26 files - How-to and quick references
├── reports/             26 files - Test results and validation
├── sessions/            64 files - Development session logs
├── historical/          92 files - Archived implementation docs
├── bootstrap/           10 files - System initialization
├── data-flows/          13 files - Data flow analysis
├── reference/           20 files - Technical references
├── api/                  2 files - API documentation
└── changes/              3 files - Change tracking

Total: 412 organized files
Root: 2 files (README.md, VERSION.md)
```

## 🗺️ Navigation

- [← Back to README](../README.md)
- [Activity System →](activity-system/)
- [Learning Loop →](learning-loop/)
- [Architecture →](architecture/)
- [Guides →](guides/)
- [Ratchet Cycles →](../tmp/template-evolution/)

---

**Documentation last organized**: 2026-02-23  
**Total files organized**: 412 markdown files from root to categorized directories  
**System status**: Self-improving and operational ✅
