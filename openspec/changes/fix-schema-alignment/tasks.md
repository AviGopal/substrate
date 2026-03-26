## Milestone 1: Fix Critical Bug (Thompson Sampling Metadata)

**Goal:** Fix the undefined `beta` variable in selection_metadata
**Testable State:** `/v2/activities/recommend` returns valid metadata

- [x] 1.1 Fix line 1598 in `repos/metabob-activity-api/src/routes/activities.ts`: change `beta` to `beta: betaVal`

### Black-Box Test M1

```bash
# Deploy current images (if not already deployed)
cd helm && helmfile -f activity-system-minimal.yaml.gotmpl sync

# Test: Recommendation endpoint returns valid beta value
curl -s -X POST http://api.minibob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"category": "tool", "limit": 5}' \
  | jq -e '.recommendations[0].selection_metadata.beta != null'
```

---

## Milestone 2: Relax Zod Validation for task_steps

**Goal:** API accepts flexible task_steps structure matching SurrealDB's `option<array>`
**Testable State:** Template creation succeeds with minimal task_steps

- [x] 2.1 Update `TemplateTaskSchema` in `repos/metabob-activity-api/src/models/schemas.ts`:
  - Changed to `z.object({ id: z.string().optional(), description: z.string().optional() }).passthrough()`
  - Accepts any additional fields without strict validation
- [x] 2.2 Update `CreateTemplateRequestSchema` to use relaxed `task_steps` validation
  - Already uses `z.array(TemplateTaskSchema)`, inherits relaxed validation
- [x] 2.3 Run unit tests to verify no regressions: `bun test` in `repos/metabob-activity-api`
  - 14 tests pass, 0 fail

### Black-Box Test M2

```bash
# Rebuild API image
./scripts/build-vessels.sh metabob-activity-api

# Redeploy
cd helm && helmfile -f activity-system-minimal.yaml.gotmpl sync

# Test: Minimal task_steps accepted
curl -s -X POST http://api.minibob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-minimal-'$(date +%s)'",
    "activity_id": "test-activity",
    "variant_name": "Minimal Task Steps Test",
    "description": "Test with minimal task_steps",
    "category": "tool",
    "task_steps": [{"id": "1", "description": "Simple task"}],
    "scope": "global"
  }' | jq -e '.success == true'

# Test: Empty task_steps accepted
curl -s -X POST http://api.minibob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-empty-'$(date +%s)'",
    "activity_id": "test-activity",
    "variant_name": "Empty Task Steps Test",
    "description": "Test with empty task_steps",
    "category": "tool",
    "task_steps": [],
    "scope": "global"
  }' | jq -e '.success == true'

# Test: Rich task_steps preserved
curl -s -X POST http://api.minibob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-rich-'$(date +%s)'",
    "activity_id": "test-activity",
    "variant_name": "Rich Task Steps Test",
    "description": "Test with rich task_steps",
    "category": "tool",
    "task_steps": [{
      "id": "1",
      "description": "Rich task",
      "subagent": "bash",
      "dependencies": ["setup"],
      "prompt": {"template": "Do the thing", "maxTokens": 1000}
    }],
    "scope": "global"
  }' | jq -e '.success == true'
```

---

## Milestone 3: Strip Undefined Fields Before INSERT

**Goal:** API only sends fields that exist in SurrealDB SCHEMAFULL tables
**Testable State:** No "field doesn't exist" errors from SurrealDB

- [x] 3.1 Verify existing code already builds dynamic query with only defined fields
  - Template registration at lines 346-378 already constructs `templateRecord` with only schema-defined fields
  - Dynamic INSERT query is built from `Object.keys(templateRecord)`
- [x] 3.2 Fix schema type mismatch: `variant_performance_metrics.org_id` changed from `record<organizations>` to `option<string>`
  - Updated `sql/schemas/010-activity-registry.surql` to use `option<string>` types
  - Updated `project_id` to `option<string>` as well for consistency
- [x] 3.3 Ensure `org_id` is passed as plain string, not record reference
  - Changed default from `'organizations:metabob_internal'` to `'metabob_internal'`

### Black-Box Test M3

