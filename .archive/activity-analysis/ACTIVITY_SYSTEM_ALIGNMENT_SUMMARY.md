# Activity System Alignment Summary

**Date**: February 6, 2026  
**Status**: ✅ Analysis Complete, Ready for Implementation

## What We Accomplished

### 1. ✅ Analyzed Current State

**Identified 3 Different Template Formats**:
- **OpenCode Format** (metabob-opencode): Modern, execution-rich, Zod-validated
- **Proto Bootstrap Format** (metabob-proto): Storage-friendly, proto-aligned
- **Custom Hybrid Format** (root templates/): Mixing both approaches

**Result**: [ACTIVITY_TEMPLATE_FORMAT_ANALYSIS.md](./ACTIVITY_TEMPLATE_FORMAT_ANALYSIS.md)

### 2. ✅ Clarified Application Goals

**Documented clear separation of concerns** for each repository:

| Application | Purpose | Responsibility |
|-------------|---------|----------------|
| **metabob-opencode** | Execution Engine | Parse, validate, and execute activity templates |
| **metabob-cli** | Tool Provider | MCP server for code analysis tools |
| **metabob-rpc-api** | Backend Service | Store variants, process jobs, LLM inference |
| **metabob-proto** | Data Models | Proto definitions, codegen, schema generation |

**Result**: [ARCHITECTURE_SEPARATION_OF_CONCERNS.md](./ARCHITECTURE_SEPARATION_OF_CONCERNS.md)

### 3. ✅ Defined Unified Format Strategy

**Proposed Approach**: Proto-based with OpenCode extensions

**Key Design Decisions**:
1. ✓ Proto defines storage schema (single source of truth)
2. ✓ OpenCode adds execution metadata via extensions
3. ✓ Conversion utilities for backward compatibility
4. ✓ Validation logic stays in OpenCode (not proto)

**Enhancement**: Add `TaskExecutionExtensions` to proto for:
- Task dependencies
- Agent assignment
- Validation rules (as JSON)
- Retry strategies (as JSON)
- Impulse references

## Critical Findings

### Format Incompatibilities

**Structural Differences**:
```
OpenCode:     tasks[].id          Proto:    task_steps[].step_id
OpenCode:     tasks[].subagent    Proto:    (not present)
OpenCode:     tasks[].dependencies Proto:    (not present)
OpenCode:     tasks[].validation  Proto:    (not present)
OpenCode:     tasks[].retry       Proto:    (not present)
```

**Impact**: Cannot directly execute proto templates without conversion

### Execution vs Storage Split

**Execution** (OpenCode-only):
- Context requirements
- Task dependency graphs
- Validation rules
- Retry strategies
- Learning feedback points
- Composition examples

**Storage** (Proto-friendly):
- Activity variant ID
- Task steps (basic structure)
- Variables
- Performance estimates
- Status
- Hooks

**Solution**: Store proto-aligned core + OpenCode extensions as JSON blobs

## Recommended Implementation Path

### Phase 1: Proto Enhancement (Week 1)
```protobuf
// Add to proto/metabob/activity/variant.proto

message TaskExecutionExtensions {
  repeated string dependencies = 1;
  string subagent = 2;
  string prompt_template = 3;
  int64 max_tokens = 4;
  string validation_json = 5;  // JSON-encoded ValidationConfig
  string retry_json = 6;        // JSON-encoded RetryConfig
  repeated string impulse_references = 7;
}

message TaskStep {
  // ... existing fields ...
  TaskExecutionExtensions extensions = 6;
}

message ActivityTemplate {
  // ... existing fields ...
  string context_requirements_json = 16;  // JSON-encoded ContextRequirements[]
  string learning_config_json = 17;       // JSON-encoded LearningConfig
  string composition_config_json = 18;    // JSON-encoded CompositionConfig
}
```

**Action Items**:
- [ ] Update proto definitions
- [ ] Run protoc codegen (TypeScript + Python)
- [ ] Update SurrealDB schema
- [ ] Test proto serialization

### Phase 2: Conversion Utilities (Week 2)

