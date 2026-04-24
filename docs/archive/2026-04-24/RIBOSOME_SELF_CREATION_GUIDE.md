# MiniBob Self-Creation: The Ribosome Pattern

**Key Insight**: MiniBob doesn't need 100+ manually-created templates. It **creates templates from successful improvisations** automatically.

---

## How Template Self-Creation Works

### The Ribosome Pattern

```
User gives goal MiniBob doesn't have template for
       ↓
MiniBob improvises (tries to figure it out)
       ↓
If improvisation succeeds
       ↓
Template Extractor analyzes what worked
       ↓
Creates reusable template from execution
       ↓
Registers template with backend
       ↓
Next time: Use template instead of improvising
```

### What We See in Action

From our practice session logs:
```
[TemplateExtractor] Extracting template from exec_improv_1776157774837_qjj8y (5 steps)
[TemplateExtractor] Extracted inputSchema: 1 required, 0 optional shapes
[TemplateExtractor] Extracted outputSchema: 1 shapes produced
[TemplateExtractor] Template extracted: tpl_1776157793545_r04qs (2 tasks)
[Ribosome] ✗ Registration failed: tpl_1776157793545_r04qs
```

**Good News**: Template extraction IS working!
- Improvisation succeeded (5 steps)
- Input/output shapes identified
- Template created (2 tasks)

**Issue**: Registration failing (backend rejection)

---

## Current State Analysis

### What's Working ✅

1. **Improvisation** - MiniBob can figure things out
   - 6/10 goals succeeded via improvisation
   - Fast execution (3-22 seconds)
   - Low cost ($0-$0.06)

2. **Template Extraction** - Ribosome analyzes successful runs
   - Identifies required inputs
   - Detects produced outputs
   - Generalizes steps into tasks

3. **Template Structure** - Creates valid JSON
   - Proper task definitions
   - Variable extraction
   - Validation rules

### What's Broken ❌

**Registration Endpoint** - Templates not saving to backend
- Cause: Backend API issue or authentication problem
- Impact: Templates extracted but not reused
- Result: Every execution improvises (slow, expensive)

---

## The Registration Issue

### Diagnosis

Let's test template registration directly:

```bash
# 1. Check if backend accepts template registration
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $(cat ~/.metabob/config.json | jq -r '.metabob.apiKey')" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-ribosome-template",
    "name": "Test Ribosome Template",
    "category": "test",
    "description": "Testing template registration",
    "tasks": [
      {
        "id": "test-task",
        "description": "Test task",
        "prompt": {"template": "Test prompt"}
      }
    ]
  }'

# 2. Check if template was stored
curl -s "https://activity.metabob.com/v2/activities/templates?limit=100" \
  -H "Authorization: ApiKey $(cat ~/.metabob/config.json | jq -r '.metabob.apiKey')" \
  | jq '.templates[] | select(.id == "test-ribosome-template")'
```

### Likely Causes

1. **Schema Mismatch** - Template structure doesn't match expected format
2. **Authentication** - API key lacks write permissions
3. **Validation Error** - Missing required fields
4. **Endpoint Issue** - POST endpoint not working

---

## The Self-Expanding Solution

### Vision: Continuous Template Growth

```
Week 1: 75 templates (manually created)
  ↓
MiniBob works on diverse goals
  ↓
Week 2: 150 templates (75 manual + 75 from improvisation)
  ↓
More templates = Better success rate
  ↓
Week 3: 225 templates (75 manual + 150 from improvisation)
  ↓
Eventually: 500+ templates covering all common patterns
```

### The Positive Feedback Loop

```
More templates → Higher success rate → Faster execution → Lower cost
       ↑                                                        ↓
   Ribosome extracts templates  ←  Successful executions increase
```

**Key Metrics**:
- **Coverage** increases: More use cases handled
- **Cost** decreases: Templates cheaper than improvisation
- **Speed** increases: Templates faster than figuring it out
- **Quality** increases: Templates refined through Thompson Sampling

---

## Fix Strategy

### Option 1: Fix Backend Registration (Recommended)

**Investigate and fix the registration endpoint**:

