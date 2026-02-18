# Task 9: TypeScript Generation & OpenCode Migration - Analysis

## Status: TypeScript Generation Complete ✅, Migration Strategy Defined

---

## Phase 1: TypeScript Generation - COMPLETE ✅

### What Was Done

1. **Installed ts-proto** ✅
   ```bash
   npm install --save-dev ts-proto @types/node typescript
   ```

2. **Updated buf.gen.yaml** ✅
   - Added TypeScript plugin configuration
   - Using local protoc-gen-ts_proto

3. **Updated generate.sh** ✅
   - Added TypeScript generation step
   - Count TypeScript files in output

4. **Generated TypeScript Types** ✅
   ```
   12 TypeScript files generated:
   - metabob/activity/variant.ts (85KB)
   - metabob/activity/execution.ts (147KB)
   - metabob/activity/optimization.ts (83KB)
   - metabob/activity/admin.ts (96KB)
   - metabob/common/types.ts
   - metabob/auth/organization.ts
   - metabob/learning/consumer.ts
   - metabob/metrics/events.ts
   - metabob/session/session.ts
   - google/protobuf/* (3 files)
   ```

5. **Created index.ts** ✅
   - Single import point for all types
   - Exports all proto types

### Generated Types Available

```typescript
// From variant.ts
export interface ActivityVariant { ... }
export interface TaskStep { ... }
export interface TaskPrompt { ... }
export interface TaskValidation { ... }
// ... all variant types

// From execution.ts
export interface ExecutionConfig { ... }
export interface ContextRequirement { ... }
export interface TaskExecutionConfig { ... }
// ... all execution types

// From types.ts
export interface Genealogy { ... }
export enum EntityStatus { ... }
// ... all common types
```

---

## Phase 2: OpenCode Analysis - COMPLETE ✅

### Key Findings

#### 1. ActivitySchemaAdapter Status

**Location:** `packages/opencode/src/session/activity-schema-adapter.ts`
**Size:** 526 lines
**Usage:** **ONLY IN TESTS** ✅

**Evidence:**
```bash
# Production code imports: 0
# Test imports: 2
packages/opencode/test/integration/template-repository.test.ts
packages/opencode/test/session/activity-template-repository.test.ts
```

**Comment in metabob.ts line 10:**
```typescript
// Note: ActivitySchemaAdapter removed - templates registered directly via MCP tool
```

**Conclusion:** Adapter is **legacy code**, only kept for tests. Can be safely replaced!

#### 2. Adapter Functions

```typescript
// Convert MCP format to OpenCode format
export function toCanonical(metabob: MetabobTemplate): OpenCodeTemplate

// Convert OpenCode format to MCP format  
export function fromCanonical(opencode: OpenCodeTemplate): MetabobTemplate

// Normalize task structure
export function normalizeTask(metabobTask: MetabobTask): OpenCodeTask
```

#### 3. Format Differences

**MetabobTemplate (what adapter expects):**
- `activity_id` (snake_case)
- `tasks` with `task_id`
- Optional fields: `author`, `created_at`, `metadata`
- Nested validation/retry structures

**OpenCodeTemplate (internal format):**
- `id` (camelCase)
- `version`, `genealogy` objects
- Required metrics: `executions`, `successRate`, etc.
- `contextRequirements` array
- `integration` object
- `metabob` configuration object

**ActivityVariant (proto - what we have now):**
- `variant_id` (snake_case like MCP)
- `task_steps` (proto TaskStep[])
- `genealogy` (proto Genealogy)
- Extension fields: `execution_config`, `optimization_config`, `admin_config`

#### 4. Current Type System

**ActivityTemplate.Schema** (81KB file):
- Uses Zod for runtime validation
- Complex type hierarchy
- Includes all OpenCode-specific fields
- **Does NOT match proto types**

---

## Phase 3: Migration Strategy

### Option A: Full Proto Migration (Complex, 4-6 hours)

**Replace ActivityTemplate with generated proto types**

**Pros:**
- True format unification
- Type safety from proto
- Eliminate all adapter code

**Cons:**
- 81KB ActivityTemplate file to rewrite
- All dependent code needs updating
- Complex Zod → Proto migration
- High risk of breaking changes

### Option B: Proto Import Layer (Simple, 1-2 hours) ⭐ **RECOMMENDED**

**Add proto types for backend communication, keep internal types**

**Approach:**
1. Keep ActivityTemplate.Schema for OpenCode internal use
2. Add proto type imports from `@metabob/proto`
3. Replace adapter's MetabobTemplate with proto ActivityVariant
4. Update test code to use proto types
5. Eventually migrate internal types (future work)

**Pros:**
- Low risk, incremental approach
- Backend uses proto, frontend keeps working
- Can migrate internal types later
- Tests verify both formats work

**Cons:**
- Maintains two type systems temporarily
- Adapter still exists (but uses proto)

### Option C: Delete Adapter, Use Proto Directly (Medium, 2-3 hours)

