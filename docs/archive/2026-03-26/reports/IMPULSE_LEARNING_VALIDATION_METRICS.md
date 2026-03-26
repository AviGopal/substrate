# Impulse Learning System: Validation Metrics & Monitoring

**Date**: 2026-02-25  
**Purpose**: Complete specification for validation metrics, monitoring queries, validation checklist, and operational dashboard

---

## Executive Summary

This document provides the complete validation and monitoring framework for the impulse learning system. It defines success metrics, monitoring queries, pre/post-deployment checklists, and dashboard design to ensure the system achieves 60-80% skip rate while maintaining quality.

**Key Metrics**:
1. **Skip Rate**: 60-80% target (memory agent calls avoided)
2. **Quality Delta**: >= 0 (skip success rate - LLM success rate)
3. **Time Savings**: 85-90% reduction in memory agent overhead
4. **Pattern Utilization**: >70% of learned patterns actively used

**Validation Gates**:
- Pre-deployment: 9-point checklist
- Post-deployment: 6-point monitoring
- Continuous improvement: 5 triggers for adjustment

---

## Part 1: Success Metrics Schema

### 1.1 Learning Metrics Interface

```typescript
/**
 * Complete learning system metrics
 * Tracks skip rate, quality, performance, and pattern health
 */
interface LearningMetrics {
  // Time range
  startTime: number                  // Unix timestamp (ms)
  endTime: number                    // Unix timestamp (ms)
  durationDays: number               // Duration in days
  
  // Skip metrics
  skip: {
    totalTurns: number               // Total turns in period
    skippedTurns: number             // Turns where LLM skipped
    skipRate: number                 // skippedTurns / totalTurns (0-1)
    
    // Skip reason breakdown
    byReason: {
      trivial: number                // Trivial message skips
      continuation: number           // Continuation skips
      patternMatch: number           // Pattern replay skips
      activityContext: number        // Activity template skips
    }
    
    // Skip confidence distribution
    confidenceDistribution: {
      high: number                   // confidence > 0.9
      medium: number                 // 0.85 <= confidence <= 0.9
      low: number                    // confidence < 0.85 (shouldn't skip)
    }
  }
  
  // Quality metrics (skip vs LLM comparison)
  quality: {
    // LLM baseline
    llmTurns: number                 // Turns with LLM call
    llmSuccesses: number             // LLM call successes
    llmSuccessRate: number           // llmSuccesses / llmTurns (0-1)
    
    // Skip performance
    skipTurns: number                // Turns with skip
    skipSuccesses: number            // Skip successes
    skipSuccessRate: number          // skipSuccesses / skipTurns (0-1)
    
    // Quality delta (target: >= 0)
    qualityDelta: number             // skipSuccessRate - llmSuccessRate
    qualityMaintained: boolean       // qualityDelta >= 0
  }
  
  // Performance metrics
  performance: {
    // Time comparison
    avgLLMTime: number               // Average LLM call time (ms)
    avgSkipTime: number              // Average skip decision time (ms)
    avgTimeSaved: number             // avgLLMTime - avgSkipTime (ms)
    timeSavingsPercent: number       // (avgTimeSaved / avgLLMTime) * 100
    
    // Total time savings
    totalLLMTimeSaved: number        // Total time saved (ms)
    totalLLMTimeSavedMinutes: number // Total time saved (minutes)
    
    // Cost savings (if applicable)
    estimatedCostSaved: number       // Estimated cost saved ($)
  }
  
  // Pattern library health
  patterns: {
    totalPatterns: number            // Total patterns in library
    activePatterns: number           // Patterns with is_active=1
    reliablePatterns: number         // Patterns with success_rate >= 0.75
    
    // Pattern utilization
    patternsUsed: number             // Patterns used in skip decisions
    utilizationRate: number          // patternsUsed / totalPatterns (0-1)
    
    // Pattern effectiveness
    avgSuccessRate: number           // Average success rate across patterns
    avgObservations: number          // Average observations per pattern
    avgResponseTime: number          // Average response time (ms)
    
    // Pattern age distribution
    ageDistribution: {
      recent: number                 // < 7 days old
      active: number                 // 7-30 days old
      mature: number                 // > 30 days old
    }
  }
  
  // Activity template learning
  activities: {
    totalTemplates: number           // Templates with contextRequirements
    learnedTemplates: number         // Templates with learned mappings
    learningRate: number             // learnedTemplates / totalTemplates (0-1)
    
    // Activity skip metrics
    activitySkips: number            // gatherContext skips
    activitySkipSuccesses: number    // Successful activity skips
    activitySkipSuccessRate: number  // activitySkipSuccesses / activitySkips
  }
  
  // Metadata
  generatedAt: number                // Timestamp when metrics calculated
  version: string                    // Metrics schema version
}
```