```bash
# Step 1: Check backend logs for registration errors
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api \
  --tail=500 | grep -i "template.*registration\|POST.*templates"

# Step 2: Test registration endpoint
curl -X POST https://activity.metabob.com/v2/activities/templates \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -H "Content-Type: application/json" \
  -d @test-template.json \
  -v

# Step 3: Check for schema validation errors
# Look for 400/422 responses indicating validation failures

# Step 4: Fix the issue in metabob-activity-api
# Likely in src/routes/activities.ts POST endpoint
```

### Option 2: Local Template Cache (Workaround)

**Store templates locally until backend fixed**:

```typescript
// In MiniBob ribosome.ts
export async function registerTemplate(template: ActivityTemplate) {
  try {
    // Try backend registration
    const result = await mcpClient.registerTemplate(template)
    if (result.success) return result
  } catch (error) {
    logger.warn('Backend registration failed, using local cache')
  }

  // Fallback: Save locally
  const localPath = `~/.metabob/templates/${template.id}.json`
  await fs.writeFile(localPath, JSON.stringify(template, null, 2))

  // Add to local index
  await updateLocalTemplateIndex(template)

  return { success: true, method: 'local' }
}
```

### Option 3: Direct Database Insert (Temporary)

**Bypass API and write directly to SurrealDB**:

```bash
# Use kubectl exec to insert template
kubectl exec -n activity-system deployment/metabob-activity-api -- \
  curl -X POST http://localhost:8080/sql \
    -u "root:$SURREALDB_PASSWORD" \
    -H 'surreal-ns: activity-system' \
    -H 'surreal-db: learning_loop' \
    -d "INSERT INTO activity {
      id: 'test-template',
      name: 'Test Template',
      category: 'test',
      tasks: [...]
    }"
```

---

## Demonstrating Self-Creation

### Test Case: Create Template Through Improvisation

Let's prove the ribosome works end-to-end:

```bash
# 1. Give MiniBob a novel goal
minibob --single "count how many JSON files are in the activities directory and save the result to activity-count.txt"

# Expected output:
# [Improviser] Improvising...
# [TemplateExtractor] Extracting template...
# [TemplateExtractor] Template extracted: tpl_XXXXX
# [Ribosome] ✓ Registered: count-files-and-save

# 2. Verify template was created
ls ~/.metabob/templates/ | grep count

# 3. Try same goal again - should use template
minibob --single "count how many TypeScript files are in src and save to ts-count.txt"

# Expected output:
# [GoalProcessor] Found template: count-files-and-save
# [Activity] Executing: count-files-and-save
# (Much faster, no improvisation)

# 4. Check Thompson Sampling scores
curl -s "https://activity.metabob.com/v2/activities/templates" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  | jq '.templates[] | select(.id == "count-files-and-save") | {id, thompson_alpha, thompson_beta, total_executions}'
```

---

## Template Quality Evolution

### How Templates Improve Over Time

**Initial Template** (from improvisation):
```json
{
  "id": "count-files-and-save",
  "tasks": [
    {
      "id": "count-files",
      "description": "Count files in directory",
      "prompt": {
        "template": "Use ls or find to count files matching {{pattern}} in {{directory}}"
      }
    },
    {
      "id": "save-result",
      "description": "Save count to file",
      "prompt": {
        "template": "Write the count to {{outputFile}}"
      }
    }
  ],
  "metrics": {
    "thompson_alpha": 2,  // 1 success + 1 prior
    "thompson_beta": 1,   // 0 failures + 1 prior
    "total_executions": 1
  }
}
```

**After 10 Uses** (Thompson Sampling learning):
```json
{
  "metrics": {
    "thompson_alpha": 9,  // 8 successes + 1 prior
    "thompson_beta": 3,   // 2 failures + 1 prior
    "total_executions": 10,
    "success_rate": 0.8
  }
}
```

**Variant Created** (after failures):
```json
{
  "id": "count-files-and-save-robust",
  "tasks": [
    {
      "id": "validate-directory",
      "description": "Check directory exists",
      "prompt": {
        "template": "Verify {{directory}} exists before counting"
      }
    },
    {
      "id": "count-with-error-handling",
      "description": "Count with fallback",
      "prompt": {
        "template": "Try find command, fallback to ls if fails"
      }
    },
    {
      "id": "save-with-validation",
      "description": "Save and verify",
      "prompt": {
        "template": "Write count and verify file exists"
      }
    }
  ]
}
```