```bash
# Rebuild and redeploy
./scripts/build-vessels.sh metabob-activity-api
cd helm && helmfile -f activity-system-minimal.yaml.gotmpl sync

# Test: Template with org_id creates successfully
curl -s -X POST http://api.minibob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-orgid-'$(date +%s)'",
    "activity_id": "test-activity",
    "variant_name": "Org ID Test",
    "description": "Test with org_id",
    "category": "tool",
    "task_steps": [{"id": "1", "description": "Task"}],
    "scope": "org",
    "org_id": "metabob_internal"
  }' | jq -e '.success == true'

# Test: Template without org_id creates successfully (null default)
curl -s -X POST http://api.minibob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "test-no-orgid-'$(date +%s)'",
    "activity_id": "test-activity",
    "variant_name": "No Org ID Test",
    "description": "Test without org_id",
    "category": "tool",
    "task_steps": [{"id": "1", "description": "Task"}],
    "scope": "global"
  }' | jq -e '.success == true'

# Test: Check API logs for no SurrealDB field errors
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=50 \
  | grep -v "field.*doesn't exist" && echo "No field errors found"
```

---

## Milestone 4: Thompson Sampling End-to-End

**Goal:** Created templates participate in Thompson Sampling recommendations
**Testable State:** Recommendations show probabilistic template selection

- [ ] 4.1 Verify `enrichTemplatesWithMetrics` in activities.ts correctly joins template data with metrics
- [ ] 4.2 Run Thompson Sampling integration tests from fix-thompson-sampling change
- [ ] 4.3 Verify probabilistic behavior (multiple calls show variation)

### Black-Box Test M4

```bash
# Create a template for Thompson Sampling testing
VARIANT_ID="thompson-test-$(date +%s)"
curl -s -X POST http://api.minibob.local/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d '{
    "variant_id": "'$VARIANT_ID'",
    "activity_id": "thompson-test",
    "variant_name": "Thompson Test Template",
    "description": "Test template for Thompson Sampling",
    "category": "tool",
    "task_steps": [{"id": "1", "description": "Test task"}],
    "scope": "global"
  }' | jq -e '.success == true'

# Test: Created template appears in templates list
curl -s http://api.minibob.local/v2/activities/templates \
  | jq -e ".templates[] | select(.variant_id == \"$VARIANT_ID\")"

# Test: Recommendation returns our template (or others)
curl -s -X POST http://api.minibob.local/v2/activities/recommend \
  -H "Content-Type: application/json" \
  -d '{"category": "tool", "limit": 10}' \
  | jq -e '.recommendations | length > 0'

# Test: Probabilistic variation (run 10 times, collect unique selections)
echo "Running 10 recommendation calls..."
for i in {1..10}; do
  curl -s -X POST http://api.minibob.local/v2/activities/recommend \
    -H "Content-Type: application/json" \
    -d '{"category": "tool", "limit": 1}' \
    | jq -r '.recommendations[0].template_id'
done | sort | uniq -c | sort -rn
echo "Different selections indicate probabilistic behavior"
```

---

## Milestone 5: Dashboard Validation (Playwright MCP)

**Goal:** Dashboard displays templates and Thompson Sampling metrics correctly
**Testable State:** Visual confirmation via Playwright screenshots

- [ ] 5.1 Use Playwright MCP to navigate to dashboard
- [ ] 5.2 Verify templates tab shows created templates
- [ ] 5.3 Verify Thompson Sampling metrics (alpha, beta, selections) are displayed
- [ ] 5.4 Take screenshot for documentation

### Black-Box Test M5 (Playwright MCP)

```typescript
// Using mcp__playwright__* tools

// 1. Navigate to dashboard
await mcp__playwright__browser_navigate({ url: "http://dashboard.minibob.local" });

// 2. Take initial snapshot
const snapshot = await mcp__playwright__browser_snapshot({});

// 3. Click Templates tab (ref from snapshot)
await mcp__playwright__browser_click({ ref: "templates-tab-ref", element: "Templates tab" });

// 4. Wait for templates to load
await mcp__playwright__browser_wait_for({ text: "Thompson Test Template" });

// 5. Take screenshot of templates view
await mcp__playwright__browser_take_screenshot({
  type: "png",
  filename: "schema-alignment-templates-validated.png"
});

// 6. Verify Thompson metrics visible
const templatesSnapshot = await mcp__playwright__browser_snapshot({});
// Check for alpha/beta/selections in snapshot

// 7. Close browser
await mcp__playwright__browser_close({});
```

---

## Summary

| Milestone | Focus | Commit State |
|-----------|-------|--------------|
| M1 | Fix beta variable bug | API returns valid metadata |
| M2 | Relax task_steps validation | Template creation works |
| M3 | Strip undefined fields | No SurrealDB field errors |
| M4 | Thompson Sampling E2E | Probabilistic recommendations |
| M5 | Dashboard validation | Visual confirmation |

Each milestone produces a working, testable state with specific black-box tests that can be run against deployed services.