### 1.2 Metrics Calculation Function

```typescript
/**
 * Calculate learning system metrics for a time period
 */
export async function calculateLearningMetrics(input: {
  startTime: number
  endTime: number
}): Promise<LearningMetrics> {
  
  const { LearningDatabase } = await import('./learning-database')
  
  const durationDays = (input.endTime - input.startTime) / (1000 * 60 * 60 * 24)
  
  // Query performance records for the period
  const performanceRecords = await LearningDatabase.query(`
    SELECT *
    FROM memory_agent_performance
    WHERE captured_at >= ? AND captured_at <= ?
  `, [input.startTime, input.endTime])
  
  // Calculate skip metrics
  const totalTurns = performanceRecords.length
  const skippedTurns = performanceRecords.filter(r => r.skipped).length
  const skipRate = totalTurns > 0 ? skippedTurns / totalTurns : 0
  
  // Skip reason breakdown
  const byReason = {
    trivial: performanceRecords.filter(r => r.skip_reason === 'trivial_message').length,
    continuation: performanceRecords.filter(r => r.skip_reason === 'continuation').length,
    patternMatch: performanceRecords.filter(r => r.skip_reason === 'pattern_match').length,
    activityContext: performanceRecords.filter(r => r.skip_reason === 'activity_context').length,
  }
  
  // Confidence distribution
  const confidenceDistribution = {
    high: performanceRecords.filter(r => r.skip_confidence > 0.9).length,
    medium: performanceRecords.filter(r => r.skip_confidence >= 0.85 && r.skip_confidence <= 0.9).length,
    low: performanceRecords.filter(r => r.skip_confidence < 0.85).length,
  }
  
  // Quality metrics
  const llmRecords = performanceRecords.filter(r => !r.skipped)
  const skipRecords = performanceRecords.filter(r => r.skipped)
  
  const llmSuccesses = llmRecords.filter(r => r.task_succeeded).length
  const skipSuccesses = skipRecords.filter(r => r.task_succeeded).length
  
  const llmSuccessRate = llmRecords.length > 0 ? llmSuccesses / llmRecords.length : 0
  const skipSuccessRate = skipRecords.length > 0 ? skipSuccesses / skipRecords.length : 0
  
  const qualityDelta = skipSuccessRate - llmSuccessRate
  const qualityMaintained = qualityDelta >= 0
  
  // Performance metrics
  const llmTimes = llmRecords.map(r => r.total_duration_ms)
  const skipTimes = skipRecords.map(r => r.total_duration_ms)
  
  const avgLLMTime = llmTimes.length > 0 ? average(llmTimes) : 0
  const avgSkipTime = skipTimes.length > 0 ? average(skipTimes) : 0
  const avgTimeSaved = avgLLMTime - avgSkipTime
  const timeSavingsPercent = avgLLMTime > 0 ? (avgTimeSaved / avgLLMTime) * 100 : 0
  
  const totalLLMTimeSaved = skipRecords.reduce((sum, r) => sum + (r.llm_time_saved_ms || 0), 0)
  const totalLLMTimeSavedMinutes = totalLLMTimeSaved / (1000 * 60)
  
  // Pattern library metrics
  const patterns = await LearningDatabase.query(`
    SELECT *
    FROM pattern_library
  `)
  
  const activePatterns = patterns.filter(p => p.is_active).length
  const reliablePatterns = patterns.filter(p => p.success_rate >= 0.75).length
  
  const patternsUsed = await LearningDatabase.query(`
    SELECT COUNT(DISTINCT pattern_id) as count
    FROM memory_agent_performance
    WHERE 
      captured_at >= ? AND captured_at <= ?
      AND pattern_id IS NOT NULL
  `, [input.startTime, input.endTime])
  
  const utilizationRate = patterns.length > 0 
    ? patternsUsed[0].count / patterns.length 
    : 0
  
  const avgSuccessRate = patterns.length > 0
    ? average(patterns.map(p => p.success_rate))
    : 0
  
  const avgObservations = patterns.length > 0
    ? average(patterns.map(p => p.observation_count))
    : 0
  
  const avgResponseTime = patterns.length > 0
    ? average(patterns.map(p => p.avg_response_time_ms))
    : 0
  
  const now = Date.now()
  const ageDistribution = {
    recent: patterns.filter(p => now - p.first_observed < 7 * 24 * 60 * 60 * 1000).length,
    active: patterns.filter(p => {
      const age = now - p.first_observed
      return age >= 7 * 24 * 60 * 60 * 1000 && age < 30 * 24 * 60 * 60 * 1000
    }).length,
    mature: patterns.filter(p => now - p.first_observed >= 30 * 24 * 60 * 60 * 1000).length,
  }
  
  // Activity template metrics
  const activityRecords = await LearningDatabase.query(`
    SELECT *
    FROM activity_learning_records
    WHERE timestamp >= ? AND timestamp <= ?
  `, [input.startTime, input.endTime])
  
  const learnedTemplates = new Set(activityRecords.map(r => r.template_id)).size
  const activitySkips = performanceRecords.filter(r => r.skip_reason === 'activity_context').length
  const activitySkipSuccesses = performanceRecords.filter(r => 
    r.skip_reason === 'activity_context' && r.task_succeeded
  ).length
  
  return {
    startTime: input.startTime,
    endTime: input.endTime,
    durationDays,
    
    skip: {
      totalTurns,
      skippedTurns,
      skipRate,
      byReason,
      confidenceDistribution,
    },
    
    quality: {
      llmTurns: llmRecords.length,
      llmSuccesses,
      llmSuccessRate,
      skipTurns: skipRecords.length,
      skipSuccesses,
      skipSuccessRate,
      qualityDelta,
      qualityMaintained,
    },
    
    performance: {
      avgLLMTime,
      avgSkipTime,
      avgTimeSaved,
      timeSavingsPercent,
      totalLLMTimeSaved,
      totalLLMTimeSavedMinutes,
      estimatedCostSaved: 0, // TODO: Calculate based on cost model
    },
    
    patterns: {
      totalPatterns: patterns.length,
      activePatterns,
      reliablePatterns,
      patternsUsed: patternsUsed[0].count,
      utilizationRate,
      avgSuccessRate,
      avgObservations,
      avgResponseTime,
      ageDistribution,
    },
    
    activities: {
      totalTemplates: 0, // TODO: Query from activity_template table
      learnedTemplates,
      learningRate: 0, // TODO: Calculate when totalTemplates available
      activitySkips,
      activitySkipSuccesses,
      activitySkipSuccessRate: activitySkips > 0 
        ? activitySkipSuccesses / activitySkips 
        : 0,
    },
    
    generatedAt: Date.now(),
    version: '1.0',
  }
}

function average(numbers: number[]): number {
  return numbers.length > 0 
    ? numbers.reduce((sum, n) => sum + n, 0) / numbers.length 
    : 0
}
```

