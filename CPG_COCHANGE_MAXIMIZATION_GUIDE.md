# Maximizing CPG & Co-Change Model Potential

**Quick Reference Guide** for leveraging CPG-inference and co-change prediction across the stack

---

## 🎯 Current Integration Status

### metabob-cli ✅ FULLY INTEGRATED
- **CPGManager**: `repos/metabob-cli/src/metabob_cli/mcp/cpg_manager.py`
- **Storage**: `~/.metabob/.metabob/cpg_cache.db` (SQLite persistent cache)
- **8 MCP Tools**: analyze_change_impact, suggest_related_changes, list_file_components, get_priority_issues, etc.
- **File Watcher**: Auto-syncs file changes → CPG in background

### metabob-opencode ⚠️ PARTIALLY INTEGRATED  
- **Activity Tracking**: `useCochangePrediction: true` (tracks accuracy)
- **Context Scoring**: Co-change scores boost relevance (0.6x weight)
- **Related Files**: Displayed in LLM context with co-change scores
- **⚠️ GAP**: Predictions tracked but not actively used to guide agents

### metabob-rpc-api ❌ NOT INTEGRATED
- **cpg-inference installed** but unused
- **Opportunity**: REST endpoints for web dashboard, CI/CD integration

---

## 🚀 HIGH IMPACT Quick Wins

### 1. Activity-Driven Co-Change Workflow

**Problem**: Co-change predictions are calculated and stored, but agents don't act on them.

**Solution**: Auto-suggest related files with issues during activity execution.

**Implementation Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

```typescript
// In executeActivityTask() - after task completion
if (task.validation.useCochangePrediction) {
  const changedFiles = extractChangedFiles(result)
  const related = await metabob.suggestRelatedChanges(changedFiles, { top_k: 3 })
  
  // Filter high co-change files with issues
  const criticalRelated = related.filter(f => 
    f.cochange_score > 0.7 && f.high_severity_issues > 0
  )
  
  // Add follow-up task for agent
  if (criticalRelated.length > 0) {
    activity.addFollowUpTask({
      description: `Review related files with issues: ${criticalRelated.map(f => f.file_path).join(", ")}`,
      reason: `Co-change analysis detected ${criticalRelated.length} related files that often change together and have high-severity issues`,
      priority: "high"
    })
  }
}
```

**Expected Impact**:
- ✅ Prevent regression bugs by catching related file issues early
- ✅ Improve code consistency (apply patterns across co-changed files)
- ✅ Increase co-change prediction accuracy (agents learn by seeing predictions)

---

### 2. Impulse Context Prioritization via CPG

**Problem**: Impulses loaded without considering component impact. High-impact components should be prioritized when context budget is tight.

**Solution**: Score impulses by CPG impact and prioritize accordingly.

**Implementation Location**: `repos/metabob-opencode/packages/opencode/src/impulse/resolver.ts`

```typescript
async function scoreImpulse(impulse: Impulse): Promise<number> {
  let score = baseScore(impulse)  // Existing scoring logic
  
  // NEW: Add CPG impact boost
  if (impulse.pointer.type === "file" || impulse.pointer.type === "component") {
    const files = extractFilesFromPointer(impulse.pointer)
    
    for (const file of files) {
      // Get CPG impact score for file
      const impactResult = await metabob.analyzeChangeImpact(file, null, 2)
      const impactScore = impactResult.direct_dependents / 100.0  // Normalize
      
      // Boost score by impact (max +0.5)
      score += Math.min(impactScore * 0.5, 0.5)
    }
  }
  
  return score
}
```

**Expected Impact**:
- ✅ High-impact components prioritized in context (even if recently used)
- ✅ Better context budget utilization (important over recent)
- ✅ Fewer issues in critical paths (agents see high-impact code first)

---

### 3. CPG-Powered Test Selection

**Problem**: Running all tests is slow, manual selection is error-prone.

**Solution**: Use CPG dependency analysis to select only affected tests.

**Implementation Location**: New MCP tool in `repos/metabob-cli/src/metabob_cli/mcp/tools.py`

