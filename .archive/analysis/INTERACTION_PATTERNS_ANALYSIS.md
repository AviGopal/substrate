# Reusable Interaction Patterns from Successful Conversations

**Generated**: February 12, 2026  
**Purpose**: Extract and document successful interaction patterns for reuse in agent development and activity templates

---

## Executive Summary

This document analyzes successful conversations and executions within the metabob-devbob repository to identify reusable patterns for agent-to-agent interaction, human-agent collaboration, and automated workflow coordination.

### Key Patterns Identified

1. **Systematic Debugging Pattern** - Incremental problem isolation through logging
2. **Multi-Agent Coordination Pattern** - Parallel execution with Metabob MESSAGE_FOR annotations
3. **Activity Execution Pattern** - Template-driven workflow with outcome tracking
4. **Architecture Alignment Pattern** - Backend-as-source-of-truth with field mapping
5. **Context Sharing Pattern** - Impulse-based design specification distribution

---

## Pattern 1: Systematic Debugging Pattern

### Source
- `ACTIVITY_EXECUTION_COMPLETE_SUCCESS.md`
- `ACTIVITY_SYSTEM_QUICK_START.md`

### Context
When facing complex integration issues with unknown root causes, especially involving multiple system layers (OpenCode → MCP → Backend).

### Pattern Description

**Steps:**
1. **Add comprehensive logging at each integration point**
   - Log function entry/exit
   - Log all data transformations
   - Log field name mappings
   - Use file-based logging when framework issues prevent standard logging

2. **Test and restart incrementally**
   - Fix one issue per iteration
   - Verify fix with execution
   - Move to next issue
   - Track progress (e.g., "16 restarts to fix 8 bugs = 2 per bug")

3. **Document each bug with**
   - Location (file, line number)
   - Root cause
   - Fix applied
   - Impact assessment

4. **Categorize bugs by type**
   - Field name mismatches (snake_case vs camelCase)
   - Missing fields
   - Wrong response format
   - Type mismatches

### Success Metrics
- 100% success rate after systematic elimination
- Clear documentation trail
- Reproducible fixes

### Example
```typescript
// Before: Silent failure
const result = await someFunction()

// After: Comprehensive logging
log.debug("CALLING someFunction", { input })
const result = await someFunction()
log.debug("someFunction RESPONSE", { 
  success: result.success,
  fieldCount: Object.keys(result).length 
})
```

### When to Use
- Integration issues between multiple systems
- Intermittent failures with unclear root cause
- Legacy code with poor documentation
- Cross-language boundary issues (Python ↔ TypeScript)

---

## Pattern 2: Multi-Agent Coordination Pattern

### Source
- `repos/metabob-opencode/packages/opencode/examples/acp-multi-agent-workflow.md`
- `repos/metabob-opencode/packages/opencode/examples/acp-basic-usage.md`

### Context
Implementing features that span multiple domains (backend, frontend, testing) with isolated agent environments.

### Pattern Description

**Architecture:**
```
Orchestrator Agent
    ├─> Backend Agent (isolated container)
    ├─> Frontend Agent (isolated container)
    └─> Test Agent (isolated container)
         └─> Coordination via Metabob annotations
```

**Steps:**

1. **Create Shared Design Context**
   ```typescript
   impulse_create({
     id: "featureDesign",
     pointer: {
       type: "memo",
       content: "Feature specification with API contracts, requirements, constraints"
     },
     budget: 3000
   })
   ```

2. **Delegate to Specialized Agents with Impulse Sharing**
   ```typescript
   const [backend, frontend, test] = await Promise.all([
     acp_delegate({
       target: "docker://devbob-backend-agent",
       taskDescription: "Implement API endpoints",
       prompt: "Implement per design. Annotate with MESSAGE_FOR:frontend.",
       shareImpulses: ["featureDesign"],
       timeout: 300
     }),
     acp_delegate({
       target: "docker://devbob-frontend-agent",
       taskDescription: "Implement UI",
       prompt: "Check Metabob for MESSAGE_FOR:frontend annotations.",
       shareImpulses: ["featureDesign"],
       timeout: 300
     }),
     acp_delegate({
       target: "docker://devbob-test-agent",
       taskDescription: "E2E tests",
       prompt: "Check Metabob for MESSAGE_FOR:test annotations.",
       shareImpulses: ["featureDesign"],
       timeout: 300
     })
   ])
   ```

