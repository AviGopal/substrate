# Validation Test Executors Implementation

**Date:** 2026-04-16
**Files Modified:** `validation/run-validation.ts`
**Files Created:** `validation/test-executors.ts`

## Overview

Implemented the 3 missing test executors in `validation/run-validation.ts` to validate impulse resolution behavior against the documented architecture in `docs/architecture/sequences/02-impulse-resolution.md`.

## Implemented Executors

### 1. `resolveImpulses` (lines 137-222)

Tests the 6-step resolver dispatch chain: LOCAL → CUSTOM → DISCOVERY → BACKEND → MCP → FALLBACK

**Behavior:**
- **LOCAL types** (`memo`, `file`, `directoryTree`, `gitDiff`): Resolves locally with `resolver: 'LOCAL'`
- **BACKEND types** (activity-specific): Calls `POST /v2/impulses/resolve` with `resolver: 'BACKEND'`
- **Unknown types**: Falls back to `resolver: 'FALLBACK'`

**Output format:**
```typescript
{
  [impulseId]: {
    resolver: 'LOCAL' | 'BACKEND' | 'FALLBACK' | 'ERROR',
    content_source: 'embedded' | 'filesystem' | 'mcp' | 'unknown',
    content: string,
    error?: string
  }
}
```

**Validation (lines 425-443):**
- Checks each impulse has expected resolver type
- Verifies content_source matches expectation
- Reports mismatches with clear error messages

### 2. `loadImpulse` (lines 224-275)

Tests budget enforcement and content truncation per documented behavior.

**Behavior:**
- Loads content from impulse pointer (memo, file, etc.)
- Estimates token count (rough: 1 token ≈ 4 characters)
- Truncates to 90% of budget if over budget
- Tracks truncation metadata for budget learning

**Output format:**
```typescript
{
  loaded: boolean,
  token_count: number,
  metadata: {
    was_truncated: boolean,
    original_token_count: number,
    truncation_ratio: number
  },
  content_suffix: string | null  // '... (truncated to fit budget)' if truncated
}
```

**Validation (lines 445-471):**
- Verifies load status matches expected
- Checks token_count is within 10% tolerance of expected
- Validates truncation flag and metadata
- Ensures truncation message present when truncated

### 3. `formatForContext` (lines 277-344)

Tests metadata-first formatting with pointer-mode and content-mode.

**Behavior:**
- **Pointer-mode** (`load_content: false`): Formats metadata as `<impulse_ref />` (self-closing)
  - Includes: id, type, shape, row_count, summary, available_ops
  - No content loaded - efficient for LLM reasoning about data structure

- **Content-mode** (`load_content: true`): Formats with full content as `<impulse>...</impulse>`
  - Includes: id, type, tokens usage
  - Full content in body
  - Used for actual task execution

**Output format:**
```typescript
// Pointer-mode
{
  format: 'pointer-mode',
  xml: '<impulse_ref id="..." type="..." shape="..." ... />'
}

// Content-mode
{
  format: 'content-mode',
  xml_start: '<impulse id="..." type="..." tokens="...">',
  xml_end: '</impulse>',
  content_included: true
}
```

**Validation (lines 473-495):**
- Checks format matches expected (pointer-mode vs content-mode)
- Validates XML structure and attributes
- Verifies content inclusion flag
- Ensures metadata properly formatted

## Testing

### Standalone Tests

Created `test-executors.ts` with unit tests for all three executors:

```bash
bun run validation/test-executors.ts
```

**Test coverage:**
- ✓ `resolveImpulses`: LOCAL, BACKEND, and FALLBACK resolver types
- ✓ `loadImpulse`: Budget enforcement and truncation logic
- ✓ `formatForContext`: Both pointer-mode and content-mode formatting

All tests pass ✅

### Integration Tests

Run with live backend (requires API key):

```bash
export METABOB_API_KEY="your-key"
bun run validation/run-validation.ts --sequence=02-impulse
```

Tests scenarios from `validation/scenarios/02-impulse-resolution.yaml`:
- Lines 113-151: Resolver dispatch chain
- Lines 153-182: Budget enforcement
- Lines 220-277: Formatting modes

## Architecture Alignment

Implementation follows the documented behavior in:
- `docs/architecture/sequences/02-impulse-resolution.md` (lines 218-548)
- `docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`

**Key principles:**
1. **Metadata-first reasoning**: Pointer-mode allows LLMs to reason about data without loading content
2. **Budget enforcement**: 90% truncation with tracking for budget learning
3. **Resolver locality**: LOCAL types resolved locally, BACKEND types delegated to activity API
4. **6-step dispatch**: Clear chain with fallback handling

## Code Quality

- **Type safety**: All functions use TypeScript types matching scenario definitions
- **Error handling**: Try-catch with clear error messages
- **Validation**: Comprehensive checks with tolerance for numeric comparisons
- **Documentation**: Inline comments explain each step
- **Testability**: Standalone test verifies logic without external dependencies

## Next Steps

1. Run integration tests against canary deployment
2. Add more edge case scenarios to `02-impulse-resolution.yaml`
3. Extend validation for other sequences (03, 04, 05)
4. Generate compliance report with `generate-report.ts`
