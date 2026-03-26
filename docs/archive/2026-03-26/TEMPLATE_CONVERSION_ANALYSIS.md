# Activity Template Conversion Analysis

**Date:** 2026-03-04  
**Issue:** Need to eliminate klugey client-side conversions and provide extensible, well-formed core templates

## Executive Summary

✅ **Good News:** The system has a clean adapter pattern via `ActivitySchemaAdapter`  
⚠️ **Issue Found:** Duplication and inconsistency in conversion logic between bootstrap templates and MCP templates  
🎯 **Recommendation:** Unify on ActivitySchemaAdapter as single source of truth for all conversions

---

## Current Architecture

### Data Flow

```
┌─────────────────────┐
│ Metabob Backend     │
│ (Proto/MCP Format)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│ MetabobCLI.getActivity()        │
│ - Calls MCP tool "activity"     │
│ - Receives MetabobTemplate      │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ ActivitySchemaAdapter           │
│ - toCanonical()                 │
│ - Converts to OpenCodeTemplate  │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ ActivityTemplate.Schema         │
│ (OpenCode Canonical Format)     │
└─────────────────────────────────┘
```

### Parallel Path for Bootstrap Templates

```
┌─────────────────────┐
│ Embedded JSON       │
│ (Proto Format)      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│ BootstrapTemplates              │
│ - convertProtoToSchema()        │
│ - DUPLICATE conversion logic    │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ ActivityTemplate.Schema         │
│ (OpenCode Canonical Format)     │
└─────────────────────────────────┘
```

---

## Conversion Points Audit

### 1. ActivitySchemaAdapter (Primary Converter)

**File:** `repos/metabob-opencode/packages/opencode/src/session/activity-schema-adapter.ts`

**Functions:**
- `toCanonical(metabob: MetabobTemplate): OpenCodeTemplate`
  - Converts Metabob MCP format → OpenCode format
  - Handles field aliasing: `activity_id` → `id`, `task_id` → `id`
  - Supports both `tasks` and `task_steps` field names
  - Provides defaults for missing fields (integration, metabob, avgTokens)
  - Generates version and genealogy metadata

- `fromCanonical(opencode: OpenCodeTemplate): MetabobTemplate`
  - Converts OpenCode format → Metabob format (for registration)
  - Converts timestamps: `number` → ISO string
  - Maps fields: `id` → `activity_id`
  - **Critical:** Used when registering templates with backend

- `normalizeTask(metabobTask: MetabobTask): OpenCodeTask`
  - Task-level conversion
  - Handles `task_id` aliasing
  - Normalizes validation patterns
  - Provides sensible defaults

**Key Design:**
- Bidirectional conversion
- Handles multiple format variations
- Well-documented

### 2. BootstrapTemplates.convertProtoToSchema (DUPLICATE)

**File:** `repos/metabob-opencode/packages/opencode/src/session/bootstrap-templates.ts`

**Function:**
- `convertProtoToSchema(protoJson: any): ActivityTemplate.Schema`
  - Converts proto JSON → ActivityTemplate.Schema
  - **DUPLICATES logic from ActivitySchemaAdapter**
  - Handles both `activity_id` OR `id` (defensive coding)
  - Handles both `task_id` OR `id` (defensive coding)
  - Validates structure before conversion

**Why it exists:**
- Bootstrap templates are embedded in binary (import from JSON)
- Proto format uses snake_case consistently
- Needs validation to catch malformed embedded data

**Problem:**
- Duplicates conversion logic
- Two places to maintain
- Inconsistent if they diverge

### 3. MetabobCLI.getActivity (Conversion Usage)

**File:** `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:746`

```typescript
export async function getActivity(activityId: string): Promise<ActivityTemplate.Schema | undefined> {
  const result = await callMCPTool<{
    status: string
    template?: ActivitySchemaAdapter.MetabobTemplate
    activity?: ActivitySchemaAdapter.MetabobTemplate
    error?: string
  }>("activity", { activity_id: activityId })

  const template = result.template || result.activity  // Field aliasing
  const localTemplate = ActivitySchemaAdapter.toCanonical(template)  // ✅ Uses adapter
  return localTemplate
}
```

**Good:**
- Uses ActivitySchemaAdapter consistently
- Handles both `template` and `activity` field names from backend

**Defensive coding:**
- `result.template || result.activity` suggests backend format isn't stable

### 4. MetabobCLI.registerActivityTemplate (Reverse Conversion)

**File:** `repos/metabob-opencode/packages/opencode/src/util/metabob.ts:793`

```typescript
export async function registerActivityTemplate(template: ActivityTemplate.Schema): Promise<boolean> {
  const metabobTemplate = ActivitySchemaAdapter.fromCanonical(template)  // Convert back
  
  const result = await callMCPTool("metabob_register_activity_template", {
    template: metabobTemplate  // Send Metabob format
  })
  
  return result?.status === "success"
}
```

