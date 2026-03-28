# Mad Libs Development Quickstart

## 5-Minute Example: Your First Mad Lib

### Step 1: You Say What You Want
```bash
# In Claude Desktop with metabob-mcp
"I want to add rate limiting to the search endpoint"
```

### Step 2: System Shows Word Bank
```
Found 3 similar implementations:

A. rate-limiter.ts → Sliding window, Redis, 95% success
   Blanks: endpoint, max_requests, window_size
   Creates: Middleware file, Redis integration, tests

B. throttle.ts → Token bucket, in-memory, 80% success
   Blanks: endpoint, tokens_per_second
   Creates: In-memory throttle, no dependencies

C. quota.ts → Fixed window, Redis, 90% success
   Blanks: endpoint, daily_limit, reset_time
   Creates: Daily quota tracker, Redis storage

Which one? (A/B/C)
```

### Step 3: You Pick and Fill Blanks
```
You: "A looks good"

System: "Great! Fill in the blanks:"
  endpoint: [/api/v2/analysis/search]
  max_requests: [100]
  window_size: [60 seconds]

You type your answers.
```

### Step 4: Preview Generated Code
```
System: "This will create:

1. src/middleware/rate-limit-search.ts
   - Sliding window rate limiter
   - Redis backend
   - 100 requests per 60 seconds

2. src/routes/search.ts (modified)
   - Add rate limiter middleware

3. tests/rate-limit-search.test.ts
   - Unit tests for rate limiting

Ready? (yes/no)"
```

### Step 5: Execute
```
You: "yes"

System executes activity:
  ✓ Task 1: Create middleware (5s)
  ✓ Task 2: Add to route (2s)
  ✓ Task 3: Create tests (3s)
  ✓ All tests pass

Done! Rate limiting added to /api/v2/analysis/search
```

### Step 6: Learning Report
```
🎓 What You Learned:

Vessel Concepts:
- Variables (blanks) define the contract between template and user
- Impulses (references) provide proven patterns as context
- Tasks decompose work into measurable steps
- Success rates guide which patterns to recommend

Blanks You Identified:
- endpoint (string) - which route to protect
- max_requests (number) - requests per window
- window_size (duration) - sliding window duration

Patterns You Learned:
- Rate limiting uses sliding window + Redis
- Middleware pattern for cross-cutting concerns
- Success rate (95%) means this pattern works well

Your Contribution:
Template "add_rate_limiting_to_endpoint" is now available for reuse!
Success rate: 100% (1/1)
Times used: 1

Want to save this as a reusable template? (yes/no)
```

## What Just Happened?

You didn't write any code, but you:
1. ✅ Identified what varies (the blanks)
2. ✅ Picked a proven pattern (the reference)
3. ✅ Specified the details (fill blanks)
4. ✅ Created working code (executed activity)
5. ✅ **Created a reusable template (vessel capability)**

## The Progressive Learning Path

### After 5 Mad Libs Sessions
**You notice**: "I keep picking Redis and 60s window"

**System**: "Want to save those as defaults? Then you'll only fill in 'endpoint' next time."

**You learned**: Variables can have defaults, reducing friction

---

### After 10 Mad Libs Sessions
**System**: "You've created rate limiting 10 times with same pattern. Want to make this a reusable template?"

**You**: "Yes, let's call it 'add_redis_rate_limiter'"

**You learned**: Activities are templates, you just created one

---

### After 20 Mad Libs Sessions
**You**: "I want to create rate limiting, but for GraphQL subscriptions, not REST endpoints"

**System**: "I don't have that template. Want to create it?"

**You**: "Yes. I'll base it on rate-limiter.ts but change..."

**You learned**: How to adapt existing templates (Level 3)

---

### After 50 Mad Libs Sessions
**System**: "You often use: rate limiting + caching + auth together. Want to bundle them into a 'resilient-api' vessel?"

**You**: "Yes! What do I need to define?"

**System**: "Activities (which templates), Lifecycle (startup/shutdown), Dependencies (Redis)"

**You learned**: Vessels are bundles of related activities (Level 4)

---

### After 100 Mad Libs Sessions
**You**: "I'm going to create a new vessel for stream processing"

**System**: "I'll validate against foundation principles as you build"

**You learned**: You're now a vessel architect

## Try It Right Now

