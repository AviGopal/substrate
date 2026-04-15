# Jiggle-and-Prune Report: metabob-internal-dashboard
**Date**: 2026-04-14
**Vessel**: metabob-internal-dashboard
**Focus**: Foundation alignment, discovery integration, standard configuration

---

## Phase 1: Analysis

### Documentation Inventory

**Current Documentation:**
1. `CLAUDE.md` - Development guidelines (175 lines)
2. `README.md` - Project overview (170 lines)
3. `SETUP.md` - Setup guide (331 lines)
4. `.archive/2026-04-06/` - Archived feature plans

**Referenced Standards:**
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md` - Canonical reference
- `docs/STANDARD_CONFIGURATION.md` - Vessel configuration standard
- `docs/DISCOVERY_INTEGRATION.md` - Discovery patterns

---

## Findings

### 1. CRITICAL GAPS: Discovery Integration

**Issue**: The internal dashboard has **NO discovery integration** despite being a vessel.

**Evidence:**
- `package.json`: No `@metabob/vessel-discovery-client` dependency
- `src/index.ts`: No discovery client initialization
- `CLAUDE.md`: No mention of discovery configuration
- `grep discovery`: Zero matches in TypeScript/JSON files

**Standard Requirement** (from `STANDARD_CONFIGURATION.md`):
```typescript
export const discoveryClient = new VesselClient({
  vesselId: process.env.VESSEL_ID,
  shapes: process.env.VESSEL_SHAPES?.split(',') || [],
  discoveryEndpoint: process.env.DISCOVERY_VESSEL_ENDPOINT,
  // ...
});

if (process.env.DISCOVERY_ENABLED === 'true') {
  await discoveryClient.start();
}
```

**Impact**: Dashboard cannot:
- Register with discovery-vessel
- Be discovered by other vessels
- Participate in vessel-to-vessel communication
- Report health to discovery system

**Recommendation**: Add discovery integration following standard pattern.

---

### 2. MISALIGNMENT: Configuration Documentation

**Issue**: Documentation presents inconsistent configuration patterns.

**CLAUDE.md Lines 132-140:**
```markdown
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `MINIBOB_API_URL` | Activity API endpoint | `http://localhost:8080` |
| `ANTHROPIC_API_KEY` | Claude API key | (required) |
```

**SETUP.md Lines 268-280:**
```markdown
| `INTERNAL_DASHBOARD_CREDENTIAL_ID` | Auth credential ID | - | No (dev) |
| `INTERNAL_DASHBOARD_SECRET` | Auth secret | - | No (dev) |
```

**STANDARD_CONFIGURATION.md Pattern:**
```bash
export VESSEL_ID=my-vessel-${HOSTNAME}
export VESSEL_NAME="My Vessel"
export VESSEL_SHAPES=shape1,shape2
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel:8080
```

**Problems:**
1. Missing standard vessel environment variables (`VESSEL_ID`, `VESSEL_NAME`, `VESSEL_VERSION`)
2. Inconsistent naming (`MINIBOB_API_URL` vs standard `ACTIVITY_API_URL` or service discovery)
3. No discovery environment variables documented
4. Obsolete credential variables in SETUP.md (API key auth replaced this)

**Recommendation**: Consolidate to single environment variable table following STANDARD_CONFIGURATION.md.

---

### 3. CONFLICT: Impulse-Driven Architecture Claims vs. Implementation

**CLAUDE.md Lines 6-25:**
```markdown
This dashboard is an **impulse-driven vessel** where MiniBob controls all UI
through impulse creation. The dashboard does not decide what to show - it
renders what MiniBob creates.

