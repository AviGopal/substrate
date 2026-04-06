## Why

MiniBob executes activities via LLM tool calling, but identical patterns repeat across executions—reading files, running commands, git operations. Each repetition costs tokens and latency even when the LLM makes the same deterministic decision. We need to observe LLM behavior, extract successful patterns as typed impulses, and progressively replace LLM reasoning with proven deterministic resolver chains.

**Additionally**, the learning loop is incomplete in production:
- Activity templates lack `input_shapes`/`output_shapes` declarations
- Thompson selection logs are empty (no selection-to-outcome correlation)
- Shape-conditioned scores aren't being recorded
- No meta-activities exist to improve activities autonomously

We need to bootstrap the learning loop with data flow verification and deploy meta-activities that enable self-improvement.

## What Changes

### Phase 1: Deterministic Workflows
- **Tool Argument Capture**: Extract LLM tool call arguments as typed impulses with shapes (e.g., `file_read_args`, `bash_args`, `git_args`)
- **Pattern Tracking**: Record tool argument patterns to backend with success metrics for learning
- **Shape-Based Routing**: Tasks declare input/output shapes; system routes to resolvers based on shape contracts
- **Resolver Task Generation**: Ribosome generates resolver-based tasks from proven patterns instead of LLM tasks
- **Recommendation API**: Backend recommends pre-loading argument patterns with high success rates

### Phase 2: Learning Loop Bootstrap
- **Shape Backfill**: Infer and add `input_shapes`/`output_shapes` to existing templates
- **Data Flow Verification**: Ensure execution traces include shapes and trigger score updates
- **Meta-Activity Library**: Deploy bootstrap activities for self-improvement (debug, optimize, extract, compose)
- **Selection Correlation**: Link Thompson Sampling selections to execution outcomes for explainability
- **Workflow Composition**: Activities that discover and compose successful activity sequences

## Capabilities

### New Capabilities (Phase 1)
- `tool-argument-extraction`: Extract tool call arguments as typed impulses with stable IDs for deduplication and shape metadata for routing
- `argument-pattern-tracking`: Backend schema and API for recording/querying tool argument patterns with success metrics
- `shape-based-resolution`: Resolve impulses by shape contract, enabling automatic routing to appropriate resolvers

### New Capabilities (Phase 2)
- `shape-backfill`: Infer and populate input_shapes/output_shapes on existing activity templates using heuristics
- `meta-activity-library`: Bootstrap activities for self-improvement: debug-failed, optimize-slow, extract-template, compose-workflow
- `selection-correlation`: Link Thompson Sampling selections to execution outcomes via correlation_id
- `workflow-composition`: Discover frequent activity sequences and compose into optimized templates
- `emergent-shape-network`: Views revealing shape topology (v_shape_usage, v_shape_network) - shapes emerge from usage, not predefined

### Modified Capabilities
- `activity-execution`: Activity executor creates argument impulses after tool calls and records patterns to backend
- `template-generation`: Ribosome generates resolver-based tasks with inputShapes/outputShapes from proven patterns
- `execution-traces`: Include input_impulse_shapes and correlation_id for learning loop closure

## Impact

**MiniBob (repos/minibob)**:
- `src/types.ts`: New `ToolArgumentPointer` type, `inputShapes`/`outputShapes` on `ActivityTask`
- `src/tool-argument-extractor.ts`: New module for extraction logic
- `src/shape-resolver.ts`: New module for shape-based impulse resolution
- `src/activity.ts`: Integration point for extraction and pattern recording; ensure `input_impulse_shapes` passed to trace
- `src/template-generator.ts`: Enhanced to generate resolver tasks
- `src/mcp.ts`: New methods for pattern recording/querying; pass `correlation_id` on trace submission

**Activity API (repos/metabob-activity-api)**:
- `sql/schemas/029-tool-argument-patterns.surql`: New table and views
- `sql/migrations/044-backfill-template-shapes.surql`: Migration to add shapes to existing templates
- `sql/schemas/045-emergent-shape-stats.surql`: Views for shape network topology (v_shape_usage, v_shape_network)
- `src/routes/activities.ts`: New endpoints for patterns, shape statistics
- `src/utils/shape-inference.ts`: Heuristic module for bootstrapping shapes from prompts/validation
- `helm/charts/metabob-activity-api/templates/init-data.yaml`: Meta-activity template seeding

**Activity Templates (production database)**:
- `debug-failed-execution`: Analyze and fix failing activities
- `optimize-slow-activity`: Improve slow-running activities
- `extract-template-from-traces`: Extract new templates from successful executions
- `backfill-template-shapes`: Add shapes to legacy templates
- `analyze-shape-performance`: Review shape-conditioned scores
- `discover-activity-sequences`: Find frequent activity patterns
- `compose-activity-sequence`: Create composite templates
- `optimize-workflow-cost`: Reduce workflow token/time costs
- `repair-failing-activity`: Create variants that fix failure modes

**No breaking changes** - all additions are backward compatible with existing impulse and activity systems.