3. **Async Coordination via Metabob Annotations**
   - Backend agent documents API contracts: `MESSAGE_FOR:frontend`
   - Backend agent lists test cases: `MESSAGE_FOR:test`
   - Frontend/test agents discover these automatically via Metabob

4. **Verify Outcomes**
   ```typescript
   if (backend.success && frontend.success && test.success) {
     console.log("Feature complete!")
   }
   ```

### Success Metrics
- Parallel execution (3x faster than sequential)
- No direct agent-to-agent communication needed
- Self-documenting via annotations
- Isolated failures don't cascade

### Benefits
✅ **Isolation** - Each agent in own container  
✅ **Scalability** - Parallel execution  
✅ **Context Sharing** - Impulses pass design decisions  
✅ **Async Coordination** - Metabob MESSAGE_FOR pattern  
✅ **Traceability** - All work tracked via annotations  

### When to Use
- Full-stack feature implementation
- Cross-domain refactoring
- Large features requiring specialized expertise
- Parallel development workflows

---

## Pattern 3: Activity Execution Pattern

### Source
- `FINAL_COMPREHENSIVE_TEST_FEB12.md`
- `ARCHITECTURE_ALIGNMENT_PLAN.md`

### Context
Executing predefined workflows with variable substitution, cost tracking, and outcome recording.

### Pattern Description

**Architecture:**
```
OpenCode CLI Tool
    ↓ (MCP)
metabob-cli (Field Mapping Layer)
    ↓ (HTTP API)
metabob-rpc-api (Backend - Proto Schema)
    ↓
SurrealDB (Template Storage)
```

**Template Structure:**
```json
{
  "id": "activity-id",
  "name": "Human-readable name",
  "category": "feature|bugfix|refactor|infrastructure",
  "tasks": [
    {
      "id": "task-1",
      "description": "What this task does",
      "prompt": {
        "template": "Instructions with {{variables}}"
      },
      "validation": {
        "success_criteria": "What makes this task successful"
      },
      "impulseReferences": ["design-doc-id"]
    }
  ],
  "variables": {
    "variableName": {
      "type": "string",
      "description": "What this variable represents",
      "required": true
    }
  }
}
```

**Execution Flow:**

1. **Discovery**
   ```typescript
   search_activities({ category: "feature" })
   // Returns: List of templates with success rates
   ```

2. **Execution**
   ```typescript
   activity({
     activityId: "feature-12345",
     variables: { targetFile: "auth.ts", method: "POST" },
     reason: "Add authentication endpoint"
   })
   ```

3. **Internal Steps**
   - Load template from backend (fresh variant selection)
   - Validate variables
   - Start execution (`startExecution` → execution_id)
   - Loop:
     - Get next step (`getNextStep`)
     - Execute step via TaskTool
     - Report result (`reportStepResult`)
   - Format output with metrics

4. **Outcome Recording**
   ```typescript
   // Backend records:
   {
     execution_id: "exec_abc",
     template_id: "feature-12345",
     success: true,
     duration_ms: 22100,
     cost_usd: 0.0004,
     tasks: [
       { id: "task-1", status: "completed", duration_ms: 7100 }
     ]
   }
   ```

### Success Metrics
- 100% task completion rate
- Accurate cost tracking (per task and total)
- Proper status reporting
- Variable interpolation working

### Key Principles
- **Backend as Source of Truth**: Always fetch fresh template
- **No Local Caching**: Backend selects optimal variant each time
- **Field Name Mapping**: Proto (snake_case) ↔ TypeScript (camelCase)
- **MCP Response Format**: All tools return `{status: "success", ...data}`

### When to Use
- Repeatable workflows (add endpoint, fix bug, refactor component)
- Cost-conscious development (avoid LLM reasoning from scratch)
- Data-driven optimization (track success rates, evolve templates)
- Multi-step procedures with dependencies

---

## Pattern 4: Architecture Alignment Pattern

### Source
- `ARCHITECTURE_ALIGNMENT_PLAN.md`
- `ACTIVITY_EXECUTION_COMPLETE_SUCCESS.md`

### Context
Maintaining consistency between backend schema (Proto/snake_case) and frontend consumption (TypeScript/camelCase) across MCP boundaries.

### Pattern Description

**Problem:**
```
Backend (Proto)        CLI (Mapping)         Frontend (TypeScript)
variant_id       →     id                →   template.id
variant_name     →     name              →   template.name
impulse_refs     →     impulseReferences →   task.impulseReferences
```

**Solution Architecture:**

