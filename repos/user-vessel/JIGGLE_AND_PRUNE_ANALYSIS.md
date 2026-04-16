# Jiggle-and-Prune Analysis: user-vessel Documentation

**Date**: 2026-04-14
**Scope**: repos/user-vessel documentation alignment with composition learning architecture

## Analysis Phase

### Existing Documentation Files

1. **README.md** (11,380 bytes)
   - Comprehensive vessel overview
   - REST API + Activities hybrid approach documented
   - Connection tracking system detailed
   - RBAC and security patterns explained
   - Discovery integration mentioned but not detailed
   - Alignment with foundation principles listed

2. **TESTING.md** (8,629 bytes)
   - Auth endpoint testing procedures
   - Password security implementation details
   - Database schema examples
   - Manual and automated testing workflows
   - References to local development (good)

3. **QUICKSTART.md** (2,499 bytes)
   - Quick reference for auth endpoints
   - Password requirements
   - Token expiry information
   - Testing commands

### Conflicts and Outdated Content

#### 1. Discovery Integration: Incomplete Documentation

**Location**: README.md lacks discovery integration details
**Issue**: Discovery is mentioned in manifest but not explained
**Current State**:
```
impulseTypes: ["user_profile", "org_settings", "api_key_info", "project_list"]
```

**Conflict**: No documentation on:
- How user-vessel registers with discovery-vessel
- What shapes it resolves
- Discovery client lifecycle
- Standard configuration from STANDARD_CONFIGURATION.md

**Recommended Action**: Add discovery integration section following STANDARD_CONFIGURATION.md

#### 2. Impulse Types: Resolver Pattern Not Documented

**Location**: README.md lines 336-342
**Issue**: Lists impulse types but doesn't explain resolver universality
**Current Text**:
```markdown
| Type | Description | Example Pointer |
|------|-------------|-----------------|
| `user_profile` | User details | `{type: "user_profile", user_id: "users:alice"}` |
```

**Conflict**: Missing:
- How to implement resolvers for these impulse types
- Shape metadata vs. content loading
- Integration with discovery system for shape-based routing
- Deterministic resolution (no LLM needed for user data)

**Recommended Action**: Expand impulse section with resolver implementation patterns

#### 3. Activities: Future vs. Present Tense

**Location**: README.md lines 314-330 ("Activities (Future)")
**Issue**: Section titled "Future" but some activities may already be implemented
**Current Text**:
```markdown
## Activities (Future)

Vessel functions to be registered with activity-api:

### 1. user-vessel:onboard-user
...
```

**Conflict**:
- Unclear whether these are aspirational or implemented
- No reference to composition learning (activities calling activities)
- Missing state-space driven selection explanation
- No mention of deterministic execution (no improvisation needed)

**Recommended Action**:
- Clarify implementation status
- Document deterministic nature of user management activities
- Explain how these compose with discovery-driven routing

#### 4. Configuration: Misalignment with STANDARD_CONFIGURATION.md

**Location**: README.md lines 188-200
**Issue**: Environment variables don't match standard configuration
**Current Variables**:
```
USER_VESSEL_PORT, USER_VESSEL_HOST
```

**Standard Pattern** (from STANDARD_CONFIGURATION.md):
```
PORT, HOST (not prefixed)
VESSEL_ID, VESSEL_NAME, VESSEL_VERSION
DISCOVERY_ENABLED, DISCOVERY_VESSEL_ENDPOINT
VESSEL_ENDPOINT, VESSEL_SHAPES
```

**Conflict**: Vessel-specific prefixes vs. standard naming
**Recommended Action**: Align with standard configuration or document deviations

#### 5. Hybrid Architecture: Needs Composition Learning Context

**Location**: README.md lines 16-23
**Issue**: Hybrid approach justified but missing composition learning perspective
**Current Text**:
```markdown
**Rationale:**
- Dashboard needs immediate auth responses (<100ms) - can't wait for activity execution
- Complex workflows benefit from Thompson Sampling and trace-based learning
- Progressive enhancement toward full activity-based model
```

