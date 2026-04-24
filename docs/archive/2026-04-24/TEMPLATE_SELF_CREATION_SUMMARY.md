# Template Self-Creation: Key Findings & Solution

## The Core Problem

**User's Insight**: "MiniBob should be able to reliably create its own templates by trying to do something, and figuring it out."

**Current Reality**: Ribosome IS extracting templates but registration is failing due to schema mismatch.

---

## What We Discovered

### ✅ Ribosome Pattern Is Working

From our test logs:
```
[TemplateExtractor] Extracting template from exec_improv_1776157774837_qjj8y (5 steps)
[TemplateExtractor] Extracted inputSchema: 1 required, 0 optional shapes
[TemplateExtractor] Extracted outputSchema: 1 shapes produced
[TemplateExtractor] Template extracted: tpl_1776157793545_r04qs (2 tasks)
[Ribosome] ✗ Registration failed: tpl_1776157793545_r04qs
```

**Ribosome succeeds at**:
1. ✅ Detecting successful improvisations
2. ✅ Analyzing execution steps
3. ✅ Identifying input/output shapes
4. ✅ Creating template structure
5. ❌ Registering with backend (FAILS HERE)

### ❌ Schema Mismatch Blocks Registration

**MiniBob creates** (old format):
```json
{
  "id": "template-name",
  "name": "Template Name",
  "category": "tool",
  "tasks": [...]
}
```

**Backend expects** (new paradigm format):
```json
{
  "variant_id": "template-name",
  "activity_id": "template-name",
  "variant_name": "Template Name",
  "category": "feature|bugfix|refactor|tool|infrastructure|meta",
  "task_steps": [
    {
      "id": "step-1",
      "description": "...",
      "subagent": "llm|bash|...",
      "dependencies": [],
      "prompt": {...}
    }
  ]
}
```

**The Gap**: MiniBob's ribosome generates old schema, backend only accepts new schema.

---

## The Solution: Two-Part Fix

### Part 1: Update Ribosome Template Format (MiniBob)

**File**: `repos/minibob/src/ribosome.ts`

**Change template extraction to output new schema**:

```typescript
// BEFORE (old format)
const template = {
  id: templateId,
  name: templateName,
  category: inferCategory(steps),
  tasks: extractTasks(steps)
}

// AFTER (new paradigm format)
const template = {
  variant_id: templateId,
  activity_id: templateId,
  variant_name: templateName,
  category: inferCategory(steps), // Must be: feature|bugfix|refactor|tool|infrastructure|meta
  task_steps: extractTasks(steps).map(task => ({
    id: task.id,
    description: task.description,
    subagent: task.subagent || 'llm',
    dependencies: task.dependencies || [],
    prompt: {
      template: task.prompt.template,
      variables: (task.prompt.variables || []).map(v => ({
        name: v.name,
        type: v.type,
        required: v.required
        // Remove 'description' field - not in backend schema
      }))
    }
  }))
}
```

### Part 2: Add Backward Compatibility (Backend)

**File**: `repos/metabob-activity-api/src/routes/activities.ts`

**Support both old and new template formats**:

```typescript
// In POST /v2/activities/templates endpoint
app.post('/templates', async (c) => {
  const body = await c.req.json()

  // Transform old format to new format for backward compatibility
  if (body.id && !body.variant_id) {
    body.variant_id = body.id
    body.activity_id = body.id
  }
  if (body.name && !body.variant_name) {
    body.variant_name = body.name
  }
  if (body.tasks && !body.task_steps) {
    body.task_steps = body.tasks.map(task => ({
      id: task.id,
      description: task.description,
      subagent: task.subagent || 'llm',
      dependencies: task.dependencies || [],
      prompt: task.prompt || {}
    }))
  }

  // Now validate and insert
  // ... existing code ...
})
```

---

## Quick Win: Minimal Template Format

**What actually works** (discovered through testing):

```json
{
  "variant_id": "my-template",
  "activity_id": "my-template",
  "variant_name": "My Template Name",
  "category": "tool",
  "description": "What this template does",
  "task_steps": [
    {
      "id": "step-1",
      "description": "Step description",
      "subagent": "llm",
      "dependencies": [],
      "prompt": {
        "template": "Prompt text with {{variables}}"
      }
    }
  ]
}
```

**Required fields**:
- variant_id, activity_id, variant_name
- category (enum: feature|bugfix|refactor|tool|infrastructure|meta)
- task_steps array
- Each task_step: id, description, subagent, dependencies, prompt

**Optional fields**: (remove to avoid validation errors)
- prompt.variables[].description
- Most other fields

---

## Immediate Action

### Option 1: Fix MiniBob Ribosome (Recommended)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/minibob

# Update ribosome to generate new schema format
minibob --single "update src/ribosome.ts to generate templates in the new paradigm format with variant_id, activity_id, variant_name, and task_steps instead of id, name, and tasks"

# Test ribosome
minibob --single "create a test file and verify the template gets registered successfully"

