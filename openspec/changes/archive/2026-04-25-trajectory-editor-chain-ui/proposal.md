## Why

The current trajectory editor treats composition as upfront path generation via `/goal-paths/recommend`, which contradicts the core idiom that activities constrain search space iteratively. Users cannot see impulse state evolution, understand shape compatibility, or explore speculative "what if" branches. The UI needs to embody the process-of-becoming: showing metadata-first impulse flow, step-by-step activity recommendations via Thompson Sampling, and continuous learning feedback.

## What Changes

- Replace upfront path generation with **iterative activity recommendation** after each step
- Visualize **impulse state space evolution** showing accumulated shapes at each column
- Add **speculative state prediction** for "what if" exploration (hover to preview outcomes)
- Implement **bidirectional discovery**: forward ("I have X, what can I do?") and backward ("I want Y, what produces it?")
- Show **Thompson Sampling scores with confidence intervals** for activity recommendations
- Display **learning feedback** post-execution (Thompson updates, variant creation, composition edges)
- Add **resolver tier visualization** (deterministic/pattern/LLM) with cost breakdowns
- Implement **goal completion detection** with progress indicators based on expected output shapes
- Add **cycle detection** for continuous feedback loops with productivity validation
- Support **inline task editing** with save-as-variant functionality

## Capabilities

### New Capabilities

- `impulse-state-space`: Visual representation of accumulated impulse shapes at each trajectory step, with provenance tracking and shape flow indicators
- `activity-applicability`: Dynamic filtering of activities based on current impulse state, showing applicable/blocked/newly-unlocked activities
- `speculative-prediction`: "What if" preview showing predicted state changes, unlocked activities, and goal progress when hovering over candidate activities
- `thompson-visualization`: Display Thompson Sampling parameters (alpha/beta), confidence intervals, and shape-conditioned success rates for activity variants
- `learning-feedback-ui`: Post-execution panel showing Thompson parameter updates, variant creation, composition graph edge changes, and impulse relevance shifts
- `resolver-attribution`: Per-task resolver tier display (LOCAL/PATTERN/LLM) with latency, cost, and vessel tracking
- `goal-completion-tracking`: Progress indicator based on expected output shapes inferred from goal text or user-specified
- `backward-chaining-ui`: Dependency tree showing prerequisite activities needed to produce required shapes
- `cycle-validation`: Detection of feedback loops with productivity analysis (adds new shapes vs infinite loop)
- `inline-variant-creation`: Task-level editing with automatic variant creation preserving genealogy and Thompson Sampling competition

### Modified Capabilities

- `trajectory-execution`: Add real-time WebSocket integration for task-by-task progress, impulse resolution events, and state transition animations (currently execution happens outside trajectory view)

## Impact

**Frontend (Workbench):**
- `src/pages/TrajectoryEditorPage.tsx` - Major refactor to add state space tracking
- `src/components/trajectory/` - 10+ new components (ImpulseStatePanel, ThompsonScoreCard, SpeculativePreview, etc.)
- `src/stores/trajectoryStore.ts` - Add impulse state tracking, speculative prediction cache
- `src/hooks/` - New hooks for Thompson scores, state predictions, resolver metrics

**Backend (Activity-API):**
- `POST /v2/activities/recommend` - Already supports `expected_output_shapes` filtering (no changes needed)
- `POST /v2/activities/discover-by-shapes` - **NEW** endpoint for bidirectional discovery
- `POST /v2/goal-paths/recommend` - Enhance to return endpoint predictions and confidence intervals
- Composition graph queries - Add state transition tracking

**MiniBob:**
- Execution integration - WebSocket events for real-time trajectory updates
- Per-task impulse tracking - Already implemented (input_impulse_ids, output_impulse_ids)
- Resolver attribution - Already tracked in impulse_resolutions array

**Learning System:**
- Thompson Sampling - No changes (UI consumes existing metrics)
- Composition graph - Add state-based edge queries
- Impulse relevance - Expose relevance scores in UI

**Breaking Changes:**
- None (additive changes only, backward compatible with existing trajectory editor)
