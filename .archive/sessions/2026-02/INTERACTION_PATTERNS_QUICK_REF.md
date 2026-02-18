# Interaction Patterns - Quick Reference

**Quick lookup for reusable patterns in agent development and workflow automation**

---

## Pattern Selection Decision Tree

```
Need to debug integration issue?
  → Pattern 1: Systematic Debugging
  → Pattern 8: File-Based Logging

Building multi-domain feature?
  → Pattern 2: Multi-Agent Coordination
  → Pattern 5: Context Sharing (impulses)

Creating repeatable workflow?
  → Pattern 3: Activity Execution
  → Pattern 6: Outcome Recording

Integrating with backend?
  → Pattern 4: Architecture Alignment
  → Pattern 7: Graceful Degradation
```

---

## Pattern 1: Systematic Debugging

**When**: Complex integration issues with unknown root cause

**Steps**:
1. Add logging at every integration point
2. Test and fix one issue per iteration
3. Document each bug: location, cause, fix
4. Categorize bugs by type

**Key Technique**: File-based logging when framework fails

```typescript
appendFileSync("/tmp/debug.log", `${timestamp} | ${event} | ${JSON.stringify(data)}\n`)
```

---

## Pattern 2: Multi-Agent Coordination

**When**: Feature spans multiple domains (backend, frontend, testing)

**Architecture**:
```
Orchestrator
  ├─> Backend Agent (container)
  ├─> Frontend Agent (container)
  └─> Test Agent (container)
```

**Steps**:
1. Create shared design impulse
2. Delegate to specialized agents in parallel
3. Backend annotates with `MESSAGE_FOR:frontend` / `MESSAGE_FOR:test`
4. Frontend/test agents discover via Metabob

```typescript
const [backend, frontend, test] = await Promise.all([
  acp_delegate({ target: "docker://backend", shareImpulses: ["design"] }),
  acp_delegate({ target: "docker://frontend", shareImpulses: ["design"] }),
  acp_delegate({ target: "docker://test", shareImpulses: ["design"] })
])
```

**Benefit**: 3x faster (parallel), isolated failures

---

## Pattern 3: Activity Execution

**When**: Repeatable multi-step workflows

**Flow**:
```
Discover → Load Template → Validate → Execute Loop → Report Outcome
```

**Template Structure**:
```json
{
  "id": "activity-id",
  "tasks": [
    {
      "id": "task-1",
      "prompt": { "template": "Do {{variable}}" },
      "validation": { "success_criteria": "..." }
    }
  ],
  "variables": { "variable": { "type": "string", "required": true } }
}
```

**Usage**:
```typescript
activity({
  activityId: "add-rest-endpoint",
  variables: { path: "/api/users", method: "POST" },
  reason: "Add user endpoint"
})
```

**Key Principles**:
- Backend as source of truth (no caching)
- Track cost and duration per task
- Record outcomes for evolution

---

## Pattern 4: Architecture Alignment

**When**: Cross-language/schema boundaries (Proto ↔ TypeScript)

**Architecture**:
```
Backend (Proto, snake_case)
    ↓
CLI (Mapping Layer)
    ↓
Frontend (TypeScript, camelCase)
```

**Mapping Example**:
```python
# CLI layer
{
  "id": proto.variant_id,
  "name": proto.variant_name,
  "impulseReferences": proto.impulse_refs
}
```

**MCP Convention**: All tools return `{status: "success", ...data}`

**Anti-Patterns**:
- ❌ Cache transformed data
- ❌ Duplicate schema definitions
- ❌ Transform at multiple layers

---

## Pattern 5: Context Sharing

**When**: Distributing design specs across agents

**Steps**:

1. **Create Impulse**
```typescript
impulse_create({
  id: "api-design",
  pointer: { type: "memo", content: "API spec..." },
  budget: 2000
})
```

2. **Share with Agents**
```typescript
acp_delegate({
  prompt: "Implement per shared design",
  shareImpulses: ["api-design"]
})
```

3. **Agent Receives**
```xml
<shared_impulses>
api-design: API spec...
</shared_impulses>
```

**Benefit**: Share once, use many times; reduced token usage

---

## Pattern 6: Outcome Recording & Evolution

**When**: Building self-improving template library

**Flow**:
```
Execute → Record Outcome → Aggregate Stats → Select Better Variant
```

**Recording**:
```typescript
recordOutcome({
  execution_id: "exec_abc",
  template_id: "add-endpoint",
  variant_id: "v3",
  success: true,
  duration_ms: 45000,
  cost_usd: 0.0012
})
```

