# Teaching MiniBob - Complete Summary

## What We've Built

I've created a comprehensive guide to teaching MiniBob, providing feedback, and creating template variants. Here's everything you need to know:

---

## 📚 Documentation Created

### 1. **TEACHING_AND_FEEDBACK_GUIDE.md** (Complete Guide)
   - Detailed explanation of all teaching mechanisms
   - Step-by-step workflows with examples
   - Thompson Sampling theory and practice
   - Troubleshooting common issues
   - Advanced techniques

### 2. **QUICK_REFERENCE_TEACHING.md** (Quick Reference Card)
   - All commands at a glance
   - Common workflows
   - Template structure examples
   - Troubleshooting shortcuts

### 3. **MINIBOB_DIAGNOSTIC_TOOLS_SUMMARY.md** (Previously created)
   - All diagnostic tools explained
   - Database query examples
   - Verification procedures

### 4. **scripts/teaching-demo.sh** (Interactive Demo)
   - Runnable demonstration of the complete workflow
   - Shows improvisation → extraction → feedback cycle
   - Includes explanations at each step

---

## 🎯 Three Ways to Teach MiniBob

### 1. **Feedback (Adjust Thompson Sampling)**

**In the REPL:**
```bash
minibob
> run some task
> /cheer[!|!!|!!!] [message]    # Positive feedback (boost α)
> /chide[!|!!|!!!] [message]    # Negative feedback (boost β)
```

**What happens:**
- `/cheer` increases `alpha` (successes) → template selected more often
- `/chide` increases `beta` (failures) → template avoided
- Intensity `!` modifiers control strength (0.5 to 2.0)
- Message logged for learning analysis

**After execution:**
```bash
# Via API
curl -X POST "https://activity.metabob.com/v2/activities/feedback" \
  -H "Content-Type: application/json" \
  -H "Authorization: ApiKey $METABOB_API_KEY" \
  -d '{
    "activity_id": "exec_12345",
    "direction": "positive",
    "intensity": 2,
    "reason": "Perfect execution"
  }'
```

### 2. **Template Submission (Add New Templates)**

**From execution (Ribosome):**
```bash
# Step 1: Run a task
minibob --single "write hello to test.txt" > log.txt
EXEC_ID=$(grep execution_id log.txt | cut -d'"' -f4)

# Step 2: Extract template
minibob doctor tutor --from-execution $EXEC_ID \
  --name "Write Hello to File" \
  --tags "file-operations,simple"

# Step 3: Verify
minibob doctor surface --goal "write to file"
```

**From file:**
```bash
# Create template.json (see structure below)
minibob doctor check template.json          # Validate
minibob doctor tutor template.json          # Submit
```

**Minimal template structure:**
```json
{
  "id": "activity:my-task",
  "name": "My Task Name",
  "description": "What this does",
  "category": "feature",
  "tasks": [{
    "id": "task-1",
    "description": "Step description",
    "prompt": {
      "template": "Do {{action}} with {{variable}}",
      "variables": ["action", "variable"]
    }
  }],
  "variables": [{
    "name": "variable",
    "type": "string",
    "required": true
  }]
}
```

### 3. **Variants (Automatic Improvement)**

**When templates fail:**
1. Template executes and fails
2. System creates variant with modifications
3. Variant enters Thompson Sampling pool
4. Future selections may choose variant

**Manual variant creation:**
```bash
# Get existing template
minibob doctor surface --goal "deploy" > template.json

# Edit to create variant
vim template.json

# Submit as variant
minibob doctor tutor template.json --variant
```

**What gets modified in variants:**
- Prompt phrasing (different instructions)
- Retry strategies (more attempts, backoff)
- Validation rules (stricter/looser)
- Tool selection (alternatives)
- Task ordering (different sequence)

---

## 🔄 The Learning Loop

