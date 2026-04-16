# Terminal Vessel Jiggle-and-Prune Analysis

**Date:** 2026-04-14
**Scope:** repos/terminal vessel documentation
**Objective:** Identify conflicts, outdated patterns, and align with composition learning architecture

## Analysis Phase

### Documentation Inventory

| File | Status | Lines | Last Updated | Purpose |
|------|--------|-------|--------------|---------|
| SPEC.md | ✅ Keep | 655 | 2026-03-28 | Technical specification |
| README.md | ✅ Keep | 355 | 2026-03-29 | User guide |
| HOW_IT_WORKS.md | ⚠️ Review | 680 | 2026-04-08 | Complete integration guide |
| OBSERVATION_LOOP.md | ⚠️ Review | 310 | 2026-04-08 | Learning loop development |
| OBSERVATION_LOOP_SUMMARY.md | ⚠️ Review | 255 | 2026-04-08 | Architecture overview |
| QUICKSTART_OBSERVATION.md | ⚠️ Review | 118 | 2026-04-08 | Quick examples |
| SETUP_AND_USAGE.md | ⚠️ Review | 551 | 2026-04-08 | Setup guide |
| TERMINAL_AND_RENDERER_GUIDE.md | ⚠️ Review | 354 | 2026-04-08 | React renderer integration |
| VESSEL_DISCOVERY.md | ✅ Keep | 394 | 2026-03-28 | Discovery integration |
| IMPLEMENTATION.md | ✅ Keep | 328 | 2026-03-28 | Implementation summary |

### Conflict Analysis

#### 1. **LLM-Centric vs. Universal Data Access**

**Problem:** Multiple docs describe impulses as primarily for LLM context injection rather than universal data access.

**Locations:**
- `HOW_IT_WORKS.md` lines 97-99: "Template injection" framing
- `OBSERVATION_LOOP.md` lines 13-14: "Thompson Sampling learns to recommend better approaches"
- Several files describe terminal state as "context for LLM" rather than "data for activities"

**Foundation Alignment:**
- ✅ Impulses are universal data (not just LLM context)
- ✅ Resolvers live where data lives (terminal vessel resolves terminalState)
- ❌ Should not frame as "LLM prompt injection" exclusively

**Recommendation:** Update language to reflect universal data access patterns.

#### 2. **Observation Loop vs. Composition Learning**

**Problem:** Extensive documentation on "observation loop" and Thompson Sampling that predates composition learning architecture.

**Locations:**
- `OBSERVATION_LOOP.md` - Entire file focused on Thompson Sampling for activity selection
- `OBSERVATION_LOOP_SUMMARY.md` - Architecture overview based on probabilistic selection
- `QUICKSTART_OBSERVATION.md` - Examples using observation activities

**Foundation Alignment:**
- Current system uses **composition learning** (deterministic activities, resolver universality)
- Thompson Sampling is deprecated in favor of state-space driven selection
- Observation loop activities are no longer the primary learning mechanism

**Recommendation:** Archive observation loop documentation. Create new composition learning integration guide.

#### 3. **Vessel Discovery Endpoint Conflicts**

**Problem:** Multiple files reference different default endpoints.

**Locations:**
- `VESSEL_DISCOVERY.md` line 106: `https://activity.metabob.local`
- `VESSEL_DISCOVERY.md` line 386: `https://activity.metabob.local`
- `HOW_IT_WORKS.md` line 253: `https://activity.metabob.com`

**STANDARD_CONFIGURATION.md Reference:**
- Production: `https://activity.metabob.com`
- Local development: `http://activity.metabob.local`

**Recommendation:** Update all references to use production endpoint (`activity.metabob.com`) per standard configuration.

#### 4. **Discovery Integration Patterns**

**Problem:** Discovery integration described but not aligned with standard configuration patterns.

**Locations:**
- `VESSEL_DISCOVERY.md` - Complete but uses old endpoint patterns
- `HOW_IT_WORKS.md` - References vessel discovery but not standard config

**STANDARD_CONFIGURATION.md Defines:**
- `DISCOVERY_ENABLED` environment variable
- `DISCOVERY_VESSEL_ENDPOINT` configuration
- Standard discovery client patterns
- Helm values configuration

**Recommendation:** Add reference to `docs/STANDARD_CONFIGURATION.md` in discovery documentation.

#### 5. **React Renderer Integration**

**Problem:** `HOW_IT_WORKS.md` and `TERMINAL_AND_RENDERER_GUIDE.md` describe react-renderer integration but vessel doesn't create CLAUDE.md for it.

**Locations:**
- `HOW_IT_WORKS.md` lines 341-528: Detailed react-renderer structure
- `TERMINAL_AND_RENDERER_GUIDE.md` - Complete guide on renderer integration

**Status:**
- repos/react-renderer does NOT exist yet
- Documentation is speculative/forward-looking

**Recommendation:** Mark react-renderer sections as "Planned" or move to separate design doc.

#### 6. **Impulse Shapes Documentation**

**Problem:** Impulse shapes well-documented but missing standard resolver configuration.

**Locations:**
- `SPEC.md` lines 55-137: Complete impulse shape definitions
- `VESSEL_DISCOVERY.md` lines 236-314: Impulse pointer types

**Missing:**
- How shapes are registered with discovery-vessel
- Configuration for standard shape resolution
- Reference to standard configuration patterns

**Recommendation:** Add "Shape Registration" section referencing standard configuration.

### Outdated Patterns

#### 1. Thompson Sampling for Activity Selection
- **Status:** Deprecated in favor of composition learning
- **Files:** OBSERVATION_LOOP.md, OBSERVATION_LOOP_SUMMARY.md, QUICKSTART_OBSERVATION.md
- **Action:** Archive these files

