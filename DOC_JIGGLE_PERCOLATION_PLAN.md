# Documentation Percolation Plan
**Mode**: APPLY  
**Generated**: 2026-02-08

---

## Overview

This document outlines the specific content percolation actions to consolidate recent valuable information into foundational documents.

---

## Percolation Action 1: Update Main README

### Source
- README_ARCHITECTURE_DOCS.md (current de-facto README)

### Action
**RENAME**: README_ARCHITECTURE_DOCS.md → README.md

### Rationale
- Standard convention is README.md at repository root
- Current file already serves this purpose
- No existing README.md to conflict with
- Will improve discoverability

---

## Percolation Action 2: Create GETTING_STARTED.md

### Sources
- QUICK_START_V2_API.md
- QUICK_START_DASHBOARD.md
- SETUP_COMPLETE_READY_TO_EXECUTE.md

### New Content Structure
```markdown
# Getting Started with Metabob Development

## Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.11+
- SurrealDB

## Quick Setup

### 1. Backend (metabob-rpc-api)
[Steps from SETUP_COMPLETE_READY_TO_EXECUTE.md]

### 2. Dashboard (Cloud UI)
[Content from QUICK_START_DASHBOARD.md]

### 3. CLI Tool
[Content from repos/metabob-cli/README.md]

### 4. OpenCode Integration
[Link to repos/metabob-opencode/README.md]

## Verify Setup
[Verification steps]

## Next Steps
- See ACTIVITIES.md for activity system usage
- See DOCUMENTATION_INDEX.md for all docs
```

---

## Percolation Action 3: Consolidate Activity System Documentation

### Sources (30+ files → 2 files)

#### Primary Consolidation: Create ACTIVITIES.md

**Base**: ACTIVITY_SYSTEM_COMPLETE_ARCHITECTURE.md  
**Add From**:
- ACTIVITY_RELIABILITY_SOLUTION.md (production-ready status, Thompson Sampling)
- ACTIVITY_WORKFLOW_QUICK_REFERENCE.md (usage patterns)
- JIGGLE_ACTIVITY_READY.md (jiggle activity specifics)

**New Structure**:
```markdown
# Activity System Documentation

## Production Status ✅
[From ACTIVITY_RELIABILITY_SOLUTION.md]
- Thompson Sampling learning active
- 8 bootstrap templates available
- MCP integration complete

## Architecture
[From ACTIVITY_SYSTEM_COMPLETE_ARCHITECTURE.md]
- Complete architecture diagrams
- Data flow
- Component interaction

## Usage Guide
[From ACTIVITY_WORKFLOW_QUICK_REFERENCE.md]
- How to discover activities
- How to execute activities
- How to create new templates

## Available Templates
[List from current system]

## Advanced Topics
- Template registration
- Variant management
- Learning system
```

#### Secondary: Keep ACTIVITY_WORKFLOW_QUICK_REFERENCE.md
- Standalone quick reference for developers
- Linked from ACTIVITIES.md

#### Archive Rest
Move to .archive/activity-analysis/:
- ACTIVITY_EXECUTION_FLOW_COMPLETE.md
- ACTIVITY_REGISTRATION_*.md (multiple)
- ACTIVITY_SYSTEM_UNDERSTANDING.md
- ACTIVITY_SYSTEM_ABSOLUTE_VALIDATION.md
- ACTIVITY_TEMPLATE_FORMAT_ANALYSIS.md
- etc. (see full list in dry run analysis)

---

## Percolation Action 4: Consolidate Memory System Documentation

### Sources (10 files → 1 file)

#### Create: MEMORY_SYSTEM.md

**Combine**:
- PROPER_MEMORY_AGENT_DESIGN.md (architecture)
- MEMORY_LEAK_ROOT_CAUSE.md (issues identified)
- MEMORY_FIXES_COMPREHENSIVE.md (solutions)
- MEMORY_BUDGET_TOOL_FIX.md (specific fix)
- CACHE_THRASHING_FIX.md (cache improvements)
- MESSAGE_HISTORY_AND_IMPULSE_SHARING.md (impulse system)

**New Structure**:
```markdown
# Memory System Documentation

## Overview
Session memory agent architecture and responsibilities

## Architecture
[From PROPER_MEMORY_AGENT_DESIGN.md]
- Context preparation
- Budget monitoring
- Component learning

## Impulse System
[From MESSAGE_HISTORY_AND_IMPULSE_SHARING.md]
- Impulse types
- Sharing between sessions
- Provenance tracking

## Known Issues & Fixes
[From MEMORY_FIXES_COMPREHENSIVE.md]
- Memory leak root causes
- Budget tool fixes
- Cache thrashing resolution

## Future Improvements
- Component learning
- Automatic summarization
- Context optimization
```

#### Archive
- MEMORY_INVESTIGATION_REPORT.md
- MEMORY_FIX_VERIFICATION.md
- MEMORY_AGENT_ARCHITECTURE_MISMATCH.md
- RESTART_INSTRUCTIONS.md (obsolete)

---

## Percolation Action 5: Consolidate Configuration Documentation

### Sources (5 files → 1 file)

#### Create: CONFIGURATION.md

**Combine**:
- METABOB_CONFIG_SIMPLIFICATION.md
- CONFIG_SIMPLIFICATION_COMPLETE.md
- COMPLETE_REFACTORING_SUMMARY.md

**New Structure**:
```markdown
# Configuration Guide

## OpenCode Configuration
Required fields for .opencode/opencode.json

## CLI Configuration
Settings for metabob-cli

## Backend Configuration
Environment variables and setup

## Deprecated Fields
[From CONFIG_SIMPLIFICATION_COMPLETE.md]

## Migration Guide
If upgrading from older versions
```