```
┌─────────────────────────────────────────────┐
│  1. EXECUTE                                 │
│     User gives goal → Activity selected     │
│     Thompson Sampling picks best template   │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  2. CAPTURE                                 │
│     Execution trace stored                  │
│     Tool calls, files, duration, cost       │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  3. FEEDBACK                                │
│     User: /cheer or /chide                  │
│     System: Updates α/β values              │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  4. EXTRACT                                 │
│     Ribosome: Successful traces → Templates │
│     Automatic or on-demand                  │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  5. IMPROVE                                 │
│     Thompson Sampling adjusted              │
│     Variants created for failures           │
│     Better templates selected next time     │
└─────────────────┬───────────────────────────┘
                  │
                  └──► Back to step 1
```

---

## 📊 Thompson Sampling Explained

### How It Works

MiniBob uses **Thompson Sampling** with Beta distribution:

- **α (alpha)** = Successes + positive feedback
- **β (beta)** = Failures + negative feedback
- **Score** = Random sample from Beta(α, β)
- **Selection** = Highest score wins

### Reading the Values

| α | β | Mean | Interpretation |
|---|---|------|----------------|
| 1 | 1 | 50% | Never used (exploration) |
| 10 | 1 | 91% | Very reliable |
| 2 | 8 | 20% | Often fails |
| 14 | 2 | 87% | Proven winner |

**Formula:** `Mean = α / (α + β)`

### How Feedback Affects It

```
Before: α=10, β=2  → 83% mean → 83% selection probability
/cheer!!: α=11.5, β=2 → 85% mean → 85% selection probability
/chide!: α=10, β=3 → 77% mean → 77% selection probability
```

### View Current State

```bash
# Check Thompson Sampling
minibob doctor health --deep --verbose

# Output:
# ✓ Recommendations: Thompson Sampling active (10 templates)
#   Top: activity:fix-bug (α=14, β=2, confidence=87%)

# Via API
curl "https://activity.metabob.com/v2/activities/templates" | \
  jq '.templates[] | {
    id: .id,
    alpha: .metrics.thompson_alpha,
    beta: .metrics.thompson_beta,
    success_rate: .metrics.success_rate
  }'
```

---

## 🛠️ Practical Examples

### Example 1: Teaching from Scratch

```bash
# Day 1: First execution (improvisation)
$ minibob --single "add rate limiting to API"
[No template exists, MiniBob improvises]
[✓ Success!]
Execution ID: exec_20260408_001

# Day 2: Extract template
$ minibob doctor tutor --from-execution exec_20260408_001 \
    --name "Add Rate Limiting" \
    --tags "middleware,security"
✓ Template created: activity:add-rate-limiting
  α=1, β=0 (initial state)

# Day 3: Use template
$ minibob --single "add rate limiting to auth endpoint"
[Template selected automatically]
[✓ Success!]

# Day 4: Provide feedback
$ /cheer!! Perfect approach
✓ Cheered: activity:add-rate-limiting
  α=2.5, β=0

# Day 5: Template highly favored
$ minibob --single "add rate limiting to payment API"
[activity:add-rate-limiting selected - 93% probability]
```

### Example 2: Correcting Wrong Approach

```bash
# Template uses wrong approach
$ minibob --single "add caching to WebSocket endpoint"
[activity:add-http-caching selected]
[✗ Failed - HTTP caching doesn't work for WebSockets]

# Provide corrective feedback
$ /chide!! Wrong - WebSockets need different approach
✓ Chided: activity:add-http-caching
  α=5, β=2 (reduced probability)

[Variant created: activity:add-websocket-caching]

# Next time, variant gets selected
$ minibob --single "add caching to chat WebSocket"
[activity:add-websocket-caching selected]
[✓ Success!]

# Reinforce correct approach
$ /cheer!!! Perfect for WebSockets
✓ Cheered: activity:add-websocket-caching
  α=3, β=0
```

### Example 3: Template Extraction Pipeline

```bash
# Automate template extraction
for exec_id in $(cat successful_executions.txt); do
  minibob doctor tutor --from-execution $exec_id \
    --name "Auto-extracted $(date +%Y%m%d)" \
    --tags "auto-extracted"
done

# Review extracted templates
minibob doctor surface "auto-extracted" --verbose

# Validate before production use
for template in auto-extracted-*.json; do
  minibob doctor check $template || echo "Failed: $template"
done
```

