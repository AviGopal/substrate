# Metabob System Documentation Index

**Purpose**: Central index for all system documentation  
**Maintained by**: Documentation agent (background updates and annotations)  
**Last Updated**: 2026-02-08

---

## 🔴 ACTIVE: Schema Alignment (Phase 1)

### Analysis & Root Cause
- **ALGORITHMIC_VALIDATION_STRATEGY.md** - Evidence-based validation approach
- **ALGORITHMIC_VALIDATION_FINDINGS.md** - Validation results with external evidence
- **SCHEMA_MISMATCH_ROOT_CAUSE.md** - Algorithmic proof of proto/backend divergence
- **CORRECT_ARCHITECTURE_DESIGN.md** - Design intent: impulse provenance & learning

### Implementation Guides
- **COMPLETE_SOLUTION_SUMMARY.md** - 4-phase plan (10 days total)
- **SCHEMA_MISMATCH_ACTION_PLAN.md** - Immediate fixes with code
- **TASK_BREAKDOWN_PHASE1.md** - Detailed specs for 4 tasks (3.5 hours)
- **DELEGATION_STRATEGY.md** - How to assign and track tasks

### Observability & Validation
- **EXECUTION_OBSERVABILITY_PROPOSAL.md** - Stage-based logging design
- **OBSERVABILITY_SOLUTION_SUMMARY.md** - Breadcrumb system (complete)
- **BREADCRUMB_QUICK_START.md** - Copy-paste implementation guide

### Task Execution Logs (Per-Task Records)
- **TASK_PHASE1_TASK1_LOG.md** - Proto Pydantic models → 📝 Not started
- **TASK_PHASE1_TASK2_LOG.md** - API endpoint updates → 📝 Not started
- **TASK_PHASE1_TASK3_LOG.md** - Migration script → 📝 Not started
- **TASK_PHASE1_TASK4_LOG.md** - E2E validation → 📝 Not started

**Task Log Purpose**: Each delegated task records its execution in detail:
- Implementation decisions and reasoning
- Issues encountered and solutions
- Files modified with explanations
- Validation results with evidence
- Notes for documentation agent about doc issues

---

## Configuration Simplification
- **METABOB_CONFIG_SIMPLIFICATION.md** - Initial analysis of redundant config fields
- **CONFIG_SIMPLIFICATION_COMPLETE.md** - Implementation details and before/after
- **COMPLETE_REFACTORING_SUMMARY.md** - Full technical summary of changes

## System Architecture & Data Flow
- **METABOB_DATAFLOW_ARCHITECTURE.md** (49KB) - Complete data flow between all three systems
  - Activity execution flow
  - Activity registration process
  - Subagent execution
  - Session memory & impulse system
  - Turn lifecycle hooks
  - Integration points between metabob-opencode, metabob-cli, metabob-rpc-api

- **AGENT_BEHAVIOR_RECORDING.md** - How agent behavior is (and should be) recorded
  - Current recording capabilities
  - Future recording enhancements
  - Implementation options for complete tracking

- **SYSTEM_INTEGRATION_COMPLETE.md** (34KB) - Complete integration picture
  - Responsibilities of each system
  - Complete data flow lifecycle
  - Session memory & impulse flow
  - Recording examples

## File Watching Improvements
- **repos/metabob-cli/FILEWATCHER_IMPROVEMENTS.md** - Enhanced file watching for large projects
  - inotify limit detection
  - Automatic polling fallback
  - Improved exclusion defaults (70+ patterns)

## Quick References
See individual files for detailed technical documentation.

## Key Takeaways

### Configuration
- **3 required fields**: cli_path, api_key, base_url
- **Everything else**: Auto-configured or has sensible defaults
- **Legacy options**: include_paths, exclude_paths (file watching)

### Architecture
- **metabob-opencode**: Agent brain (orchestration, sessions, context)
- **metabob-cli**: Analysis engine (code analysis, activity execution, recording)
- **metabob-rpc-api**: Backend brain (learning, storage, orchestration)

### Data Flow
- **Forward**: User → opencode → cli → backend (execution & recording)
- **Backward**: Backend → cli → opencode → agent (recommendations & context)
- **Continuous**: File watching → analysis → cache → context injection

### Recording
- ✅ **Today**: Messages, steps, outcomes, metrics
- 🚀 **Tomorrow**: Decisions, context effectiveness, tool patterns
- 🔮 **Future**: Real-time coaching, automatic evolution

