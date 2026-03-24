# metabob-opencode - OpenSpec Proposal

**Status:** Draft
**Created:** 2026-03-23
**Author:** System (via Claude Code)
**Type:** Integration
**Repo:** `repos/metabob-opencode`

---

## Problem Statement

OpenCode sessions currently have no learning or pattern recognition:

1. **No Learning Loop:** Each session starts from scratch
2. **No Activity Recommendations:** Can't suggest "this worked before"
3. **No Template Extraction:** Successful patterns not captured
4. **No Measurement:** No success rates, cost tracking, or performance metrics
5. **Isolated Knowledge:** Sessions don't contribute to system improvement

## Proposed Solution

Integrate MiniBob library into OpenCode using **non-invasive observation pattern**.

**Scope:** ~100 LOC OpenCode changes + ~500 LOC backend integration
**Stack:** TypeScript + Bus events + MCP protocol

### Integration Pattern

**Key Insight:** OpenCode changes are MINIMAL. All intelligence lives in MiniBob backend.

### Three Simple Components (OpenCode Side)

**1. Observer (~40 LOC)**
- Subscribe to Bus events (Session.*, Tool.*)
- Forward raw session data to backend
- No intelligence, just observation and forwarding

**2. Static Skill (~40 LOC)**
- ONE skill: `/minibob` (always available)
- Calls backend `getHelp()` with session context
- Displays whatever backend returns

**3. Backend Client (~20 LOC)**
- Thin MCP wrapper
- Handles connectivity, errors
- No business logic

### Backend Integration (MiniBob Side ~500 LOC)

**Intent Detection:** Analyze session context to understand user goals
**Thompson Sampling:** Recommend best activity templates
**Execution:** Run activities via ActivityExecutor
**Learning:** Update success rates, extract patterns

## Dependencies

**Blocked By:** None (OpenCode already exists)

**Blocks:** None (parallel with other changes)

**External Dependencies:**
- `@metabob/minibob` (library import)
- OpenCode Bus system (already exists)

## Success Criteria

1. **Observation:** All session events forwarded to backend
2. **No Performance Impact:** <5ms overhead per event
3. **Graceful Degradation:** OpenCode works normally if backend offline
4. **Skill Functionality:** `/minibob` returns helpful recommendations
5. **Learning:** Success rates improve over 50+ sessions

## Non-Goals

- Not modifying OpenCode core functionality
- Not adding UI for template management (that's dashboard)
- Not implementing real-time collaboration

## Timeline

**Week 3-4:** Complete integration (16 tasks, parallel with analysis-api)
- Week 3: Observer + Static Skill + Backend Client
- Week 4: Backend intelligence + testing

## References

- Original: `archive/opencode-minibob-integration/`
- OpenCode Bus: `repos/metabob-opencode/packages/opencode/src/bus`
- Tasks: [tasks.md](./tasks.md)
- Design: [design.md](./design.md)