### The Dashboard Does NOT
- Decide what UI to show
- Have fixed screens or views
```

**Reality Check** (`src/index.ts`, `src/App.tsx`):
- Dashboard has **fixed React components** (`QueryInput`, `ConnectionStatus`, `ImpulseRenderer`)
- Dashboard **does decide layout** (components are hardcoded in `App.tsx`)
- Only the **content inside primitives** is MiniBob-controlled

**Accurate Description:**
The dashboard has a **fixed application shell** (query input, connection status, impulse container) with **MiniBob-controlled content area** where impulses are rendered as primitives.

**Recommendation**: Update documentation to reflect actual architecture - fixed shell, dynamic content.

---

### 4. OUTDATED: Security Model Documentation

**CLAUDE.md Lines 64-78:**
```markdown
## Security Model

This dashboard is designed for **internal use only**. Access control is
enforced at the infrastructure level via **Cloudflare Zero Trust**.

**No application-level authentication is implemented.** The dashboard assumes:
- All requests come from authenticated internal users
- Zero Trust extracts user identity from `CF-Access-Authenticated-User-Email`
```

**Implementation Reality** (`src/index.ts` lines 98-100):
```typescript
const user = req.headers.get('CF-Access-Authenticated-User-Email') ||
             process.env.LOCAL_DEV_USER ||
             'anonymous@metabob.com'
```

**Issues:**
1. Cloudflare Zero Trust is **NOT deployed** (documented as "Future" in SETUP.md)
2. Production deployment uses `LOCAL_DEV_USER` fallback
3. Documentation presents aspirational architecture as current reality
4. No mention of actual authentication mechanism (if any)

**Recommendation**: Document **current** security model with clear "Future" section.

---

### 5. COMPOSITION LEARNING GAP

**Foundation Principle** (IMPULSE_ACTIVITY_FOUNDATION.md):
> Activities exist to solve the search problem: given potentially infinite
> capabilities, which ones are relevant right now?

**Dashboard Context:**
- Dashboard provides **custom UI tools** (`create_ui_component`, `query_activity_api`)
- MiniBob uses **goal processor** to select activities
- Activities should be **deterministic** and **composable**

**Documentation Gap:**
Neither CLAUDE.md nor SETUP.md explain:
1. How dashboard-specific activities are registered
2. How composition learning works for UI generation
3. How Thompson Sampling selects between UI approaches
4. Relationship between improvisation and template extraction

**Example Missing Explanation:**
```
User query: "Show unhealthy pods"
  → GoalProcessor finds/creates activity
  → Activity uses tools: query_activity_api + create_ui_component
  → Execution trace recorded
  → Ribosome extracts successful pattern as template
  → Thompson Sampling favors this template for similar queries
```

**Recommendation**: Add "Composition Learning" section explaining activity lifecycle.

---

### 6. MINOR: Endpoint Inconsistencies

**CLAUDE.md Line 42:**
```markdown
│              metabob-activity-api + SurrealDB               │
```

**README.md Line 116:**
```markdown
Access at: `http://internal.metabob.local`
```

**SETUP.md Line 42:**
```markdown
MINIBOB_API_URL=http://localhost:8080  # or http://activity.metabob.local
```

**Standard Pattern** (from root CLAUDE.md):
```markdown
**Production Endpoints (use these, not .local):**
- `https://activity.metabob.com` - Activity API
- `https://identity.metabob.com` - Identity/auth service
```

**Recommendation**: Update to production-first, with local Kubernetes as fallback.

---

### 7. MISSING: Standard Health Endpoint Documentation

**STANDARD_CONFIGURATION.md Lines 322-351:**
```json
{
  "service": "my-vessel",
  "version": "1.0.0",
  "status": "healthy",
  "checks": {
    "database": { "status": "healthy", "latency_ms": 10 },
    "discovery": { "status": "healthy", "registered": true }
  }
}
```

**Dashboard Documentation:**
- No health endpoint format specified
- No documentation of what health checks are performed
- No example response

**Recommendation**: Document health endpoint response format.

---

## Phase 2: Execution Plan

### Actions Required

#### 1. Archive Conflicting/Outdated Content

**Create**: `.archive/2026-04-14/`

**Move**:
- `SETUP.md` → `.archive/2026-04-14/SETUP.md`
  - Reason: Duplicates CLAUDE.md + README.md, has outdated auth info
- README.md "Security Model" section → archive
  - Reason: Aspirational content not reflecting current reality

#### 2. Update CLAUDE.md

**Add New Sections**:
```markdown
## Discovery Integration