---

## Part 2: Monitoring Queries

### 2.1 Skip Rate Over Time (Daily)

```sql
-- Daily skip rate for last 30 days
SELECT 
  DATE(captured_at / 1000, 'unixepoch') as date,
  COUNT(*) as total_turns,
  SUM(CASE WHEN skipped THEN 1 ELSE 0 END) as skipped_turns,
  ROUND(100.0 * SUM(CASE WHEN skipped THEN 1 ELSE 0 END) / COUNT(*), 2) as skip_rate,
  ROUND(AVG(llm_time_saved_ms), 0) as avg_time_saved_ms
FROM memory_agent_performance
WHERE captured_at > (strftime('%s', 'now') - 30 * 86400) * 1000
GROUP BY date
ORDER BY date DESC;
```

**Expected Output**:
```
date        | total_turns | skipped_turns | skip_rate | avg_time_saved_ms
------------|-------------|---------------|-----------|------------------
2026-02-25  | 150         | 105           | 70.00     | 1650
2026-02-24  | 142         | 98            | 69.01     | 1580
2026-02-23  | 138         | 92            | 66.67     | 1620
...
```

### 2.2 Skip Reason Breakdown

```sql
-- Skip reason distribution and effectiveness
SELECT 
  skip_reason,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage,
  ROUND(AVG(skip_confidence), 3) as avg_confidence,
  ROUND(AVG(total_duration_ms), 0) as avg_duration_ms,
  SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) as successes,
  COUNT(CASE WHEN task_succeeded IS NOT NULL THEN 1 END) as completed,
  ROUND(100.0 * SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) / 
    NULLIF(COUNT(CASE WHEN task_succeeded IS NOT NULL THEN 1 END), 0), 2) as success_rate
FROM memory_agent_performance
WHERE 
  skipped = 1
  AND captured_at > (strftime('%s', 'now') - 7 * 86400) * 1000
GROUP BY skip_reason
ORDER BY count DESC;
```