1. **Backend: Single Source of Truth**
   - Use Proto schema exclusively
   - Return snake_case field names
   - Store execution outcomes

2. **CLI: Minimal Mapping Layer**
   ```python
   # In metabob-cli/mcp/activity_manager.py
   def _map_to_opencode_format(proto_template):
       return {
           "id": proto_template.variant_id,
           "name": proto_template.variant_name,
           "tasks": [
               {
                   **task,
                   "impulseReferences": task.get("impulse_refs", [])
               }
               for task in proto_template.task_steps
           ]
       }
   ```

3. **OpenCode: TypeScript Consumption**
   - Expect camelCase
   - Don't cache templates (always fresh from backend)
   - Trust mapped data

**MCP Tool Response Convention:**
```typescript
// ALL MCP tools must return:
{
  "status": "success",  // API call result
  ...actualData          // Tool-specific data
}

// OpenCode checks:
if (result.status !== "success") {
  throw new Error("Tool call failed")
}
```

### Success Metrics
- Zero field name conflicts
- Clean separation of concerns
- No data duplication
- Type safety maintained

### Anti-Patterns to Avoid
❌ Transform data at multiple layers  
❌ Cache transformed data locally  
❌ Duplicate schema definitions  
❌ Assume field names match across boundaries  

### When to Use
- Cross-language system integration
- Proto/gRPC → REST API bridges
- Backend-driven dynamic data (templates, configs)
- Schema evolution scenarios

---

## Pattern 5: Context Sharing Pattern

### Source
- `repos/metabob-opencode/packages/opencode/examples/acp-basic-usage.md`
- `repos/metabob-opencode/.opencode/agent/session.md`

### Context
Distributing design specifications, architectural decisions, and requirements across multiple agents without tight coupling.

### Pattern Description

**Impulse-Based Context Sharing:**

1. **Create Context Artifact**
   ```typescript
   impulse_create({
     id: "api-design",
     pointer: {
       type: "memo",
       content: `API Endpoint Design:
   
   POST /api/users
   Request: { name: string, email: string }
   Response: { id: string, user: User }
   
   Validation:
   - name: required, 2-50 chars
   - email: required, valid format
   
   Error Codes:
   - 400: Validation failed
   - 409: User already exists
   `
     },
     budget: 2000  // Token budget for this context
   })
   ```

2. **Share with Agents**
   ```typescript
   acp_delegate({
     target: "docker://agent-name",
     taskDescription: "Implement feature",
     prompt: "Implement per shared design specification",
     shareImpulses: ["api-design"],  // <-- Impulse injection
     timeout: 300
   })
   ```

3. **Agent Receives Context**
   ```typescript
   // Agent's system prompt receives:
   <shared_impulses>
   api-design: API Endpoint Design:
   POST /api/users
   Request: { name: string, email: string }
   ...
   </shared_impulses>
   ```

4. **Agent References Context**
   - Agent reads shared context
   - Implements per specification
   - No need to re-communicate design

**Session-Level Context Injection:**

```typescript
// In src/session/system.ts
async function injectExternalData(
  sessionID?: string,
  userIntent?: UserIntent,
  agentConfig?: Config
): Promise<InjectableContext> {
  
  // Check availability
  const available = await ExternalSystem.isAvailable()
  if (!available) {
    return { agentContext: [] }  // Graceful degradation
  }
  
  // Gather data
  const data = await ExternalSystem.getData({ sessionID })
  
  // Format for injection
  const lines = [
    "<external_system_context>",
    ...data.map(item => formatItem(item)),
    "</external_system_context>"
  ]
  
  return {
    agentContext: lines,
    userMessage: `[System] ${data.length} items`
  }
}
```

### Success Metrics
- Zero information loss across agent boundaries
- Reduced token usage (shared once, used many times)
- Agents stay aligned with design
- Traceable context provenance

### Context Types
- **Design Specifications**: API contracts, UI mockups, data schemas
- **Code Quality Data**: Metabob issues, annotations, dependencies
- **Session State**: Activity progress, task results, conversation history
- **External Systems**: LSP diagnostics, MCP tool lists, git status

### When to Use
- Multi-agent workflows
- Complex feature specifications
- Cross-domain coordination
- Shared architectural decisions

---

## Pattern 6: Outcome Recording and Evolution Pattern

### Source
- `ARCHITECTURE_ALIGNMENT_PLAN.md` (lines 180-250)

### Context
Learning from execution outcomes to improve template selection and evolution over time.

### Pattern Description

**Data Collection:**

