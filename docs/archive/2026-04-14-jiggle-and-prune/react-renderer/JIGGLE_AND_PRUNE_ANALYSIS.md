# Jiggle-and-Prune Analysis: React-Renderer Vessel

**Date**: 2026-04-14
**Vessel**: react-renderer
**Analysis Phase**: Documentation conflict and alignment check

---

## Executive Summary

The react-renderer vessel documentation requires moderate updates to align with:
1. Composition learning architecture (deterministic activities, state-space driven selection)
2. Discovery-vessel integration patterns (using standardized client)
3. Standard configuration from docs/STANDARD_CONFIGURATION.md
4. Resolver universality (impulses as universal data, not LLM-specific)

**Current State**:
- ARCHITECTURE.md exists but lacks CLAUDE.md
- Partial implementation in src/ (discovery client already integrated)
- Discovery spec exists in openspec/changes/vessel-integration-standardization/
- No conflicting documentation detected

**Required Actions**:
1. Create CLAUDE.md with standardized configuration
2. Update ARCHITECTURE.md alignment with foundation
3. Document deterministic resolution patterns
4. Add composition learning context

---

## Documentation Inventory

### Existing Documentation

| File | Location | Purpose | Status |
|------|----------|---------|--------|
| ARCHITECTURE.md | /repos/react-renderer/ | Core architecture | **Needs update** |
| vessel.json | /repos/react-renderer/ | Vessel manifest | **Current** |
| spec.md | /openspec/changes/vessel-integration-standardization/specs/react-renderer-discovery-integration/ | Discovery integration spec | **Current** |

### Missing Documentation

| File | Should Contain | Priority |
|------|---------------|----------|
| CLAUDE.md | Standard vessel configuration, impulse types, activities, discovery setup | **HIGH** |

---

## Conflict Analysis

### 1. No CLAUDE.md File

**Issue**: React-renderer lacks a CLAUDE.md file for AI-assisted development.

**Impact**:
- No standardized configuration reference
- Missing impulse type documentation
- No activity template documentation
- Discovery integration not documented for developers

**Resolution**: Create CLAUDE.md following standard vessel pattern

---

### 2. ARCHITECTURE.md Alignment Gaps

**Current Issues**:

#### 2.1 LLM-Centric Framing (Minor)

**Location**: ARCHITECTURE.md, lines 3-5, 71-73

**Current Text**:
```markdown
React-renderer is a **UI rendering vessel** that resolves UI-related impulses
and renders them as React components. It operates as a "navigation system for
the impulse state space" - displaying portions of the shared impulse state to users.

**Key Insight:** The metadata allows reasoners (LLM or otherwise) to understand...
```

**Issue**: Overemphasizes LLM role in what is primarily a deterministic rendering system.

**Recommendation**: Reframe as deterministic UI resolver with impulse-driven composition.

---

#### 2.2 Missing Composition Learning Context

**Location**: ARCHITECTURE.md, section "Learning Metrics"

**Current Text**:
```markdown
## Learning Metrics

| Metric | Description |
|--------|-------------|
| `time_to_action` | Time until user takes action |
| `interaction_success` | Did action achieve goal? |
| `impulse_utilization` | % of impulses user viewed |
| `navigation_efficiency` | Clicks to reach goal |
```

**Issue**: Focuses on user metrics but doesn't explain how composition learning works.

**Missing Context**:
- How primitive compositions are recorded
- Which compositions lead to successful outcomes
- Thompson Sampling for UI pattern variants
- State-space driven primitive selection

**Recommendation**: Add section on composition learning and deterministic primitive resolution.

---

#### 2.3 Discovery Integration Not Documented

**Location**: ARCHITECTURE.md, section "Deployment"

**Current Text**:
```markdown
## Deployment

- **Namespace**: `activity-system`
- **Service**: `react-renderer.activity-system.svc.cluster.local:3000`
- **External**: `ui.metabob.local`
- **Dependencies**: surrealdb, metabob-activity-api
```

**Issue**: Doesn't mention discovery-vessel integration despite implementation.

**Evidence**: src/index.ts has discoveryClient integration (lines 18, 23-24, etc.)

**Recommendation**: Document discovery integration following STANDARD_CONFIGURATION.md.

---

#### 2.4 Activity Templates Not Specified

**Location**: ARCHITECTURE.md, section "Activities"

**Current Text**:
```markdown
### render-impulse-collection
Resolves UI impulses and renders them as components.

### update-from-execution-trace
Updates UI when activity execution progresses.

### handle-user-interaction
Converts user events into activity execution.
```

**Issue**: High-level descriptions but no specification of:
- Input/output impulse shapes
- Deterministic vs LLM-driven tasks
- Composition patterns
- Template file structure

**Recommendation**: Expand with structured activity documentation.

---

### 3. Vessel.json Configuration Gaps

**Location**: vessel.json

**Current State**:
```json
{
  "id": "react-renderer",
  "version": "0.1.0",
  "resolvers": [
    {
      "type": "ui_component",
      "protocol": "http",
      "endpoint": "/resolve/ui_component"
    }
    // ...
  ]
}
```