**Expected Output**:
```
skip_reason      | count | percentage | avg_confidence | avg_duration_ms | successes | completed | success_rate
-----------------|-------|------------|----------------|-----------------|-----------|-----------|-------------
pattern_match    | 320   | 52.00      | 0.912          | 45              | 285       | 320       | 89.06
continuation     | 150   | 24.39      | 0.950          | 15              | 148       | 150       | 98.67
activity_context | 90    | 14.63      | 0.950          | 38              | 82        | 90        | 91.11
trivial_message  | 55    | 8.94       | 1.000          | 8               | 55        | 55        | 100.00
```

### 2.3 Pattern Effectiveness

```sql
-- Top 20 patterns by usage and effectiveness
SELECT 
  p.id as pattern_id,
  p.template,
  p.observation_count,
  p.success_count,
  p.failure_count,
  ROUND(p.success_rate, 3) as success_rate,
  ROUND(p.avg_response_time_ms, 0) as avg_response_time,
  COUNT(m.id) as times_used_recently,
  ROUND(100.0 * SUM(CASE WHEN m.task_succeeded THEN 1 ELSE 0 END) / 
    NULLIF(COUNT(CASE WHEN m.task_succeeded IS NOT NULL THEN 1 END), 0), 2) as recent_success_rate
FROM pattern_library p
LEFT JOIN memory_agent_performance m 
  ON m.pattern_id = p.id 
  AND m.captured_at > (strftime('%s', 'now') - 7 * 86400) * 1000
WHERE p.is_active = 1
GROUP BY p.id
ORDER BY times_used_recently DESC, success_rate DESC
LIMIT 20;
```

**Expected Output**:
```
pattern_id  | template               | observation_count | success_count | failure_count | success_rate | avg_response_time | times_used_recently | recent_success_rate
------------|------------------------|-------------------|---------------|---------------|--------------|-------------------|---------------------|--------------------
pattern_abc | fix bug in {file0}     | 45                | 42            | 3             | 0.933        | 1250              | 28                  | 92.86
pattern_def | add {id0} to {file0}   | 32                | 28            | 4             | 0.875        | 1580              | 22                  | 86.36
pattern_ghi | refactor {id0}         | 28                | 24            | 4             | 0.857        | 1420              | 18                  | 88.89
...
```

### 2.4 Quality Comparison (Skip vs LLM)

```sql
-- Compare skip success rate vs LLM success rate
WITH skip_stats AS (
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) as successes,
    ROUND(100.0 * SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) / 
      NULLIF(COUNT(CASE WHEN task_succeeded IS NOT NULL THEN 1 END), 0), 2) as success_rate,
    ROUND(AVG(total_duration_ms), 0) as avg_duration
  FROM memory_agent_performance
  WHERE 
    skipped = 1
    AND captured_at > (strftime('%s', 'now') - 7 * 86400) * 1000
),
llm_stats AS (
  SELECT 
    COUNT(*) as total,
    SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) as successes,
    ROUND(100.0 * SUM(CASE WHEN task_succeeded THEN 1 ELSE 0 END) / 
      NULLIF(COUNT(CASE WHEN task_succeeded IS NOT NULL THEN 1 END), 0), 2) as success_rate,
    ROUND(AVG(total_duration_ms), 0) as avg_duration
  FROM memory_agent_performance
  WHERE 
    skipped = 0
    AND captured_at > (strftime('%s', 'now') - 7 * 86400) * 1000
)
SELECT 
  'Skip' as method,
  skip_stats.total,
  skip_stats.successes,
  skip_stats.success_rate,
  skip_stats.avg_duration
FROM skip_stats
UNION ALL
SELECT 
  'LLM' as method,
  llm_stats.total,
  llm_stats.successes,
  llm_stats.success_rate,
  llm_stats.avg_duration
FROM llm_stats;
```

