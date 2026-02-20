# Session-Variant Affinity: Review Summary

## Quick Reference

**Date**: 2026-02-20
**Feature**: Session-Variant Affinity for Activity Templates
**Status**: ✅ **APPROVED** - Architecturally aligned with all systems

---

## The Problem

When a session creates an improved variant through trailblazing:
- ❌ **Current**: Session might revert to old failing variant (Thompson Sampling is random)
- ✅ **Proposed**: Session remembers and prefers its own created variant

---

## The Solution

### Backend (metabob-rpc-api)
**Changes**: 3 new functions + 2 new endpoints

1. **Storage**: `session:variant:affinity:{session_id}` → Redis hash
2. **Functions**: 
   - `record_session_variant_affinity()` - Store affinity
   - `get_session_variant_affinity()` - Query affinity
   - `select_variant_for_session()` - Selection with affinity check
3. **Endpoints**:
   - `POST /sessions/{id}/variant-affinity` - Set affinity
   - `GET /sessions/{id}/variant-affinity` - Get affinities
   - `POST /sessions/{id}/templates/select` - **NEW: Centralized selection API**

### OpenCode (metabob-opencode)
**Changes**: 2 new functions + 3 modifications

1. **New Functions**:
   - `Metabob.setSessionVariantAffinity()` - Record affinity (calls backend)
   - `Metabob.selectVariantForSession()` - **NEW: Delegate selection to backend**
2. **Modifications**:
   - `TrailblazingExecutor.createTemplateVariant()` - Record affinity after creating variant
   - `TemplateSelector.select()` - **CHANGED: Delegate to backend (not check locally)**
   - `ActivityTool` - Pass sessionId throughout execution

### CLI (metabob-cli)
**Changes**: NONE ✅

---

## Key Architectural Decision

**Question**: Should OpenCode check affinity locally or delegate to backend?

**Answer**: **Delegate to backend** (Option B)

### Why?

| Aspect | Local Check (Option A) | Backend Delegation (Option B) |
|--------|------------------------|-------------------------------|
| **Separation of Concerns** | ⚠️ Selection logic in 2 places | ✅ Backend owns all selection |
| **Logic Duplication** | ❌ Yes (affinity + Thompson) | ✅ No duplication |
| **Testing** | ⚠️ Test in 2 places | ✅ Test in backend only |
| **Future Strategies** | ⚠️ Update both places | ✅ Update backend only |

**Decision**: Use **Option B** - Backend selection API

---

## Architectural Alignment

### ✅ metabob-rpc-api (Backend)
- **Owns**: State, Thompson Sampling, selection logic
- **Adds**: Affinity state + centralized selection API
- **Compliance**: ✅ PERFECT - Backend owns all state

### ✅ metabob-cli (MCP Server)
- **Owns**: MCP tools, code quality, stateless gateway
- **Changes**: NONE
- **Compliance**: ✅ PERFECT - No execution logic

### ✅ metabob-opencode (Agent Platform)
- **Owns**: Execution, orchestration, tool calling
- **Changes**: Delegates selection to backend (no local logic)
- **Compliance**: ✅ PERFECT - Pure client

---

## Data Flow

### Creating Variant (Trailblazing)

```
User → OpenCode activity tool
  ↓
Activity fails → Trailblazing creates variant
  ↓
OpenCode → Backend: POST /templates (register variant)
  ↓
Backend → Redis: Store variant (content-hash)
  ↓
OpenCode → Backend: POST /sessions/{id}/variant-affinity
  ↓
Backend → Redis: Store affinity (session → variant)
  ↓
OpenCode continues with new variant ✅
```

### Using Affinity (Next Execution)

```
User → OpenCode activity tool
  ↓
OpenCode → Backend: POST /sessions/{id}/templates/select
  ↓
Backend checks Redis affinity
  ↓
Backend: Affinity exists? → Return affinity variant ✅
Backend: No affinity? → Thompson Sampling
  ↓
OpenCode executes with selected variant
```

---

## Benefits

| Benefit | Impact |
|---------|--------|
| **Session-Local Improvement** | ✅ Session uses its own variant immediately |
| **No Regression** | ✅ Won't revert to old failing variant |
| **Global Learning** | ✅ Other sessions discover better variant via Thompson Sampling |
| **Natural Workflow** | ✅ Automatic - no explicit variant API calls |
| **Isolation** | ✅ Affinity expires (7 days), doesn't affect other sessions |
| **Architecture** | ✅ Clean separation - backend owns selection |

