# MiniBob-TUI Alignment Report

**Generated:** 2026-04-08
**Status:** ⚠️ Out of Sync (3 days behind)

---

## Timeline Comparison

### MiniBob (repos/minibob)
**Latest Commit:** 2026-04-08 13:55:51 -0700
**Commit Hash:** da89c2c
**Subject:** feat(auth): implement API-key-only authentication

**Recent Activity:** 20+ commits between 2026-04-06 and 2026-04-08

### MiniBob-TUI (repos/minibob-tui)
**Latest Commit:** 2026-04-05 00:26:07 -0700
**Commit Hash:** 29c7dae
**Subject:** docs: add CI/CD integration section to CLAUDE.md

**Recent Activity:** Last meaningful feature work on 2026-03-26

### Gap: **3 days** (60+ commits in minibob)

---

## Key Changes in MiniBob (Since 2026-04-05)

### 1. Authentication System Overhaul (2026-04-08)

**Commit:** `da89c2c` - feat(auth): implement API-key-only authentication

**Impact on TUI:**
- MiniBob now uses API-key-only authentication (no more instance_id+api_key)
- AuthService simplified (removed JWT token management, minibob_record access)
- Bootstrap sequence changed to Phase 2 (API-key-only)
- Identity service integration for key validation

**TUI Changes Needed:**
```typescript
// OLD (minibob-tui might still use)
const auth = new AuthService({
  apiKey: config.apiKey,
  instanceId: config.instanceId  // ❌ No longer used
})

// NEW (minibob uses)
const auth = new AuthService({
  apiKey: config.apiKey  // ✅ Only API key needed
})
```

**Files Changed in MiniBob:**
- `src/auth-service.ts` (285 lines modified)
- `src/bootstrap/identity-client.ts` (50 lines modified)
- `index.ts` (170 lines modified)
- `src/config.ts` (37 lines modified)

### 2. Composition Framework (2026-04-07)

**Commit:** `57b3c8a` - feat(composition): add shape-based composition framework

**New Components:**
- `src/composition/engine.ts` (322 lines) - Composition execution engine
- `src/composition/types.ts` (160 lines) - Type definitions
- `src/composition/index.ts` (90 lines) - Public API

**Impact on TUI:**
- Activities can now compose other activities
- Shape-based activity chaining
- Input/output shape matching for automatic composition

**TUI Changes Needed:**
- Display composition graphs visually
- Show parent/child activity relationships
- Render composition execution traces

### 3. Ribosome Enhancement (2026-04-07)

**Commit:** `3d3f996` - feat(ribosome): extract attempt templates from failed improvisations

**Impact on TUI:**
- MiniBob now extracts templates from failed improvisations (not just successes)
- Learning from failures enables trailblazing
- More activity variants generated automatically

**TUI Changes Needed:**
- Display "extracted from failed attempt" metadata
- Show improvisation → template extraction flow
- Visualize variant trees

### 4. Shape-Based Goal Decomposition (2026-04-07)

**Commit:** `225ab6f` - feat(improviser): add shape declarations per step for activity extraction

**Impact on TUI:**
- Each improvisation step declares output shapes
- Shape metadata enables better activity extraction
- More precise activity recommendations

**TUI Changes Needed:**
- Display shape metadata per improvisation step
- Show shape evolution through execution
- Render shape-conditioned recommendations

### 5. Configuration Loading Fixes (2026-04-07)

**Commit:** `183aad3` - fix: consolidate API key configuration loading pathways

**Impact on TUI:**
- Unified config loading: environment → project → user → defaults
- More consistent behavior between MiniBob and TUI

**TUI Changes Needed:**
- Adopt same config priority chain
- Load from same config files
- Use same environment variables

### 6. Early Exit Validation (2026-04-06)

**Commit:** `708c356d` - feat(minibob): add shape validator system for behavioral early exit

**New Components:**
- `src/validators/shape-validators.ts` - Pre-execution validation

**Impact on TUI:**
- Activities can exit early without LLM if validation passes
- Faster execution for deterministic tasks

**TUI Changes Needed:**
- Display "skipped LLM" indicators
- Show validation pass/fail status
- Render validation rules

