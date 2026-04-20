# How to Demonstrate Vessel Self-Improvement

This guide shows **three ways** to demonstrate MiniBob improving itself, from simplest to most complete.

## Quick Summary

| Method | Backend Required | Outputs | Best For |
|--------|-----------------|---------|----------|
| **Local Analysis** | No | File reports | Quick demo, offline |
| **Goal-Based** | Yes (degraded OK) | Improvised execution | Showing goal processing |
| **Template-Based** | Yes | Full structured output | Complete demonstration |

---

## Method 1: Local Analysis (Simplest)

**No backend required. Works offline. Creates observable file outputs.**

### What It Does
- Scans MiniBob's activity files
- Analyzes deterministic vs LLM usage
- Creates a concrete improvement report in `/tmp/vessel-analysis/`

### Run It

```bash
# Interactive demonstration with explanations
./demos/run-vessel-analysis.sh

# Or direct execution
cd repos/minibob
bun run index.ts --single "Execute ../../demos/vessel-self-analysis-local.json"
```

### Expected Output
```
✓ Improvement report created: /tmp/vessel-analysis/improvement-report-YYYYMMDD-HHMMSS.md
```

The report includes:
- Activity inventory (counts by category)
- Resolver distribution (bash vs LLM)
- Optimization opportunities
- Concrete next steps
- Success metrics

### Why This Works Offline
- Uses only `bash` resolver (deterministic)
- No MCP backend calls
- Writes results to local filesystem
- Observable, repeatable, measurable

---

## Method 2: Goal-Based Execution (Current)

**Demonstrates goal processing. Backend optional (graceful degradation).**

### What It Does
- Processes the goal through `goal_processing_standard` template
- Improvises execution based on goal description
- Caches traces offline if backend unavailable

### Run It

```bash
cd repos/minibob
bun run index.ts --single "Execute the vessel self-analysis: scan activities, analyze patterns, generate improvement roadmap, save to /tmp/minibob-self-improvement/, create tracking dashboard"
```

### What You'll See
- Goal analysis and decomposition
- Activity recommendation (Thompson Sampling attempt)
- Improvised execution (LLM reasoning)
- Directory creation (`/tmp/minibob-self-improvement/`)
- Trace caching if backend offline

### Cost
- ~$2-3 per execution (LLM-based improvisation)
- 2-4 minutes execution time

---

## Method 3: Template-Based Execution (Most Complete)

**Full structured execution. Requires backend for template registration.**

### What It Does
- Executes the specific `demo:vessel-self-analysis` template
- Runs all 5 tasks exactly as defined
- Creates structured outputs (roadmap, dashboard, analysis)

### Setup (One-Time)

```bash
# Register the template with backend
cd repos/minibob
minibob doctor tutor ../../demos/example-vessel-improvement.json

# Verify registration
minibob --list-templates | grep vessel-self-analysis
```

### Run It

```bash
minibob --template demo:vessel-self-analysis
```

### Expected Outputs

Files created in `/tmp/minibob-self-improvement/`:
- `roadmap-{timestamp}.md` - Prioritized improvement plan
- `analysis-{timestamp}.json` - Pattern analysis data
- `dashboard-{timestamp}.json` - Tracking dashboard

### Why This is Best
- ✓ Executes exact tasks (no improvisation)
- ✓ Structured, repeatable outputs
- ✓ Creates reusable tracking data
- ✓ Demonstrates template system fully

---

## Observable Demonstration Flow

For maximum impact, show all three methods in sequence:

### Phase 1: Quick Win (Local)
```bash
./demos/run-vessel-analysis.sh
```
**Show**: "Look, the vessel analyzed itself and created a report"

### Phase 2: Goal Processing (Improvisation)
```bash
cd repos/minibob
bun run index.ts --single "Analyze MiniBob's activities and create improvement recommendations"
```
**Show**: "The vessel understood the goal and figured out how to execute it"

### Phase 3: Structured Execution (Template)
```bash
minibob --template demo:vessel-self-analysis
```
**Show**: "The vessel executed the exact analysis workflow and created structured outputs"

---

## What Makes This "Vessel Self-Improvement"?

In all three methods:

1. **The vessel examines itself**: MiniBob scans its own `activities/` directory
2. **Through activity execution**: Self-analysis is just another activity
3. **Identifies concrete improvements**: Not abstract, but specific actions
4. **Creates actionable outputs**: Reports, roadmaps, tracking data
5. **Feeds the learning loop**: Executions are traced for Thompson Sampling

## Key Demonstration Points

### For Technical Audience
- "Every operation is an activity, including meta-operations"
- "The vessel doesn't 'know' it's improving itself - it just executes activities"
- "Traces feed Thompson Sampling, which learns what works"
- "Progressive determinism: LLM operations evolve into fast resolvers"

### For Non-Technical Audience
- "The AI examines its own code and suggests improvements"
- "It learns from every execution which approaches work best"
- "Over time, it gets faster and cheaper as it learns patterns"
- "It can work on itself while you're working on other things"

---

## Troubleshooting

### "Backend unavailable" errors
**Expected**. The system gracefully degrades:
- Traces cached offline in `~/.minibob/trace-cache/`
- Execution continues without backend
- Use Method 1 (Local Analysis) for offline demo

### Empty output directories
**Cause**: Goal processor improvised instead of executing template
**Solution**: Use Method 3 (Template-Based) after registering template

### "Template not found"
**Cause**: Template not registered with backend
**Solution**: Run `minibob doctor tutor <activity-file>` first

---

## Success Criteria

After demonstration, audience should understand:

✓ Vessels can analyze and improve themselves
✓ Self-improvement happens through activity execution
✓ Every execution feeds the learning loop
✓ System evolves toward determinism (faster, cheaper)
✓ "Activities all the way down" is real, not theoretical

---

**Created**: 2026-04-18
**Purpose**: Demonstrate vessel self-improvement with observable results
**Status**: Ready to execute