**Missing**:
- Discovery configuration schema
- Standard environment variable documentation
- Bootstrap/lifecycle hooks
- Health check specifications

**Recommendation**: Add discovery config section per STANDARD_CONFIGURATION.md.

---

## Alignment with Foundation Documents

### IMPULSE_ACTIVITY_FOUNDATION.md Alignment

**Current Alignment**: ✅ **Good**

The vessel correctly treats UI components as impulses:
- Primitive compositions are impulses with shape `ui_component`
- Resolution is deterministic (primitive renderer)
- No LLM involved in resolution (correct)

**Needs Improvement**:
- Document how primitives compose without LLM intervention
- Clarify resolver universality (primitives resolve to rendered output)
- Explain state-space navigation (viewport = budget allocation)

---

### STANDARD_CONFIGURATION.md Alignment

**Current Alignment**: ⚠️ **Partial**

**Implemented**:
- Discovery client integration (src/index.ts)
- Health endpoint with discovery status
- WebSocket protocol

**Missing**:
- Standardized environment variables documentation
- Configuration priority explanation
- Bootstrap delay configuration
- Graceful shutdown documentation

---

### Discovery Integration Spec Alignment

**Current Alignment**: ✅ **Good**

The spec.md in openspec/ accurately describes:
- Registration with discovery-vessel
- Heartbeat manager
- Graceful shutdown
- Impulse shapes resolved

**Implementation Status**:
- Discovery client: ✅ Implemented (uses @metabob/vessel-discovery-client)
- Health endpoint: ✅ Implemented
- Metadata: ⚠️ Could be enriched with primitive capabilities

---

## Recommended Changes

### Phase 1: Create CLAUDE.md (HIGH PRIORITY)

**Template**:
```markdown
# React-Renderer Vessel

> UI rendering vessel that resolves ui_component impulses to rendered React primitives

## Overview

React-renderer is a deterministic UI resolver that:
- Resolves `ui_component`, `ui_state`, and `viewport_state` impulses
- Composes 12 primitive types into unbounded visualizations
- Broadcasts updates via WebSocket to connected clients
- Records composition patterns for learning

**Key Principle**: Primitives are deterministically composed, not LLM-generated.

## Configuration

[Standard configuration following STANDARD_CONFIGURATION.md]

## Impulse Types Resolved

[Document the 3 shapes with schemas]

## Activities

[Document the 3 activities with structured specs]

## Discovery Integration

[Document registration, heartbeat, deregistration]

## Development

[Local setup, testing, deployment]
```

---

### Phase 2: Update ARCHITECTURE.md (MEDIUM PRIORITY)

**Changes**:
1. Add composition learning section
2. Document discovery integration
3. Expand activity specifications
4. Clarify deterministic resolution
5. Remove LLM-centric framing where inappropriate

---

### Phase 3: Archive Outdated Specs (LOW PRIORITY)

**No outdated specs detected** - openspec/ spec is current and accurate.

---

## Implementation Verification

### Discovery Integration Status

**Code Check**: ✅ **Implemented**

Evidence from src/index.ts:
```typescript
import { VesselClient, type DiscoveryConfig } from '@metabob/vessel-discovery-client'

let discoveryClient: VesselClient | null = null

// Lines 53-67: Health check includes discovery status
// Lines 223-260: Discovery client initialization
// Lines 279-295: Graceful shutdown with deregistration
```

**Recommendation**: Document this in CLAUDE.md and update ARCHITECTURE.md.

---

### Primitive System Status

**Code Check**: ✅ **Implemented**

Evidence from src/primitives/:
```
primitives/
├── badge.tsx
├── button.tsx
├── chart.tsx
├── code.tsx
├── container.tsx
├── data-table.tsx
├── graph.tsx
├── image.tsx
├── index.ts
├── input.tsx
├── progress.tsx
└── text.tsx
```

All 12 primitives mentioned in ARCHITECTURE.md exist.

**Recommendation**: Document primitive capabilities as discovery metadata.

---

### WebSocket Protocol Status

**Code Check**: ✅ **Implemented**

Evidence from src/websocket/:
```
websocket/
├── broadcaster.ts
├── handler.ts
└── protocol.ts
```

**Recommendation**: Cross-reference with ARCHITECTURE.md protocol documentation.

---

## Execution Plan

### Immediate Actions (This Session)

1. ✅ **Analysis Complete**: This document
2. ⬜ **Create CLAUDE.md**: Following standard vessel pattern
3. ⬜ **Update ARCHITECTURE.md**: Add missing sections
4. ⬜ **Update vessel.json**: Add discovery config section
5. ⬜ **Archive Analysis**: Move this to docs/archive/2026-04-14/

### Future Enhancements (Follow-up)

- Implement activity templates (JSON files in templates/)
- Add composition learning metrics to backend
- Expand primitive metadata in discovery registration
- Create integration tests for discovery heartbeat

---

## Conclusion

**Severity**: 🟡 **Moderate** - No critical conflicts, but documentation gaps exist

**Recommendation**: Proceed with execution phase to create CLAUDE.md and update ARCHITECTURE.md.

**No Breaking Changes Required**: Implementation is sound, only documentation needs updates.