**Round-trip conversion:**
1. Client has OpenCode format (ActivityTemplate.Schema)
2. Converts to Metabob format (fromCanonical)
3. Sends to backend
4. Backend stores/processes
5. Future retrieval converts back (toCanonical)

**Risk:**
- Information loss if schemas aren't perfectly symmetric
- Conversion bugs can corrupt data
- Backend may return slightly different format than it received

---

## Issues Identified

### Issue 1: Conversion Logic Duplication

**Problem:**
- `ActivitySchemaAdapter.toCanonical()` - 150 lines
- `BootstrapTemplates.convertProtoToSchema()` - 140 lines
- **~70% code overlap**

**Consequences:**
- Bug fixes need to be applied twice
- Inconsistent behavior if they diverge
- Harder to maintain

**Example of defensive coding indicating format instability:**
```typescript
// From BootstrapTemplates
id: task.task_id || task.id,  // Why support both?
subagent: task.subagent || task.agent  // Why two field names?

// From MetabobCLI
const template = result.template || result.activity  // Why two field names?
```

### Issue 2: Format Instability

**Evidence:**
1. Bootstrap templates support BOTH proto field names AND schema field names
2. MCP results checked for BOTH `template` AND `activity` fields
3. Tasks support BOTH `task_id` AND `id`
4. Tasks support BOTH `task_steps` AND `tasks` arrays

**Root cause:**
- Backend format not standardized
- Multiple producers of templates (proto, MCP, manual)
- Defensive coding to handle all variations

### Issue 3: Round-Trip Conversion Risk

**Current flow:**
```
OpenCode format → fromCanonical() → Metabob format → Backend
Backend → toCanonical() → OpenCode format
```

**Risks:**
- Field mapping isn't perfectly symmetric
- `toCanonical()` generates new version/genealogy data
- `avgTokens` field defaults to zeros (information loss)
- `contextRequirements` array cleared (information loss)

**Example information loss:**
```typescript
// fromCanonical() sends to backend:
avgTokens: { input: 0, output: 0, cache: 0 }  // Always zeros

// toCanonical() receives from backend:
avgTokens: { input: 0, output: 0, cache: 0 }  // Gets back zeros
```

---

## Recommendations

### Option A: Unify on ActivitySchemaAdapter (Recommended)

**Approach:**
1. Extend ActivitySchemaAdapter to handle proto format
2. Make it the single source of truth for ALL conversions
3. Update BootstrapTemplates to delegate to adapter

**Implementation:**

```typescript
// activity-schema-adapter.ts

/**
 * Unified proto format converter.
 * Handles both proto JSON (snake_case) and MCP format (mixed).
 */
export function fromProtoOrMCP(input: any): OpenCodeTemplate {
  // Detect format variant
  const hasTaskSteps = 'task_steps' in input
  const hasTasks = 'tasks' in input
  const hasActivityId = 'activity_id' in input
  const hasId = 'id' in input
  
  // Normalize to common intermediate format
  const normalized = {
    id: hasActivityId ? input.activity_id : input.id,
    name: input.name,
    description: input.description,
    category: input.category,
    tasks: hasTaskSteps ? input.task_steps : input.tasks,
    // ... rest of normalization
  }
  
  // Convert to canonical OpenCode format
  return toCanonical(normalized)
}

// bootstrap-templates.ts
function convertProtoToSchema(protoJson: any): ActivityTemplate.Schema {
  validateProtoStructure(protoJson)  // Keep validation
  return ActivitySchemaAdapter.fromProtoOrMCP(protoJson)  // Delegate conversion
}
```

**Benefits:**
- ✅ Single conversion logic
- ✅ Easier to maintain
- ✅ Consistent behavior
- ✅ Less code duplication
- ✅ Extensible to new format variants

**Migration effort:** Low (2-3 hours)

### Option B: Standardize Backend Format

**Approach:**
1. Backend returns ActivityTemplate.Schema directly (OpenCode canonical format)
2. Eliminate client-side conversions entirely
3. Backend owns schema evolution

**Benefits:**
- ✅ Zero client-side conversions
- ✅ Backend controls format
- ✅ Simpler client code

**Trade-offs:**
- ❌ Backend coupled to OpenCode schema
- ❌ Less flexibility for backend evolution
- ❌ Requires backend changes

**Migration effort:** High (backend changes + testing)

### Option C: Hybrid Approach (Best Long-Term)

**Approach:**
1. Backend returns **well-formed, standardized** proto format
2. ActivitySchemaAdapter handles ALL proto → canonical conversions
3. Remove all field aliasing hacks (`task_id || id`)
4. Make adapter extensible via plugins for new format variants