#### Archive
- CONFIG_VALIDATION_FIXES.md

---

## Percolation Action 6: Update DOCUMENTATION_INDEX.md

### Add/Update Sections

#### 1. Quick Start Section (NEW)
```markdown
## 🚀 Getting Started

New to Metabob development? Start here:
- **GETTING_STARTED.md** - Setup guide
- **README.md** - Architecture overview
- **ACTIVITIES.md** - Activity system usage
- **CONFIGURATION.md** - Configuration reference
```

#### 2. Update Active Projects Section
Remove completed projects:
- ~~Schema Alignment~~ (moved to .archive/v2-migration/)
- ~~V2 API Migration~~ (moved to .archive/v2-migration/)

Add:
- **Documentation Maintenance** - See DOCUMENTATION_ALIGNMENT_PROTOCOL.md

#### 3. Add Archive Section (NEW)
```markdown
## 📦 Archive

Historical documentation and completed projects:
- **.archive/sessions/** - Session summaries
- **.archive/v2-migration/** - V2 API migration docs
- **.archive/activity-analysis/** - Activity system development
- See .archive/README.md for full archive index
```

---

## Percolation Action 7: Organize Architecture Docs

### Create: docs/architecture/ directory

#### Move from root:
- CORRECT_ARCHITECTURE_DESIGN.md → docs/architecture/DESIGN_INTENT.md
- ARCHITECTURE_EVOLUTION_SUMMARY.md → docs/architecture/EVOLUTION.md
- METABOB_DATAFLOW_ARCHITECTURE.md → docs/architecture/DATA_FLOW.md
- EXECUTION_ENVIRONMENT_ARCHITECTURE.md → docs/architecture/EXECUTION_ENV.md

#### Update DOCUMENTATION_INDEX.md with new paths

---

## Percolation Action 8: Organize Process Documentation

### Create: docs/processes/ directory

#### Move from root:
- DELEGATION_STRATEGY.md → docs/processes/DELEGATION_STRATEGY.md
- DOCUMENTATION_ALIGNMENT_PROTOCOL.md → docs/processes/DOC_ALIGNMENT.md
- EXAMPLE_DOC_ALIGNMENT_SESSION.md → docs/processes/DOC_ALIGNMENT_EXAMPLE.md

---

## Cross-Reference Updates

### Files with Known References to Update

1. **DOCUMENTATION_INDEX.md**
   - Update all links to archived files
   - Update links to moved architecture docs
   - Update links to moved process docs

2. **README.md** (renamed from README_ARCHITECTURE_DOCS.md)
   - Update "Complete solution: ACTIVITY_RELIABILITY_SOLUTION.md" → "See ACTIVITIES.md"
   - Update architecture doc references to docs/architecture/ paths

3. **ACTIVITIES.md** (new consolidated file)
   - Ensure links point to archived detailed docs
   - Link to activity templates README: repos/metabob-opencode/packages/opencode/templates/README.md

4. **GETTING_STARTED.md** (new file)
   - Link to sub-project READMEs
   - Link to ACTIVITIES.md
   - Link to CONFIGURATION.md

### Cross-Reference Validation Script

After percolation, run:
```bash
# Find all .md files with links to other .md files
find . -name "*.md" ! -path "*/.archive/*" ! -path "*/node_modules/*" \
  -exec grep -l "\[.*\](.*\.md)" {} \; | \
  xargs -I {} sh -c 'echo "=== {} ===" && grep -o "\[.*\](.*\.md)" {}'
```

Then manually verify each link still resolves.

---

## Summary of Percolations

| Action | Source Files | Destination | Type |
|--------|-------------|-------------|------|
| 1 | README_ARCHITECTURE_DOCS.md | README.md | Rename |
| 2 | QUICK_START_*.md (3 files) | GETTING_STARTED.md | Consolidate |
| 3 | ACTIVITY_*.md (~30 files) | ACTIVITIES.md + keep ACTIVITY_WORKFLOW_QUICK_REFERENCE.md | Consolidate |
| 4 | MEMORY_*.md (10 files) | MEMORY_SYSTEM.md | Consolidate |
| 5 | CONFIG_*.md (5 files) | CONFIGURATION.md | Consolidate |
| 6 | N/A | DOCUMENTATION_INDEX.md | Update |
| 7 | 4 architecture docs | docs/architecture/ | Move & Rename |
| 8 | 3 process docs | docs/processes/ | Move & Rename |

**Total Files Affected**: ~60 files  
**New Files Created**: 4 (GETTING_STARTED.md, ACTIVITIES.md, MEMORY_SYSTEM.md, CONFIGURATION.md)  
**Files Renamed**: 5 (README + 4 architecture docs)  
**Files Moved**: 7 (architecture + process docs)  
**Files Consolidated**: ~50 (archived after content extracted)

---

## Validation Checklist

After applying percolations:

- [ ] README.md exists at root
- [ ] GETTING_STARTED.md links to all key resources
- [ ] ACTIVITIES.md contains production status
- [ ] MEMORY_SYSTEM.md covers all issues and fixes
- [ ] CONFIGURATION.md has all required fields
- [ ] DOCUMENTATION_INDEX.md updated with new structure
- [ ] docs/architecture/ directory created with 4 files
- [ ] docs/processes/ directory created with 3 files
- [ ] No broken links in foundational docs
- [ ] All archived files still referenced via .archive/ paths

---

**Ready for Apply Mode**: Yes  
**Estimated Time**: 30-45 minutes  
**Risk Level**: Low (all files preserved via git history)