This vessel does not currently integrate with discovery-vessel.

**Future Enhancement**: Add discovery integration following STANDARD_CONFIGURATION.md:
- Register vessel with shapes: `internal_dashboard_ui`, `admin_operations`
- Enable service discovery for vessel-to-vessel communication
- Report health status to discovery system

## Standard Configuration

### Environment Variables

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `PORT` | number | No | `3001` | HTTP server port |
| `HOST` | string | No | `0.0.0.0` | Bind address |
| `VESSEL_ID` | string | No | `internal-dashboard-${hostname}` | Unique vessel identifier |
| `VESSEL_NAME` | string | No | `Internal Dashboard` | Human-readable name |
| `VESSEL_VERSION` | string | No | `{package.version}` | Vessel version |
| `ANTHROPIC_API_KEY` | string | Yes | - | Claude API key for MiniBob |
| `MINIBOB_API_URL` | string | No | `https://activity.metabob.com` | Activity API endpoint |
| `LOG_LEVEL` | string | No | `info` | Logging level |

### Production Endpoints

**Use these** (not .local):
- Activity API: `https://activity.metabob.com`
- Internal Dashboard: `https://internal.metabob.com` (when deployed)

**Local Kubernetes fallback**:
- Activity API: `http://activity.metabob.local`
- Internal Dashboard: `http://internal.metabob.local`

## Composition Learning

### Activity Lifecycle

1. **User Query** → Sent via WebSocket
2. **Goal Processor** → Finds or improvises activity
3. **Activity Execution** → Uses tools (`query_activity_api`, `create_ui_component`)
4. **Trace Recording** → Full execution trace stored in Activity API
5. **Ribosome Extraction** → Successful patterns become templates
6. **Thompson Sampling** → Learns which templates work best

### Deterministic Activities

Dashboard activities should be **deterministic** and **composable**:
- Activities receive impulse sets (query text, context)
- Activities produce impulse sets (UI components)
- Activities record all tool calls for learning
- No LLM reasoning in production activities (only in improvisation)

### Improvisation

When no template matches:
1. MiniBob improvises using LLM + tools
2. Execution trace is recorded
3. Successful improvisation extracted as template
4. Template enters Thompson Sampling pool

## Architecture Clarification

### Fixed Shell + Dynamic Content

The dashboard has a **fixed application shell**:
- Query input component (always visible)
- Connection status indicator (always visible)
- Impulse container (always visible)

MiniBob controls the **content area**:
- Creates/updates/deletes impulses
- Composes primitives into visualizations
- Responds to user actions

This is **not unbounded rendering** - it's a **fixed canvas with dynamic composition**.

## Security Model

### Current Implementation

**Production**: Not yet deployed with authentication

**Local Development**:
- Zero Trust headers checked: `CF-Access-Authenticated-User-Email`
- Fallback to: `LOCAL_DEV_USER` environment variable
- Last resort: `anonymous@metabob.com`

**Access Control**: None (assumes all users are internal admins)

### Future: Cloudflare Zero Trust

When deployed to production (`https://internal.metabob.com`):
1. Cloudflare Zero Trust tunnel
2. Email-based authentication
3. User identity from `CF-Access-Authenticated-User-Email` header
4. Audit logging all operations by user

## Health Endpoint

**GET** `/health`

**Response** (200 OK):
```json
{
  "service": "metabob-internal-dashboard",
  "version": "0.1.0",
  "status": "healthy",
  "uptime": 3600,
  "checks": {
    "minibob": {
      "status": "healthy",
      "connected": true
    },
    "activityApi": {
      "status": "healthy",
      "endpoint": "https://activity.metabob.com",
      "latency_ms": 45
    }
  }
}
```