# Deploy to production
git add src/ribosome.ts
git commit -m "fix(ribosome): update template format to paradigm schema"
git push
```

### Option 2: Add Backend Compatibility (Quick Fix)

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api

# Add format transformation in POST /templates endpoint
minibob --single "update src/routes/activities.ts POST /v2/activities/templates to accept both old format (id, name, tasks) and new format (variant_id, variant_name, task_steps) by transforming old to new"

# Deploy to production
git add src/routes/activities.ts
git commit -m "feat(api): support legacy template format for ribosome compatibility"
git push
```

### Option 3: Both (Best)

Do both fixes for full compatibility:
1. Update MiniBob to generate new format (future-proof)
2. Add backend compatibility layer (works with old MiniBob versions)

---

## Testing the Fix

Once fixed, test end-to-end:

```bash
# 1. Give MiniBob a novel goal
minibob --single "calculate the total size of all JSON files in the activities directory and save to activities-size.txt"

# 2. Check ribosome extraction
# Should see: [TemplateExtractor] Template extracted: tpl_XXXXX
# Should see: [Ribosome] ✓ Registered: calculate-file-sizes

# 3. Verify template registered
curl -s "https://activity.metabob.com/v2/activities/templates?limit=200" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  | jq '.templates[] | select(.variant_id | contains("calculate"))'

# 4. Run similar goal - should use template
minibob --single "calculate the total size of all TypeScript files in src and save to src-size.txt"

# Should see: [Activity] Executing: calculate-file-sizes (NOT improvising)

# 5. Check Thompson Sampling
curl -s "https://activity.metabob.com/v2/activities/templates" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  | jq '.templates[] | select(.variant_id | contains("calculate")) | .metrics'

# Should show: thompson_alpha: 2+, total_executions: 2+
```

---

## The Exponential Growth Model

### Once Ribosome Works

**Week 1**:
- Start: 75 manual templates
- MiniBob works on 50 novel goals
- Success rate: 60% (30 successful improvisations)
- Templates created: 30
- **Total: 105 templates**

**Week 2**:
- Start: 105 templates
- MiniBob works on 100 goals (more confidence)
- Success rate: 70% (70 successful, 40 new improvisations needed)
- Templates created: 40
- **Total: 145 templates**

**Month 1**:
- Start: 75 templates
- End: ~250 templates
- Success rate: 75%
- Cost reduction: 40%

**Month 3**:
- Start: 75 templates
- End: ~600 templates
- Success rate: 82%
- Cost reduction: 60%

**Month 6**:
- Start: 75 templates
- End: ~1,000 templates
- Success rate: 88%
- Cost reduction: 70%

### Why This Enables Full Autonomy

**Without self-creation**:
- Limited to 75 manually-created use cases
- Novel goals always require improvisation
- Slow, expensive, unreliable
- Cannot handle complex development autonomously

**With self-creation**:
- Handles 1,000+ use cases after 6 months
- Most goals match existing templates
- Fast, cheap, reliable
- Complex goals achievable through template composition
- **True autonomous development possible**

---

## Connection to Autonomous Development

### The Positive Feedback Loop

```
More templates → More successful goals → More new templates
     ↑                                          ↓
Cost decreases ← Speed increases ← Coverage increases
```

### Dashboard Integration

**Template Growth Metrics** (add to development dashboard):

```json
{
  "templateMetrics": {
    "totalTemplates": 147,
    "manualTemplates": 75,
    "ribosomeCreated": 72,
    "thisWeek": {
      "created": 12,
      "used": 89,
      "improvised": 8
    },
    "growthRate": "8.9% per week",
    "coverageEstimate": "82% of common development tasks"
  }
}
```

**Dashboard View**:
```html
<section class="template-growth">
  <h2>Template Library Growth</h2>
  <div class="stats">
    <div class="stat">
      <span class="value">147</span>
      <span class="label">Total Templates</span>
      <span class="delta">+12 this week</span>
    </div>
    <div class="stat">
      <span class="value">72</span>
      <span class="label">Self-Created</span>
      <span class="delta">48% of library</span>
    </div>
  </div>
  <canvas id="template-growth-chart"></canvas>
</section>
```

---

## Next Steps

1. **Fix Ribosome** (1-2 hours)
   - Update template extraction format
   - Test registration
   - Deploy to production

2. **Verify Self-Creation** (30 minutes)
   - Run 10 novel goals
   - Confirm templates registered
   - Test template reuse

3. **Enable in Autonomous Loop** (1 hour)
   - Integrate with orchestrator
   - Add template growth tracking
   - Update dashboard

4. **Monitor Growth** (ongoing)
   - Track templates created per day
   - Measure success rate improvement
   - Calculate cost reduction

**Start now**:
```bash
minibob --single "fix the ribosome template extraction to generate new paradigm format with variant_id, activity_id, variant_name, and task_steps"
```

---

## Summary

**The Problem**: Ribosome works but registration fails due to schema mismatch

**The Solution**: Update ribosome to generate new template format

**The Impact**:
- Template library grows exponentially
- Success rate increases continuously
- Cost decreases over time
- Full autonomy becomes achievable

**The Vision**: MiniBob creating 1,000+ specialized templates through real development work, enabling truly autonomous development on demo-minibob-cicd and beyond.