**Create converters** in metabob-opencode:
```typescript
// src/activity/converters/proto-to-opencode.ts
export function protoToOpenCode(
  protoVariant: ActivityVariant
): OpenCodeActivityTemplate {
  return {
    id: protoVariant.variantId,
    name: protoVariant.variantName,
    tasks: protoVariant.taskSteps.map(step => ({
      id: step.stepId,
      subagent: step.extensions?.subagent || "general",
      dependencies: step.extensions?.dependencies || [],
      validation: JSON.parse(step.extensions?.validationJson || "{}"),
      retry: JSON.parse(step.extensions?.retryJson || "{}"),
      prompt: {
        template: step.extensions?.promptTemplate || step.description,
        maxTokens: step.extensions?.maxTokens || 8000,
      }
    })),
    contextRequirements: JSON.parse(
      protoVariant.contextRequirementsJson || "[]"
    ),
    learning: JSON.parse(protoVariant.learningConfigJson || "{}"),
    // ... etc
  }
}

// src/activity/converters/opencode-to-proto.ts
export function openCodeToProto(
  template: OpenCodeActivityTemplate
): ActivityVariant {
  return {
    variantId: template.id,
    variantName: template.name,
    taskSteps: template.tasks.map(task => ({
      stepId: task.id,
      title: task.description,
      description: task.prompt.template,
      tools: extractToolsFromPrompt(task.prompt.template),
      guidance: extractGuidance(task),
      extensions: {
        dependencies: task.dependencies,
        subagent: task.subagent,
        promptTemplate: task.prompt.template,
        maxTokens: task.prompt.maxTokens,
        validationJson: JSON.stringify(task.validation),
        retryJson: JSON.stringify(task.retry),
        impulseReferences: task.impulseReferences
      }
    })),
    contextRequirementsJson: JSON.stringify(template.contextRequirements),
    learningConfigJson: JSON.stringify(template.learning),
    // ... etc
  }
}
```

**Action Items**:
- [ ] Implement proto-to-opencode converter
- [ ] Implement opencode-to-proto converter
- [ ] Write round-trip tests
- [ ] Validate all conversions

### Phase 3: Template Migration (Week 3)

**Migrate bootstrap templates** in metabob-proto:
```bash
# Script to convert all bootstrap templates
cd repos/metabob-proto/activities/bootstrap/

# Convert each template
for template in *.json; do
  # Add extensions to task_steps
  # Add context_requirements_json
  # Add learning_config_json
  # Validate against new schema
done
```

**Migrate OpenCode templates**:
```bash
cd repos/metabob-opencode/packages/opencode/templates/built-in/

# Convert to unified format
for template in *.json; do
  # Extract proto-compatible core
  # Move execution metadata to extensions
  # Validate against schema
done
```

**Action Items**:
- [ ] Create migration script
- [ ] Migrate 9 bootstrap templates
- [ ] Migrate OpenCode built-in template
- [ ] Validate all migrated templates

### Phase 4: Executor Updates (Week 4)

**Update OpenCode executor** to support both formats:
```typescript
// src/activity/template-loader.ts
export async function loadTemplate(
  templateId: string
): Promise<OpenCodeActivityTemplate> {
  const raw = await loadRawTemplate(templateId)
  
  // Detect format
  if (isProtoFormat(raw)) {
    return protoToOpenCode(raw)
  } else if (isOpenCodeFormat(raw)) {
    return raw
  } else if (isLegacyFormat(raw)) {
    // Backward compatibility
    return migrateLegacyFormat(raw)
  }
  
  throw new Error(`Unknown template format: ${templateId}`)
}

function isProtoFormat(template: any): boolean {
  return "variant_id" in template && "task_steps" in template
}

function isOpenCodeFormat(template: any): boolean {
  return "id" in template && "tasks" in template
}
```

**Action Items**:
- [ ] Add format detection
- [ ] Add auto-conversion on load
- [ ] Test execution with both formats
- [ ] Update documentation

## Testing Strategy

### Unit Tests
```typescript
describe("Template Conversion", () => {
  it("converts proto to OpenCode", () => {
    const proto = loadProtoTemplate("bug-fix-v1")
    const openCode = protoToOpenCode(proto)
    
    expect(openCode.id).toBe(proto.variantId)
    expect(openCode.tasks).toHaveLength(proto.taskSteps.length)
    // ... more assertions
  })
  
  it("converts OpenCode to proto", () => {
    const openCode = loadOpenCodeTemplate("create-activity-template")
    const proto = openCodeToProto(openCode)
    
    expect(proto.variantId).toBe(openCode.id)
    expect(proto.taskSteps).toHaveLength(openCode.tasks.length)
    // ... more assertions
  })
  
  it("round-trips without data loss", () => {
    const original = loadOpenCodeTemplate("bug-fix-complete")
    const proto = openCodeToProto(original)
    const converted = protoToOpenCode(proto)
    
    expect(converted).toEqual(original)
  })
})
```

### Integration Tests
```typescript
describe("Template Execution", () => {
  it("executes proto-format template", async () => {
    const result = await executeActivity({
      templateId: "bug-fix-v1",  // Proto format
      variables: { bugDescription: "test" }
    })
    
    expect(result.status).toBe("completed")
  })
  
  it("executes OpenCode-format template", async () => {
    const result = await executeActivity({
      templateId: "create-activity-template",  // OpenCode format
      variables: { templateName: "test" }
    })
    
    expect(result.status).toBe("completed")
  })
})
```

