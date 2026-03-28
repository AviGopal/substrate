# Codebase State Snapshot - Comprehensive

**Generated**: 2026-02-17  
**Purpose**: Complete stateless representation of current functionality and architecture  
**Scope**: Metabob DevBob multi-repository monorepo  
**Type**: Comprehensive (full details)

> **Note**: For a quick overview, see CODEBASE_STATE.md. This document provides exhaustive details.

---

## Executive Summary

The Metabob DevBob codebase is a **distributed AI-powered software development platform** that combines:
- Code quality analysis (Metabob CPG integration)
- Activity-based automation (30 templates)
- Learning-enhanced workflows (learning loop)
- Multi-agent orchestration (ACP support)
- Multiple interfaces (CLI, Dashboard, Slack Bot, MCP Server)

### System Status: ✅ Production-Ready

| Component | Version | Status | Health |
|-----------|---------|--------|--------|
| metabob-opencode | v1.0.62 | ✅ Stable | Healthy |
| metabob-rpc-api | v0.16.0 | ✅ Stable | Healthy (crash fix deployed) |
| metabob-cli | v1.9.0 | ✅ Stable | Healthy |
| metabob-dashboard | v2.2.11 | 🟡 Active Dev | V2 API migration |
| metabob-proto | Latest | ✅ Stable | Shared types |
| cpg-inference | v0.5.2 | ✅ Stable | Code analysis |
| platform | Latest | 🟡 Active Dev | K8s configs |

---

## Repository Details

### 1. metabob-opencode (Core Framework)

**Purpose**: Activity execution framework, CLI, and SDK

**Key Features**:
- Activity template engine with 30+ templates
- Impulse system for lazy context loading
- MCP server (Model Context Protocol)
- ACP client (Agent Client Protocol)
- Remote execution (SSH, Docker)
- Learning loop integration
- Plugin architecture

