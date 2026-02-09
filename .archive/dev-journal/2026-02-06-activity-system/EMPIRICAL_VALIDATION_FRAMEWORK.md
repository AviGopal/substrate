# Empirical Validation Framework - Activity & Memory Agent System

## The Insight

**Writing tests now would be cheating** - we'd validate our assumptions, not reality.

Instead, the **activity/impulse system should validate itself** through:
1. Understanding actual effects of components
2. Collecting expected outputs from real usage
3. Analyzing failure cases
4. Building validation from empirical evidence

---

## What We Built (Claims to Validate)

### Session Memory Agent

**Claims**:
1. Spawns as subagent with minimal prompts (~200 tokens)
2. Uses tool calls (memory_budget, impulse_create, impulse_load)
3. Operates on parent session (cross-session impulse creation)
4. Works like a kernel (inspect → allocate → verify)
5. Runs in 3 contexts: chat turns, activity init, per-task

**Evidence needed**:
- Logs showing subagent spawn
- Tool calls visible in logs
- Impulses created in correct session
- Per-task invocations in activities

### Activity Orchestration

**Claims**:
1. Recommendation hook always enabled (no activity check)
2. Decision reminder impulse created for non-trivial tasks
3. Agent sees recommendations in session memory
4. Agent uses activity tool more frequently

**Evidence needed**:
- Hook execution logs
- Impulse creation logs
- Agent actually using activity tool
- Decreased direct execution rate

---

## How to Validate Empirically

### Phase 1: Observation (No Intervention)

**Run the system naturally**, collect data:

```bash
# Capture baseline behavior
tail -f ~/.local/share/opencode/log/dev.log > behavior-$(date +%Y%m%d-%H%M).log

# Use normally for 10-20 turns
# Different task types:
# - Feature requests
# - Bug fixes
# - Questions
# - Refactoring
```

**Collect**:
- Which hooks executed
- Which impulses created
- Which tools agent used
- Outcomes (success/failure)

### Phase 2: Extract Patterns

**From logs, answer**:

1. **Hook Execution Rate**
   ```bash
   # How often does decision reminder run?
   grep "activity-decision-reminder.*hook completed" logs | wc -l
   
   # How often does recommendation run?
   grep "activity-recommendation.*hook completed" logs | wc -l
   
   # How often disabled vs success?
   grep "activity-recommendation.*disabled" logs | wc -l
   grep "activity-recommendation.*success=true" logs | wc -l
   ```

2. **Impulse Creation Rate**
   ```bash
   # Workflow reminders created?
   grep "activity-workflow-reminder" logs | wc -l
   
   # Recommendations created?
   grep "activity-recommendations.*added" logs | wc -l
   ```

3. **Agent Behavior**
   ```bash
   # Activity tool usage
   grep "tool=activity" logs | wc -l
   
   # search_activities calls
   grep "search_activities" logs | wc -l
   
   # Direct execution
   grep "tool=write\|tool=edit" logs | wc -l
   ```

4. **Memory Agent Tool Calls**
   ```bash
   # Memory agent spawns
   grep "spawning memory agent\|Memory agent - context preparation" logs | wc -l
   
   # Tool calls from memory agent
   grep "impulse-create.*memory agent operating on parent" logs | wc -l
   ```

### Phase 3: Analyze Failure Cases

**When things don't work**:

1. **Hook doesn't execute** → Check enabled() logic
2. **Impulse not created** → Check for errors
3. **Agent ignores recommendation** → Check if impulse loaded
4. **Memory agent times out** → Check prompt size, model speed
5. **Tool call fails** → Check parent session detection

**Build validation FROM these failure cases**, not from assumptions.

### Phase 4: Build Validated Expectations

**Only AFTER observing real behavior**, create expectations:

```json
{
  "component": "activity-decision-reminder",
  "observed_behavior": {
    "executes_on_non_trivial": true,
    "creates_impulse": true,
    "impulse_loaded": true,
    "agent_sees_reminder": true
  },
  "failure_cases": [
    {
      "date": "2026-02-07",
      "issue": "Reminder not loaded (priority too low)",
      "fix": "Changed priority medium → high",
      "validated": true
    }
  ],
  "expected_outcomes": {
    "reminder_in_first_5_impulses": true,
    "agent_mentions_checking_activities": "sometimes",
    "activity_usage_increases": "needs_more_data"
  }
}
```

---

## Validation Data Structure

### Component Validation Record

```json
{
  "component_name": "session-memory-agent",
  "component_type": "subagent",
  "claims": [
    {
      "claim": "Spawns with minimal prompts (~200 tokens)",
      "evidence_type": "log_grep",
      "evidence_query": "grep 'spawning memory agent.*promptLength' | awk '{print $NF}'",
      "expected_pattern": "[0-9]{2,3}",
      "validation_status": "pending",
      "observations": []
    },
    {
      "claim": "Makes tool calls (impulse_create, impulse_load)",
      "evidence_type": "log_grep",
      "evidence_query": "grep 'memory agent operating on parent'",
      "expected_pattern": "memorySession=.* targetSession=.*",
      "validation_status": "pending",
      "observations": []
    }
  ],
  "failure_cases": [],
  "validated_expectations": []
}
```

### Observation Collection