**Expected Output**:
```
method | total | successes | success_rate | avg_duration
-------|-------|-----------|--------------|-------------
Skip   | 615   | 570       | 92.68        | 35
LLM    | 265   | 242       | 91.32        | 1850
```

**Quality Delta**: 92.68 - 91.32 = **+1.36** ✅ (quality maintained)

### 2.5 Performance Comparison (Time Savings)

```sql
-- Calculate time savings from skipping
WITH time_stats AS (
  SELECT 
    COUNT(*) as total_skips,
    ROUND(SUM(llm_time_saved_ms) / 1000, 2) as total_seconds_saved,
    ROUND(SUM(llm_time_saved_ms) / 1000 / 60, 2) as total_minutes_saved,
    ROUND(AVG(llm_time_saved_ms), 0) as avg_ms_saved_per_skip,
    ROUND(AVG(total_duration_ms), 0) as avg_skip_duration
  FROM memory_agent_performance
  WHERE 
    skipped = 1
    AND captured_at > (strftime('%s', 'now') - 7 * 86400) * 1000
),
llm_avg AS (
  SELECT 
    ROUND(AVG(total_duration_ms), 0) as avg_llm_duration
  FROM memory_agent_performance
  WHERE 
    skipped = 0
    AND captured_at > (strftime('%s', 'now') - 7 * 86400) * 1000
)
SELECT 
  time_stats.total_skips,
  time_stats.total_minutes_saved,
  time_stats.avg_skip_duration,
  llm_avg.avg_llm_duration,
  time_stats.avg_ms_saved_per_skip,
  ROUND(100.0 * time_stats.avg_ms_saved_per_skip / llm_avg.avg_llm_duration, 2) as time_savings_percent
FROM time_stats, llm_avg;
```

**Expected Output**:
```
total_skips | total_minutes_saved | avg_skip_duration | avg_llm_duration | avg_ms_saved_per_skip | time_savings_percent
------------|---------------------|-------------------|------------------|----------------------|---------------------
615         | 17.25               | 35                | 1850             | 1815                 | 98.11
```

### 2.6 Pattern Library Health

```sql
-- Pattern library health metrics
SELECT 
  COUNT(*) as total_patterns,
  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_patterns,
  SUM(CASE WHEN is_reliable = 1 THEN 1 ELSE 0 END) as reliable_patterns,
  SUM(CASE WHEN success_rate >= 0.75 THEN 1 ELSE 0 END) as high_quality_patterns,
  ROUND(AVG(success_rate), 3) as avg_success_rate,
  ROUND(AVG(observation_count), 1) as avg_observations,
  ROUND(AVG(avg_response_time_ms), 0) as avg_response_time,
  
  -- Age distribution
  SUM(CASE WHEN (strftime('%s', 'now') * 1000 - first_observed) < 7 * 86400 * 1000 THEN 1 ELSE 0 END) as recent_patterns,
  SUM(CASE WHEN (strftime('%s', 'now') * 1000 - first_observed) >= 7 * 86400 * 1000 
    AND (strftime('%s', 'now') * 1000 - first_observed) < 30 * 86400 * 1000 THEN 1 ELSE 0 END) as active_age_patterns,
  SUM(CASE WHEN (strftime('%s', 'now') * 1000 - first_observed) >= 30 * 86400 * 1000 THEN 1 ELSE 0 END) as mature_patterns
FROM pattern_library;
```

**Expected Output**:
```
total_patterns | active_patterns | reliable_patterns | high_quality_patterns | avg_success_rate | avg_observations | avg_response_time | recent_patterns | active_age_patterns | mature_patterns
---------------|-----------------|-------------------|----------------------|------------------|------------------|-------------------|-----------------|---------------------|----------------
85             | 78              | 65                | 65                   | 0.823            | 12.5             | 1380              | 15              | 28                  | 42
```

---

## Part 3: Validation Checklist

### 3.1 Pre-Deployment Checklist

**Before enabling impulse learning system in production**:

- [ ] **1. Database Tables Created**
  - `impulse_mapping_records` table exists
  - `pattern_library` table exists
  - `memory_agent_performance` table exists
  - All indexes created
  - Verify with: `SELECT name FROM sqlite_master WHERE type='table'`

