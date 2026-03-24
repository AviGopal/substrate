# OpenSpec Split Structure Guide

**Created:** 2026-03-23
**Purpose:** Document the per-repo + contracts + meta split for delegatable development

---

## Overview

We've restructured specs from monolithic to **delegatable** structure:

```
FROM: openspec/changes/analysis-api-extraction/ (all-in-one)

TO:   repos/{repo}/openspec/          (per-repo implementation)
      openspec/contracts/              (shared interfaces)
      openspec/meta/                   (deployment, orchestration)
```

---

## Agent Deployment Model

**One Agent Per Repo:**
- `analysis-api-agent` → repos/metabob-analysis-api
- `mcp-agent` → repos/metabob-mcp
- `cloud-dashboard-agent` → repos/metabob-cloud-dashboard
- `cpg-library-agent` → repos/cpg-inference-ts
- `minibob-agent` → repos/minibob

**One Agent Per Contract:**
- `db-schema-agent` → openspec/contracts/surrealdb-schema.md
- `analysis-api-contract-agent` → openspec/contracts/http-api-v2-analysis.md
- `mcp-tools-contract-agent` → openspec/contracts/mcp-analysis-tools.md
- `e2e-tests-agent` → openspec/contracts/e2e-tests.md

**Agents check related specs at end of implementation** (manual ripple)

---

## Contracts Created

### ✅ openspec/contracts/surrealdb-schema.md
**Contract ID:** `surrealdb-schema`
**Version:** 1.0.0
**Owner:** Database Schema Agent

**Defines:**
- Shared tables (analysis_problems, code_components, etc.)
- Graph relations (documented_by, depends_on)
- Migration strategy

**Consumers:**
- metabob-analysis-api
- metabob-activity-api
- metabob-cloud-dashboard

---

### ✅ openspec/contracts/http-api-v2-analysis.md
**Contract ID:** `http-api-v2-analysis`
**Version:** 1.0.0
**Owner:** Analysis API Contract Agent

**Defines:**
- 7 HTTP endpoints (GET /v2/analysis/priority, POST /v2/analysis/search, etc.)
- Request/response schemas
- Error responses
- Performance targets (P50/P99)

**Provider:** metabob-analysis-api
**Consumers:**
- metabob-mcp
- metabob-cloud-dashboard

---

### ✅ openspec/contracts/mcp-analysis-tools.md
**Contract ID:** `mcp-analysis-tools`
**Version:** 1.0.0
**Owner:** MCP Tools Contract Agent

**Defines:**
- 7 MCP tools (get_priority_issues, search_codebase_issues, etc.)
- Input/output schemas
- Side effects
- Recommended workflow

**Provider:** metabob-mcp
**Consumers:**
- AI Agents (Claude, Cursor, etc.)
- metabob-cloud-dashboard (potentially)

---

### ✅ openspec/contracts/e2e-tests.md
**Contract ID:** `e2e-tests`
**Version:** 1.0.0
**Owner:** E2E Testing Contract Agent

**Defines:**
- 6 test scenarios (full analysis flow, co-change prediction, etc.)
- Test manifest pattern (provenance tracking)
- Playwright integration
- Cleanup strategy
- NO MOCK DATA policy

**Affects:**
- All repos (must support E2E testing)

---

## Per-Repo Structure

Example: `repos/metabob-analysis-api/`

```
repos/metabob-analysis-api/
  openspec/
    ├─ manifest.yaml              ← Dependencies & ripple config
    │
    ├─ contracts/                 ← LOCAL contracts (if any)
    │   └─ (none for this repo)
    │
    ├─ internal/                  ← Implementation details
    │   ├─ architecture.md        (How it works)
    │   ├─ services.md            (Service design)
    │   └─ performance.md         (Benchmarks)
    │
    └─ tasks.md                   ← Work breakdown (repo-specific)
```

### Manifest.yaml Structure

```yaml
name: metabob-analysis-api
version: 1.0.0
owner: analysis-api-agent

provides:
  - id: http-api-v2-analysis
    version: 1.0.0
    contract: ../../../../openspec/contracts/http-api-v2-analysis.md

depends_on:
  - id: surrealdb-schema
    version: ^1.0.0
    source: ../../../../openspec/contracts/surrealdb-schema.md
    critical: true

  - id: cpg-library
    version: ^1.0.0
    source: ../cpg-inference-ts/openspec/contracts/api.md
    critical: true

ripple:
  notify_on_change:
    - repos/metabob-mcp/openspec/manifest.yaml
    - repos/metabob-cloud-dashboard/openspec/manifest.yaml

  check_before_complete:
    - Verify contract matches implementation
    - Update metabob-mcp if new endpoints added
    - Update metabob-cloud-dashboard if UI changes needed
    - Add E2E test scenarios
```

---

## Ripple Workflow

### Manual Ripple (MiniBob will automate later)

When completing implementation in a repo:

**Step 1: Check Your Manifest**
```bash
cd repos/metabob-analysis-api
cat openspec/manifest.yaml | grep -A 10 "ripple:"
```

**Step 2: Review Checklist**
- ✅ Contract document updated?
- ✅ Version bumped if breaking change?
- ✅ Dependent repos notified?
- ✅ E2E tests added/updated?

**Step 3: Create Ripple Tasks**
Go to each dependent repo and create tasks:

```
repos/metabob-mcp/openspec/tasks.md

[RIPPLE] Integrate new analysis endpoints
  - Triggered by: metabob-analysis-api v1.1.0
  - Depends on: http-api-v2-analysis@^1.1.0
  - Actions:
    • Review new endpoints in contract
    • Consider new MCP tools
    • Update integration tests
```