1. **Record Execution Outcomes**
   ```typescript
   // After activity execution
   await MetabobCLI.recordOutcome({
     execution_id: "exec_abc",
     template_id: "add-rest-endpoint",
     variant_id: "variant-v3",
     success: true,
     duration_ms: 45000,
     cost_usd: 0.0012,
     context: {
       language: "typescript",
       project_type: "rest-api"
     }
   })
   ```

2. **Backend Aggregates Data**
   ```sql
   -- In SurrealDB
   SELECT 
     variant_id,
     count() as executions,
     sum(success) / count() as success_rate,
     avg(duration_ms) as avg_duration,
     avg(cost_usd) as avg_cost
   FROM executions
   WHERE template_id = "add-rest-endpoint"
   GROUP BY variant_id
   ```

3. **Variant Selection Algorithm**
   ```python
   def select_variant(template_id: str, context: dict) -> str:
       variants = get_variants(template_id)
       
       # Score each variant
       for variant in variants:
           stats = get_variant_stats(variant.id, context)
           
           # Composite score
           score = (
               stats.success_rate * 0.6 +      # 60% weight on success
               (1 - stats.cost_normalized) * 0.2 +  # 20% weight on cost
               (1 - stats.duration_normalized) * 0.2  # 20% weight on speed
           )
           
           # Exploration bonus (try new variants 5% of time)
           if variant.execution_count < 10:
               score += 0.05
               
           variant.score = score
       
       # Return highest scoring variant
       return max(variants, key=lambda v: v.score)
   ```

**Evolution Triggers:**

1. **Low Success Rate** (< 70%): Analyze failures, create improved variant
2. **High Cost** (> 2x median): Optimize prompts, reduce steps
3. **User Feedback**: Explicit improvement requests
4. **Context Patterns**: Variant performs poorly in specific contexts

**Creating New Variants:**

```typescript
// Triggered by evolution system or human
activity({
  activityId: "activity-evolve",
  variables: {
    templateId: "add-rest-endpoint",
    issueDescription: "Fails on Express.js projects",
    improvementPrompt: "Add Express-specific route handling"
  },
  reason: "Improve template for Express context"
})
```

### Success Metrics
- Increasing average success rate over time
- Decreasing average cost per execution
- Context-aware variant selection accuracy
- Phasing out low-performing variants

### Benefits
✅ **Self-Improving**: System gets better with use  
✅ **Cost Optimization**: Choose cheapest effective variant  
✅ **Context-Aware**: Right template for right situation  
✅ **Data-Driven**: Decisions based on evidence, not assumptions  

### When to Use
- Template library management
- Cost-conscious development
- Continuous improvement workflows
- A/B testing of prompts/procedures

---

## Pattern 7: Error Recovery and Graceful Degradation Pattern

### Source
- `repos/metabob-opencode/.opencode/agent/session.md` (lines 120-150)
- Various backend connectivity logs

### Context
Handling failures in external integrations without blocking primary workflow.

### Pattern Description

**Graceful Degradation Layers:**

1. **Availability Check**
   ```typescript
   async function isSystemAvailable(): Promise<boolean> {
     try {
       await system.ping({ timeout: 1000 })
       return true
     } catch {
       log.debug("system unavailable, degrading gracefully")
       return false
     }
   }
   ```

2. **Conditional Feature Activation**
   ```typescript
   async function injectSystemContext(sessionID: string) {
     // Check global config
     const config = await Config.get()
     if (!config.system?.auto_inject) {
       return { agentContext: [] }
     }
     
     // Check availability
     const available = await isSystemAvailable()
     if (!available) {
       log.info("system unavailable, skipping injection")
       return { agentContext: [] }
     }
     
     // Try to gather data
     try {
       const data = await system.getData({ sessionID })
       return { agentContext: formatData(data) }
     } catch (error) {
       log.error("failed to inject system context", { error })
       return { agentContext: [] }  // Don't block on failure
     }
   }
   ```

3. **Retry with Backoff**
   ```typescript
   async function executeWithRetry<T>(
     fn: () => Promise<T>,
     maxRetries = 3,
     backoffMs = 1000
   ): Promise<T> {
     let lastError: Error
     
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fn()
       } catch (error) {
         lastError = error
         log.warn(`attempt ${i + 1} failed, retrying...`, { error })
         await sleep(backoffMs * Math.pow(2, i))  // Exponential backoff
       }
     }
     
     throw new Error(`Failed after ${maxRetries} retries: ${lastError}`)
   }
   ```

