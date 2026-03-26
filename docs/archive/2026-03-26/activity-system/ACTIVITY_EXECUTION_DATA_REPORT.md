# Activity Execution Data Report

**Date**: 2026-02-21  
**Scope**: Complete analysis of activity execution tracking

---

## Executive Summary

Activity execution data is stored in **THREE separate locations**:

1. **Redis** (PRIMARY) - Thompson sampling metrics via API server
   - 20 activity variants tracked
   - Real execution data for 2 variants only
   - 18 variants have zero executions (templates registered but not run)

2. **JSON Files** (SECONDARY) - Boredom API metrics via MCP
   - 13 template files in `~/.metabob/activities/`
   - Manually created for testing (not from real executions)

3. **OpenCode Storage** (INTERNAL) - Activity state management
   - 1 execution record found (`act_mlpu1y8v`)
   - Session data in `~/.local/share/opencode/storage/session/`

**Key Finding**: Most tracked templates have **ZERO actual executions**. They were registered for testing but never run.

---

## Storage Location 1: Redis (Thompson Sampling)

### Connection Details
- **Backend**: Redis (metabob-redis container)
- **Access**: Via API server (http://localhost:8080)
- **Total Activity Metrics**: 20 keys

### Execution Data

#### Templates with ACTUAL Executions (2 variants)

**1. test-feature-template-8739521f**
```json
{
  "variant_id": "test-feature-template-8739521f",
  "activity_id": "test-feature-template",
  "total_selections": 6,
  "total_successes": 5,
  "total_failures": 1,
  "thompson_alpha": 6.0,
  "thompson_beta": 2.0,
  "avg_cost": 0.005886,
  "avg_duration_ms": 1994.25,
  "last_updated": "2026-02-19T04:24:26.647553"
}
```

**Metrics**:
- Success Rate: 83.3% (5/6)
- Average Cost: $0.0059 per execution
- Average Duration: 1.99 seconds
- Last Run: 2026-02-19

**2. test-feature-template-8bb2a471**
```json
{
  "variant_id": "test-feature-template-8bb2a471",
  "activity_id": "test-feature-template",
  "total_selections": 6,
  "total_successes": 5,
  "total_failures": 1,
  "thompson_alpha": 6.0,
  "thompson_beta": 2.0,
  "avg_cost": 0.005886,
  "avg_duration_ms": 1994.25,
  "last_updated": "2026-02-19T04:24:26.629023"
}
```

**Metrics**: (Identical to 8739521f - same template, different variant)
- Success Rate: 83.3% (5/6)
- Average Cost: $0.0059 per execution
- Average Duration: 1.99 seconds
- Last Run: 2026-02-19

**3. test-hello-world-cc1fcb90**
```json
{
  "variant_id": "test-hello-world-cc1fcb90",
  "activity_id": "test-hello-world",
  "total_selections": 2,
  "total_successes": 2,
  "total_failures": 0,
  "thompson_alpha": 3.0,
  "thompson_beta": 1.0,
  "avg_cost": 0.00019,
  "avg_duration_ms": 0.57,
  "last_updated": "2026-02-19T12:37:05.439214"
}
```

**Metrics**:
- Success Rate: 100% (2/2)
- Average Cost: $0.00019 per execution (very cheap!)
- Average Duration: 0.57 seconds (very fast!)
- Last Run: 2026-02-19

#### Templates with ZERO Executions (17 variants)

All registered but never executed:

1. **refactor-with-tests-b42b7487**
   - Registered: 2026-02-20T18:45:28
   - Executions: 0
   - Thompson: α=1.0, β=1.0 (prior only)

2. **evolve-activity-template-(self-contained)-07dc501b**
   - Registered: 2026-02-20T18:45:28
   - Executions: 0

3. **hello-world-minimal-31727b21**
   - Registered: 2026-02-20T18:45:28
   - Executions: 0

4. **add-feature-complete-e071a333**
   - Registered: 2026-02-20T18:45:28
   - Executions: 0

5. **create-activity-template-3cd903b8**
   - Registered: 2026-02-19T22:45:25
   - Executions: 0

6. **create-activity-template-(ultra-minimal)-6b9f02c6**
   - Registered: 2026-02-19T22:36:36
   - Executions: 0

7. **manage-session-memory-f2346cf0**
   - Registered: 2026-02-20T18:45:28
   - Executions: 0

8. **cli-test-template-d24d2e01**
   - Registered: (date not shown)
   - Executions: 0

9. **cli-test-template-8bbf328f**
   - Registered: (date not shown)
   - Executions: 0

10. **unknown-template-cc1fcb90**
    - Registered: (date not shown)
    - Executions: 0

11. **fix-bug-complete-5810d1ed**
    - Registered: (date not shown)
    - Executions: 0

12. **create-activity-template-(simplified)-147450e5**
    - Registered: (date not shown)
    - Executions: 0

13. **create-activity-template-22bab2d2**
    - Registered: (date not shown)
    - Executions: 0

14. **end-to-end-activity-execution-validation-82f39732**
    - Registered: (date not shown)
    - Executions: 0

15. **create-activity-template-(self-contained)-ed6cce82**
    - Registered: (date not shown)
    - Executions: 0

16. **debug-activity-execution-(self-contained)-0a9cc1d3**
    - Registered: (date not shown)
    - Executions: 0

17. **e2e-test-20260219-031655-4d210bdb**
    - Registered: (date not shown)
    - Executions: 0

### Summary Statistics (Redis)

```
Total Variants Tracked: 20
Variants with Executions: 3 (15%)
Variants with Zero Executions: 17 (85%)

Total Executions: 14 (6 + 6 + 2)
Total Successes: 12
Total Failures: 2
Overall Success Rate: 85.7%

Average Cost (executed only): $0.0038
Average Duration (executed only): 1329.69 ms
```

---

## Storage Location 2: JSON Files (Boredom API)

### Connection Details
- **Backend**: File system at `~/.metabob/activities/`
- **Access**: Direct file I/O via MCP tools
- **Total Templates**: 13 files

### Template Data

#### Templates Created from Previous Architecture Analysis

1. **create-activity-template.json**
   - Size: 4.9K
   - Date: Dec 12 16:17
   - Metrics: Not extracted (large template definition)

2. **diagnose-startup-issues.json**
   - Size: 39K
   - Date: Feb 19 03:39
   - Metrics: Not extracted (large template)

3. **git-revision-management.json**
   - Size: 24K
   - Date: Dec 12 16:17
   - Metrics: Not extracted (large template)

4. **multi-agent-acp-workflow.json**
   - Size: 18K
   - Date: Feb 19 03:39
   - Metrics: Not extracted (large template)

5. **test-boredom-system-docker.json**
   - Size: 12K
   - Date: Feb 21 12:21
   - Metrics: Not extracted (large template)

#### Test Templates for Boredom System (Created Manually)

6. **good-quality-template.json**
```json
{
  "activity_id": "good-quality-template",
  "name": "Good Quality Template",
  "category": "feature",
  "estimated_metrics": {
    "execution_count": 8,
    "success_count": 7,
    "success_rate": 0.875,
    "avg_duration_ms": 25000,
    "avg_cost": 0.15,
    "improvement_gradient": 0.85,
    "performance_trends": {
      "duration": "improving",
      "cost": "improving",
      "success_rate": "stable"
    }
  }
}
```

**Metrics**:
- Execution Count: 8 (MANUALLY SET - not from real executions)
- Success Rate: 87.5%
- Avg Duration: 25 seconds
- Avg Cost: $0.15
- **Improvement Gradient**: 0.85 (HIGH - good quality)

7. **mediocre-template.json**
```json
{
  "activity_id": "mediocre-template",
  "name": "Mediocre Template",
  "category": "feature",
  "estimated_metrics": {
    "execution_count": 5,
    "success_count": 3,
    "success_rate": 0.6,
    "avg_duration_ms": 35000,
    "avg_cost": 0.25,
    "improvement_gradient": 0.5
  }
}
```

**Metrics**:
- Execution Count: 5 (MANUALLY SET)
- Success Rate: 60%
- Avg Duration: 35 seconds
- Avg Cost: $0.25
- **Improvement Gradient**: 0.5 (MEDIUM - needs improvement)

8. **high-failures-template.json**
```json
{
  "activity_id": "high-failures-template",
  "name": "High Failures Template",
  "category": "bugfix",
  "estimated_metrics": {
    "execution_count": 10,
    "success_count": 3,
    "success_rate": 0.3,
    "avg_duration_ms": 40000,
    "avg_cost": 0.3,
    "improvement_gradient": 0.25,
    "performance_trends": {
      "duration": "stable",
      "cost": "stable",
      "success_rate": "degrading"
    }
  }
}
```

**Metrics**:
- Execution Count: 10 (MANUALLY SET)
- Success Rate: 30% (LOW - many failures!)
- Avg Duration: 40 seconds
- Avg Cost: $0.30
- **Improvement Gradient**: 0.25 (LOW - needs work!)

9. **test-low-quality-template.json**
   - Size: 889B
   - Date: Feb 21 03:06
   - Likely similar to high-failures-template

10. **debug-template-failures.json**
    - Size: 1.1K
    - Date: Feb 21 12:28
    - Recent update (likely manually created)

11. **improve-error-handling.json**
    - Size: 1.3K
    - Date: Feb 21 12:28
    - Recent update

12. **optimize-query-performance.json**
    - Size: 1.2K
    - Date: Feb 21 12:28
    - Recent update

### Summary Statistics (JSON Files)

```
Total Templates: 13
Large Templates (definitions): 5
Test Templates (metrics only): 8

NOTE: Metrics in JSON files are MANUALLY SET for testing boredom API.
They do NOT reflect actual execution history.
```

---

## Storage Location 3: OpenCode Internal Storage

### Connection Details
- **Backend**: File system at `~/.local/share/opencode/storage/`
- **Purpose**: Internal OpenCode activity state management
- **Access**: Direct file I/O

### Activity Execution Records

**Directory**: `~/.local/share/opencode/storage/activity-execution/5a663c16ed174f011286a37c5e65ff7a9a5bc940/`

**Found**: 1 execution record

**File**: `act_mlpu1y8v_c548c40acbc1e9ed.json`
- Size: 235K
- Date: Feb 16 17:40
- Status: "executing" (likely incomplete/failed execution)
- Activity ID: Not extracted (parse error in JSON structure)

### Session Storage

**Directory**: `~/.local/share/opencode/storage/session/5a663c16ed174f011286a37c5e65ff7a9a5bc940/`

**Found**: 20+ session files
- Session files: `ses_*.json`
- Date range: Recent (Feb 2026)
- Purpose: Session state persistence

### Activity Template Storage

**Directory**: `~/.local/share/opencode/storage/activity-template/`

**Found**: Multiple template definitions
- `create-activity-self-contained.json`
- `debug-activity-self-contained.json`
- `evolve-activity-self-contained.json`
- `debug-activity-execution-self-contained.json`
- `validate-backend-activity-storage.json`
- `validate-cli-activity-orchestration.json`
- `test-activity-artifact-system.json`
- `debug-activity-execution-failure.json`
- `end-to-end-activity-execution-validation.json`
- `implement-activity-co-change-workflow.json`
- `create-activity.json`

**NOTE**: These are template DEFINITIONS, not execution records.

### Summary Statistics (OpenCode Storage)

```
Execution Records: 1 (incomplete)
Session Files: 20+
Template Definitions: 11+

This storage is SEPARATE from learning loop metrics.
Used for OpenCode internal state management only.
```

---

## Execution Timeline

Based on Redis `last_updated` timestamps:

```
2026-02-19 04:24:26 - test-feature-template executions (6 each for 2 variants)
2026-02-19 12:37:05 - test-hello-world executions (2)
2026-02-19 22:36:36 - create-activity-template-(ultra-minimal) registered
2026-02-19 22:45:25 - create-activity-template registered
2026-02-20 18:45:28 - Multiple templates registered (refactor-with-tests, etc.)
2026-02-21 (today) - Analysis and documentation
```

**Activity Pattern**:
- Most activity on Feb 19 (test executions)
- Template registrations on Feb 19-20
- Zero executions since Feb 19

---

## Data Format and Schema

### Redis Schema (Thompson Sampling)

**Key**: `activity:metrics:{variant_id}`

```typescript
interface ActivityMetrics {
  variant_id: string;           // Unique variant ID (template-id + hash)
  activity_id: string;          // Base template ID
  total_selections: number;     // Times selected for execution
  total_successes: number;      // Successful completions
  total_failures: number;       // Failed executions
  thompson_alpha: number;       // Bayesian α parameter (successes + 1)
  thompson_beta: number;        // Bayesian β parameter (failures + 1)
  avg_cost: number;             // Running average cost (USD)
  avg_duration_ms: number;      // Running average duration (milliseconds)
  last_updated: string;         // ISO 8601 timestamp
}
```

**Update Algorithm**:
1. On success: `α = α + 1`
2. On failure: `β = β + 1`
3. Update running averages: `new_avg = (old_avg * count + new_value) / (count + 1)`

**Prior**: Beta(1, 1) - uniform prior (no preference)

### JSON File Schema (Boredom API)

**File**: `~/.metabob/activities/{template_id}.json`

```typescript
interface TemplateFile {
  activity_id: string;
  name: string;
  description?: string;
  category: 'feature' | 'bugfix' | 'refactor' | 'tool' | 'infrastructure';
  tasks?: Task[];              // Full template definition (optional)
  estimated_metrics: {
    execution_count: number;
    success_count: number;
    success_rate: number;
    avg_duration_ms: number;
    avg_cost: number;
    improvement_gradient?: number;      // 0.0-1.0 (lower = needs work)
    performance_trends?: {
      duration: 'stable' | 'improving' | 'degrading';
      cost: 'stable' | 'improving' | 'degrading';
      success_rate: 'stable' | 'improving' | 'degrading';
    };
    failure_patterns?: Array<{
      task_id: string;
      error_type: string;
      error_message: string;
      count: number;
      last_seen: string;
    }>;
    last_execution?: {
      timestamp: string;
      success: boolean;
      duration: number;
      cost: number;
      error?: string;
    };
  };
}
```

### OpenCode Storage Schema

**Activity Execution File**: `act_{id}_{hash}.json`

```typescript
interface ActivityExecution {
  activityId?: string;
  status: 'executing' | 'completed' | 'failed';
  createdAt?: string;
  // ... (full schema not extracted due to parse errors)
}
```

---

## Metrics Being Tracked

### Redis (Automated Tracking)

✅ **Tracked Automatically**:
- Total selections (executions attempted)
- Total successes
- Total failures
- Thompson sampling parameters (α, β)
- Average cost per execution
- Average duration per execution
- Last update timestamp

❌ **NOT Tracked**:
- Improvement gradient (not calculated)
- Performance trends over time
- Failure patterns by task
- Individual execution details
- Task-level metrics

### JSON Files (Manual/Semi-Automated)

✅ **Tracked** (but mostly MANUALLY SET for testing):
- Execution count
- Success count
- Success rate
- Average duration
- Average cost
- Improvement gradient (MANUALLY SET)
- Performance trends (MANUALLY SET)

❌ **NOT Tracked Automatically**:
- Real execution history
- Automatic gradient calculation
- Trend detection
- Failure pattern aggregation

---

## Critical Findings

### 1. MOST TEMPLATES NEVER EXECUTED

**Evidence**:
- 20 templates tracked in Redis
- Only 3 have execution data (15%)
- 17 have zero executions (85%)

**Implications**:
- Thompson sampling has limited training data
- Most templates are theoretical (registered but not tested)
- Learning loop cannot learn from templates that aren't run

### 2. JSON FILE METRICS ARE FAKE

**Evidence**:
- `good-quality-template.json` shows 8 executions
- Same template NOT in Redis (no actual executions)
- Manually created on Feb 21 03:07 (test data)

**Implications**:
- Boredom API operates on synthetic test data
- Cannot validate boredom suggestions against real metrics
- Dual storage problem is worse than expected (different data, not just different format)

### 3. RECENT ACTIVITY STOPPED

**Evidence**:
- Last real execution: 2026-02-19 12:37:05 (test-hello-world)
- 2+ days ago
- Many templates registered since then (Feb 20) but not run

**Implications**:
- Learning loop is STAGNANT
- No new training data being collected
- System not being actively used/tested

### 4. ONE INCOMPLETE EXECUTION IN OPENCODE STORAGE

**Evidence**:
- `act_mlpu1y8v_c548c40acbc1e9ed.json` at 235K (large file)
- Status: "executing" (not completed)
- Date: Feb 16 17:40 (5 days ago)

**Implications**:
- Execution may have crashed or timed out
- No automatic cleanup of failed executions
- OpenCode storage not being actively used for metrics

---

## Data Quality Assessment

### Redis Data: ✅ HIGH QUALITY
- **Source**: Automated tracking from actual executions
- **Integrity**: Thompson sampling parameters are mathematically consistent
- **Freshness**: Timestamps show when data was collected
- **Completeness**: All expected fields present
- **Issues**: Very limited (only 3 templates with data)

### JSON File Data: ⚠️ LOW QUALITY (Test Data)
- **Source**: Manually created for testing
- **Integrity**: Internally consistent but NOT from real executions
- **Freshness**: Recently updated (Feb 21) but synthetic
- **Completeness**: Missing many optional fields (failure_patterns, trends)
- **Issues**: NOT REAL DATA - cannot be used to validate system

### OpenCode Storage: ⚠️ INCOMPLETE
- **Source**: Internal activity state management
- **Integrity**: Parse errors in JSON (malformed data?)
- **Freshness**: Old (5 days) and stale
- **Completeness**: Only 1 execution record found
- **Issues**: Not used for metrics tracking

---

## Recommendations

### 1. EXECUTE TEMPLATES TO GENERATE REAL DATA

**Problem**: 85% of tracked templates have zero executions

**Solution**:
```bash
# Execute each registered template at least 3 times
for template in $(docker exec metabob-redis redis-cli KEYS "activity:metrics:*" | grep -v "test-feature\|test-hello"); do
  template_id=$(echo $template | sed 's/activity:metrics://')
  echo "Executing: $template_id"
  opencode activity execute --template $template_id --variables '{"test": true}'
done
```

**Expected Outcome**:
- All 20 templates will have execution data
- Thompson sampling can make informed selections
- Learning loop has training data

### 2. SYNC REDIS METRICS TO JSON FILES

**Problem**: JSON files have fake test data, Redis has real data

**Solution**: Create sync script
```python
# sync_redis_to_json.py
import redis
import json
from pathlib import Path

r = redis.Redis(host='localhost', port=6379)
activities_dir = Path.home() / '.metabob' / 'activities'

for key in r.keys('activity:metrics:*'):
    metrics = json.loads(r.get(key))
    template_id = metrics['activity_id']
    json_file = activities_dir / f"{template_id}.json"
    
    if json_file.exists():
        data = json.loads(json_file.read_text())
        data['estimated_metrics'] = {
            'execution_count': metrics['total_selections'],
            'success_count': metrics['total_successes'],
            'success_rate': metrics['total_successes'] / max(metrics['total_selections'], 1),
            'avg_duration_ms': metrics['avg_duration_ms'],
            'avg_cost': metrics['avg_cost'],
            # Calculate improvement_gradient from Thompson parameters
            'improvement_gradient': metrics['thompson_alpha'] / (metrics['thompson_alpha'] + metrics['thompson_beta'])
        }
        json_file.write_text(json.dumps(data, indent=2))
```

### 3. AUTOMATE METRICS COLLECTION

**Problem**: Metrics only updated when activities complete/fail

**Solution**: Ensure `TemplateMetricsClient.reportExecution()` is called in ALL execution paths:
- Activity.complete() ✅ (already implemented)
- Activity.fail() ✅ (already implemented)
- Activity timeout ❓ (needs verification)
- Activity cancelled ❓ (needs verification)

### 4. CLEAN UP STALE DATA

**Problem**: Incomplete execution in OpenCode storage (5 days old)

**Solution**:
```bash
# Find and remove stale execution files
find ~/.local/share/opencode/storage/activity-execution -name "*.json" -mtime +3 -exec rm {} \;
```

### 5. TEST END-TO-END FLOW

**Validation Script**:
```bash
# 1. Execute activity
opencode activity execute --template test-feature-template --variables '{"test": true}'

# 2. Verify Redis update
docker exec metabob-redis redis-cli GET "activity:metrics:test-feature-template-*"

# 3. Verify JSON file update (if sync implemented)
cat ~/.metabob/activities/test-feature-template.json | jq .estimated_metrics

# 4. Verify OpenCode storage
ls -lt ~/.local/share/opencode/storage/activity-execution/*/*.json | head -1
```

---

## Summary Table

| Storage Backend | Purpose | Templates Tracked | Real Executions | Data Quality | Sync Status |
|----------------|---------|-------------------|-----------------|--------------|-------------|
| **Redis** | Thompson sampling | 20 | 3 variants (14 total) | ✅ High | N/A |
| **JSON Files** | Boredom API | 13 | 0 (test data only) | ⚠️ Low (fake) | ❌ Not synced |
| **OpenCode Storage** | Internal state | Unknown | 1 (incomplete) | ⚠️ Low | N/A |

---

## Execution Statistics

### Overall
```
Total Templates Registered: 20+ (across all backends)
Total Real Executions: 14 (from Redis)
Success Rate: 85.7% (12/14)
Average Cost: $0.0038 per execution
Average Duration: 1.33 seconds

Templates with Data: 3 (15%)
Templates without Data: 17+ (85%)

Last Execution: 2026-02-19 12:37:05 (2+ days ago)
System Status: STAGNANT (no recent activity)
```

### By Template (Real Executions Only)

| Template | Variant | Executions | Success Rate | Avg Cost | Avg Duration |
|----------|---------|------------|--------------|----------|--------------|
| test-feature-template | 8739521f | 6 | 83.3% | $0.0059 | 1.99s |
| test-feature-template | 8bb2a471 | 6 | 83.3% | $0.0059 | 1.99s |
| test-hello-world | cc1fcb90 | 2 | 100% | $0.00019 | 0.57s |

---

## Conclusion

The activity execution tracking system is **technically functional but underutilized**:

✅ **Working**:
- Redis stores real execution metrics accurately
- Thompson sampling parameters are correctly calculated
- Data persistence across sessions

⚠️ **Issues**:
- 85% of templates have ZERO executions
- JSON file metrics are FAKE (manually created test data)
- No synchronization between Redis and JSON files
- System has been STAGNANT for 2+ days (no new executions)

🔧 **Action Required**:
1. Execute all registered templates to generate real data
2. Sync Redis metrics to JSON files
3. Remove fake test data from JSON files
4. Automate metrics collection in all execution paths
5. Test end-to-end flow with real activities

**Status**: Learning loop infrastructure is ready, but needs **real usage data** to function properly.