```bash
#!/bin/bash
# collect-observations.sh
# Run this after using the system to collect empirical data

OUTPUT="observations-$(date +%Y%m%d-%H%M).json"

echo "{"
echo "  \"timestamp\": $(date +%s),"
echo "  \"session_count\": $(grep -c 'session created' logs),"
echo "  \"turn_count\": $(grep -c 'turn-lifecycle.*executing pre-turn' logs),"
echo ""
echo "  \"hooks\": {"
echo "    \"decision_reminder_executions\": $(grep -c 'activity-decision-reminder.*hook completed.*success=true' logs),"
echo "    \"recommendation_executions\": $(grep -c 'activity-recommendation.*hook completed.*success=true' logs),"
echo "    \"recommendation_disabled\": $(grep -c 'activity-recommendation.*disabled' logs),"
echo "    \"memory_agent_spawns\": $(grep -c 'spawning memory agent' logs)"
echo "  },"
echo ""
echo "  \"impulses\": {"
echo "    \"workflow_reminders\": $(grep -c 'activity-workflow-reminder.*added' logs),"
echo "    \"activity_recommendations\": $(grep -c 'activity-recommendations.*added' logs),"
echo "    \"memory_agent_creates\": $(grep -c 'impulse-create.*memory agent operating' logs)"
echo "  },"
echo ""
echo "  \"agent_behavior\": {"
echo "    \"activity_tool_calls\": $(grep -c 'tool=activity' logs),"
echo "    \"search_activities_calls\": $(grep -c 'search_activities' logs),"
echo "    \"direct_write_calls\": $(grep -c 'tool=write' logs),"
echo "    \"direct_edit_calls\": $(grep -c 'tool=edit' logs)"
echo "  }"
echo "}"
```

**Save observations over time**, then analyze:
- Are claims supported by data?
- What failure patterns emerge?
- What actually matters vs assumptions?

---

## The Proper Approach

### Step 1: Document What We Built

✅ **Done**: Created implementation docs with claims

### Step 2: Run It

**Let the system execute naturally**:
- Different users
- Different tasks
- Different contexts

### Step 3: Collect Real Data

**Observation scripts** (not tests):
- Extract hook execution rates
- Extract impulse creation rates
- Extract tool usage patterns
- Extract failure cases

### Step 4: Analyze Failures

**When something doesn't work**:
- What was expected?
- What actually happened?
- What does the log show?
- What's the root cause?

**Build understanding from failures**, not from assumptions.

### Step 5: Create Validated Expectations

**Only AFTER empirical observation**:

```json
{
  "expectation": "Memory agent spawns in < 2 seconds",
  "evidence": {
    "sample_size": 50,
    "p50": 1.2,
    "p95": 1.8,
    "p99": 2.1
  },
  "validated": true,
  "confidence": 0.95
}
```

**vs**:

```json
{
  "assumption": "Memory agent spawns quickly",
  "validated": false,
  "evidence": "none"
}
```

---

## Activity/Impulse System as Validator

### The System Should Validate Itself

**Activities track**:
- Success rates
- Token usage
- Cost
- Duration
- Component interactions (via annotations)

**Impulses track**:
- What was loaded
- What was helpful
- Budget efficiency
- Usage patterns

**Together they provide**:
- Which components work
- Which patterns succeed
- Which failures occur
- What to expect

**This IS the validation system!**

---

## What We Should Do Now

### Instead of Writing Tests

1. **Document claims** ✓ (done in various .md files)

2. **Create observation scripts** ✓ (validate-from-logs.sh)

3. **Run system naturally** ⏳ (needs actual usage)

4. **Collect data** ⏳ (let it accumulate)

5. **Analyze patterns** ⏳ (after sufficient data)

6. **Build validated expectations** ⏳ (from evidence)

7. **THEN write tests** ⏳ (based on validated reality)

### What to Track

**Metrics to collect**:
- Hook execution success rate
- Impulse creation rate
- Tool call patterns
- Agent activity usage rate
- Memory agent spawn rate
- Timeout occurrences
- Budget overflow events
- Component annotation rate

**Store in**: Activity outcomes, impulse metadata, component annotations

**Query via**: Metabob backend, log analysis, outcome aggregation

---

## The Validation Loop

```
Build Component
  ↓
Deploy and Run
  ↓
Collect Observations (logs, outcomes, annotations)
  ↓
Analyze Patterns (what actually happens?)
  ↓
Identify Failures (what doesn't work?)
  ↓
Understand Root Causes (why?)
  ↓
Build Validated Expectations (from evidence)
  ↓
Create Tests (based on reality)
  ↓
[Loop back if tests reveal issues]
```

**We're at step 2** (Deploy and Run).

**Don't jump to step 7** (Create Tests).

---

## Summary

**You're right**: Tests written now would validate assumptions, not reality.

**Better approach**:
1. Let the system run
2. Collect empirical data
3. Learn from actual behavior
4. Build validation from evidence
5. Let the activity/impulse system be the validator

**The activity system with**:
- Success rates
- Component annotations
- Outcome tracking
- Impulse effectiveness

**IS the validation framework.**

We should use it, not bypass it with premature tests.

**Next**: Run the system, collect data, analyze what actually happens, THEN validate.
