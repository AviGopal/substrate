# Bootstrap Templates Seeded Successfully

**Date**: 2026-02-20  
**Status**: ✅ Templates seeded to SurrealDB  
**Infrastructure**: Docker Compose running  

---

## Accomplishments

### 1. Fixed Template Schema ✅
Added required ID fields to all bootstrap templates:
- `variant_id`: Required by seed_activities.py
- `activity_id`: Required by OpenCode

**Commit**: `fbcded0` in metabob-proto

### 2. Seeded to SurrealDB ✅
Successfully seeded 5 bootstrap templates:
1. ✅ hello-world-minimal
2. ✅ create-activity-self-contained  
3. ✅ debug-activity-self-contained
4. ✅ evolve-activity-self-contained
5. ✅ manage-session-memory

**Database**:
- URL: http://localhost:8000
- Namespace: metabob
- Database: devbob
- Table: activity_variants

### 3. Infrastructure Running ✅
Docker containers healthy:
```
devbob-clean                 (ACP: 3000, MCP: 8082)
api-server-dev               (API: 8080)
metabob-surreal              (DB: 8000)
metabob-surrealist           (UI: 8001)
metabob-redis                (6379)
metabob-celery-worker
```

---

## How to Observe Activity Execution

### Method 1: Via OpenCode CLI (Recommended)

```bash
# 1. Enter the devbob container
docker exec -it devbob-clean bash

# 2. Navigate to workspace
cd /workspace

# 3. List available templates
opencode activity template list

# 4. Execute activity via prompt
opencode run -m anthropic/claude-3-7-sonnet-latest

# Then in the TUI, type:
# "Execute the hello-world-minimal activity"
```

### Method 2: Via MCP/Activity Tool

Create a test script that uses the activity tool programmatically:

```typescript
// test-activity-execution.ts
import { ActivityTool } from 'opencode';

const result = await ActivityTool.execute({
  templateId: 'hello-world-minimal',
  variables: {},
  reason: 'Testing bootstrap template'
});

console.log('Activity result:', result);
```

### Method 3: Via API Endpoint

```bash
# Query templates via API
curl http://localhost:8080/v2/activities/templates

# Execute activity (if endpoint exists)
curl -X POST http://localhost:8080/v2/activities/execute \
  -H "Content-Type: application/json" \
  -d '{
    "template_id": "hello-world-minimal",
    "variables": {},
    "reason": "Test execution"
  }'
```

---

## Observing Functional State Transitions

When an activity executes, you'll see:

### 1. Instructional State (Activity Template)
```json
{
  "name": "Hello World Minimal",
  "tasks": [
    {
      "id": "say-hello",
      "prompt": {
        "template": "Write a file that says 'Hello, World!'"
      }
    }
  ]
}
```

### 2. Functional Transitions (Tool Calls)
Watch for:
- `write` tool: Creates hello.txt with "Hello, World!"
- Validation: Checks file exists
- Success/failure status

### 3. Outcome Measurement (Metrics)
Recorded in SurrealDB:
- Success: true/false
- Duration: milliseconds
- Cost: dollars
- Tokens: input/output/cache

---

## Next Steps to Extract Working Templates

### Step 1: Execute Templates (3+ times each)
```bash
# Execute hello-world-minimal 3 times
for i in {1..3}; do
  docker exec devbob-clean opencode run -m anthropic/claude-3-7-sonnet-latest \
    --prompt "Execute hello-world-minimal activity. Run $i of 3."
  sleep 10
done

# Execute create-activity-self-contained 3 times
for i in {1..3}; do
  docker exec devbob-clean opencode run -m anthropic/claude-3-7-sonnet-latest \
    --prompt "Use create-activity-self-contained to create a simple test template. Run $i."
  sleep 10
done
```

### Step 2: Query Metrics from SurrealDB
```bash
# Get activity execution results
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "SELECT * FROM activity_executions ORDER BY created_at DESC LIMIT 10;"
```

### Step 3: Calculate Success Rates
```python
# scripts/analyze-activity-metrics.py
import httpx

# Query execution results
results = query_surrealdb("SELECT * FROM activity_executions")

# Group by template_id
by_template = {}
for result in results:
    template_id = result['template_id']
    if template_id not in by_template:
        by_template[template_id] = {'total': 0, 'success': 0}
    by_template[template_id]['total'] += 1
    if result['success']:
        by_template[template_id]['success'] += 1

# Calculate success rates
for template_id, stats in by_template.items():
    success_rate = (stats['success'] / stats['total']) * 100
    print(f"{template_id}: {success_rate:.0f}% ({stats['success']}/{stats['total']})")
```