```python
@server.call_tool()
async def select_relevant_tests(
    changed_files: list[str],
    test_pattern: str = "test_*.py",
    max_depth: int = 2
) -> list[str]:
    """Select tests affected by changed files using CPG dependency analysis.
    
    Args:
        changed_files: Files that changed
        test_pattern: Pattern to match test files
        max_depth: Depth of dependency traversal
        
    Returns:
        List of test file paths to run
    """
    affected_tests = set()
    
    # For each changed file
    for file_path in changed_files:
        # Get all components in the file
        components_result = await list_file_components(file_path)
        
        if components_result["status"] != "success":
            continue
            
        # For each component, find dependents
        for comp in components_result["components"]:
            component_id = f"{file_path}::{comp['name']}"
            
            # Analyze what depends on this component
            impact = await analyze_change_impact(file_path, comp["name"], max_depth)
            
            # Extract test files from dependents
            for dep in impact.get("transitive_dependents", []):
                dep_file = dep.split("::")[0]
                if matches_pattern(dep_file, test_pattern):
                    affected_tests.add(dep_file)
    
    return sorted(list(affected_tests))
```

**Usage in Activity Template**:
```json
{
  "id": "run-affected-tests",
  "description": "Run only tests affected by changes",
  "subagent": "general",
  "prompt": {
    "template": "Run tests for changed files:\n{{changedFiles}}\n\nUse select_relevant_tests() to find affected tests, then run them.",
    "variables": [
      {"name": "changedFiles", "type": "array", "required": true}
    ]
  }
}
```

**Expected Impact**:
- ✅ 50-70% reduction in test execution time
- ✅ Catch affected tests missed by manual selection
- ✅ Faster CI/CD pipelines

---

## 🔶 MEDIUM IMPACT Enhancements

### 4. REST API Exposure (metabob-rpc-api)

**Opportunity**: Expose CPG capabilities for web dashboard, CI/CD tools, external integrations.

**New Endpoints**:

```python
# In metabob-rpc-api/src/routes/cpg.py

@router.post("/api/v2/cpg/analyze-impact")
async def analyze_impact(request: ImpactRequest):
    """Analyze change impact for a component."""
    cpg_manager = get_cpg_manager()  # Singleton
    result = cpg_manager.analyze_change_impact(
        component_id=f"{request.file_path}::{request.component_name}",
        max_depth=request.max_depth or 3
    )
    return result

@router.post("/api/v2/cpg/predict-cochanges")
async def predict_cochanges(request: CoChangeRequest):
    """Predict files that should change together."""
    cpg_manager = get_cpg_manager()
    predictions = []
    
    for file in request.changed_files:
        related = cpg_manager.predict_related_files(file, top_k=request.top_k or 5)
        predictions.extend(related)
    
    return {"predictions": predictions}

@router.get("/api/v2/cpg/graph/{file_path}")
async def get_component_graph(file_path: str):
    """Get D3.js-compatible graph for visualization."""
    cpg_manager = get_cpg_manager()
    engine = cpg_manager.predictor.query_graph()
    
    # Get all components in file
    components = engine.find_nodes_by_name(f"{file_path}::*")
    
    # Build D3 graph
    nodes = []
    links = []
    for comp in components:
        nodes.append({"id": comp.component_id, "name": comp.name})
        
        # Get dependencies
        deps = engine.find_dependencies(comp.component_id)
        for dep in deps:
            links.append({"source": comp.component_id, "target": dep.component_id})
    
    return {"nodes": nodes, "links": links}
```

**Use Cases**:
- Web dashboard showing codebase dependency graphs
- PR comments with impact analysis ("This change affects 12 components")
- CI/CD risk assessment (high-impact changes trigger extra review)

---

### 5. Proactive High-Impact Issue Detection

**Problem**: High-impact components with issues go unnoticed until they break.

**Solution**: Background worker detects issues in high-impact components → sends alerts.

**Implementation Location**: `repos/metabob-cli/src/metabob_cli/mcp/analysis_worker.py`

