# Metabob System Documentation Index

**Purpose**: Central index for all system documentation  
**Maintained by**: Documentation agent (background updates and annotations)  
**Last Updated**: 2026-02-09  
**Status**: Refreshed via documentation jiggling process

---

## 📚 Quick Start & Essential Guides

### For New Users
- **README.md** - Project overview and setup
- **BREADCRUMB_QUICK_START.md** - Quick implementation guide
- **CLI_METABOB_TOOLS_REFERENCE.md** - Metabob CLI MCP tools reference

### For Developers
- **PROTO_SCHEMA_REFERENCE.md** - Proto schema reference
- **EXISTING_EXECUTION_TRACKING.md** - Backend execution tracking infrastructure
- **docs-ACTIVITY_EXECUTION_GUIDE.md** - Activity execution guide

---

## 🏗️ System Architecture

### Core Architecture Documents
- **METABOB_DATAFLOW_ARCHITECTURE.md** - Complete data flow between all systems
- **ARCHITECTURE_SEPARATION_OF_CONCERNS.md** - System boundaries and responsibilities
- **CORRECT_ARCHITECTURE_DESIGN.md** - Design intent: impulse provenance & learning
- **EXECUTION_ENVIRONMENT_ARCHITECTURE.md** - Execution environment design

### Integration & Data Flow
- **COMPLETE_FLOW_MAP.md** - End-to-end flow mapping
- **FLOW_COMPARISON.md** - Flow comparison analysis
- **GIT_HISTORY_DESIGN_ALIGNMENT.md** - Design alignment with implementation

---

## 🎯 Activity System

### Activity Implementation
- **ACTIVITY_RELIABILITY_SOLUTION.md** - Activity reliability improvements
- **CREATE_ACTIVITY_TEMPLATE_IMPROVEMENTS.md** - Template creation enhancements
- **repos/metabob-opencode/OPENCODE_ACTIVITY_STATUS.md** - Current implementation status

### Activity Execution
- **docs-ACTIVITY_EXECUTION_GUIDE.md** - Complete execution guide
- **EXISTING_EXECUTION_TRACKING.md** - Backend tracking infrastructure

---

## 🔧 API & Integration

### API Documentation
- **API_V2_DESIGN.md** - V2 API design and architecture
- **API_CLEANUP_PLAN.md** - API cleanup and refactoring plan

### Backend Integration
- **BACKEND_VERSION_MANAGEMENT.md** - Backend version management
- **CLI_PROTO_HANDLING_UPDATE.md** - CLI proto handling updates

---

## 🧪 Development & Debugging

### Quick References
- **BREADCRUMB_QUICK_START.md** - Quick implementation guide
- **DOC_ALIGNMENT_QUICK_START.md** - Documentation alignment guide

### Issue Resolution
- **CACHE_THRASHING_FIX.md** - Cache thrashing resolution
- **CONTEXT_OVERFLOW_PREVENTION_IMPL.md** - Context overflow prevention
- **DATA_FRAGMENTATION_ANALYSIS.md** - Data fragmentation analysis
- **DATA_STRUCTURE_ALIGNMENT_ISSUE.md** - Structure alignment issues
- **FIXES_APPLIED.md** - Applied fixes log

---

## 📦 Archived Documentation

Historical documentation has been moved to `.archive/` for reference:
- **Session Logs**: `.archive/session-logs/2026-02/` (17 files)
- **Planning Documents**: `.archive/planning-docs/` (5 files)
- **Summaries**: `.archive/summaries/2026-02/` (33 files)
- **Test Reports**: `.archive/test-reports/2026-02/` (17 files)

See `.archive/ARCHIVE_INDEX.md` for complete archive structure.

**Archive Rationale**: Session logs, status snapshots, and temporary planning documents have been archived to reduce clutter. All information is preserved in git history and the archive is available for reference.

## 🔍 Observability & Monitoring

### System Monitoring
- **AGENT_BEHAVIOR_RECORDING.md** - Agent behavior recording and tracking
- **EXECUTION_OBSERVABILITY_PROPOSAL.md** - Stage-based logging design

### File Watching
- **repos/metabob-cli/FILEWATCHER_IMPROVEMENTS.md** - Enhanced file watching for large projects

---

## 🧹 Documentation Maintenance

### Recent Jiggling (2026-02-09)
- **DOC_JIGGLE_COMPREHENSIVE_ANALYSIS.md** - Latest jiggling analysis and results
- **72 files archived** to `.archive/` (session logs, summaries, test reports)
- **51% reduction** in root directory clutter
- **Validated**: All recent documentation aligns with git commits

### Alignment & Protocols
- **DOCUMENTATION_ALIGNMENT_PROTOCOL.md** - How to keep docs aligned with code
- **DOC_ALIGNMENT_QUICK_START.md** - Quick guide for doc maintenance

---

## 🎯 Key System Components

### Component Overview
- **metabob-opencode**: Agent orchestration, sessions, context management
- **metabob-cli**: Code analysis, activity execution, file watching
- **metabob-rpc-api**: Learning, storage, recommendations

### Data Flow
- **Forward**: User → opencode → cli → backend (execution & recording)
- **Backward**: Backend → cli → opencode → agent (recommendations & context)
- **Continuous**: File watching → analysis → cache → context injection

### Configuration
- **3 required fields**: cli_path, api_key, base_url
- **Auto-configured**: Everything else with sensible defaults
- **Legacy options**: include_paths, exclude_paths (file watching)

---

## 📖 Additional Resources

### Repository-Specific Docs
- **repos/metabob-opencode/** - OpenCode-specific documentation
- **repos/metabob-cli/** - CLI-specific documentation
- **repos/metabob-proto/** - Proto definitions and activity templates

### Dashboard & Setup
- **DEVBOB_DASHBOARD_V2_SETUP.md** - Dashboard V2 setup guide
- **DEVBOB_SCRIPT_INSPECTION.md** - Devbob script documentation
- **DASHBOARD_INTEGRATION_STATUS.md** - Dashboard integration status