**Missing Context**:
- REST endpoints are deterministic operations (no learning needed)
- Activities are for composition patterns (onboarding sequences, audit flows)
- Discovery enables shape-based routing to avoid LLM for simple lookups
- State-space is known (CRUD operations), no search needed

**Recommended Action**: Reframe hybrid approach in composition learning terms

#### 6. Connection Tracking: Not Aligned with Discovery Pattern

**Location**: README.md lines 88-158
**Issue**: Connection tracking is vessel-specific, not following discovery pattern
**Current Implementation**: Custom connection slots, heartbeats, instance tracking

**Potential Conflict**:
- Discovery-vessel already provides heartbeat mechanism
- Vessel registration includes health checks
- Overlapping concerns between connection tracking and discovery health

**Recommended Action**: Document relationship between connection tracking and discovery heartbeats

### Missing Documentation

1. **No CLAUDE.md** - Vessel-specific development guidance missing
2. **No discovery integration guide** - How shapes map to user domain
3. **No resolver implementation examples** - How to add new impulse types
4. **No composition patterns** - How user-vessel activities compose with others

### Alignment with Foundation Principles

**Current Alignment** (README.md lines 386-395):
- ✓ Treats data as impulses
- ✓ Activities constrain search
- ✓ Resolvers where data lives
- ✓ Records traces
- ✓ Avoids unnecessary LLM
- ✓ Improvisation with recording
- ✓ Backend for traces only
- ✓ Extractable patterns

**Issues**:
- Listed as checkmarks but not explained in context
- No examples of how each principle is implemented
- Missing: deterministic execution (no improvisation needed for CRUD)
- Missing: state-space is known (relational database operations)

## Execution Phase Recommendations

### 1. Archive Conflicts

Create archive directory:
```
repos/user-vessel/docs/archive/2026-04-14-jiggle-and-prune/
```

Archive:
- Current README.md (for comparison)
- Current TESTING.md (outdated local K8s references)

### 2. Create CLAUDE.md

New file: `repos/user-vessel/CLAUDE.md`

Contents should include:
- Vessel overview and purpose
- Discovery integration (shapes, resolvers, registration)
- Impulse types with resolver patterns
- Deterministic activities vs. composition patterns
- Standard configuration alignment
- Development workflow (local testing, canary deployment)
- Relationship to identity-vessel and discovery-vessel

### 3. Update README.md

Sections to update:
1. Add "Discovery Integration" section after "Architecture"
2. Expand "Impulse Types" with resolver implementation guide
3. Clarify "Activities" section (implemented vs. planned)
4. Update "Environment Variables" to align with STANDARD_CONFIGURATION.md
5. Reframe "Hybrid Approach" with composition learning context
6. Add "Connection Tracking vs. Discovery Health" clarification
7. Expand "Alignment with Foundation Principles" with examples

### 4. Update TESTING.md

Sections to update:
1. Remove local Kubernetes references
2. Add canary deployment testing workflow
3. Document discovery health checks
4. Add resolver testing examples

### 5. Archive QUICKSTART.md

Rationale: Content is already in README.md and TESTING.md
Action: Move to archive, link from README if needed

## Summary

**Total Conflicts**: 6 major areas
**Missing Documentation**: 4 critical gaps
**Recommended Archives**: 3 files
**New Files Needed**: 1 (CLAUDE.md)
**Files to Update**: 2 (README.md, TESTING.md)

**Priority**:
1. HIGH: Create CLAUDE.md with discovery integration
2. HIGH: Update README.md discovery and impulse sections
3. MEDIUM: Align configuration with STANDARD_CONFIGURATION.md
4. MEDIUM: Clarify activities implementation status
5. LOW: Archive QUICKSTART.md (redundant)
6. LOW: Update TESTING.md for canary workflow