### 7. Direct Activity Execution (2026-04-07)

**Commit:** `bb3cfee` - feat(cli): add direct activity execution and trace-based development

**New CLI Commands:**
- `minibob run <activity-id>` - Execute activity directly
- `minibob trace <execution-id>` - View execution trace

**TUI Changes Needed:**
- Add keybinding for direct activity execution (e.g., Ctrl+R → run activity)
- Display activity picker/selector
- Show execution trace viewer

---

## Critical Breaking Changes

### 1. Bootstrap Sequence Change

**MiniBob (NEW):**
```typescript
=== Bootstrap Sequence (Phase 2: API-key-only) ===
1. Validating API key...
   ✓ API key configured
2. Connecting to activity API at https://activity.metabob.com...
   ✓ Activity vessel reachable
3. Initializing authentication...
   ✓ API key authentication ready
```

**MiniBob-TUI (OLD):**
```typescript
// Likely still using Phase 1 (instance_id + api_key)
// Needs update to Phase 2
```

### 2. AuthService Interface

**Before:**
```typescript
interface AuthServiceConfig {
  apiKey: string
  instanceId: string           // ❌ Removed
  activityApiUrl: string
}
```

**After:**
```typescript
interface AuthServiceConfig {
  apiKey: string               // ✅ Only this
  activityApiUrl: string
}
```

### 3. MCP Client Initialization

**Before:**
```typescript
// Registration with instance_id
await mcp.registerVessel({
  vesselId: config.instanceId,  // ❌ No longer used
  // ...
})
```

**After:**
```typescript
// Registration with API key auth only
await mcp.registerVessel({
  vesselId: config.vesselId,    // ✅ Generated from API key
  // ...
})
```

---

## Recommended Alignment Strategy

### Phase 1: Critical Updates (Immediate)

**Priority: CRITICAL**

1. **Update AuthService** (breaking change)
   - Remove `instanceId` parameter
   - Remove JWT token management
   - Update to API-key-only auth
   - Files: `src/lib/auth.ts`, `src/lib/minibob-client.ts`

2. **Update Bootstrap Sequence**
   - Change Phase 1 → Phase 2 messaging
   - Remove instance_id from config
   - Files: `src/index.ts`, `src/lib/embedded-minibob.ts`

3. **Update Configuration Loading**
   - Adopt unified config priority: env → project → user → defaults
   - Use same environment variables as MiniBob
   - Files: `src/config.ts`

### Phase 2: Feature Parity (Week 1)

**Priority: HIGH**

4. **Add Composition Visualization**
   - Display composition graphs
   - Show parent/child activity relationships
   - Render shape-based chaining
   - Files: `src/components/`, `src/lib/regions.ts`

5. **Add Shape Display**
   - Show input/output shapes per task
   - Display shape metadata
   - Render shape-conditioned recommendations
   - Files: `src/components/activity-component.tsx`

6. **Add Early Exit Indicators**
   - Display "skipped LLM" badges
   - Show validation pass/fail
   - Render validation rules
   - Files: `src/components/task-list-component.tsx`

### Phase 3: Enhanced Features (Week 2)

**Priority: MEDIUM**

7. **Add Direct Activity Execution**
   - Keybinding: Ctrl+R → activity picker
   - Display activity selector
   - Show execution trace viewer
   - Files: `src/index.ts`, `src/components/`

8. **Add Ribosome Visualization**
   - Display "extracted from improvisation" metadata
   - Show template extraction flow
   - Visualize variant trees
   - Files: `src/components/factory.ts`

---

## Files Requiring Updates

### Critical (Phase 1)

```
repos/minibob-tui/
├── src/
│   ├── index.ts                    # Bootstrap sequence change
│   ├── config.ts                   # Unified config loading
│   ├── lib/
│   │   ├── auth.ts                 # ❌ BREAKING: Remove instanceId
│   │   ├── minibob-client.ts       # Update auth headers
│   │   └── embedded-minibob.ts     # Bootstrap Phase 2
│   └── types.ts                    # Update AuthConfig interface
```

### High Priority (Phase 2)

