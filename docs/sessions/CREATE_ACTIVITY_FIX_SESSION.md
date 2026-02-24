# Create Activity Template Fix Session

**Date**: 2026-02-20  
**Objective**: Fix create-activity-self-contained template (0% success rate, 7+ failed executions)  
**Status**: ⏳ In Progress

---

## Problems Identified and Fixed

### 1. Schema Mismatch: task_id vs id ✅ FIXED

**Problem**:
- Proto templates used `task_id` field for task identifiers
- OpenCode expects `id` field
- Caused immediate pre-flight failures

**Fix**:
```bash
# Changed all bootstrap templates
task_id → id
```

**Commit**: `67369f1` in metabob-proto

---

### 2. Handlebars Filter Not Supported ✅ FIXED

**Problem**:
```
ERROR Missing variables in template: {{templateName | kebabCase}}
```

- Template used Handlebars filter: `{{templateName | kebabCase}}`
- Variable resolution system doesn't support filters
- Caused variable resolution failures

**Fix**:
```bash
# Replaced filter with simple variable
{{templateName | kebabCase}} → {{templateId}}
```

**Commit**: `4a0becf` in metabob-proto

---

## Current Status

**Fixes Applied**:
1. ✅ Schema fix (task_id → id)
2. ✅ Filter removal ({{templateName | kebabCase}} → {{templateId}})
3. ✅ Templates reseeded to SurrealDB
4. ✅ Local cache refreshed

**Activity Still Failing**:
- Pre-flight validation passes
- Task execution starts but fails immediately
- No agent sessions spawned
- No tool calls made
- Duration: 0.0s, Cost: $0.00

---

## Investigation Needed

**Possible Remaining Issues**:
1. Memory agent integration problem
2. Context requirements issue
3. Subagent spawn failure
4. Prompt template syntax error
5. Variable interpolation failure (despite filter fix)

**Next Steps**:
1. Check if simpler template works (hello-world-minimal)
2. Try debug-activity-self-contained to inspect execution
3. Review template prompt for other syntax issues
4. Check if there are MORE Handlebars filters in the prompt
5. Verify all variables are actually being provided

---

## Template Variables

**Required**:
- templateName
- templateDescription  
- category

**Optional with Defaults**:
- purpose (default: {{templateDescription}})
- templateId (default: "template") - FIXED, was {{templateName | kebabCase}}

**Provided by User**:
```json
{
  "templateName": "Manage Docker Compose Environment",
  "templateDescription": "Manage docker-compose services...",
  "category": "infrastructure"
}
```

---

## Commits

**metabob-proto**:
1. `67369f1`: Schema fix (task_id → id)
2. `4a0becf`: Filter removal

**metabob-devbob**:
1. `f96836f`: Update .metabob cache with schema fix
2. `b7acb1b`: Add session summary docs
3. Multiple: Update submodule pointers

---

## Key Insights

**Instructional → Functional State Bridge**:
- **Instructional**: Template should create activities
- **Functional Transitions**: Fixed schema, removed filters, reseeded DB
- **Outcome Measurement**: Still failing (0% → 0%)
- **Learning**: Multiple fixes needed, not just one root cause

**Template Quality Issues**:
- 0% success rate indicates fundamental problems
- Pre-flight passes but execution fails = deeper issue
- May need complete template rewrite or different approach

---

## Alternative Approaches

If template continues to fail:

1. **Manual Creation**: Create activities as JSON files directly
2. **Simpler Template**: Use ultra-minimal variant (if it has tasks)
3. **Different Tool**: Use different activity creation method
4. **Template Rewrite**: Start from scratch with minimal complexity

---

## Next Session

Should focus on:
1. Testing hello-world-minimal to verify system works
2. If that works, problem is specific to create-activity template
3. If that fails too, problem is broader (activity system itself)
4. Consider creating utilities manually rather than fighting template