- [ ] **2. Data Capture Points Instrumented**
  - Memory agent intent capture (memory-agent.ts:431)
  - Memory agent impulse capture (memory-agent.ts:1058)
  - Response usage capture (session/index.ts)
  - Activity task capture (activity executor)
  - Activity completion capture (activity.ts:884)
  - Verify with: Check logs for "learning record captured"

- [ ] **3. Pattern Learning Engine Implemented**
  - Pattern extraction function works
  - Pattern matching function works
  - Impulse replay function works
  - Pattern creation from mapping works
  - Test with: Run unit tests for learning engine

- [ ] **4. Skip Decision Hook Registered**
  - Hook registered at priority 5
  - Hook enabled check works
  - Skip decision function returns correctly
  - Fallback strategies implemented
  - Test with: Enable hook, check logs for "evaluating memory agent skip decision"

- [ ] **5. Tracking Functions Working**
  - Skip decision tracking inserts records
  - Pattern usage tracking updates metrics
  - Activity learning tracking captures data
  - Verify with: Query tables after test session

- [ ] **6. Baseline Metrics Captured**
  - Run system for 7 days WITHOUT skip decision enabled
  - Capture baseline LLM success rate
  - Capture baseline LLM response times
  - Store baseline in configuration
  - Target: ~90% success rate, ~1800ms avg time

- [ ] **7. Pattern Pruning Scheduled**
  - Pruning function implemented
  - Cron job or scheduled task configured
  - Runs daily at 3 AM
  - Test with: Run pruning manually, check logs

- [ ] **8. Monitoring Queries Validated**
  - All 6 monitoring queries run without errors
  - Queries return expected columns
  - Performance acceptable (<100ms)
  - Test with: Run each query against test data

- [ ] **9. Confidence Thresholds Configured**
  - Pattern match threshold: 0.85
  - Activity learning threshold: 0.80
  - Pattern reliability threshold: 0.75
  - Pattern unreliability threshold: 0.50
  - Verify in: Configuration file

### 3.2 Post-Deployment Monitoring

**After enabling impulse learning system in production**:

- [ ] **1. Monitor Skip Rate (Week 1)**
  - Target: 20-40% skip rate (ramp-up)
  - Query: Daily skip rate over time
  - Alert: If skip rate < 10% or > 60%
  - Action: Investigate pattern matching issues

- [ ] **2. Monitor Quality Delta (Week 1)**
  - Target: Quality delta >= -5% (allow small degradation initially)
  - Query: Quality comparison (Skip vs LLM)
  - Alert: If quality delta < -10%
  - Action: Disable unreliable patterns, investigate failures

- [ ] **3. Track Pattern Creation (Week 1-2)**
  - Target: 20-50 new patterns created
  - Query: Count patterns by age (recent)
  - Alert: If < 10 patterns created in 2 weeks
  - Action: Verify capture points are working

- [ ] **4. Validate Pattern Reliability (Week 2-3)**
  - Target: >= 50% of patterns become reliable (3+ obs, 75%+ success)
  - Query: Pattern library health
  - Alert: If < 30% patterns reliable after 3 weeks
  - Action: Review pattern extraction logic, increase observation threshold

- [ ] **5. Measure Time Savings (Week 2-4)**
  - Target: 85-90% time savings on skipped turns
  - Query: Performance comparison (time savings)
  - Alert: If time savings < 70%
  - Action: Optimize skip decision logic, reduce fallback overhead

- [ ] **6. Stabilize Skip Rate (Week 4+)**
  - Target: 60-80% skip rate maintained
  - Query: Skip rate over time (30 days)
  - Alert: If skip rate trends downward or > 85%
  - Action: Adjust confidence thresholds, prune unreliable patterns

### 3.3 Continuous Improvement Triggers

**Conditions that trigger system adjustments**:

1. **Quality Delta < -5% for 3 days**
   - Action: Increase skip confidence threshold (0.85 → 0.90)
   - Action: Disable patterns with success_rate < 0.70
   - Action: Review recent failures, identify common issues

2. **Skip Rate < 50% after 4 weeks**
   - Action: Decrease skip confidence threshold (0.85 → 0.80)
   - Action: Review pattern matching logic (may be too strict)
   - Action: Check if pattern library is growing (should be 50+ patterns)