### Template Variants Through Trailblazing

When a template fails, MiniBob:
1. Creates variant with failure analysis
2. Thompson Sampling tests both versions
3. Better variant gets selected more often
4. Poor variants naturally deprecated

---

## Integration with Autonomous Development

### How Self-Creation Enables Autonomy

**Without Ribosome** (manual templates only):
```
MiniBob gets goal: "Optimize dashboard performance"
  ↓
No template matches
  ↓
Improvises (slow, expensive, might fail)
  ↓
Template discarded
  ↓
Next time: Improvises again (no learning)
```

**With Ribosome** (self-creating templates):
```
MiniBob gets goal: "Optimize dashboard performance"
  ↓
No template matches
  ↓
Improvises successfully
  ↓
Template created: "optimize-web-dashboard"
  ↓
Template registered with backend
  ↓
Next similar goal: Uses template (fast, cheap, reliable)
  ↓
Template refined through Thompson Sampling
```

### The Exponential Effect

**Month 1**: 75 templates (manual)
- Can handle: ~150 goal types (direct + variants)
- Success rate: 60%
- Avg cost per goal: $0.15

**Month 2**: 75 manual + 200 self-created = 275 templates
- Can handle: ~550 goal types
- Success rate: 75%
- Avg cost per goal: $0.08

**Month 6**: 75 manual + 800 self-created = 875 templates
- Can handle: ~1,750 goal types
- Success rate: 85%
- Avg cost per goal: $0.03

**Month 12**: 75 manual + 2,000 self-created = 2,075 templates
- Can handle: ~4,000 goal types
- Success rate: 92%
- Avg cost per goal: $0.01

---

## Action Plan

### Immediate (Today)

1. **Test Registration Endpoint**
   ```bash
   cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-activity-api

   # Check POST /v2/activities/templates endpoint
   grep -A 50 "app.post.*templates" src/routes/activities.ts

   # Test with curl
   curl -X POST https://activity.metabob.com/v2/activities/templates \
     -H "Authorization: ApiKey $METABOB_API_KEY" \
     -H "Content-Type: application/json" \
     -d @test-template.json
   ```

2. **Fix Registration If Broken**
   ```bash
   # Deploy fix to backend
   # Test ribosome end-to-end
   # Verify templates accumulate
   ```

3. **Demonstrate Self-Creation**
   ```bash
   # Run 10 novel goals
   # Verify 10 templates created
   # Re-run similar goals
   # Confirm templates reused
   ```

### This Week

1. **Enable Ribosome in Autonomous Loop**
   - Every improvisation creates template
   - Templates registered automatically
   - Dashboard shows template growth

2. **Monitor Template Accumulation**
   - Track templates created per day
   - Measure success rate improvement
   - Calculate cost reduction

3. **Quality Control**
   - Review auto-created templates
   - Merge similar templates
   - Refine prompts based on failures

### This Month

1. **Achieve 200+ Templates** (75 manual + 125+ self-created)
2. **80%+ Success Rate** (up from current 60%)
3. **50% Cost Reduction** (templates vs improvisation)

---

## Success Criteria

**Ribosome Working**:
- ✅ Templates extracted from improvisation
- ✅ Templates registered with backend
- ✅ Templates reused on similar goals
- ✅ Success rate increases over time
- ✅ Cost per goal decreases

**Autonomous Development Enabled**:
- ✅ MiniBob handles novel goals automatically
- ✅ Template library grows without human input
- ✅ Complex goals achievable through composition
- ✅ Dashboard shows development progress
- ✅ System improves itself continuously

---

## The Vision

**Current**: MiniBob with 75 manually-created templates

**6 Months**: MiniBob with 1,000+ self-created templates, autonomously developing demo-minibob-cicd with visible progress on dashboard

**1 Year**: MiniBob developing multiple projects simultaneously, creating specialized templates for each domain, continuously improving through Thompson Sampling

**The Key**: Fix ribosome registration → Enable exponential template growth → Achieve true autonomy

---

## Next Step

```bash
# Test and fix ribosome registration
minibob --single "investigate why template registration is failing in the ribosome. Check the backend POST /v2/activities/templates endpoint and fix any issues."
```
