# Why Different Activity Template Formats? Root Cause

**Question**: Why does OpenCode have a different template format from proto/backend?  
**Answer**: **Historical accident** - not intentional design

---

## The Problem: Three Formats

### 1. Proto Format (Should Be Canonical)
```protobuf
// repos/metabob-proto/proto/metabob/activity/variant.proto
message ActivityVariant {
  string variant_id;
  string activity_id;
  repeated TaskStep task_steps;  // ← Note: task_STEPS
}
```

### 2. OpenCode "Canonical" Format
```typescript
// repos/metabob-opencode/src/session/activity-schema-adapter.ts
interface OpenCodeTemplate {
  id: string;                    // ← NOT variant_id
  tasks: OpenCodeTask[];         // ← NOT task_steps
  contextRequirements: [...];    // ← NOT in proto
  integration: {...};            // ← NOT in proto
}
```

### 3. Metabob MCP Format
```typescript
interface MetabobTemplate {
  activity_id: string;           // ← Matches proto
  tasks: MetabobTask[];          // ← Still not task_steps
}
```

**Result**: 250+ lines of conversion code in `ActivitySchemaAdapter`

---

## Root Cause

**From git history** (commit f43ddf4d, Nov 28, 2025):
```
feat(activity): comprehensive activity system with Metabob MCP integration
```

**Timeline**:
1. OpenCode activity system built (Nov 2025)
2. Created its own schema (TypeScript interfaces)
3. Proto schema created later (or not known about)
4. Adapter created to convert between formats (Feb 2026)

**Why it happened**:
- OpenCode team unaware of proto schema
- Easier to write TypeScript than learn proto
- No proto codegen set up
- Gradual divergence over time

**Evidence**:
- Adapter has manual ID aliasing (`activity_id ↔ id`)
- Different field names (`tasks` vs `task_steps`)
- OpenCode has fields proto doesn't (`contextRequirements`)
- Proto has fields OpenCode doesn't (`variant_id`)

---

## Consequences

### 1. Conversion Bugs
Every format conversion is a bug opportunity:
- Empty `task_steps` arrays (serialization fails)
- Field mapping errors
- Type mismatches
- Lost data in translation

### 2. Three Sources of Truth
- Proto says one thing
- OpenCode says another
- Backend expects proto
- **Who's right? Unclear.**

### 3. Evolution Breaks
When `activity-evolve` creates variants:
- Which format does it use?
- How do OpenCode fields get stored?
- Can templates round-trip?
- **Answer: Unknown, untested, broken**

### 4. Maintenance Hell
One proto field addition requires:
1. Update proto
2. Update TypeScript types
3. Update adapter conversion
4. Update validation
5. Update tests
6. Update docs

**Six places to change.**

---

## What SHOULD Exist

### Correct: Proto-First Architecture

```
Protocol Buffers (.proto file)
      ↓
  buf generate (codegen)
      ↓
Generated TypeScript interfaces
      ↓
Everyone uses same types
      ↓
✅ Single source of truth
```

**Example**: How gRPC works
- Define `.proto` once
- Generate code for all languages
- Everyone uses generated types
- **Zero adapters needed**

### What We Have

```
Proto (variant.proto) ← Backend uses this
      ↓ (ignored)
OpenCode invents own format
      ↓
ActivitySchemaAdapter converts
      ↓ (manual 250+ LOC)
MCP uses different format
      ↓
🔥 THREE FORMATS 🔥
```

---

## The Fix

### Phase 1: Audit
**Question**: Are OpenCode-specific fields truly needed?
- `contextRequirements` - Could be added to proto
- `integration` - Could be added to proto
- `metabob` config - Could be added to proto

**OR** can they be removed?

### Phase 2: Extend Proto
```protobuf
message ActivityVariant {
  // Existing fields...
  
  // Add OpenCode needs
  repeated ContextRequirement context_requirements = 20;
  IntegrationConfig integration = 21;
}
```

**Still single schema. No adapter needed.**

### Phase 3: Generate Code
```bash
buf generate repos/metabob-proto/proto

# Generates:
# - TypeScript interfaces from proto
# - Guaranteed to match backend
# - Auto-updates when proto changes
```

### Phase 4: Migrate
```typescript
// Delete this
import { OpenCodeTemplate } from './activity-schema-adapter'

// Use this
import { ActivityVariant } from '@metabob/proto-gen/activity'

// Delete adapter entirely
rm activity-schema-adapter.ts
```

---

## Impact on Our Work

### Why jiggle-documentation Can't Run
1. Created in OpenCode format
2. Adapter converts to MCP format
3. Backend expects proto format
4. Conversion loses `task_steps` data
5. Database has empty arrays
6. Execution fails

**Root cause**: Too many conversions, too many formats.

### Why Evolution Will Fail
1. `activity-evolve` creates new variant
2. Uses OpenCode format
3. Tries to store in backend
4. Conversion fails or loses data
5. Genealogy breaks
6. Can't retrieve properly

**Root cause**: Format fragmentation.

---

## Recommendations

### DO ✅
- **Use proto as single source of truth**
- **Generate TypeScript from proto**
- **Extend proto if OpenCode needs fields**
- **Delete adapter layer**

### DON'T ❌
- **Maintain separate "canonical" formats**
- **Keep adapter as long-term solution**
- **Invent new formats**

---

## Bottom Line

**We don't NEED different formats.**

We HAVE different formats because:
1. OpenCode was built without proto knowledge
2. Adapter was added as band-aid
3. Nobody refactored to proto-first

**The fix**:
- Align on proto as canonical
- Generate code from proto
- Delete adapter
- **1-2 weeks of work to fix years of complexity**

---

**Your Question Revealed**: This is not intentional design. This is technical debt from not following proto-first architecture from the start.

**The Solution**: Proto-first. Always. No exceptions.