3. **Skip Rate > 85% for 7 days**
   - Action: Increase skip confidence threshold (0.85 → 0.90)
   - Action: Review trivial/continuation detection (may be too broad)
   - Action: Ensure quality is maintained (check quality delta)

4. **Pattern Utilization < 50%**
   - Action: Prune unused patterns (last_used > 30 days)
   - Action: Review pattern creation logic (creating too many patterns?)
   - Action: Increase observation threshold for reliability (3 → 5)

5. **Activity Skip Success Rate < 80%**
   - Action: Increase activity learning threshold (0.80 → 0.85)
   - Action: Increase minimum observations (5 → 8)
   - Action: Review activity learning capture (missing data?)

---

## Part 4: Dashboard Design

### 4.1 Real-Time Monitoring Dashboard (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   IMPULSE LEARNING SYSTEM DASHBOARD                          │
│                        Last Updated: 2026-02-25 14:30                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SKIP RATE (LAST 7 DAYS)                                         70.5% ✓    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Target: 60-80%                                                              │
│                                                                              │
│  100% ┤                                                                      │
│   90% ┤                                              ╭───╮                   │
│   80% ┤────────────────────────────────────────────┬│   │──────────────     │
│   70% ┤                           ╭────╮      ╭────╯    ╰────╮              │
│   60% ┤──────────────────────────┬│    │──────│                             │
│   50% ┤                     ╭────╯     ╰──────╯                             │
│   40% ┤              ╭──────╯                                                │
│   30% ┤         ╭────╯                                                       │
│   20% ┤    ╭────╯                                                            │
│   10% ┤────╯                                                                 │
│    0% ┴───────────────────────────────────────────────────────────────      │
│       Day1  Day2  Day3  Day4  Day5  Day6  Day7                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┬──────────────────────────────────────────┐
│  QUALITY METRICS                 │  PERFORMANCE METRICS                     │
├──────────────────────────────────┼──────────────────────────────────────────┤
│  Skip Success Rate:    92.7% ✓   │  Avg LLM Time:         1850 ms          │
│  LLM Success Rate:     91.3%     │  Avg Skip Time:          35 ms          │
│  Quality Delta:        +1.4% ✓   │  Time Saved Per Skip:  1815 ms          │
│                                   │  Time Savings:         98.1% ✓          │
│  Status: QUALITY MAINTAINED       │                                         │
│                                   │  Total Time Saved:    17.3 min          │
└──────────────────────────────────┴──────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SKIP REASON BREAKDOWN (LAST 7 DAYS)                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Pattern Match       ████████████████████████████████ 52.0% (320)          │
│  Continuation        ████████████████ 24.4% (150)                           │
│  Activity Context    ███████████ 14.6% (90)                                 │
│  Trivial Message     ██████ 8.9% (55)                                       │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  PATTERN LIBRARY HEALTH                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Total Patterns:        85        Active Patterns:       78 (91.8%)        │
│  Reliable Patterns:     65        High Quality:          65 (76.5%)        │
│  Avg Success Rate:   82.3%        Avg Observations:      12.5             │
│  Utilization Rate:   71.2% ✓      Avg Response Time:    1380 ms           │
│                                                                              │
│  Age Distribution:                                                           │
│    Recent (< 7d):    15 (17.6%)  ████████                                  │
│    Active (7-30d):   28 (32.9%)  ████████████████                          │
│    Mature (> 30d):   42 (49.4%)  ████████████████████████                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  TOP PATTERNS (BY USAGE)                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Rank  Pattern Template             Used  Success   Avg Time                │
│  ───────────────────────────────────────────────────────────────────────    │
│   1.   fix bug in {file0}            28    92.9%    1250 ms                │
│   2.   add {id0} to {file0}          22    86.4%    1580 ms                │
│   3.   refactor {id0}                18    88.9%    1420 ms                │
│   4.   test {file0}                  15    93.3%    1180 ms                │
│   5.   explain {id0}                 12    91.7%    980 ms                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ALERTS & WARNINGS                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ✓  All systems operational                                                 │
│  ✓  Skip rate within target (60-80%)                                        │
│  ✓  Quality maintained (delta >= 0)                                         │
│  ✓  Pattern utilization healthy (> 70%)                                     │
│  ⚠  3 patterns marked unreliable in last 24h (review recommended)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Dashboard Implementation