```python
# New background task (runs every 30 minutes)
async def detect_critical_issues_task():
    """Proactively detect HIGH issues in high-impact components."""
    while True:
        await asyncio.sleep(1800)  # 30 minutes
        
        try:
            # Get all MEDIUM+ issues
            issues = await get_issues(min_severity="MEDIUM")
            
            critical_alerts = []
            for issue in issues:
                # Calculate CPG impact
                impact_score = cpg_manager.calculate_impact_score(issue.file_path)
                
                # If high impact (>0.8) and HIGH severity, it's critical
                if impact_score > 0.8 and issue.severity == "HIGH":
                    dependents_count = int(impact_score * 100)
                    critical_alerts.append({
                        "issue_id": issue.id,
                        "file_path": issue.file_path,
                        "severity": issue.severity,
                        "impact_score": impact_score,
                        "dependents_count": dependents_count,
                        "message": issue.message,
                        "recommendation": f"Fix urgently - {dependents_count} components depend on this"
                    })
            
            # Send notifications if critical issues found
            if critical_alerts:
                await notify_user({
                    "type": "critical_issues_detected",
                    "count": len(critical_alerts),
                    "issues": critical_alerts[:5]  # Top 5
                })
                
        except Exception as e:
            logger.error(f"Critical issue detection failed: {e}")
```

**Notification Integration**: Could use Slack, email, or in-app notifications.

---

### 6. Activity Template Co-Change Learning

**Problem**: Activity templates don't improve over time. Co-change accuracy tracked but not used.

**Solution**: Learn from activity execution data to improve predictions.

**Implementation Location**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`

```typescript
// After activity completion
async function recordActivityLearning(activity: Activity) {
  const learningRecord = {
    template_id: activity.templateId,
    predicted_cochanges: activity.expected.cochanges,
    actual_cochanges: activity.actual.changedFiles,
    accuracy: activity.comparison.cochangeAccuracy,
    timestamp: Date.now(),
    success: activity.status === "completed"
  }
  
  // Store in backend
  await backend.post("/api/v2/activity-learning/record", learningRecord)
  
  // If accuracy is poor, flag for template improvement
  if (learningRecord.accuracy < 0.5 && learningRecord.success) {
    await backend.post("/api/v2/templates/flag-improvement", {
      template_id: activity.templateId,
      reason: `Low co-change accuracy (${(learningRecord.accuracy * 100).toFixed(0)}%)`,
      learning_record_id: learningRecord.id
    })
  }
}
```

**Analysis Dashboard**: Query learning data to identify:
- Templates with consistently low co-change accuracy
- Patterns in false positives/negatives
- Files that frequently co-change but aren't predicted

---

## 🔧 Technical Optimizations

### 1. CPG Cache Warming (Startup Performance)

**Problem**: First CPG query after restart is slow (cold cache).

**Solution**: Background index frequently-accessed files during startup.

```python
# In server.py after CPGManager initialization
async def warm_cpg_cache():
    # Query backend for hot files (accessed in last 7 days)
    hot_files = await db.query("""
        SELECT file_path, COUNT(*) as access_count
        FROM activity_file_access
        WHERE timestamp > $recent
        GROUP BY file_path
        ORDER BY access_count DESC
        LIMIT 100
    """, recent=datetime.now() - timedelta(days=7))
    
    # Index in background (non-blocking)
    asyncio.create_task(cpg_manager.index_files([f.file_path for f in hot_files]))
```

---

### 2. Distributed CPG (Redis Backend)

**Problem**: Single SQLite database limits scalability for large teams.

**Solution**: Use Redis for shared CPG cache across multiple MCP servers.

```python
# In cpg_manager.py initialization
from cpg_inference.storage import RedisStorage

if config.get("cpg.distributed", False):
    storage = RedisStorage(
        host=config.get("redis.host", "localhost"),
        port=config.get("redis.port", 6379),
        db=config.get("redis.db", 0),
        prefix="cpg:"
    )
else:
    storage = SQLiteStorage(cpg_cache_path)

