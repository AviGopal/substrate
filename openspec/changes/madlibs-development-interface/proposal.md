# Mad Libs Development Interface

## Executive Summary

Transform development into a Mad Libs-style experience where users:
1. Say what they want ("I want rate limiting")
2. Pick from proven options (word bank)
3. Fill in the blanks (variables)
4. Get working code (executed activity)
5. **Learn vessel creation** through progressive revelation

This makes development **10x faster** while teaching advanced concepts naturally.

## Why This Matters

**Current problem:**
- Creating code from scratch is slow and error-prone
- Learning to create vessels requires understanding complex architecture
- No clear path from "user of activities" to "creator of vessels"

**Mad Libs solution:**
- Pick proven patterns → instant working code
- Each session teaches one vessel concept
- Progressive path from beginner to architect (Level 1→4)
- Your contributions become reusable templates

## Architecture Alignment

✅ **Impulses Are Universal Data**: Similar implementations are impulses (word bank)
✅ **Activities Constrain Search**: Templates constrain options to proven patterns
✅ **Metadata First, Content Later**: User sees intent/success rate before code
✅ **Learn From Traces**: Variable extraction from successful executions
✅ **Reserve Improvisation**: Create from scratch if no similar found
✅ **Backend is Flexible**: New template types without MiniBob changes

## The 4 Levels

```
Level 1: FILL     → "endpoint: /api/search, max: 100"
Level 2: CHOOSE   → "Option A (Redis) or B (in-memory)?"
Level 3: CREATE   → "Save this as template: add_redis_cache"
Level 4: DESIGN   → "Bundle into vessel: resilient-api"
```

## Implementation Phases

### Phase 1: Component Metadata (Word Bank)
**Goal**: Enable "find similar implementations"

**Tasks:**
1. Add `component_metadata` table (intent, outcome, embeddings)
2. Implement `ComponentMetadataService` with heuristic + LLM intent extraction
3. Index existing codebase components
4. Add `find_similar_implementations` MCP tool
5. Test: "I want rate limiting" → Returns 3-5 similar components

**Success criteria:**
- ✅ Can find similar implementations by intent
- ✅ Results ranked by success rate
- ✅ <2 second response time

---

### Phase 2: Template Generation (Fill Blanks)
**Goal**: Generate activities from picked options

**Tasks:**
1. Add variable extraction from execution traces
2. Implement `POST /v2/activities/generate-from-template` endpoint
3. Add `fill_template_blanks` MCP tool
4. Store Mad Libs metadata on activities
5. Test: Pick option → Fill blanks → Generate activity → Execute

**Success criteria:**
- ✅ Can generate activity from component + variables
- ✅ Preview shows what will be created
- ✅ Execution succeeds >80% of the time

---

### Phase 3: Learning Reports (Progressive Revelation)
**Goal**: Teach vessel concepts through usage

**Tasks:**
1. Generate learning reports after each execution
2. Track user progression (sessions, templates created)
3. Suggest template creation after 10 similar executions
4. Show vessel bundling opportunity after 20 sessions
5. Test: User progresses from Level 1→4 naturally

**Success criteria:**
- ✅ Users understand "variables" after 5 sessions
- ✅ Users create first template after 10 sessions
- ✅ Users understand impulse-activity model after 20 sessions

---

### Phase 4: Mad Libs Dashboard
**Goal**: Visual interface for the experience

**Tasks:**
1. Create Mad Libs Development view
2. Word bank selection UI
3. Fill-in-the-blanks form
4. Preview generated activity
5. Learning report display
6. Template gallery

**Success criteria:**
- ✅ Non-technical users can use Mad Libs
- ✅ Time from "I want X" to "X works" <5 minutes
- ✅ >80% of development uses Mad Libs

## Example User Journey

### Session 1: First Experience
```
User: "I want caching"
System: "Pick: A) Redis, B) Memory, C) Disk"
User: "A"
System: "Fill: ttl_seconds, key_prefix"
User: "3600, my_cache"
System: ✓ Done! Caching added.
```
**Learning**: None yet, just experiencing the flow

---

### Session 10: Pattern Recognition
```
System: "You've created caching 10 times. Want to save as template?"
User: "Yes - 'add_redis_cache_with_ttl'"
System: ✓ Template created! Others can now use this.
```
**Learning**: Activities are templates, you just created one

---

### Session 30: Template Creation
```
User: "I want rate limiting for WebSockets"
System: "No template found. Create one?"
User: "Yes, based on rate-limiter.ts but adapted for WS"
System: "What are the blanks?"
User: "connection_id, messages_per_second, window"
System: ✓ New template created!
```
**Learning**: How to identify variables and create templates

---

### Session 60: Vessel Design
```
System: "You use: rate limiting + caching + auth together. Bundle into vessel?"
User: "Yes - 'resilient-api-vessel'"
System: "Define: activities, lifecycle, dependencies"
User: [Defines vessel structure]
System: ✓ Vessel created! This is now a reusable capability.
```
**Learning**: Vessels are bundles of activities with lifecycle

## Business Value

**Time savings:**
- Development: 80% faster (5 minutes vs. 30 minutes)
- Onboarding: 90% faster (learn by doing, not reading docs)
- Consistency: 100% (all use proven patterns)

**Quality improvement:**
- Success rate: >80% (using proven patterns)
- Bugs: -70% (reference implementations are tested)
- Maintenance: -50% (consistent patterns easier to maintain)

**Learning acceleration:**
- Time to first contribution: 1 week (vs. 3 months)
- Time to understand architecture: 1 month (vs. 6 months)
- Time to vessel creation: 2 months (vs. never for most)

## Risks and Mitigations

**Risk**: Users never graduate from Level 1 (just fill blanks)
**Mitigation**: Progressive prompts nudge toward template creation

**Risk**: Generated code doesn't match user expectations
**Mitigation**: Preview before execution, allow edits

**Risk**: Word bank is empty (no similar implementations)
**Mitigation**: Fallback to guided template creation (Level 3)

**Risk**: Templates become stale (no longer work)
**Mitigation**: Success rate tracking deprecates bad templates

## Success Metrics

**Adoption:**
- % of development using Mad Libs (target: >80%)
- Active users per week (target: growing)
- Templates created per user (target: >3)

**Learning:**
- Time to first template creation (target: <10 sessions)
- % understanding impulse-activity model (target: >80% after 20 sessions)
- % creating vessels (target: >40% after 60 sessions)

**Quality:**
- Success rate of Mad Libs activities (target: >80%)
- User satisfaction score (target: >4.5/5)
- Time from "I want X" to "X works" (target: <5 minutes)

## Next Steps

1. **Approve this proposal** → Creates design.md and tasks.md
2. **Implement Phase 1** → Component metadata for word bank
3. **Beta test with 5 users** → Iterate on UX
4. **Implement Phase 2** → Template generation
5. **Public launch** → Everyone can Mad Libs their development

## Open Questions

1. Should we charge for template marketplace? (community-created templates)
2. How to handle private templates vs. public?
3. Should there be "Mad Libs modes" (strict/loose)?
4. Integration with other MCP servers?