**Benefits:**
- ✅ Backend format flexibility
- ✅ Clean client-side adapter pattern
- ✅ Extensible architecture
- ✅ No round-trip information loss

**Implementation:**

```typescript
// 1. Backend standardizes on proto format (snake_case, consistent field names)
// 2. Remove defensive coding
const localTemplate = ActivitySchemaAdapter.fromProto(template)  // No field aliasing

// 3. Make adapter plugin-based
ActivitySchemaAdapter.registerFormatPlugin('proto-v1', protoConverter)
ActivitySchemaAdapter.registerFormatPlugin('mcp-v1', mcpConverter)

const template = ActivitySchemaAdapter.convert(input, { detectFormat: true })
```

**Migration effort:** Medium (3-5 days)

---

## Immediate Actions

### Phase 1: Audit & Document (Today)
- ✅ Document all conversion points (this document)
- ⬜ Map field mappings in detail
- ⬜ Identify information loss points
- ⬜ Create test cases for round-trip conversions

### Phase 2: Unify Converters (This Week)
- ⬜ Extend ActivitySchemaAdapter with proto support
- ⬜ Refactor BootstrapTemplates to use adapter
- ⬜ Add comprehensive tests
- ⬜ Validate no behavior changes

### Phase 3: Eliminate Defensive Coding (Next Week)
- ⬜ Work with backend team to standardize format
- ⬜ Remove field aliasing (`task_id || id`)
- ⬜ Remove field name variations (`template || activity`)
- ⬜ Update documentation

### Phase 4: Validate Round-Trip (Ongoing)
- ⬜ Add round-trip conversion tests
- ⬜ Monitor for information loss
- ⬜ Track schema evolution

---

## Testing Strategy

### Test Cases Needed

1. **Round-trip conversion:**
   ```typescript
   test("round-trip preserves all data", () => {
     const original = createTestTemplate()
     const metabob = ActivitySchemaAdapter.fromCanonical(original)
     const restored = ActivitySchemaAdapter.toCanonical(metabob)
     expect(restored).toEqual(original)  // Should be identical
   })
   ```

2. **Proto format conversion:**
   ```typescript
   test("proto format converts correctly", () => {
     const proto = loadProtoTemplate()
     const canonical = ActivitySchemaAdapter.fromProto(proto)
     expect(canonical).toMatchSchema(ActivityTemplate.Schema)
   })
   ```

3. **Format detection:**
   ```typescript
   test("detects format variant correctly", () => {
     expect(detectFormat({ activity_id: "x" })).toBe("proto")
     expect(detectFormat({ id: "x", tasks: [] })).toBe("mcp")
   })
   ```

4. **Field aliasing:**
   ```typescript
   test("handles both task_id and id", () => {
     const withTaskId = { task_id: "t1", ... }
     const withId = { id: "t1", ... }
     expect(normalizeTask(withTaskId)).toEqual(normalizeTask(withId))
   })
   ```

---

## Conclusion

**Current State:** Good foundation with ActivitySchemaAdapter, but duplication and defensive coding indicate format instability.

**Recommended Path Forward:**
1. ✅ **Short-term (Option A):** Unify on ActivitySchemaAdapter to eliminate duplication
2. 🎯 **Medium-term (Option C):** Standardize backend format and remove defensive coding
3. 🚀 **Long-term:** Plugin-based adapter for extensibility

**Priority:** HIGH - Template conversion is core infrastructure that affects all template operations

**Estimated Effort:**
- Phase 1 (Audit): 4 hours ✅ (Complete)
- Phase 2 (Unify): 8 hours
- Phase 3 (Standardize): 2-3 days (requires backend coordination)
- Phase 4 (Validate): Ongoing

---

## Appendix: Key Files

1. **ActivitySchemaAdapter** - `src/session/activity-schema-adapter.ts`
2. **BootstrapTemplates** - `src/session/bootstrap-templates.ts`
3. **MetabobCLI** - `src/util/metabob.ts`
4. **ActivityTemplate Schema** - `src/session/activity-template.ts`
5. **TemplateServiceClient** - `src/server/template-service-client.ts`

## Appendix: Format Comparison

| Field | Proto Format | MCP Format | OpenCode Format |
|-------|-------------|------------|-----------------|
| Template ID | `activity_id` | `activity_id` or `id` | `id` |
| Task ID | `task_id` | `task_id` or `id` | `id` |
| Tasks Array | `tasks` | `tasks` or `task_steps` | `tasks` |
| Agent Field | `subagent` | `subagent` or `agent` | `subagent` |
| Max Tokens | `context_rules.max_tokens` | `max_tokens` | `prompt.maxTokens` |
| Patterns | `{pattern, description}[]` | `string[]` or `{pattern, description}[]` | `string[]` |

**Observation:** Too many format variations supported, indicating lack of standardization.
