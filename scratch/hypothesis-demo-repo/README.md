# Hypothesis Demo Repository

This is a simple Express API with in-memory rate limiting, used to demonstrate MiniBob's hypothesis-driven codebase understanding.

## What's Inside

- **Express** web framework
- **In-memory rate limiting** using Map<string, object>
- **Two API endpoints**: `/` and `/api/status`

## Test Scenarios

### Scenario 1: Understanding Rate Limiting

**Learning Goal**: "How does rate limiting work in this codebase?"

**Expected Hypotheses MiniBob Will Generate**:
1. ✅ **Express middleware pattern exists** - Should CONFIRM
2. ❌ **Redis is used for rate limiting** - Should REFUTE (uses in-memory Map)
3. ✅ **Rate limiter middleware is applied** - Should CONFIRM

**Expected Alignment Decision**:
- Hypothesis 2 fails (expects Redis, finds Map)
- Decision depends on user's goal:
  - If goal = "Add rate limiting" → ALIGN_VALIDATOR (in-memory is fine)
  - If goal = "Add distributed rate limiting" → ALIGN_CODE (add Redis)

### Scenario 2: Adding Distributed Rate Limiting

**Learning Goal**: "Add distributed rate limiting across multiple instances"

**Expected Flow**:
1. Generate hypotheses about current architecture
2. Test hypothesis: "Redis available for distributed state"
3. Hypothesis REFUTED (no Redis)
4. Interpret results with goal context
5. Decision: ALIGN_CODE (add Redis because goal requires distribution)
6. Generate activity to add Redis dependency and refactor
7. Execute alignment activity
8. Re-test hypothesis
9. Hypothesis now CONFIRMED

## Running the Demo

```bash
cd scratch/hypothesis-demo-repo
bun install
bun run dev
```

Test the API:
```bash
curl http://localhost:3000/
curl http://localhost:3000/api/status
```

Test rate limiting (send 11 requests quickly):
```bash
for i in {1..11}; do curl http://localhost:3000/; done
```

The 11th request should return 429 Too Many Requests.