---

## Implementation Checklist

### Phase 1: Backend Storage (1-2 days)
- [ ] Add Redis schema for affinity
- [ ] Implement `record_session_variant_affinity()`
- [ ] Implement `get_session_variant_affinity()`
- [ ] Update `select_variant_for_session()` with affinity check
- [ ] Add unit tests

### Phase 2: Backend API (1 day)
- [ ] Add `POST /sessions/{id}/variant-affinity` endpoint
- [ ] Add `GET /sessions/{id}/variant-affinity` endpoint
- [ ] Add `POST /sessions/{id}/templates/select` endpoint (NEW)
- [ ] Add API tests

### Phase 3: OpenCode Integration (2-3 days)
- [ ] Add `Metabob.setSessionVariantAffinity()`
- [ ] Add `Metabob.selectVariantForSession()` (NEW)
- [ ] Update `TrailblazingExecutor.createTemplateVariant()`
- [ ] Update `TemplateSelector.select()` to delegate
- [ ] Update `ActivityTool` to pass sessionId
- [ ] Add integration tests

### Phase 4: Testing (2 days)
- [ ] Test trailblazing creates affinity
- [ ] Test affinity selection works
- [ ] Test Thompson Sampling fallback
- [ ] Test cross-session isolation
- [ ] Test affinity expiration (TTL)
- [ ] Test ignore_affinity parameter

### Phase 5: Monitoring (1 day)
- [ ] Add affinity hit rate metrics
- [ ] Add affinity success rate metrics
- [ ] Add selection method distribution metrics
- [ ] Add logging for debugging

**Total Estimate**: 7-9 days

---

## Open Questions

### 1. Affinity TTL ⚠️
**Question**: 7 days fixed? Per-session? Per-template?
**Recommendation**: Per-session with configurable default (7 days)

### 2. Affinity Override ⚠️
**Question**: Should agent be able to ignore affinity?
**Recommendation**: Yes - add `ignore_affinity` parameter to selection API

### 3. Multi-Session Activities ⚠️
**Question**: What if activity spans multiple sessions?
**Recommendation**: Affinity is per-session, not per-activity (no conflict)

### 4. Metrics ⚠️
**Question**: How to track affinity effectiveness?
**Recommendation**: Add metrics to backend (hit rate, success rate, distribution)

---

## Documentation Updates

After implementation, update:

1. **API Documentation**:
   - Document new endpoints
   - Document selection API
   - Document affinity parameters

2. **Developer Guides**:
   - Explain when affinity is set
   - Explain how selection works
   - Explain how to override affinity

3. **Architecture Docs**:
   - Update separation of concerns
   - Update data flow diagrams
   - Update API surface documentation

---

## Approval

✅ **APPROVED FOR IMPLEMENTATION**

**Conditions**:
1. Use Option B (backend selection API)
2. Backend owns ALL selection logic
3. OpenCode delegates to backend
4. CLI remains unchanged

**Reviewers**:
- Architecture: ✅ Aligned with separation of concerns
- Backend: ✅ Backend owns state and selection
- OpenCode: ✅ Pure client, delegates selection
- CLI: ✅ No changes needed

---

## Next Steps

1. Create implementation tickets
2. Implement Phase 1 (backend storage)
3. Implement Phase 2 (backend API)
4. Implement Phase 3 (OpenCode integration)
5. Run full test suite
6. Deploy to staging
7. Monitor metrics
8. Deploy to production

**Timeline**: 2-3 weeks (including testing and deployment)

---

## Related Documents

- `VARIANT_CREATION_AND_SESSION_AFFINITY_ARCHITECTURE.md` - Full technical spec
- `SESSION_AFFINITY_ARCHITECTURAL_ALIGNMENT_REVIEW.md` - Detailed alignment analysis
- `ARCHITECTURE_SEPARATION_OF_CONCERNS.md` - System separation of concerns
- `BACKEND_FIRST_TEMPLATE_ARCHITECTURE.md` - Template architecture

---

**Conclusion**: Session-variant affinity is a well-designed feature that respects architectural boundaries and provides clear value to users. Proceed with implementation using the backend selection API approach (Option B).