**Variant Selection**:
```python
score = (
  success_rate * 0.6 +           # 60% weight
  (1 - cost_normalized) * 0.2 +  # 20% weight  
  (1 - time_normalized) * 0.2    # 20% weight
)
```

**Benefit**: System improves with use, cost optimization

---

## Pattern 7: Graceful Degradation

**When**: External system integrations

**Layers**:
1. Check availability
2. Try primary source
3. Fall back to cache
4. Fall back to embedded defaults
5. Fail gracefully with clear message

```typescript
async function getData() {
  const available = await isAvailable()
  if (!available) {
    return { data: [], degraded: true }  // Don't block
  }
  
  try {
    return await primarySource.get()
  } catch {
    const cached = await cache.get()
    return cached || { data: [], degraded: true }
  }
}
```

**Benefit**: Primary workflow continues despite subsystem failures

---

## Pattern 8: File-Based Logging

**When**: Framework logging unavailable/unreliable

**Implementation**:
```typescript
const LOG = "/tmp/debug.log"

function log(event: string, data?: any) {
  appendFileSync(LOG, `${Date.now()} | ${event} | ${JSON.stringify(data)}\n`)
}

// Usage
log("CALLING", { fn: "loadTemplate", id: "abc" })
const result = await loadTemplate("abc")
log("RETURNED", { success: true, id: result.id })
```

**Analysis**:
```bash
# Watch live
tail -f /tmp/debug.log

# Find errors
grep ERROR /tmp/debug.log

# Trace execution
grep "CALLING\|RETURNED" /tmp/debug.log
```

**Benefit**: 100% visibility, bypass framework issues

---

## Pattern Combinations

### Full-Stack Feature
1. Pattern 5: Create design impulse
2. Pattern 2: Delegate to multi-agents
3. Pattern 3: Wrap in activity template
4. Pattern 6: Record outcome

### System Integration
1. Pattern 4: Define mapping layer
2. Pattern 7: Add graceful degradation
3. Pattern 1: Debug with systematic logging
4. Pattern 8: Use file logs if needed

### Template Development
1. Pattern 3: Define activity structure
2. Pattern 6: Add outcome recording
3. Pattern 7: Handle missing dependencies gracefully

---

## Success Metrics Summary

| Pattern | Key Metric | Target |
|---------|-----------|--------|
| 1. Debugging | Time to root cause | < 1 hour |
| 2. Multi-Agent | Speedup vs sequential | 3x |
| 3. Activity | Completion rate | > 95% |
| 4. Architecture | Field name conflicts | 0 |
| 5. Context Sharing | Token savings | 30-50% |
| 6. Evolution | Success rate trend | +5-10% quarterly |
| 7. Degradation | Uptime despite failures | > 99% |
| 8. File Logging | Visibility coverage | 100% |

---

## Quick Start Checklist

### For New Agent
- [ ] Add systematic debugging (Pattern 1)
- [ ] Implement file logging (Pattern 8)
- [ ] Support impulse context (Pattern 5)
- [ ] Add graceful degradation (Pattern 7)

### For Workflow Automation
- [ ] Define as activity template (Pattern 3)
- [ ] Add outcome recording (Pattern 6)
- [ ] Support variable substitution
- [ ] Test with variants

### For System Integration
- [ ] Map field names (Pattern 4)
- [ ] Backend as source of truth
- [ ] Add availability checks (Pattern 7)
- [ ] Test cross-boundary data flow

---

## Common Mistakes

### ❌ Debugging
- Adding logs after-the-fact (add upfront)
- Assuming field names match (verify at boundary)
- No file logging fallback (framework may fail)

### ❌ Multi-Agent
- Sequential execution (use parallel where possible)
- Direct agent-to-agent calls (use annotations)
- No shared context (impulses reduce duplication)

### ❌ Activities
- Caching templates locally (backend selects variant)
- No outcome recording (can't learn/improve)
- Monolithic tasks (break into small steps)

### ❌ Architecture
- Transform at multiple layers (single mapping point)
- Duplicate schemas (backend is source of truth)
- Ignoring failures (graceful degradation required)

---

## Resources

- **Full Analysis**: `INTERACTION_PATTERNS_ANALYSIS.md`
- **Activity Examples**: `FINAL_COMPREHENSIVE_TEST_FEB12.md`
- **Multi-Agent Examples**: `repos/metabob-opencode/packages/opencode/examples/acp-multi-agent-workflow.md`
- **Debugging Success**: `ACTIVITY_EXECUTION_COMPLETE_SUCCESS.md`
- **Architecture Guide**: `ARCHITECTURE_ALIGNMENT_PLAN.md`

---

**Version**: 1.0  
**Last Updated**: February 12, 2026
