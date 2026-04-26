# Vessel Documentation Index

This document indexes all vessel-specific documentation and tracks their currency relative to the super-repo's canonical CLAUDE.md.

## Vessel Documentation Map

### Core Infrastructure Vessels

#### 1. Discovery-Vessel (`repos/discovery-vessel`)
- **CLAUDE.md**: Apr 14, 2026 (10KB) - Vessel registry and capability resolver
- **README.md**: Capability queries, heartbeat management, health scoring
- **Key Docs**: 
  - `test/QUICK_START.md` - Testing quickstart
  - `test/TEST_EXECUTION_REPORT.md` - Test results

**Canonical Reference**: CLAUDE.md §1 (metabob-devbob root)

---

#### 2. Identity-Vessel (`repos/identity-vessel`)
- **README.md**: API-key + JWT issuer
- **CLAUDE.md**: N/A (minimal documentation)
- **Key Docs**:
  - `AUTHENTICATION_TRACE_FIXES.md` - Auth trace improvements
  - `KEY_MANAGEMENT_MIGRATION_PLAN.md` - Key management evolution

**Canonical Reference**: CLAUDE.md Authentication section

---

#### 3. metabob-activity-api (`repos/metabob-activity-api`)
- **CLAUDE.md**: Apr 22, 2026 (9KB) - Learning backend guidelines
- **README.md**: Backend overview, schema, endpoints
- **Key Docs**:
  - `API_REFERENCE.md` - Complete API reference
  - `DEPLOYMENT_WORKFLOW.md` - Deployment procedures
  - `docs/SCHEMA_MIGRATION_GUIDE.md` - Schema changes
  - `docs/SHAPE_MATCH_SCORING.md` - Impulse shape matching
  - `PATTERN_EXTRACTION_IMPLEMENTATION.md` - Pattern learning

**Canonical Reference**: CLAUDE.md §3 (metabob-devbob root)

---

### Execution & Control Vessels

#### 4. MiniBob (`repos/minibob`)
- **CLAUDE.md**: Apr 22, 2026 (16KB) - Development guidelines
- **README.md**: Project overview
- **CHANGELOG.md**: Version history
- **Key Docs**:
  - `.metabob/minibob-trace-config.md` - Trace configuration

**Notable Recent Changes**:
- v0.8.0: impulse-resolve + audit-and-backfill activity
- Template-dispatchable resolvers (14 registered)
- Activity-driven goal processing (meta-activity chains)

**Canonical Reference**: CLAUDE.md §2 (metabob-devbob root)

---

#### 5. Workbench (`repos/workbench`)
- **CLAUDE.md**: Apr 22, 2026 (10KB) - UI development guide
- **README.md**: Project overview
- **OPENSPEC.md**: OpenSpec change tracking
- **Key Docs**:
  - `docs/IMPLEMENTATION_GUIDE.md` - Component implementation
  - `docs/WEBSOCKET_PROTOCOL.md` - Live execution streaming
  - `docs/API_INTEGRATION.md` - Backend integration
  - `INDEX.md` - Component index
  - `QUICKSTART.md` - Getting started

**Notable Recent Changes**:
- Trajectory editor with goal-to-activity mapping
- Thompson Sampling integration
- Live execution monitor with Gantt timeline
- Composition builder with cycle detection

**Canonical Reference**: CLAUDE.md §5 (metabob-devbob root)

---

#### 6. Deployment (`repos/deployment`)
- **CLAUDE.md**: Comprehensive deployment guidelines
- **README.md**: Deployment overview
- **DEPLOYMENT_WORKFLOW.md**: Complete workflow (referenced in root CLAUDE.md)
- **Key Docs**:
  - `QUICK_DEPLOY_REFERENCE.md` - Quick reference
  - `docs/PROMOTION_WORKFLOW.md` - Promotion to production
  - `docs/TLS_CERTIFICATE_MANAGEMENT.md` - TLS setup
  - `scripts/REGENERATE_KEYS_QUICKREF.md` - Key management
  - `monitoring/README.md` - Monitoring setup

**Canonical Reference**: CLAUDE.md Deployment Workflows section

---

### Data & Concept Vessels

#### 7. Concept-DB (`repos/concept-db`)
- **CLAUDE.md**: Apr 5, 2026 (9KB) - Concept management
- **README.md**: Graph relationships, MCP tools

**Key Features**:
- Concepts as impulses with graph relationships
- ExecutionObserver WebSocket client for passive learning
- Discovery-vessel registration (5 advertised shapes)

**Canonical Reference**: CLAUDE.md Adjacent Vessels section

---

#### 8. Conversation-Vessel (`repos/conversation-vessel`)
- **README.md**: LLM conversations using Vercel ai-sdk
- **CLAUDE.md**: (New vessel, v0.1.0 as of Apr 23)

**Key Features**:
- Multi-LLM support
- Impulse system integration
- Resolver server (4 endpoints)

**Canonical Reference**: CLAUDE.md Adjacent Vessels section

---

### Dashboard & UI Vessels

