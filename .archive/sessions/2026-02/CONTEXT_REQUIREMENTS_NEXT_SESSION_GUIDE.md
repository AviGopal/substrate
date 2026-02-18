# Context Requirements - Next Session Quick Start

**Date**: February 16, 2026  
**Status**: Ready for final validation (template registration needed)  
**Time Estimate**: 15 minutes

---

## What's Already Done ✅

1. ✅ Enhanced tracing in OpenCode (`prompt.ts`, `impulse-create.ts`)
2. ✅ OpenCode rebuilt (version `202602160758`)
3. ✅ File-based trace output to `.context-flow-trace/`
4. ✅ Impulse creation validated (8 impulses traced)
5. ✅ Test template designed with 3 context_requirements

---

## What's Needed 🎯

**ONE THING**: Register test template in backend with `context_requirements` field.

---

## Quick Start Commands

### Option 1: Direct SurrealDB Insert (Fastest)

```bash
# Connect to SurrealDB and insert template
curl -X POST http://localhost:8000/key \
  -u root:root \
  -H "NS: metabob" \
  -H "DB: devbob" \
  -H "Accept: application/json" \
  --data-binary @/tmp/test-template-with-context-reqs.json

# Or use Python script:
python3 scripts/register_test_template.py
```

### Option 2: Backend API (If endpoint exists)

```bash
# Check for POST /api/v2/activities/templates endpoint
curl -X POST http://localhost:8080/api/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d @/tmp/test-template-with-context-reqs.json
```

### Option 3: Use metabob-cli (If registration command exists)

```bash
metabob-cli register-template /tmp/test-template-with-context-reqs.json
```

---

## Validation Steps (After Registration)

### 1. Verify Template Registered

```bash
curl -s "http://localhost:8080/api/v2/activities/templates/test-context-flow-v1" | jq '.context_requirements'
# Expected: Array with 3 requirements
```

### 2. Clear Trace Directory

```bash
rm -rf .context-flow-trace
```

### 3. Execute Test Activity

In OpenCode:
```javascript
activity({
  activityId: "test-context-flow-v1",
  variables: {
    target_file: "test-workspace/refactor-test/sample.ts"
  },
  reason: "Validate context requirements end-to-end flow"
})
```

### 4. Check Trace Files

```bash
ls -lh .context-flow-trace/
# Expected files:
# - context-requirements-*.json (1 file)
# - memory-agent-complete-*.json (1 file)
# - impulse-created-*.json (multiple files)
```

### 5. Analyze Results

```bash
# View requirements extraction
cat .context-flow-trace/context-requirements-*.json | jq '.'

# View memory agent completion
cat .context-flow-trace/memory-agent-complete-*.json | jq '.'

# Count impulses created
ls .context-flow-trace/impulse-created-*.json | wc -l
# Expected: 3+ (one for each requirement)

# View all impulses
for f in .context-flow-trace/impulse-created-*.json; do cat "$f"; echo ""; done | jq -s '.'
```

---

## Expected Trace Output

### context-requirements-*.json
```json
{
  "event": "CONTEXT_REQUIREMENTS_EXTRACTED",
  "timestamp": "2026-02-16T...",
  "templateId": "test-context-flow-v1",
  "count": 3,
  "requirements": [
    {
      "key": "target-code",
      "required": true,
      "types": ["file", "component"],
      "budgetMin": 3000,
      "budgetMax": 8000
    },
    {
      "key": "related-files",
      "required": false,
      "types": ["file", "bashOutput"],
      "budgetMin": 2000,
      "budgetMax": 5000
    },
    {
      "key": "test-coverage",
      "required": true,
      "types": ["file", "memo"],
      "budgetMin": 2000,
      "budgetMax": 6000
    }
  ]
}
```

### memory-agent-complete-*.json
```json
{
  "event": "MEMORY_AGENT_COMPLETED",
  "timestamp": "2026-02-16T...",
  "duration": 5234,
  "impulsesCreated": 3,
  "breakdown": [
    {
      "id": "target-code-file",
      "type": "file",
      "budgetUsed": 4500,
      "budgetAllocated": 5000
    },
    {
      "id": "related-files-search",
      "type": "bashOutput",
      "budgetUsed": 2100,
      "budgetAllocated": 3000
    },
    {
      "id": "test-coverage-summary",
      "type": "memo",
      "budgetUsed": 1800,
      "budgetAllocated": 2500
    }
  ]
}
```

### impulse-created-*.json (multiple files)
```json
{"event":"IMPULSE_CREATED_SESSION_SCOPE","timestamp":"2026-02-16T...","id":"target-code-file","pointerType":"file","budget":5000,"priority":"high","targetSession":"ses_..."}
{"event":"IMPULSE_CREATED_SESSION_SCOPE","timestamp":"2026-02-16T...","id":"related-files-search","pointerType":"bashOutput","budget":3000,"priority":"medium","targetSession":"ses_..."}
{"event":"IMPULSE_CREATED_SESSION_SCOPE","timestamp":"2026-02-16T...","id":"test-coverage-summary","pointerType":"memo","budget":2500,"priority":"high","targetSession":"ses_..."}
```

---

## Validation Checklist

After execution, verify:

- [ ] `context-requirements-*.json` exists with 3 requirements
- [ ] `memory-agent-complete-*.json` shows 3 impulses created
- [ ] At least 3 `impulse-created-*.json` files exist
- [ ] Budget values are within specified ranges:
  - target-code: 3000-8000 ✓
  - related-files: 2000-5000 ✓
  - test-coverage: 2000-6000 ✓
- [ ] Required requirements (target-code, test-coverage) have `priority: "high"`
- [ ] Optional requirement (related-files) may have lower priority

---

## Success Criteria

✅ **Complete Validation** when:
1. Template registered with `context_requirements`
2. Activity executed successfully
3. Trace files created with all 3 events
4. Requirements match impulses created
5. Budgets within specified ranges
6. Priority reflects required vs. optional

---

## Files Reference

**Test Template**: `/tmp/test-template-with-context-reqs.json`  
**OpenCode Source**: `repos/metabob-opencode/packages/opencode/src/`  
**Trace Output**: `.context-flow-trace/`  
**Validation Report**: `CONTEXT_REQUIREMENTS_RUNTIME_VALIDATION_REPORT.md`

---

## Troubleshooting

### No trace files created
- Check `.context-flow-trace/` directory exists
- Verify OpenCode version: `opencode --version` (should be `202602160758`)
- Check file write permissions

### Only impulse traces, no requirements trace
- Template doesn't have `context_requirements` field
- Verify: `curl -s "http://localhost:8080/api/v2/activities/templates/test-context-flow-v1" | jq '.context_requirements'`
- Re-register template if needed

### Wrong number of impulses
- Check memory agent logs in backend
- Memory agent may create additional impulses beyond requirements
- Focus on matching requirement keys to impulse IDs

---

**Ready to complete validation!** 🚀

Just register the template and execute - should take < 15 minutes.