4. **Fallback Strategies**
   ```typescript
   async function getTemplateData(id: string): Promise<Template> {
     // Try primary source (backend)
     try {
       return await backend.getTemplate(id)
     } catch (error) {
       log.warn("backend unavailable, trying cache", { error })
       
       // Try cache
       const cached = await cache.get(id)
       if (cached && !isStale(cached)) {
         return cached
       }
       
       // Try embedded defaults
       const embedded = embeddedTemplates[id]
       if (embedded) {
         log.info("using embedded template")
         return embedded
       }
       
       throw new Error(`Template ${id} unavailable from all sources`)
     }
   }
   ```

### Success Metrics
- Primary workflow completes despite subsystem failures
- Clear logging of degradation events
- User not blocked by temporary issues
- Graceful recovery when system returns

### Degradation Levels
1. **Full Functionality**: All systems available
2. **Degraded**: Some features disabled, core works
3. **Minimal**: Only essential features, no enhancements
4. **Failure**: Clear error message, suggested recovery

### When to Use
- External service integrations (MCP, LSP, APIs)
- Network-dependent features
- Optional enhancements (code quality checks, suggestions)
- Resource-constrained environments

---

## Pattern 8: File-Based Logging for Framework Debugging Pattern

### Source
- `ACTIVITY_EXECUTION_COMPLETE_SUCCESS.md` (lines 340-365)

### Context
When standard logging framework is unavailable, unreliable, or gets consumed by the system before you can inspect it.

### Pattern Description

**Implementation:**

```typescript
// In src/tool/activity.ts (or any file needing debugging)
import { appendFileSync } from "fs"

const DEBUG_LOG = "/tmp/activity-debug.log"

function debugLog(message: string, data?: any) {
  const timestamp = new Date().toISOString()
  const line = `${timestamp} | ${message}${data ? " | " + JSON.stringify(data) : ""}\n`
  
  try {
    appendFileSync(DEBUG_LOG, line)
  } catch {
    // Silently fail - don't break execution if logging fails
  }
}

// Usage throughout code
export async function executeActivity(options: ActivityOptions) {
  debugLog("ACTIVITY TOOL ENTRY", { activityId: options.activityId })
  
  const template = await loadTemplate(options.activityId)
  debugLog("TEMPLATE LOADED", { 
    found: !!template,
    id: template?.id,
    taskCount: template?.tasks?.length 
  })
  
  // ... execution continues
}
```

**Log Analysis:**

```bash
# Watch live
tail -f /tmp/activity-debug.log

# Search for errors
grep ERROR /tmp/activity-debug.log

# Find specific execution
grep "execution_id=exec_abc" /tmp/activity-debug.log

# Trace a call chain
grep "CALLING\|COMPLETED" /tmp/activity-debug.log
```

**Structured Tracing:**

```typescript
function createTracer(traceId: string) {
  return {
    event(name: string, data?: any) {
      debugLog("EVENT", {
        trace_id: traceId,
        event: name,
        timestamp: Date.now(),
        ...data
      })
    },
    
    span(name: string) {
      const start = Date.now()
      return {
        end(data?: any) {
          const duration = Date.now() - start
          debugLog("SPAN", {
            trace_id: traceId,
            span: name,
            duration_ms: duration,
            ...data
          })
        }
      }
    }
  }
}

// Usage
const trace = createTracer("activity-exec-123")
trace.event("execution_started", { activityId: "abc" })

const span = trace.span("template_loading")
const template = await loadTemplate()
span.end({ templateId: template.id })
```

### Success Metrics
- 100% visibility into execution flow
- Bypass framework logging issues
- Grep-able, parseable logs
- Minimal performance impact

### When to Use
- Framework logging is consumed/hidden
- Need to debug through system boundaries
- Investigating intermittent issues
- Production debugging (with caution)

### Best Practices
- Use temp file paths (`/tmp` or project-local)
- Fail silently if logging errors occur
- Clean up or rotate logs periodically
- Remove before production if not needed
- Use structured format (JSON) for parsing

---

## Cross-Pattern Synergies

### Synergy 1: Activity Execution + Outcome Recording
- Execute activities with Pattern 3
- Record outcomes with Pattern 6
- System learns and improves over time

### Synergy 2: Multi-Agent + Context Sharing
- Coordinate agents with Pattern 2
- Share context via impulses (Pattern 5)
- Async communication via Metabob annotations