**Remove adapter entirely, use proto for MCP communication**

**Approach:**
1. Install `@metabob/proto` in OpenCode
2. Update MCP tool calls to use proto types directly
3. Delete activity-schema-adapter.ts
4. Update tests to use proto types
5. Keep ActivityTemplate.Schema for internal use

**Pros:**
- Eliminates 526 line adapter
- Proto types for backend communication
- Clear separation: proto for API, Schema for internal

**Cons:**
- Some test updates needed
- Need type conversion helpers

---

## Recommended Approach: Option C with Helpers

### Implementation Plan

#### Step 1: Install Proto Package (10 min)

```bash
cd repos/metabob-opencode
# Create package.json for proto types
cd ../metabob-proto
npm pack  # Create tarball
cd ../metabob-opencode
# Add as dependency
```

#### Step 2: Create Type Converters (30 min)

**File:** `packages/opencode/src/session/proto-converters.ts`

```typescript
import { ActivityVariant, TaskStep } from '@metabob/proto'
import { ActivityTemplate } from './activity-template'

export function protoToTemplate(variant: ActivityVariant): ActivityTemplate.Schema {
  // Convert proto ActivityVariant to internal Schema
}

export function templateToProto(template: ActivityTemplate.Schema): ActivityVariant {
  // Convert internal Schema to proto ActivityVariant
}
```

#### Step 3: Update MCP Integration (20 min)

Replace MetabobTemplate with proto ActivityVariant in MCP calls.

#### Step 4: Update Tests (30 min)

- Update template-repository.test.ts
- Update activity-template-repository.test.ts
- Use proto types instead of adapter

#### Step 5: Delete Adapter (5 min)

```bash
rm packages/opencode/src/session/activity-schema-adapter.ts
```

#### Step 6: Verify & Test (30 min)

- Build OpenCode
- Run tests
- Verify type safety

**Total Time:** ~2-2.5 hours

---

## Decision Matrix

| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| Implementation Time | 4-6 hours | 1-2 hours | 2-3 hours |
| Risk Level | HIGH | LOW | MEDIUM |
| Proto Usage | Full | Partial | Backend Only |
| Code Deletion | 81KB+ | 0 | 526 lines |
| Type Safety | Full | Partial | Good |
| Future Work | None | Migrate later | Optional |
| **Recommendation** | ❌ Too complex | ✅ Safest | ⭐ **BEST** |

---

## Recommendation: Option C

**Why:**
1. **Achievable in remaining time** (~2.5 hours fits in session)
2. **Real progress** - Deletes 526 line adapter
3. **Proto types for backend** - Format unification where it matters
4. **Low risk** - Internal types unchanged
5. **Clean architecture** - Proto for API, Schema for internal logic

**Trade-off:**
- Don't migrate internal ActivityTemplate.Schema (81KB)
- That's a larger refactor for future work
- Current goal: Format unification for backend communication ✅

---

## Files to Modify

### New Files (2)
1. `packages/opencode/src/session/proto-converters.ts` - Type converters
2. `repos/metabob-proto/package.json` - For npm pack

### Modified Files (3-4)
1. `packages/opencode/package.json` - Add proto dependency
2. `packages/opencode/test/integration/template-repository.test.ts` - Use proto
3. `packages/opencode/test/session/activity-template-repository.test.ts` - Use proto
4. MCP integration files - Use proto (if needed)

### Deleted Files (1)
1. `packages/opencode/src/session/activity-schema-adapter.ts` - 526 lines ✅

---

## Success Criteria

- ✅ TypeScript types generated (12 files)
- ✅ Proto package installable in OpenCode
- ✅ Type converters working
- ✅ Tests passing with proto types
- ✅ ActivitySchemaAdapter deleted
- ✅ OpenCode builds successfully
- ✅ Backend communication uses proto types

---

## Next Steps

1. **Create proto NPM package** (10 min)
2. **Install in OpenCode** (10 min)
3. **Create proto-converters.ts** (30 min)
4. **Update tests** (30 min)
5. **Delete adapter** (5 min)
6. **Test & verify** (30 min)

**Estimated remaining:** 2 hours

---

## Notes

### Why Not Migrate ActivityTemplate.Schema?

1. **Size:** 81KB file with complex Zod validation
2. **Scope:** Used throughout OpenCode codebase
3. **Risk:** High chance of breaking changes
4. **Time:** Would take 4-6 hours alone
5. **Value:** Internal types don't need proto (only backend communication does)

### Future Work (Post Task 9)

- Consider migrating ActivityTemplate.Schema to proto (separate project)
- Evaluate if Zod validation still needed with proto
- Plan gradual internal type migration

---

## Status

**Phase 1 (Generation):** ✅ Complete  
**Phase 2 (Analysis):** ✅ Complete  
**Phase 3 (Migration):** Ready to start (Option C recommended)

**Progress:** 75% complete (Tasks 1-8 + TypeScript gen)
