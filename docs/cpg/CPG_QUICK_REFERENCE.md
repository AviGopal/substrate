# CPG & Co-Change Quick Reference Card

**One-page reference for developers**

---

## 🔧 MCP Tools Available

### 1. `analyze_change_impact`
**When**: Before refactoring or deleting code  
**Input**: `file_path`, `component_name`, `max_depth`  
**Output**: Dependencies, dependents, similar components  
**Example**:
```typescript
const impact = await metabob.analyzeChangeImpact("auth.py", "login", 3)
console.log(`${impact.direct_dependents} components call this function`)
```

### 2. `suggest_related_changes`
**When**: After making changes  
**Input**: `changed_files`, `top_k`  
**Output**: Files that often change together  
**Example**:
```typescript
const related = await metabob.suggestRelatedChanges(["auth.py"], { top_k: 5 })
related.forEach(f => console.log(`${f.file_path}: ${f.cochange_score}`))
```

### 3. `list_file_components`
**When**: Debugging CPG queries  
**Input**: `file_path`  
**Output**: All functions/classes in file  
**Example**:
```typescript
const components = await metabob.listFileComponents("auth.py")
components.forEach(c => console.log(`${c.type}: ${c.name}`))
```

### 4. `get_priority_issues`
**When**: Starting work session  
**Input**: None  
**Output**: 0-5 top issues in your work area  
**Example**:
```typescript
const priorities = await metabob.getPriorityIssues()
// Returns issues ranked by: severity × CPG_impact × recency
```

---

## 📁 Key Files

### CPG-Inference Library
- **Main**: `repos/cpg-inference/cpg_inference/service.py`
- **Queries**: `repos/cpg-inference/cpg_inference/graph_queries.py`
- **Storage**: SQLite (default) or Redis

### metabob-cli Integration
- **Manager**: `repos/metabob-cli/src/metabob_cli/mcp/cpg_manager.py`
- **Tools**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`
- **Watcher**: `repos/metabob-cli/src/metabob_cli/mcp/server.py`

### metabob-opencode Integration
- **Activity**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`
- **Utils**: `repos/metabob-opencode/packages/opencode/src/util/metabob.ts`
- **Context**: `repos/metabob-opencode/packages/opencode/src/session/system.ts`

---

## ⚙️ Configuration

### opencode.json
```json
{
  "metabob": {
    "cpg": {
      "auto_build": true,
      "incremental": true,
      "watch_files": true,
      "storage_path": "${stateDirectory}/.metabob/cpg_cache.db"
    },
    "activities": {
      "cochange_prediction": {
        "enabled": true,
        "track_accuracy": true
      }
    }
  }
}
```

---

## 🚀 Quick Wins to Implement

### 1. Activity Co-Change Workflow (4 hours)
**File**: `repos/metabob-opencode/packages/opencode/src/session/activity.ts`  
**Change**: Auto-suggest related files after each task  
**Impact**: Prevent regression bugs

### 2. Impulse CPG Scoring (3 hours)
**File**: `repos/metabob-opencode/packages/opencode/src/impulse/resolver.ts`  
**Change**: Prioritize high-impact components  
**Impact**: Better context utilization

### 3. Test Selection (6 hours)
**File**: `repos/metabob-cli/src/metabob_cli/mcp/tools.py`  
**Change**: New tool for dependency-based test selection  
**Impact**: 50%+ faster test runs

---

## 📊 Performance Targets

| Operation | Target | Current |
|-----------|--------|---------|
| File update | < 100ms | 36-156ms ✅ |
| CPG query | < 20ms | 9-19ms ✅ |
| Cold start | < 200ms | 25-170ms ✅ |
| Co-change accuracy | > 70% | Not measured ⚠️ |

---

## 🐛 Debugging

### CPG Not Returning Data?
1. Check if file indexed: `ls -lh ~/.metabob/.metabob/cpg_cache.db`
2. List components: `await metabob.listFileComponents(filePath)`
3. Use exact component name from step 2

### Slow Queries?
1. Check cache size: `sqlite3 ~/.metabob/.metabob/cpg_cache.db "SELECT COUNT(*) FROM components;"`
2. Enable debug logging: `logging.getLogger("cpg_inference").setLevel(logging.DEBUG)`
3. Consider Redis backend for large codebases

### Co-Change Predictions Wrong?
1. Check accuracy tracking in activity system
2. Review learning data (if pipeline exists)
3. Consider model fine-tuning (Phase 4)

---

## 📚 Full Documentation

- **Architecture**: `CPG_COCHANGE_INTEGRATION_ARCHITECTURE.md`
- **Implementation Guide**: `CPG_COCHANGE_MAXIMIZATION_GUIDE.md`
- **Data Flow**: `CPG_DATA_FLOW_DIAGRAM.md`
- **Summary**: `CPG_INTEGRATION_SUMMARY.md`

---

## 💡 Best Practices

✅ **DO**: Call `analyze_change_impact` before major refactoring  
✅ **DO**: Call `suggest_related_changes` after completing features  
✅ **DO**: Use `list_file_components` when debugging CPG queries  
✅ **DO**: Enable co-change tracking in activity templates  

❌ **DON'T**: Query CPG in tight loops (batch queries instead)  
❌ **DON'T**: Ignore related files with high co-change scores  
❌ **DON'T**: Skip test selection (wastes CI/CD time)  

---

**Start here**: Implement Quick Win #1 (Activity Co-Change Workflow) - highest ROI, lowest effort! 🚀