### Prerequisites
```bash
# Make sure metabob-mcp is running
cd repos/metabob-mcp
bun run dev

# In Claude Desktop, add to mcp_servers.json:
{
  "metabob": {
    "command": "npx",
    "args": ["@metabob/metabob-mcp"],
    "env": {
      "METABOB_API_KEY": "your-key-here"
    }
  }
}
```

### Example Interaction
```
You: "I want to add caching to the component metadata service"

Claude (via metabob-mcp):
  [Calls find_similar_implementations("caching for service")]

  Found 4 caching implementations:
  A. redis-cache.ts (Redis, TTL, 92% success)
  B. memory-cache.ts (LRU, in-memory, 85% success)
  C. disk-cache.ts (File-based, persistent, 78% success)
  D. hybrid-cache.ts (Redis + memory, 89% success)

  Which pattern would you like to use?

You: "A - Redis cache"

Claude:
  Great! Fill in these blanks:
  - cache_key_prefix: [component_metadata]
  - ttl_seconds: [3600]
  - redis_host: [localhost]
  - redis_port: [6379]

You: Fill in the blanks

Claude:
  [Calls fill_template_blanks]

  This will create:
  1. src/services/cache/component-metadata-cache.ts
  2. Modify src/services/component-metadata-service.ts
     - Add cache.get before database query
     - Add cache.set after successful query
  3. Create tests/component-metadata-cache.test.ts

  Execute? (yes/no)

You: "yes"

Claude:
  [Calls execute_activity]

  ✓ Created cache service
  ✓ Modified component metadata service
  ✓ Created tests
  ✓ All tests pass

  Done! Caching added with 1-hour TTL.

  🎓 Learning Report:
  - You identified "cache_key_prefix" as a variable (good!)
  - Redis pattern works for shared state across instances
  - This template now available for other services

  Want to apply the same caching to other services? (yes/no)
```

## Implementation Checklist

To make this work, we need:

### Backend (metabob-analysis-api)
- [ ] Component metadata extraction (already in CODE_UNDERSTANDING_VESSEL_DESIGN.md)
- [ ] Variable extraction from activity traces
- [ ] `POST /v2/activities/generate-from-template` endpoint
- [ ] Mad Libs metadata on activity templates

### MCP Layer (metabob-mcp)
- [ ] `create_from_template` tool (multi-turn)
- [ ] `fill_template_blanks` tool
- [ ] Learning report generation

### Dashboard (activity-dashboard)
- [ ] Mad Libs Development view
- [ ] Word bank selection UI
- [ ] Fill-in-the-blanks form
- [ ] Learning report display
- [ ] Template gallery (browse user-created templates)

### MiniBob
- [ ] Execute generated activities (already works!)
- [ ] Extract variables from execution traces
- [ ] Save successful patterns as templates

## Why This Works

**Cognitive Load Reduction:**
- No blank page syndrome ("What should I write?")
- Concrete options to choose from
- Guided by proven patterns
- Immediate feedback

**Progressive Complexity:**
- Start simple (fill blanks)
- Increase gradually (create templates)
- Build expertise naturally (design vessels)
- Never overwhelmed

**Learning by Doing:**
- Experience first, theory later
- Patterns emerge from repetition
- System explains what you just did
- Immediate application

**Immediate Value:**
- Get working code in minutes
- No need to understand everything
- Learn advanced concepts when ready
- Your contributions help others

## Next Steps

1. **Implement Phase 1** (Component Metadata)
   - This provides the "word bank" for Mad Libs

2. **Create Mad Libs MCP Tools**
   - `create_from_template`, `fill_template_blanks`
   - Multi-turn conversation flow

3. **Build Learning Report Generator**
   - Extract what the user just learned
   - Progressive revelation of concepts

4. **Add Mad Libs Dashboard View**
   - Visual interface for picking and filling
   - Gallery of user-created templates

5. **Test with Real Users**
   - Measure time to first success
   - Track learning progression
   - Iterate on UX

## The Vision

**In 6 months:**
- New developer: "I want auth" → Picks option → Fills blanks → Done in 3 minutes
- After 10 sessions: Creates their first template
- After 30 sessions: Understands impulse-activity model deeply
- After 60 sessions: Designs their first vessel
- After 100 sessions: Teaches others how to create vessels

**Development becomes:**
- Accessible (Mad Libs is easy)
- Educational (learning reports guide you)
- Collaborative (your templates help others)
- Self-improving (success rates guide choices)

**Everyone becomes a vessel creator** because the path is clear, guided, and rewarding.