#### 9. Activity-Dashboard (`repos/activity-dashboard`)
- **CLAUDE.md**: Apr 22, 2026 - Development guide
- **README.md**: Observability dashboard
- **Key Docs**:
  - `JIGGLE_AND_PRUNE_ANALYSIS.md` - Documentation audit
  - `JIGGLE_AND_PRUNE_SUMMARY.md` - Cleanup results

**Canonical Reference**: CLAUDE.md §4 (metabob-devbob root)

---

#### 10. Metabob-Cloud-Dashboard (`repos/metabob-cloud-dashboard`)
- **CLAUDE.md**: SaaS frontend guide
- **README.md**: Cloud dashboard overview

**Canonical Reference**: CLAUDE.md Core Components section

---

### MCP & Tool Vessels

#### 11. Metabob-MCP (`repos/metabob-mcp`)
- **CLAUDE.md**: Apr 22, 2026 - MCP integration guide
- **README.md**: MCP server overview
- **Key Docs**:
  - `QUICK_START.md` - MCP quickstart
  - `DEPLOYMENT.md` - MCP deployment
  - `PUBLISHING.md` - Publishing to npm

**Canonical Reference**: Referenced in CLAUDE.md for MCP integration

---

#### 12. Terminal (`repos/terminal`)
- **CLAUDE.md**: Terminal vessel guide
- **README.md**: Terminal overview
- **Key Docs**:
  - `SETUP_AND_USAGE.md` - Setup guide
  - `HOW_IT_WORKS.md` - Architecture
  - `COMPOSITION_LEARNING.md` - Composition learning
  - `VESSEL_DISCOVERY.md` - Discovery integration

**Canonical Reference**: Core Components section

---

### Analysis & Utilities

#### 13. Metabob-Analysis-API (`repos/metabob-analysis-api`)
- **CLAUDE.md**: Apr 22, 2026 (8KB) - Analysis API guide
- **README.md**: Code analysis overview
- **Key Docs**:
  - `IMPULSE_RESOLUTION_IMPLEMENTATION.md` - Resolver implementation

**Canonical Reference**: CLAUDE.md Core Components section

---

#### 14. React-Renderer (`repos/react-renderer`)
- **CLAUDE.md**: React rendering vessel
- **README.md**: Rendering system overview
- **Key Docs**:
  - `ARCHITECTURE.md` - Renderer architecture

**Canonical Reference**: Core Components section

---

#### 15. K8s-Activity-Executor (`repos/k8s-activity-executor`)
- **CLAUDE.md**: Kubernetes executor guide
- **README.md**: Activity executor overview
- **Key Docs**:
  - `DISCOVERY_INTEGRATION.md` - Discovery integration
  - `QUICK_START_AUTH.md` - Auth setup
  - `LOCAL_VS_PRODUCTION.md` - Environment differences

---

### Experimental/Secondary Vessels

- **User-Vessel** (`repos/user-vessel`) - User interaction vessel
- **Minibob-TUI** (`repos/minibob-tui`) - Terminal UI
- **Metabob-Internal-Dashboard** (`repos/metabob-internal-dashboard`) - Internal observability
- **Metabob-Proto** (`repos/metabob-proto`) - Prototyping environment
- **Microplastic** (`repos/microplastic`) - Experimental components
- **CPG-Inference** (`repos/cpg-inference`) - Code analysis backend

---

## Documentation Currency Assessment

### Recently Updated (Apr 22-24, 2026)
✅ **Current**:
- minibob/CLAUDE.md - v0.8.0 resolver enhancements documented
- metabob-activity-api/CLAUDE.md - Learning backend guidance current
- workbench/CLAUDE.md - UI implementation guide current
- deployment/CLAUDE.md - Deployment procedures current

### Due for Review (Apr 14-21, 2026)
⚠️ **May need updates**:
- discovery-vessel/CLAUDE.md - Review for recent changes
- concept-db/CLAUDE.md - PassiveObserver documentation may need updates

### Not Directly Documented
ℹ️ **Self-documented via README**:
- identity-vessel - Uses README only
- conversation-vessel - New vessel (v0.1.0)

---

## Super-Repo (metabob-devbob) CLAUDE.md Status

**Last Updated**: 2026-04-24 (Just updated with percolation cleanup)

**Synchronization**: CLAUDE.md in root includes:
- ✅ All major vessel descriptions (§Core Components)
- ✅ Discovery integration patterns
- ✅ Activity-driven goal processing
- ✅ Template-dispatchable resolvers
- ✅ Authentication and RBAC
- ✅ Deployment workflows
- ✅ Multi-tenant architecture

**Gaps Identified**: None major (comprehensive)

---

## Recommendations for Future Percolation

1. **Weekly**: Check vessel CLAUDE.md files for significant feature additions
2. **Monthly**: Review vessel README.md files for API changes
3. **Per-release**: Update root CLAUDE.md to reflect major vessel version bumps
4. **On-demand**: Percolate critical architecture changes immediately

---

## Archive Structure

All archived vessel documentation lives in `docs/archive/2026-04-24/` - see README.md for inventory.

---

**Index Last Updated**: 2026-04-24  
**Scope**: Super-repo documentation + 15+ major vessels  
**Status**: ✅ Current and coherent with canonical CLAUDE.md