cpg_manager = CPGManager(project_root, storage_backend=storage)
```

**Benefits**:
- Multiple developers share same CPG cache
- Faster queries (Redis in-memory vs SQLite disk)
- Horizontal scaling for large codebases

---

### 3. Incremental Model Fine-Tuning

**Problem**: Bundled GNN model never learns from actual co-change patterns.

**Solution**: Periodic retraining with activity learning data.

```python
# Weekly cron job
async def fine_tune_cochange_model():
    # Fetch activity learning records (last 30 days)
    learning_data = await db.query("""
        SELECT predicted_cochanges, actual_cochanges, accuracy
        FROM activity_cochange_learning
        WHERE timestamp > $cutoff AND success = true
    """, cutoff=datetime.now() - timedelta(days=30))
    
    # Prepare training pairs
    positive_pairs = []
    negative_pairs = []
    
    for record in learning_data:
        for actual in record.actual_cochanges:
            # Positive: predicted AND occurred
            if actual in record.predicted_cochanges:
                positive_pairs.append((record.predicted_cochanges[0], actual, 1))
            # Negative: predicted but didn't occur
            for pred in record.predicted_cochanges:
                if pred not in record.actual_cochanges:
                    negative_pairs.append((record.predicted_cochanges[0], pred, 0))
    
    # If enough new data, fine-tune model
    if len(positive_pairs) + len(negative_pairs) > 1000:
        fine_tuned_model = await fine_tune_gnn(
            base_model=cpg_manager.predictor.model,
            training_pairs=positive_pairs + negative_pairs,
            epochs=5
        )
        
        # Deploy new model
        await deploy_model(fine_tuned_model, version=f"fine-tuned-{datetime.now():%Y%m%d}")