**Step 4: Notify Agents**
- Update GitHub issues
- Tag repo owners
- Link to contract changes

---

## Current Status

### ✅ Completed
- Created 4 contract documents
- Created manifest.yaml structure for metabob-analysis-api
- Defined agent deployment model
- Documented ripple workflow

### 🔄 Next Steps
1. Create manifest.yaml for remaining repos:
   - repos/metabob-mcp/openspec/manifest.yaml
   - repos/cpg-inference-ts/openspec/manifest.yaml
   - repos/metabob-cloud-dashboard/openspec/manifest.yaml
   - repos/minibob/openspec/manifest.yaml (if needed)

2. Extract internal/ specs from monolithic spec:
   - repos/metabob-analysis-api/openspec/internal/architecture.md
   - repos/metabob-analysis-api/openspec/internal/services.md
   - repos/metabob-mcp/openspec/internal/implementation.md
   - repos/metabob-cloud-dashboard/openspec/internal/components.md
   - repos/cpg-inference-ts/openspec/internal/translation.md

3. Split tasks.md:
   - repos/metabob-analysis-api/openspec/tasks.md (API-1 through API-19)
   - repos/metabob-mcp/openspec/tasks.md (MCP-1 through MCP-6)
   - repos/cpg-inference-ts/openspec/tasks.md (CPG-1 through CPG-13)
   - repos/metabob-cloud-dashboard/openspec/tasks.md (DASH-1, DASH-2, etc.)

4. Create meta specs:
   - openspec/meta/deployment.md (Helmfile, Kubernetes)
   - openspec/meta/integration.md (Service mesh, routing)

5. Create CPG library contract:
   - openspec/contracts/cpg-library-api.md (or in repos/cpg-inference-ts/openspec/contracts/)

---

## Benefits of This Structure

### ✅ Delegatable
- Each agent has clear boundaries
- Manifest defines dependencies explicitly
- Ripple checklist ensures alignment

### ✅ Modular
- Changes in one repo don't require editing other repos' specs
- Contracts act as interface boundaries
- Versioning enables gradual migration

### ✅ Testable
- E2E tests span all repos
- Each repo can have internal tests
- Contract validation ensures compatibility

### ✅ Scalable
- Easy to add new repos
- Easy to add new contracts
- MiniBob can automate ripple eventually

---

## FAQ

**Q: Where do I put a new feature spec?**
A: If it's internal to one repo → `repos/{repo}/openspec/internal/`
   If it's an interface others consume → `openspec/contracts/` or `repos/{repo}/openspec/contracts/`

**Q: When do I bump contract version?**
A: Breaking changes → major (2.0.0)
   New features (backward compatible) → minor (1.1.0)
   Bug fixes/docs → patch (1.0.1)

**Q: How do I know which repos to notify?**
A: Check contract document → "Consumers" section
   Check manifest.yaml → "ripple.notify_on_change"

**Q: What if I don't know which contract a feature belongs to?**
A: Start in `repos/{repo}/openspec/internal/` → Extract to contract later if needed

**Q: Can I have both repo-local and shared contracts?**
A: Yes! Put local contracts in `repos/{repo}/openspec/contracts/`
   Share contracts in `openspec/contracts/` when multiple repos need them

---

## Example: Adding a New Endpoint

**Scenario:** Add POST /v2/analysis/annotations/:id/resolve to analysis API

**Step 1: Update Contract**
```bash
vim openspec/contracts/http-api-v2-analysis.md

# Add new endpoint section
# Bump version: 1.0.0 → 1.1.0
```

**Step 2: Update Provider Manifest**
```bash
vim repos/metabob-analysis-api/openspec/manifest.yaml

# Update version in provides:
#   - id: http-api-v2-analysis
#     version: 1.1.0  # was 1.0.0
```

**Step 3: Implement in Repo**
```bash
cd repos/metabob-analysis-api
# ... implement endpoint ...
```

**Step 4: Update Internal Spec**
```bash
vim repos/metabob-analysis-api/openspec/internal/architecture.md

# Document how resolve endpoint works
```

**Step 5: Check Ripple Checklist**
```bash
cat openspec/manifest.yaml | grep -A 10 "check_before_complete:"

# ✅ Verify contract matches implementation
# ✅ Update metabob-mcp (new endpoint → new tool?)
# ✅ Update metabob-cloud-dashboard (UI for resolve?)
# ✅ Add E2E test scenario
```

**Step 6: Create Ripple Tasks**
```bash
vim repos/metabob-mcp/openspec/tasks.md

# Add:
# [RIPPLE-1] Evaluate new resolve endpoint
#   Consider adding resolve_annotation MCP tool
```

```bash
vim openspec/contracts/e2e-tests.md

# Add:
# E2E-7: Annotation Resolution Flow
```

**Done!** All specs remain in alignment.

---

## Tools (Future)

Once MiniBob is mature, these will be automated:

```bash
# Analyze ripple impact
minibob ripple analyze --repo metabob-analysis-api --contract http-api

# Create ripple tasks
minibob ripple create-tasks --from metabob-analysis-api

# Validate spec consistency
minibob ripple validate

# Generate dependency graph
minibob ripple graph
```

For now: **Manual checklist in manifest.yaml**

---

## Contact

**Structure Owner:** OpenSpec Architecture Team
**Last Updated:** 2026-03-23
**Questions:** Check ripple checklist in manifest.yaml
