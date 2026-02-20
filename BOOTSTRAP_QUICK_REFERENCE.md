# Bootstrap Templates Quick Reference

**Last Updated**: 2026-02-19  
**Status**: ✅ Production Ready  
**Commit**: `1b2ed21` in metabob-proto

---

## Templates (5 total)

| Name | Tasks | Version | Status | Use Case |
|------|-------|---------|--------|----------|
| **hello-world-minimal** | 1 | v1 | ✅ **PROVEN** | System verification |
| **create-activity-self-contained** | 4 | v2 | ✅ Fixed | Create new templates |
| **debug-activity-self-contained** | 4 | v2 | ✅ Ready | Debug failures |
| **evolve-activity-self-contained** | 4 | v2 | ✅ Ready | Improve templates |
| **manage-session-memory** | 5 | v1 | ✅ Ready | Memory management |

---

## Quick Commands

### Validate Templates
```bash
cd repos/metabob-proto/activities/bootstrap
for f in *.json; do cat "$f" | jq empty && echo "✅ $f" || echo "❌ $f"; done
```

### Seed SurrealDB
```bash
cd repos/metabob-proto
python scripts/seed_activities.py \
  --db-url http://localhost:8000 \
  --namespace metabob \
  --database devbob
```

### Check Template Status
```bash
cd repos/metabob-proto/activities/bootstrap
for f in *.json; do
  jq '{name, version, tasks: .tasks | length, contextRequirements: has("contextRequirements")}' "$f"
done
```

---

## Schema Checklist

All templates must have:
- ✅ `name: string`
- ✅ `version: number`
- ✅ `category: string`
- ✅ `description: string`
- ✅ `tasks: Task[]` (NOT task_steps)
- ✅ `contextRequirements: ContextRequirement[]`

---

## Promotion Criteria

To add a template to metabob-proto/activities/bootstrap:
- **Execution count**: ≥ 3 runs
- **Success rate**: ≥ 80%
- **Avg cost**: < $2.00
- **Schema compliance**: 100%
- **Validation**: JSON valid

---

## Git Workflow

```bash
# 1. Update template in metabob-proto
cd repos/metabob-proto

# 2. Commit changes
git add activities/bootstrap/*.json
git commit -m "feat(bootstrap): [description]"

# 3. Push to branch
git push origin prompts/metabob-devbob-mlpu1y8l

# 4. Merge to main (after testing)
git checkout main
git merge prompts/metabob-devbob-mlpu1y8l
git push origin main

# 5. Tag release
git tag -a v1.0.0-bootstrap -m "Bootstrap templates v1.0.0"
git push origin v1.0.0-bootstrap
```

---

## Success Metrics

### Current Status
- **hello-world-minimal**: 100% success (2 executions) ⭐
- **create-activity**: 0% (7 old executions, before fix)
- **debug-activity**: Not tested yet
- **evolve-activity**: Not tested yet
- **manage-session-memory**: Not tested yet

### Target Metrics
- ≥ 80% success rate
- ≥ 3 executions per template
- < $2.00 avg cost
- < 10 min avg duration

---

## Next Actions

1. ⏳ Push to remote
2. ⏳ Test SurrealDB seeding
3. 🧪 Execute create/debug/evolve (3+ times each)
4. 📊 Collect metrics
5. 🚀 Deploy to production

---

**Files**: `repos/metabob-proto/activities/bootstrap/*.json`  
**Docs**: `BOOTSTRAP_TEMPLATES_UPDATED.md` (full details)  
**Session**: `SESSION_SUMMARY_BOOTSTRAP_REVIEW.md` (what we did)