**Technologies**:
- Runtime: Bun (TypeScript)
- AI: @ai-sdk/* (Bedrock, Vertex)
- Protocols: MCP, ACP, gRPC
- Validation: Zod
- UI: Solid.js

**Recent Commits**:
1. `1ca9a2d1` - Add self-contained bootstrap templates
2. `1d77994e` - Fix impulse schema flattening
3. `2c33f140` - Backend template registration

**In-Flight**:
- Modified: activity.ts, metabob.ts, opencode.json
- New: template-quality-score.ts, debug-activity-v3.json

---

### 2. metabob-rpc-api (Backend)

**Purpose**: REST API, template storage, learning loop

**Key Features**:
- FastAPI REST API (V2 endpoints)
- Template storage (SurrealDB)
- Learning loop data collection
- Variant management (A/B testing)
- Code quality integration
- Cochange prediction

**Technologies**:
- Python 3.11+, FastAPI
- SurrealDB, Redis, Celery
- OpenAI API, cpg-inference

**V2 Endpoints**:
- `/v2/activities/*` - Activities, templates, executions
- `/v2/metabob/*` - Code quality, annotations, impact

**Recent Commits**:
1. `17d5599` - Fix FastAPI crash (type annotations)
2. `be47c2e` - Fix context_requirements (camelCase)
3. `0d38ce5` - Bootstrap template conversion fix

**In-Flight**:
- Modified: v2_activities.py
- New: gradient_analysis.py (quality scoring)
- Issues: Type errors in activity_learning.py

---

### 3. metabob-cli (MCP Server)

**Purpose**: MCP server with Metabob tools

**Key Features**:
- 9 MCP tools for code quality
- CPG integration for local analysis
- Activity template execution
- File content extraction

**MCP Tools**:
- metabob_search_codebase_issues
- metabob_get_priority_issues
- metabob_mark_problem_complete
- metabob_annotate_component
- metabob_analyze_change_impact
- metabob_suggest_related_changes
- metabob_list_file_components
- metabob_search_activities
- metabob_activity

**Recent Commits**:
1. `6805579de` - v1.9.0 with file content endpoints
2. `f4e44b1b7` - Fix CI runner
3. `2c6c6d149` - Bundle proto wheel

---

### 4. metabob-dashboard (UI)

**Purpose**: Web dashboard for visualization

**Key Features**:
- Code quality visualization
- Activity execution metrics
- Learning analytics
- Multi-deployment modes (local/cloud/mock)

**Technologies**:
- React 18, Material-UI
- Redux Toolkit, RTK Query
- Recharts, Playwright

**Recent Commits**:
1. `396cd05` - V2 API migration + local dev
2. `f1584d7` - Cost tracking + accuracy tests
3. `0c79b72` - Token refresh fix

**In-Flight**:
- New: .env files for multi-mode deployment

---

### 5. metabob-proto (Shared Types)

**Purpose**: Protocol buffer definitions

**Features**:
- gRPC service definitions
- Shared data models
- Cross-language type safety

---

### 6. cpg-inference (Code Analysis)

**Purpose**: Code Property Graph engine

**Features**:
- Tree-sitter parsing
- Component extraction
- Dependency graphs
- Change impact analysis

---

### 7. platform (Infrastructure)

**Purpose**: Kubernetes deployment configs

**Features**:
- Helm charts for all services
- Multi-environment support
- Resource management

**Recent Commits**:
1. `555c40b` - Fix SurrealDB values
2. `af0ba73` - Increase RPC API memory
3. `14ecfd7` - Add memory limits

**In-Flight**:
- New: Slack bot chart, SurrealDB StatefulSet
- Modified: Resource limits across services

---

## Core Capabilities

### 1. Activity System (30 Templates)

**Production Templates**:
- fix-bug-complete
- add-feature-complete
- refactor-component-complete
- validate-build-process-complete
- cleanup-documentation-and-tests

**Experimental Templates**:
- organize-documentation-* (3 variants)
- debug-activity-* (2 variants)
- diagnose-startup-issues
- multi-agent-acp-workflow
- unified-impulse-* (2 variants)

**Test Templates**: 15+ for development

---

### 2. Metabob Integration

**Features**:
- Issue detection and prioritization
- Change impact analysis
- Cochange prediction
- Component annotations
- Safety assessment

**Workflow**:
```
Code → CPG Analysis → Issues → Priority → Recommendations
```

---

### 3. Learning Loop

**Capabilities**:
- Execution tracking (success/failure/cost)
- Template evolution
- A/B testing (variants)
- Gradient-based quality scoring (new)

**Data Flow**:
```
Execution → Backend → SurrealDB → Analytics → Dashboard
```

---

### 4. Multi-Agent Orchestration

**Features**:
- Docker container execution
- SSH remote execution
- Impulse sharing
- Bidirectional communication

**Use Cases**:
- Stack separation (frontend/backend agents)
- Isolated testing
- Parallel processing

---

### 5. Developer Experience

**Interfaces**:
- CLI (opencode command)
- Dashboard (web UI)
- Slack Bot (chat interface)
- MCP Server (tool interface)

---

## Architecture

### Component Map
```
┌──────────────────────────────────────┐
│  CLI / Dashboard / Slack Bot         │
│         ↓         ↓         ↓        │
│    ┌──────────────────────────┐     │
│    │   metabob-opencode       │     │
│    │  (Activity Engine)       │     │
│    └──────────┬───────────────┘     │
│               ↓                      │
│    ┌──────────────────────────┐     │
│    │   metabob-rpc-api        │     │
│    │  (Backend + Learning)    │     │
│    └──────────┬───────────────┘     │
│               ↓                      │
│    ┌──────────────────────────┐     │
│    │   SurrealDB + Redis      │     │
│    └──────────────────────────┘     │
│               ↑                      │
│    ┌──────────────────────────┐     │
│    │   metabob-cli (MCP)      │     │
│    │   cpg-inference          │     │
│    └──────────────────────────┘     │
└──────────────────────────────────────┘
```

### Data Flow: User Request
```
User: "fix bug in auth.ts"
  ↓
CLI parses command
  ↓
Activity Engine loads template
  ↓
Tasks execute sequentially
  ↓
Report to Learning Loop
  ↓
Display results
```

---

## In-Flight Changes

### By Repository

**metabob-opencode**:
- Activity tool improvements
- Template quality scoring (new)
- Debug template v3 (new)
- Slack bot updates

**metabob-rpc-api**:
- Gradient analysis (new feature)
- V2 API improvements
- Type errors (needs proto sync)

**metabob-cli**:
- Activity tool enhancements

**metabob-dashboard**:
- Environment configuration (5 .env files)

**platform**:
- Slack bot Helm chart (new)
- SurrealDB StatefulSet migration (in progress)
- Resource limit updates

---

## Known Issues

### High Priority
1. Type errors in activity_learning.py (proto sync needed)
2. Import errors in v2_activities.py (gradient_analysis)

### Medium Priority
3. Dashboard .env files not in version control
4. SurrealDB persistence migration incomplete

### Low Priority
5. Documentation consolidation pending
6. Docker Desktop instability

---

## Next Steps

### Immediate (This Week)
1. Fix type errors in rpc-api (1 hour)
2. Complete gradient analysis integration (4 hours)
3. Deploy SurrealDB StatefulSet (2 hours)
4. Create dashboard .env templates (30 min)

### Short-term (2 Weeks)
1. Deploy Slack bot (4 hours)
2. Documentation consolidation (2 hours)
3. Template quality dashboard (8 hours)
4. Activity E2E tests (8 hours)

### Long-term (Month)
1. Template A/B testing infrastructure (16 hours)
2. Cochange prediction improvements (16 hours)
3. Impulse system optimization (12 hours)
4. Multi-agent enhancements (16 hours)

---

## Technology Stack Summary

### Frontend
- React 18.3.1, Material-UI v5
- Redux Toolkit, Recharts
- Playwright, Jest

### Backend
- Python 3.11+, FastAPI
- SurrealDB, Redis, Celery
- OpenAI API, cpg-inference

### CLI & Tools
- Python 3.12+ (CLI), Bun (OpenCode)
- Click, MCP, ACP
- Tree-sitter, cpg-inference

### Infrastructure
- Kubernetes, Helm, Helmfile
- Docker, kubectl

---

## Maintenance

**Regenerate This Document**:
- After major releases
- Quarterly (every 3 months)
- After architecture changes

**Command**:
```bash
opencode --activity organize-documentation-and-create-codebase-state-snapshot
```

**Next Review**: 2026-05-17 (quarterly)

---

## Related Documentation

- CODEBASE_STATE.md (quick overview)
- DOCUMENTATION_INDEX.md (doc catalog)
- ACTIVITY_SYSTEM_QUICK_START.md (activity guide)
- ARCHITECTURE_SEPARATION_OF_CONCERNS.md (boundaries)

---

**Document Status**: ✅ Complete  
**Generated By**: organize-documentation-and-create-codebase-state-snapshot  
**Generation Time**: 2026-02-17  
**Type**: Comprehensive with full details

---

**End of Comprehensive Codebase State Snapshot**