#### 2. Backend as Universal Resolver
- **Status:** Outdated - resolvers live where data lives
- **Files:** Multiple references to backend resolving terminal impulses
- **Action:** Clarify that backend only discovers resolvers, doesn't resolve itself

#### 3. MCP-Only Integration
- **Status:** Incomplete - also supports HTTP discovery
- **Files:** Several files focus only on MCP server mode
- **Action:** Emphasize dual-mode operation (HTTP + MCP)

#### 4. `.local` TLD Usage
- **Status:** Outdated for production usage
- **Files:** Multiple references to `.metabob.local`
- **Action:** Update to use `.metabob.com` for production examples

### Missing Documentation

#### 1. Composition Learning Integration
- **Need:** How terminal vessel participates in composition learning
- **Should Include:**
  - Deterministic activity patterns
  - State-space driven selection
  - Composition recording
  - Learning from terminal usage patterns

#### 2. Standard Configuration Reference
- **Need:** Link to `docs/STANDARD_CONFIGURATION.md`
- **Should Include:**
  - Discovery environment variables
  - Standard Helm values
  - Configuration priority
  - Health check requirements

#### 3. Impulse Type Registration
- **Need:** How `terminalState`, `terminalCommand`, `terminalOutput` are registered
- **Should Include:**
  - Shape registration with discovery-vessel
  - Resolver capabilities advertisement
  - Shape metadata standards

## Execution Phase: Recommendations

### Archive (Move to docs/archive/2026-04-14-jiggle-and-prune/)

1. **OBSERVATION_LOOP.md**
   - Reason: Thompson Sampling deprecated, observation loop is old pattern
   - Replacement: Composition learning integration guide

2. **OBSERVATION_LOOP_SUMMARY.md**
   - Reason: Architecture overview based on deprecated patterns
   - Replacement: Update HOW_IT_WORKS.md with composition learning

3. **QUICKSTART_OBSERVATION.md**
   - Reason: Examples use deprecated observation activities
   - Replacement: Create quickstart with composition learning examples

### Update

1. **HOW_IT_WORKS.md**
   - Remove Thompson Sampling references
   - Update to composition learning architecture
   - Fix endpoint references (`.com` not `.local`)
   - Mark react-renderer sections as "Planned"
   - Add reference to STANDARD_CONFIGURATION.md

2. **VESSEL_DISCOVERY.md**
   - Update all endpoint references to production defaults
   - Add standard configuration reference
   - Include shape registration section

3. **SETUP_AND_USAGE.md**
   - Update endpoint references
   - Add discovery configuration from standard config
   - Remove observation loop examples

4. **TERMINAL_AND_RENDERER_GUIDE.md**
   - Mark as "Design Document - Not Implemented"
   - Keep for future reference

### Create

1. **COMPOSITION_LEARNING.md**
   - How terminal vessel participates in composition learning
   - Deterministic activity patterns
   - State-space driven selection examples
   - Learning from terminal usage

2. **CLAUDE.md** (if missing)
   - Vessel-specific guidance for Claude Code
   - Reference to standard configuration
   - Key implementation patterns
   - Discovery integration notes

### Keep As-Is

1. **SPEC.md** - Technical specification is current and accurate
2. **README.md** - User guide is clear and concise
3. **IMPLEMENTATION.md** - Implementation summary is accurate
4. **VESSEL_DISCOVERY.md** - Needs minor updates only

## Alignment with Composition Learning

### Current Terminal Vessel Strengths

✅ **Resolvers Live Where Data Lives**
- Terminal vessel resolves `terminalState` from local PTY
- No backend dependency for resolution
- In-memory state management

✅ **Impulses Are Universal Data**
- Terminal state exposed as standard impulse shape
- Can be consumed by any activity
- Not limited to LLM reasoning

✅ **Deterministic Resolution**
- PTY buffer capture is deterministic
- No LLM involved in state capture
- Predictable, measurable behavior

### Required Alignments

❌ **Remove Thompson Sampling Language**
- Composition learning uses state-space driven selection
- Not probabilistic activity recommendation

❌ **Update Discovery Patterns**
- Use standard configuration from docs/STANDARD_CONFIGURATION.md
- Reference discovery-vessel integration
- Follow standard environment variables

❌ **Clarify Activity Integration**
- Activities use terminal state as deterministic input
- Not "observation activities" but standard composition patterns
- State transitions are recorded, not scored

## Summary

### Conflicts Found: 6
1. LLM-centric vs. universal data framing
2. Observation loop vs. composition learning
3. Endpoint reference inconsistencies
4. Discovery integration not aligned with standard config
5. React renderer integration documented but not implemented
6. Missing shape registration documentation

### Files to Archive: 3
- OBSERVATION_LOOP.md
- OBSERVATION_LOOP_SUMMARY.md
- QUICKSTART_OBSERVATION.md

### Files to Update: 4
- HOW_IT_WORKS.md
- VESSEL_DISCOVERY.md
- SETUP_AND_USAGE.md
- TERMINAL_AND_RENDERER_GUIDE.md (mark as design doc)

### Files to Create: 2
- COMPOSITION_LEARNING.md
- CLAUDE.md (if missing)

### Estimated Impact
- **High Priority:** Archive observation loop docs (outdated architecture)
- **Medium Priority:** Update endpoint references (production usage)
- **Low Priority:** Create composition learning guide (enhancement)

## Next Steps

1. Execute archival of observation loop documentation
2. Update HOW_IT_WORKS.md with composition learning patterns
3. Fix endpoint references across all files
4. Create CLAUDE.md with standard configuration reference
5. Update VESSEL_DISCOVERY.md with shape registration section
6. Mark TERMINAL_AND_RENDERER_GUIDE.md as design document