```
repos/minibob-tui/
├── src/
│   ├── components/
│   │   ├── activity-component.tsx  # Add shape display
│   │   ├── task-list-component.tsx # Add early exit indicators
│   │   └── factory.ts              # Add composition components
│   └── lib/
│       └── regions.ts              # Support composition metadata
```

### Medium Priority (Phase 3)

```
repos/minibob-tui/
├── src/
│   ├── index.ts                    # Add Ctrl+R keybinding
│   ├── components/
│   │   ├── activity-picker.tsx     # NEW: Activity selector
│   │   ├── trace-viewer.tsx        # NEW: Execution trace viewer
│   │   └── composition-graph.tsx   # NEW: Composition visualization
```

---

## Testing Checklist

After alignment, verify:

- [ ] TUI connects to MiniBob with API key only (no instanceId)
- [ ] Bootstrap sequence shows "Phase 2: API-key-only"
- [ ] Configuration loads from same priority chain as MiniBob
- [ ] Activities display input/output shapes
- [ ] Composition graphs render when activities chain
- [ ] Early exit validation indicators appear
- [ ] Direct activity execution works (Ctrl+R)
- [ ] Extracted templates show source metadata
- [ ] WebSocket connection remains stable
- [ ] All TUI tools still function (tui_emit, tui_observe, etc.)

---

## Migration Commands

```bash
# 1. Backup current minibob-tui state
cd repos/minibob-tui
git checkout -b backup-pre-alignment
git add -A && git commit -m "backup: before alignment with minibob Phase 2"

# 2. Create alignment branch
git checkout main
git checkout -b feat/align-with-minibob-phase2

# 3. Update dependencies (if MiniBob package.json changed)
cd ../minibob
git diff HEAD~20..HEAD package.json
# Copy any new dependencies to minibob-tui/package.json

# 4. Copy critical files from MiniBob (if needed)
cd ../minibob-tui
# Review and adapt:
# - src/auth-service.ts
# - src/config.ts
# - index.ts (bootstrap logic)

# 5. Test embedded mode
bun install
bun run start --embedded --dev

# 6. Test remote mode
# Terminal 1:
cd ../minibob && bun run index.ts --daemon --port 8080

# Terminal 2:
cd ../minibob-tui && bun run start --endpoint http://localhost:8080

# 7. Commit changes
git add -A
git commit -m "feat(tui): align with MiniBob Phase 2 API-key-only auth"
```

---

## Risk Assessment

### Low Risk
- Configuration loading changes (backward compatible)
- Shape display additions (new features)
- Composition visualization (new features)

### Medium Risk
- Bootstrap sequence changes (messaging only)
- Early exit indicators (UI only)

### High Risk
- **AuthService interface change** (BREAKING)
  - Removing instanceId parameter
  - Existing TUI instances will fail to connect
  - Migration strategy needed

### Mitigation Strategy

**For AuthService breaking change:**

```typescript
// Backward-compatible approach (if needed temporarily)
interface AuthServiceConfig {
  apiKey: string
  instanceId?: string  // Deprecated, ignored if provided
  activityApiUrl: string
}

class AuthService {
  constructor(config: AuthServiceConfig) {
    if (config.instanceId) {
      console.warn('[AuthService] instanceId is deprecated and ignored (Phase 2: API-key-only)')
    }
    // Use API key only
  }
}
```

---

## Summary

**Status:** MiniBob-TUI is 3 days (60+ commits) behind MiniBob

**Critical Changes:**
1. API-key-only authentication (BREAKING)
2. Bootstrap sequence Phase 2
3. Unified configuration loading

**New Features to Add:**
1. Composition framework visualization
2. Shape-based activity display
3. Early exit validation indicators
4. Ribosome extraction metadata
5. Direct activity execution UI

**Recommended Timeline:**
- Week 1: Critical updates (auth, bootstrap, config)
- Week 2: Feature parity (composition, shapes, validation)
- Week 3: Enhanced features (direct execution, trace viewer)

**Next Steps:**
1. Create alignment branch: `feat/align-with-minibob-phase2`
2. Update AuthService to API-key-only
3. Update bootstrap sequence to Phase 2
4. Test embedded and remote modes
5. Add composition/shape visualization
6. Document breaking changes in CHANGELOG