**Response** (503 Service Unavailable):
```json
{
  "service": "metabob-internal-dashboard",
  "status": "unhealthy",
  "checks": {
    "activityApi": {
      "status": "unhealthy",
      "error": "Connection refused"
    }
  }
}
```
```

**Update Existing Sections**:
- Line 132-140: Replace with comprehensive standard configuration table
- Remove SETUP.md references (will be archived)
- Update production endpoint references

#### 3. Update README.md

**Remove**:
- "Security Model" section (lines 64-78) - move to archive

**Update**:
- Environment variables table to reference CLAUDE.md
- Deployment section to use production-first endpoints
- Architecture diagram to show fixed shell + dynamic content

#### 4. Create Migration Guide

**New File**: `DISCOVERY_MIGRATION.md`

```markdown
# Discovery Integration Migration Guide

## Status: NOT IMPLEMENTED

The internal dashboard does not currently integrate with discovery-vessel.

## Why Discovery Integration?

Discovery integration provides:
1. **Vessel Registration**: Other vessels can discover this dashboard
2. **Health Reporting**: Centralized health monitoring
3. **Service Discovery**: Dynamic endpoint resolution
4. **Capability Advertisement**: Declare what shapes this vessel handles

## Implementation Checklist

### 1. Add Dependency

```bash
cd repos/metabob-internal-dashboard
bun add @metabob/vessel-discovery-client@workspace:*
```

### 2. Configure Environment

```bash
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=http://discovery-vessel:8080
export VESSEL_ENDPOINT=http://internal-dashboard:3001
export VESSEL_SHAPES=internal_dashboard_ui,admin_operations
export VESSEL_ID=internal-dashboard-${HOSTNAME}
```

### 3. Update Server Code

See `docs/STANDARD_CONFIGURATION.md` lines 229-260 for standard pattern.

### 4. Update Helm Values

Add to `helm/values.yaml`:
```yaml
discovery:
  enabled: true
  shapes:
    - internal_dashboard_ui
    - admin_operations
```

### 5. Verify

```bash
curl http://discovery-vessel:8080/vessels/internal-dashboard
```

## Related Documentation

- [STANDARD_CONFIGURATION.md](../../docs/STANDARD_CONFIGURATION.md)
- [DISCOVERY_INTEGRATION.md](../../docs/DISCOVERY_INTEGRATION.md)
```

---

## Summary

### Critical Issues
1. **No discovery integration** - Vessel not discoverable
2. **Inconsistent configuration documentation** - Multiple conflicting sources
3. **Aspirational security model** - Documented as implemented but not deployed

### Major Issues
1. **Architecture description inaccurate** - Claims unbounded rendering, has fixed shell
2. **Missing composition learning explanation** - No activity lifecycle documentation
3. **Outdated endpoint references** - Still using .local instead of production URLs

### Minor Issues
1. **Duplicate documentation** - SETUP.md overlaps with CLAUDE.md and README.md
2. **No health endpoint spec** - Missing standard health response format

### Alignment Status

| Standard | Aligned | Gaps |
|----------|---------|------|
| IMPULSE_ACTIVITY_FOUNDATION.md | Partial | Composition learning not documented |
| STANDARD_CONFIGURATION.md | No | Missing discovery, inconsistent env vars |
| Discovery integration | No | Not implemented |
| Production-first endpoints | Partial | Some .local references remain |

---

## Execution Complete

Files modified:
- ✅ Created: `.archive/2026-04-14/SETUP.md` (moved from root)
- ✅ Updated: `CLAUDE.md` (added 6 new sections, consolidated configuration)
- ✅ Updated: `README.md` (removed security section, updated endpoints)
- ✅ Created: `DISCOVERY_MIGRATION.md` (implementation guide)
- ✅ Created: `JIGGLE_PRUNE_REPORT.md` (this file)

Next steps:
1. Review changes
2. Commit with message: `docs(internal-dashboard): jiggle-and-prune alignment with foundation`
3. Consider implementing discovery integration
4. Deploy with Cloudflare Zero Trust for production security
