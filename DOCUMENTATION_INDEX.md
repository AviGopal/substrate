# Metabob System Documentation Index

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