```typescript
/**
 * Generate dashboard display
 */
export async function generateDashboard(): Promise<string> {
  
  // Calculate metrics for last 7 days
  const endTime = Date.now()
  const startTime = endTime - 7 * 24 * 60 * 60 * 1000
  
  const metrics = await calculateLearningMetrics({ startTime, endTime })
  
  // Build dashboard sections
  const skipRateChart = generateSkipRateChart(metrics)
  const qualityMetrics = generateQualityMetrics(metrics)
  const performanceMetrics = generatePerformanceMetrics(metrics)
  const skipReasonBreakdown = generateSkipReasonBreakdown(metrics)
  const patternHealth = generatePatternHealth(metrics)
  const topPatterns = await generateTopPatterns()
  const alerts = generateAlerts(metrics)
  
  // Combine into dashboard
  return `
${DASHBOARD_HEADER}

${skipRateChart}

${qualityMetrics}
${performanceMetrics}

${skipReasonBreakdown}

${patternHealth}

${topPatterns}

${alerts}
  `.trim()
}

const DASHBOARD_HEADER = `
┌─────────────────────────────────────────────────────────────────────────────┐
│                   IMPULSE LEARNING SYSTEM DASHBOARD                          │
│                        Last Updated: ${new Date().toLocaleString()}         │
└─────────────────────────────────────────────────────────────────────────────┘
`.trim()

function generateSkipRateChart(metrics: LearningMetrics): string {
  const skipRate = (metrics.skip.skipRate * 100).toFixed(1)
  const status = metrics.skip.skipRate >= 0.6 && metrics.skip.skipRate <= 0.8 ? '✓' : '⚠'
  
  return `
┌─────────────────────────────────────────────────────────────────────────────┐
│  SKIP RATE (LAST 7 DAYS)                                         ${skipRate}% ${status}    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Target: 60-80%                                                              │
│  [Chart visualization would go here]                                         │
└─────────────────────────────────────────────────────────────────────────────┘
  `.trim()
}

function generateQualityMetrics(metrics: LearningMetrics): string {
  const skipSuccessRate = (metrics.quality.skipSuccessRate * 100).toFixed(1)
  const llmSuccessRate = (metrics.quality.llmSuccessRate * 100).toFixed(1)
  const qualityDelta = (metrics.quality.qualityDelta * 100).toFixed(1)
  const deltaSign = metrics.quality.qualityDelta >= 0 ? '+' : ''
  const status = metrics.quality.qualityMaintained ? '✓' : '⚠'
  
  return `
┌──────────────────────────────────┐
│  QUALITY METRICS                 │
├──────────────────────────────────┤
│  Skip Success Rate:    ${skipSuccessRate}% ✓   │
│  LLM Success Rate:     ${llmSuccessRate}%     │
│  Quality Delta:        ${deltaSign}${qualityDelta}% ${status}   │
│                                   │
│  Status: ${metrics.quality.qualityMaintained ? 'QUALITY MAINTAINED' : 'QUALITY DEGRADED'}       │
└──────────────────────────────────┘
  `.trim()
}

// ... Additional dashboard generation functions ...
```

---

## Summary

This document provides complete validation and monitoring framework with:

1. ✅ **Success Metrics Schema**: LearningMetrics interface with 50+ fields
2. ✅ **6 Monitoring Queries**: Skip rate, quality, patterns, performance, health
3. ✅ **Pre-Deployment Checklist**: 9 items to verify before enabling
4. ✅ **Post-Deployment Monitoring**: 6 items to track after enabling
5. ✅ **Continuous Improvement**: 5 triggers for system adjustments
6. ✅ **Dashboard Design**: Real-time ASCII dashboard with all key metrics

**Key Validation Gates**:
- Skip Rate: 60-80% target
- Quality Delta: >= 0 (skip success >= LLM success)
- Time Savings: 85-90% reduction
- Pattern Utilization: > 70% of patterns used

**Monitoring Schedule**:
- Real-time: Dashboard updates every 5 minutes
- Daily: Skip rate tracking, pattern health
- Weekly: Quality validation, performance analysis
- Monthly: Long-term trend analysis, pattern pruning review

The system provides complete observability and validation to ensure learning system maintains quality while achieving skip rate targets!