```

---

## 📊 Metrics & Monitoring

### Key Metrics to Track

**Co-Change Prediction Effectiveness**:
```typescript
interface CoChangePredictionMetrics {
  predictions_made: number           // Total predictions across all activities
  predictions_accurate: number       // How many predicted files actually changed
  accuracy_rate: number              // accurate / made (target: >70%)
  avg_cochange_score: number         // Average confidence score
  false_positive_rate: number        // Predicted but didn't change
  false_negative_rate: number        // Should have predicted but didn't
}
```

**CPG Query Performance**:
```typescript
interface CPGPerformanceMetrics {
  avg_query_time_ms: number          // Average query time (target: <20ms)
  p95_query_time_ms: number          // 95th percentile (target: <50ms)
  p99_query_time_ms: number          // 99th percentile (target: <100ms)
  cache_hit_rate: number             // SQLite cache effectiveness
  files_indexed: number              // Total files in CPG
  components_indexed: number         // Total functions/classes
}
```

**CPG Usage Patterns**:
```typescript
interface CPGUsageMetrics {
  tools_called: Record<string, number>  // analyze_change_impact: 120, etc.
  files_most_queried: Array<{file: string, count: number}>
  components_highest_impact: Array<{component: string, impact_score: number}>
  test_selection_time_saved_ms: number
}
```

### Monitoring Dashboard

**Grafana Panels**:
1. Co-change accuracy trend (daily)
2. CPG query latency (p50, p95, p99)
3. Test selection effectiveness (tests run vs total)
4. High-impact components with issues (alert threshold)
5. Activity learning data volume (training readiness)

---

## 🎓 Best Practices

### When to Use Each CPG Tool

#### analyze_change_impact
**Use Before**:
- Refactoring critical components
- Deleting code (check dependents first)
- Large architectural changes

**Example**:
```typescript
// Before refactoring authentication system
const impact = await metabob.analyzeChangeImpact("auth.py", "login", 3)
console.log(`This change will affect ${impact.direct_dependents} components directly`)
console.log(`And ${impact.transitive_dependents} components transitively`)
// Decision: Create comprehensive tests before proceeding
```

#### suggest_related_changes
**Use After**:
- Completing a feature (find related files)
- Fixing a bug (apply pattern elsewhere)
- Code review (consistency check)

**Example**:
```typescript
// After fixing authentication bug
const related = await metabob.suggestRelatedChanges(["auth.py"], { top_k: 5 })
for (const file of related) {
  if (file.cochange_score > 0.7) {
    console.log(`Check ${file.file_path} - often changes with auth.py`)
  }
}
```

#### list_file_components
**Use For**:
- Debugging (why is analyze_change_impact returning 0 dependencies?)
- Exploration (what components exist in this file?)
- Verification (did CPG extract components correctly?)

**Example**:
```typescript
// Debug missing dependencies
const components = await metabob.listFileComponents("auth.py")
console.log("CPG extracted:", components.map(c => c.name))
// Use exact name from this output for analyze_change_impact
```

#### get_priority_issues
**Use When**:
- Starting a work session (what needs attention?)
- After completing a task (what's next?)
- Context-switching (focus on relevant work)

**Example**:
```typescript
// Start of day workflow
const priorities = await metabob.getPriorityIssues()
if (priorities.length > 0) {
  console.log(`Focus on ${priorities[0].file_path} - ${priorities[0].dependents_count} components depend on it`)
} else {
  console.log("No high-priority issues in your work area")
}
```

---

## 🚀 Action Plan

### Phase 1: Quick Wins (1-2 days)

1. ✅ **Enable activity-driven co-change workflow**
   - Modify `session/activity.ts::executeActivityTask()`
   - Auto-suggest related files with issues
   - Add follow-up tasks for high-cochange files

2. ✅ **Add CPG metrics to observability**
   - Log co-change accuracy per activity
   - Track CPG query performance (p95, p99)
   - Monitor false positive/negative rates

3. ✅ **Document CPG tools in agent prompts**
   - Update activity mode system prompts
   - Add CPG tool examples to mode docs

---

### Phase 2: High-Impact Features (1 week)

4. ⚙️ **Impulse context prioritization**
   - Implement CPG impact scoring in impulse resolver
   - Prioritize high-impact components in context

5. ⚙️ **CPG-powered test selection**
   - Add `select_relevant_tests()` MCP tool
   - Integrate with test activity templates
   - Measure test execution time reduction

6. ⚙️ **Activity learning pipeline**
   - Store co-change accuracy data in backend
   - Flag templates for improvement (accuracy <50%)
   - Create learning data export for model retraining

---

### Phase 3: Infrastructure (2 weeks)

7. 🏗️ **REST API exposure (metabob-rpc-api)**
   - Add CPG endpoints for web dashboard
   - Implement D3.js graph visualization
   - Enable CI/CD integration

8. 🏗️ **Proactive issue detection**
   - Background worker for critical issue alerts
   - Notification system integration (Slack, email)
   - Dashboard for high-impact issues

9. 🏗️ **Distributed CPG (Redis)**
   - Redis storage backend option
   - Multi-server CPG cache sharing
   - Horizontal scaling support

---

### Phase 4: Advanced (1 month)

10. 🔬 **Model fine-tuning pipeline**
    - Collect activity learning data (30 days)
    - Implement GNN fine-tuning workflow
    - A/B test fine-tuned vs bundled model

11. 🔬 **CPG cache warming**
    - Hot file identification from activity history
    - Background indexing during startup
    - Reduce cold-start query latency

12. 🔬 **Visualization dashboard**
    - D3.js dependency graphs
    - Co-change heatmaps
    - Impact analysis UI

---

## 📚 Quick Reference

### Key Files

**CPG-Inference**:
- Library: `repos/cpg-inference/cpg_inference/`
- Main service: `service.py::CoChangePredictor`
- Graph queries: `graph_queries.py::GraphQueryEngine`

**metabob-cli**:
- CPG wrapper: `src/metabob_cli/mcp/cpg_manager.py`
- MCP tools: `src/metabob_cli/mcp/tools.py`
- File watcher: `src/metabob_cli/mcp/server.py`

**metabob-opencode**:
- Activity system: `packages/opencode/src/session/activity.ts`
- Metabob utils: `packages/opencode/src/util/metabob.ts`
- Context system: `packages/opencode/src/session/system.ts`

### Configuration

**opencode.json**:
```json
{
  "metabob": {
    "cpg": {
      "auto_build": true,
      "incremental": true,
      "watch_files": true,
      "storage_path": "${stateDirectory}/.metabob/cpg_cache.db"
    },
    "context": {
      "include_related_files": true,
      "cochange_threshold": 0.6
    },
    "activities": {
      "cochange_prediction": {
        "enabled": true,
        "track_accuracy": true,
        "learning_mode": true
      }
    }
  }
}
```

### Success Criteria

**Target Metrics**:
- Co-change accuracy: >70%
- CPG query p95 latency: <20ms
- Test selection time savings: >50%
- False positive rate: <30%
- Activity quality: 20% fewer regression bugs

---

**Next Steps**: Pick a phase from the action plan and implement it! Start with Phase 1 Quick Wins for immediate impact. 🚀