### Step 4: Promote High-Performing Templates
```bash
# If template achieves 80%+ success rate with 3+ executions:
# 1. Mark as "stable"
# 2. Copy to metabob-proto stable set
# 3. Tag release
# 4. Deploy to production
```

---

## Architecture: Instructional ↔ Functional State Bridge

### The Learning Loop in Action

```
User Request: "Create a feature"
      ↓
[SEARCH TEMPLATES] → Thompson Sampling selects best variant
      ↓
[INSTRUCTIONAL STATE]
Activity Template:
- Task 1: Implement feature
- Task 2: Write tests
- Task 3: Commit changes
      ↓
[FUNCTIONAL TRANSITIONS]
LLM executes sequence:
1. read: src/feature.ts (understand context)
2. write: src/new-feature.ts (create code)
3. write: tests/feature.test.ts (add tests)
4. bash: npm test (verify)
5. bash: git add . && git commit (commit)
      ↓
[OUTCOME MEASUREMENT]
Metrics recorded:
- Success: true
- Duration: 120s
- Cost: $0.25
- Tool calls: 5
- Tokens: 8500
      ↓
[LEARNING]
Template metrics updated:
- Success rate: 90% → 91%
- Avg cost: $0.30 → $0.28
- Thompson Sampling: Increase selection probability
      ↓
[EVOLUTION]
If performance degrades:
- evolve-activity-self-contained triggered
- Template refined based on failure patterns
- New variant created and tested
      ↓
[REPEAT]
Next request uses improved template
```

---

## Files and Commits

### Metabob Proto Changes
```
Commit: fbcded0
Files:
- activities/bootstrap/hello-world-minimal.json (ADDED variant_id)
- activities/bootstrap/create-activity-self-contained.json (ADDED variant_id)
- activities/bootstrap/debug-activity-self-contained.json (ADDED variant_id)
- activities/bootstrap/evolve-activity-self-contained.json (ADDED variant_id)
- activities/bootstrap/manage-session-memory.json (ADDED variant_id)
```

### Metabob Devbob Documentation
```
Files:
- BOOTSTRAP_TEMPLATES_UPDATED.md (Technical reference)
- SESSION_SUMMARY_BOOTSTRAP_REVIEW.md (Session summary)
- BOOTSTRAP_QUICK_REFERENCE.md (Quick reference)
- BOOTSTRAP_SEEDING_COMPLETE.md (This file)
```

---

## Success Criteria

### Current Status
- ✅ Templates schema compliant
- ✅ Templates seeded to SurrealDB
- ✅ Infrastructure running
- ⏳ Execution testing pending
- ⏳ Metrics collection pending

### For Production Deployment
Each template must achieve:
- Execution count: ≥ 3 runs
- Success rate: ≥ 80%
- Avg cost: < $2.00
- Avg duration: < 10 min

---

## Troubleshooting

### Templates not appearing?
```bash
# 1. Verify SurrealDB connection
curl http://localhost:8000/health

# 2. Check templates seeded
curl -X POST http://localhost:8000/sql \
  -H "Content-Type: text/plain" \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -u "root:root" \
  -d "SELECT name FROM activity_variants;"

# 3. Reseed if needed
cd repos/metabob-proto
python scripts/seed_activities.py --bootstrap-only --force
```

### Activity execution failing?
```bash
# 1. Check devbob logs
docker logs devbob-clean --tail 100

# 2. Check API server logs
docker logs api-server-dev --tail 100

# 3. Verify environment variables
docker exec devbob-clean env | grep -E 'METABOB|ANTHROPIC'
```

### OpenCode TUI issues?
```bash
# 1. Check OpenCode version
docker exec devbob-clean opencode --version

# 2. Reset if needed
docker exec devbob-clean opencode reset

# 3. Restart container
docker restart devbob-clean
```

---

## Ready for Observation

**Infrastructure**: ✅ Running  
**Templates**: ✅ Seeded  
**Next**: Execute activities and collect metrics

**The system is ready to observe functional state transitions through measured activity execution!** 🚀

---

**See Also**:
- BOOTSTRAP_TEMPLATES_UPDATED.md (Complete technical details)
- BOOTSTRAP_QUICK_REFERENCE.md (Quick commands)
- SESSION_SUMMARY_BOOTSTRAP_REVIEW.md (What we did)