---

## 🎓 How You Can Help

### 1. **Run Activities Regularly**
Every execution generates a trace:
```bash
minibob --single "your daily tasks"
```

### 2. **Provide Quality Feedback**
- Be specific in messages
- Explain WHY something worked/failed
- Use appropriate intensity
- Feedback soon after execution

### 3. **Curate Templates**
- Submit well-structured templates
- Review low-performing templates
- Create variants for edge cases
- Document successful patterns

### 4. **Share Knowledge**
- Submit templates to org scope
- Document common workflows
- Report issues and anomalies
- Help improve the system

---

## 🔍 Diagnostic Tools

### Quick Health Check
```bash
minibob doctor health --deep --verbose
```

### Template Search
```bash
minibob doctor surface "keyword"
minibob doctor surface --goal "fix bug"
```

### Validation
```bash
minibob doctor check template.json --verbose
```

### Full Verification
```bash
./scripts/verify-diagnostics.sh
```

---

## 📖 Resources

| Document | Purpose |
|----------|---------|
| **TEACHING_AND_FEEDBACK_GUIDE.md** | Complete guide with theory and examples |
| **QUICK_REFERENCE_TEACHING.md** | Quick command reference |
| **MINIBOB_DIAGNOSTIC_TOOLS_SUMMARY.md** | All diagnostic tools |
| **scripts/teaching-demo.sh** | Interactive demonstration |
| **scripts/verify-diagnostics.sh** | Verify all tools work |

---

## 🚀 Getting Started

### 1. Run the Demo
```bash
./scripts/teaching-demo.sh
```

### 2. Try Basic Feedback
```bash
minibob
> write hello to test.txt
> /cheer! Good job
```

### 3. Extract Your First Template
```bash
minibob --single "your task" > log.txt
EXEC_ID=$(grep execution_id log.txt | cut -d'"' -f4)
minibob doctor tutor --from-execution $EXEC_ID --name "My Template"
```

### 4. Monitor Improvement
```bash
minibob doctor health --deep --verbose
```

---

## 💡 Key Insights

1. **Feedback is Continuous**: Every `/cheer` and `/chide` adjusts Thompson Sampling
2. **Templates are Data**: Extracted from successful executions, not hand-crafted
3. **Variants are Automatic**: System creates them when templates fail
4. **Learning is Closed-Loop**: Execute → Capture → Feedback → Extract → Improve
5. **You are the Teacher**: Your feedback and templates improve the system

---

## ⚡ Quick Commands

```bash
# Feedback
/cheer[!|!!|!!!] message    # In REPL
/chide[!|!!|!!!] message    # In REPL

# Templates
minibob doctor tutor template.json
minibob doctor tutor --from-execution exec_id
minibob doctor surface "search"
minibob doctor surface --goal "goal"

# Diagnostics
minibob doctor health --deep --verbose
minibob doctor check template.json

# Verification
./scripts/verify-diagnostics.sh
./scripts/teaching-demo.sh
```

---

## 🎯 Success Metrics

**You'll know it's working when:**
- ✅ Thompson Sampling confidence increases over time
- ✅ Successful templates get selected more often
- ✅ Failed templates are avoided or improved via variants
- ✅ Template registry grows with quality templates
- ✅ Similar goals consistently use the same template
- ✅ Feedback visibly affects future selections

**Track with:**
```bash
# Weekly check
minibob doctor health --deep --verbose | tee weekly-report.txt

# Compare α/β trends
curl "https://activity.metabob.com/v2/activities/templates" | \
  jq '.templates | sort_by(.metrics.thompson_alpha) | reverse | .[0:10]'
```

---

**Remember**: MiniBob learns from *every execution*. The more you use it and provide feedback, the better it gets at achieving your development goals.

Start teaching MiniBob today! 🚀
