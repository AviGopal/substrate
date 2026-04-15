# Archived Documentation - 2026-04-14 Jiggle-and-Prune

This directory contains documentation archived during the jiggle-and-prune process on 2026-04-14.

## Reason for Archival

These documents described **observation loop** and **Thompson Sampling** patterns that have been superseded by **composition learning** architecture.

## Archived Files

### OBSERVATION_LOOP.md
- **Original Purpose:** Development guide using observation/learning loop
- **Why Archived:** Thompson Sampling deprecated in favor of composition learning
- **Replacement:** `COMPOSITION_LEARNING.md` in parent directory

### OBSERVATION_LOOP_SUMMARY.md
- **Original Purpose:** Architecture overview of observation loop
- **Why Archived:** Based on probabilistic activity selection (deprecated)
- **Replacement:** Composition learning patterns in `HOW_IT_WORKS.md`

### QUICKSTART_OBSERVATION.md
- **Original Purpose:** Quick examples using observation activities
- **Why Archived:** Examples used deprecated observation activity patterns
- **Replacement:** Standard activity examples in `README.md`

## Key Changes in New Architecture

### Old Pattern (Archived)
```typescript
// Thompson Sampling for activity selection
const alpha = successCount;
const beta = failureCount;
const score = sampleBeta(alpha, beta);
if (score > threshold) {
  recommendActivity();
}
```

### New Pattern (Current)
```typescript
// State-space driven composition selection
const requiredState = activity.input_impulses[0].metadata.required_state;
const matchingImpulses = impulses.filter(i =>
  matchesRequiredState(i.state, requiredState)
);
// Deterministic selection based on state requirements
```

## Migration Guide

If you were using observation loop patterns:

1. **Replace observation activities** with standard composition activities
2. **Remove Thompson Sampling logic** - use state-based selection
3. **Update activity templates** to specify required state instead of success criteria
4. **Record compositions** instead of success/failure counts

See `COMPOSITION_LEARNING.md` for current patterns.

## Historical Context

These files were created during early terminal vessel development when the system used Thompson Sampling for activity recommendation. The shift to composition learning (April 2026) made these patterns obsolete.

The core concepts remain valid:
- Recording execution traces ✅
- Learning from past executions ✅
- Detecting patterns ✅

The implementation changed:
- From probabilistic scoring to state-space matching
- From activity recommendation to composition pattern recognition
- From success/failure counts to deterministic state transitions

## References

- **Current Architecture:** `/home/avi/documents/work/exp-repo/metabob-devbob/docs/architecture/IMPULSE_ACTIVITY_FOUNDATION.md`
- **Composition Learning:** `../COMPOSITION_LEARNING.md`
- **Standard Config:** `/home/avi/documents/work/exp-repo/metabob-devbob/docs/STANDARD_CONFIGURATION.md`