### Synergy 3: Architecture Alignment + Debugging
- Maintain clean architecture with Pattern 4
- Debug integration issues with Pattern 1
- Use file logging (Pattern 8) when framework fails

### Synergy 4: Error Recovery + Context Sharing
- Graceful degradation (Pattern 7) for external systems
- Context injection continues with partial data
- Activity execution proceeds with available tools

---

## Implementation Checklist

### For New Agent Development
- [ ] Implement systematic debugging pattern (Pattern 1)
- [ ] Add file-based logging for observability (Pattern 8)
- [ ] Support impulse-based context sharing (Pattern 5)
- [ ] Implement graceful degradation (Pattern 7)
- [ ] Record execution outcomes if applicable (Pattern 6)

### For Multi-Agent Workflows
- [ ] Design shared context artifacts (Pattern 5)
- [ ] Use ACP delegation (Pattern 2)
- [ ] Implement MESSAGE_FOR annotations for discovery
- [ ] Verify isolation (containers/environments)
- [ ] Add parallel execution where independent

### For Activity Templates
- [ ] Follow execution pattern (Pattern 3)
- [ ] Define clear variable schema
- [ ] Add validation criteria
- [ ] Support outcome recording (Pattern 6)
- [ ] Design for evolution (multiple variants)

### For System Integration
- [ ] Apply architecture alignment (Pattern 4)
- [ ] Map field names at boundary
- [ ] Backend as source of truth
- [ ] Implement graceful degradation (Pattern 7)
- [ ] Add availability checks

---

## Metrics for Pattern Success

### Debugging Efficiency (Pattern 1)
- **Time to Root Cause**: < 1 hour with systematic logging
- **Fix Rate**: 2 restarts per bug (vs unlimited with ad-hoc)
- **Documentation**: 100% of bugs documented with location + fix

### Multi-Agent Throughput (Pattern 2)
- **Speedup**: 3x (parallel vs sequential)
- **Success Rate**: Same as single-agent (isolation prevents cascade)
- **Coordination Overhead**: < 5% (via annotations, not messages)

### Activity Reliability (Pattern 3)
- **Completion Rate**: > 95% for proven templates
- **Cost Accuracy**: ± 10% of estimated
- **Execution Time**: Predictable (±20% variance)

### Evolution Effectiveness (Pattern 6)
- **Success Rate Trend**: Increasing 5-10% per quarter
- **Cost Reduction**: 10-20% via variant optimization
- **Context Accuracy**: 80%+ match rate (right variant for right context)

---

## Future Pattern Opportunities

### Pattern: Progressive Disclosure
- Start with minimal context
- Request additional context as needed
- Reduce token usage for simple tasks

### Pattern: Template Composition
- Small, composable activity templates
- Build complex workflows from primitives
- Reuse across multiple high-level activities

### Pattern: Predictive Variant Selection
- ML model predicts best variant
- Consider historical context beyond current execution
- User-specific variant preferences

### Pattern: Cross-Repository Learning
- Share outcome data across projects
- Generalize patterns beyond single codebase
- Community-driven template evolution

---

## Conclusion

These patterns represent proven interaction strategies extracted from successful executions in the metabob-devbob system. They demonstrate:

1. **Systematic Problem-Solving**: Incremental debugging with comprehensive logging
2. **Scalable Coordination**: Multi-agent workflows without tight coupling
3. **Reliable Automation**: Activity templates with outcome tracking
4. **Clean Architecture**: Backend-driven with minimal mapping layers
5. **Efficient Communication**: Context sharing via impulses and annotations
6. **Continuous Improvement**: Data-driven template evolution
7. **Resilient Design**: Graceful degradation when subsystems fail
8. **Observable Systems**: File-based logging when framework fails

### Recommended Adoption Order

1. **Start**: Pattern 1 (Systematic Debugging) + Pattern 8 (File Logging)
2. **Build**: Pattern 3 (Activity Execution) + Pattern 4 (Architecture Alignment)
3. **Scale**: Pattern 2 (Multi-Agent) + Pattern 5 (Context Sharing)
4. **Optimize**: Pattern 6 (Outcome Recording) + Pattern 7 (Error Recovery)

### Success Indicators
- Faster feature development (templates vs from-scratch)
- Lower LLM costs (reusable patterns vs repeated reasoning)
- Higher success rates (proven procedures vs trial-and-error)
- Better observability (systematic logging vs blind debugging)

---

**Document Status**: Complete  
**Last Updated**: February 12, 2026  
**Version**: 1.0