### End-to-End Tests
```bash
# Test full workflow with unified format
opencode activity run bug-fix-complete --var bugDescription="test"

# Verify template registration
opencode activity register ./new-template.json

# Verify cross-repo execution
opencode activity run add-full-stack-feature \
  --var featureName="Export Users" \
  --var method="GET"
```

## API Contract Changes

### POST /activity/register

**Before**:
```json
{
  "name": "Bug Fix Complete",
  "tasks": [...]
}
```

**After** (accepts both formats):
```json
// OpenCode format (auto-converted)
{
  "id": "bug-fix-complete",
  "name": "Bug Fix Complete", 
  "tasks": [...]
}

// OR proto format (stored directly)
{
  "variant_id": "bug-fix-v1",
  "variant_name": "v1-baseline",
  "task_steps": [...]
}
```

**Backend handling**:
```python
@app.post("/activity/register")
async def register_activity(request: dict):
    # Detect format
    if "variant_id" in request:
        # Proto format - validate and store
        variant = ActivityVariant(**request)
    else:
        # OpenCode format - convert to proto
        variant = convert_opencode_to_proto(request)
    
    # Store in SurrealDB
    await db.create("activity_variants", variant.dict())
    
    return {"status": "registered", "variant_id": variant.variant_id}
```

## Documentation Updates Needed

### For Users
- [ ] Update activity template authoring guide
- [ ] Add format comparison examples
- [ ] Document migration from old to new format
- [ ] Create video tutorial

### For Developers
- [ ] Update proto schema documentation
- [ ] Document conversion utilities API
- [ ] Add architecture diagrams
- [ ] Update contribution guide

## Rollout Plan

### Week 1: Internal Testing
- Deploy to devbob containers
- Test with bootstrap templates
- Validate conversion utilities

### Week 2: Gradual Rollout
- Release to staging environment
- Monitor conversion errors
- Fix any edge cases

### Week 3: Production Migration
- Migrate all templates in production
- Update documentation
- Announce changes to users

### Week 4: Cleanup
- Remove legacy format support
- Archive old templates
- Deprecation warnings

## Success Criteria

✅ All 3 format incompatibilities resolved  
✅ Single source of truth: metabob-proto  
✅ Execution richness preserved in OpenCode  
✅ All applications use unified format  
✅ Backward compatibility maintained  
✅ Round-trip conversion validated  
✅ All tests passing  
✅ Documentation complete  

## Current Status

| Task | Status | Owner | Due Date |
|------|--------|-------|----------|
| Format analysis | ✅ Complete | Activity Mode | Feb 6 |
| Architecture docs | ✅ Complete | Activity Mode | Feb 6 |
| Proto enhancement design | ✅ Complete | Activity Mode | Feb 6 |
| Proto implementation | ⏳ Pending | - | Week 1 |
| Conversion utilities | ⏳ Pending | - | Week 2 |
| Template migration | ⏳ Pending | - | Week 3 |
| Executor updates | ⏳ Pending | - | Week 4 |
| Testing | ⏳ Pending | - | Week 4 |

## Next Actions

**Immediate** (Today):
1. Review analysis documents with team
2. Approve proto enhancement approach
3. Create implementation tickets

**This Week** (Week 1):
1. Update proto definitions
2. Run codegen
3. Update SurrealDB schema
4. Start conversion utilities

**Next Steps** (Weeks 2-4):
1. Implement converters
2. Migrate templates
3. Update executors
4. Test and validate
5. Documentation
6. Rollout

## Files Created

1. ✅ [ACTIVITY_TEMPLATE_FORMAT_ANALYSIS.md](./ACTIVITY_TEMPLATE_FORMAT_ANALYSIS.md)
   - Detailed format comparison
   - Incompatibility analysis
   - Unified format proposal

2. ✅ [ARCHITECTURE_SEPARATION_OF_CONCERNS.md](./ARCHITECTURE_SEPARATION_OF_CONCERNS.md)
   - Application responsibilities
   - Protocol boundaries
   - Execution flow
   - Data model alignment

3. ✅ [ACTIVITY_SYSTEM_ALIGNMENT_SUMMARY.md](./ACTIVITY_SYSTEM_ALIGNMENT_SUMMARY.md) (this file)
   - Executive summary
   - Implementation roadmap
   - Testing strategy
   - Rollout plan

## References

- Proto definitions: `repos/metabob-proto/proto/metabob/activity/`
- OpenCode templates: `repos/metabob-opencode/packages/opencode/templates/built-in/`
- Bootstrap templates: `repos/metabob-proto/activities/bootstrap/`
- Cross-repo design: `repos/metabob-opencode/packages/opencode/.design/cross-repo-activity-system.md`

---

**Ready for implementation** ✅

