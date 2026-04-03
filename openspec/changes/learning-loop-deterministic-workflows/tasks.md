## 1. Type Definitions (minibob) ✅

- [x] 1.1 Add `ToolArgumentPointer` to `BackendImpulsePointer` union in `repos/minibob/src/types.ts`
- [x] 1.2 Add `ToolArgumentShape` type with values: `file_read_args`, `file_write_args`, `file_edit_args`, `bash_args`, `git_args`, `glob_args`, `grep_args`
- [x] 1.3 Add optional `inputShapes?: string[]` field to `ActivityTask` interface
- [x] 1.4 Add optional `outputShapes?: string[]` field to `ActivityTask` interface

## 2. Tool Argument Extraction Module (minibob) ✅

- [x] 2.1 Create `repos/minibob/src/tool-argument-extractor.ts` with module structure
- [x] 2.2 Implement `inferArgumentShape(toolName: string): string` function
- [x] 2.3 Implement `inferArgumentSchema(toolName: string, args: Record<string, unknown>): Record<string, string>` function
- [x] 2.4 Implement `generateStableArgumentId(toolCall: ToolCall): string` function with tool-specific logic
- [x] 2.5 Implement `extractToolArgumentImpulse(toolCall: ToolCall, taskId: string, activityId: string): Impulse` function
- [x] 2.6 Add unit tests for extraction functions in `repos/minibob/src/tool-argument-extractor.test.ts`

## 3. Shape-Based Resolution Module (minibob) ✅

- [x] 3.1 Create `repos/minibob/src/shape-resolver.ts` with module structure
- [x] 3.2 Implement `resolveImpulsesByShape(requiredShapes: string[], availableImpulses: Impulse[]): Map<string, Impulse[]>` function
- [x] 3.3 Implement `canExecuteTask(task: ActivityTask, availableImpulses: Impulse[]): {canExecute: boolean, missing: string[]}` function
- [x] 3.4 Add unit tests for shape resolution in `repos/minibob/src/shape-resolver.test.ts`

## 4. Backend Schema (activity-api) ✅

- [x] 4.1 Create `repos/metabob-activity-api/sql/schemas/029-tool-argument-patterns.surql` with table definition
- [x] 4.2 Define `tool_argument_pattern` table with fields: activity_id, tool_name, argument_shape, argument_hash, arguments, times_used, times_succeeded, avg_execution_ms, last_used_at, org_id
- [x] 4.3 Add RBAC PERMISSIONS for org_id isolation
- [x] 4.4 Add indexes for activity_id, argument_hash, and composite lookups
- [x] 4.5 Create `v_argument_recommendations` computed view with success_rate >= 0.8 and times_used >= 3 filter

## 5. Backend API Endpoints (activity-api) ✅

- [x] 5.1 Add POST `/v2/activities/tool-argument-patterns` endpoint in `repos/metabob-activity-api/src/routes/activities.ts`
- [x] 5.2 Implement upsert logic: create new or increment existing pattern
- [x] 5.3 Add GET `/v2/activities/tool-argument-recommendations` endpoint with activity_id query param
- [x] 5.4 Implement query against `v_argument_recommendations` view
- [x] 5.5 Add request/response validation with Zod schemas

## 6. MCP Client Methods (minibob) ✅

- [x] 6.1 Add `recordToolArgumentPattern(params)` method to `repos/minibob/src/mcp.ts`
- [x] 6.2 Add `getToolArgumentRecommendations(activityId: string)` method to `repos/minibob/src/mcp.ts`
- [x] 6.3 Add trace-cache fallback for `recordToolArgumentPattern` when backend unavailable

## 7. Activity Executor Integration (minibob) ✅

- [x] 7.1 Import `extractToolArgumentImpulse` in `repos/minibob/src/activity.ts`
- [x] 7.2 After tool calls (~line 1548), create argument impulses using `extractToolArgumentImpulse`
- [x] 7.3 Store argument impulses in impulse store via `createImpulse`
- [x] 7.4 After successful task, call `mcp.recordToolArgumentPattern` for each tool call
- [x] 7.5 Import `canExecuteTask` and `resolveImpulsesByShape` in activity.ts
- [x] 7.6 In `executeWithResolver`, check `canExecuteTask` before execution
- [x] 7.7 If shapes missing, log warning and fall back to `executeWithLLM`

## 8. Template Generator Enhancement (minibob) ✅

- [x] 8.1 Update `inferResolver` in `repos/minibob/src/template-generator.ts` to return `inputShapes` array
- [x] 8.2 Add `inferOutputShapes(toolCalls: ToolCall[]): string[]` function
- [x] 8.3 In `assembleTemplateFromExecution`, populate `inputShapes` and `outputShapes` on resolver tasks
- [x] 8.4 Ensure prompt is retained as fallback for resolver tasks

## 9. Verification ✅

- [x] 9.1 Run `bun test` in repos/minibob to verify all tests pass (130 pass, 11 skip, 0 fail)
- [x] 9.2 Run `bun run typecheck` in repos/minibob to verify types (no errors)
- [x] 9.3 Code review completed - RBAC issues fixed (org_id composite index, view PERMISSIONS, API filtering)
- [ ] 9.4 Deploy to canary environment
- [ ] 9.5 Verify patterns are recorded to backend database
- [ ] 9.6 Verify recommendations endpoint returns patterns with high success rate

---

# Phase 2: Learning Loop Bootstrap

## 10. Shape Backfill for Existing Templates (activity-api)

- [ ] 10.1 Create schema migration `sql/migrations/044-backfill-template-shapes.surql` to add default shapes
- [ ] 10.2 Implement `inferInputShapesFromPrompt(prompt: string): string[]` function in `src/utils/shape-inference.ts`
- [ ] 10.3 Implement `inferOutputShapesFromValidation(validation: object): string[]` function
- [ ] 10.4 Create backfill script that infers shapes from existing template task prompts
- [ ] 10.5 Apply backfill to production database: `UPDATE activity_template SET input_shapes = $inferred WHERE input_shapes = []`
- [ ] 10.6 Verify all templates have non-null `input_shapes` and `output_shapes`

## 11. Learning Loop Data Flow Verification (activity-api + minibob)

- [ ] 11.1 Add debug logging in `storeExecutionTrace` to log `input_impulse_shapes` presence
- [ ] 11.2 Verify MiniBob passes `input_impulse_shapes` in execution trace submission
- [ ] 11.3 Verify `updateShapeActivityScores()` is called after trace storage
- [ ] 11.4 Add integration test: execute activity → verify `impulse_shape_activity_score` updated
- [ ] 11.5 Verify `thompson_selection_log` populated on `/recommend` calls
- [ ] 11.6 Add dashboard query to show shape-conditioned score distribution

## 12. Bootstrap Meta-Activity Templates (activity-api)

Deploy activity templates that enable self-improvement to production:

- [ ] 12.1 Create `debug-failed-execution` template with tasks:
  - Load execution trace impulse
  - Analyze failure patterns
  - Identify root cause
  - Propose fix or variant

- [ ] 12.2 Create `optimize-slow-activity` template with tasks:
  - Load activity metrics impulse
  - Identify slow tasks
  - Propose optimization strategies
  - Create variant with improvements

- [ ] 12.3 Create `extract-template-from-traces` template with tasks:
  - Load successful execution traces
  - Identify common patterns
  - Call ribosome extraction endpoint
  - Register new template

- [ ] 12.4 Create `backfill-template-shapes` template with tasks:
  - Load activity template impulse
  - Analyze task prompts and validation rules
  - Infer input_shapes and output_shapes
  - Update template via API

- [ ] 12.5 Create `analyze-shape-performance` template with tasks:
  - Query v_shape_conditioned_score view
  - Identify shape combinations with low success rates
  - Generate improvement recommendations
  - Create tasks for fixing underperforming patterns

- [ ] 12.6 Deploy meta-activity templates to production via init-data Helm hook

## 13. Workflow Composition Activities (activity-api)

- [ ] 13.1 Create `discover-activity-sequences` template with tasks:
  - Query execution_sequences table for frequent patterns
  - Filter by success rate >= 80%
  - Identify composition candidates
  - Output sequence pattern impulses

- [ ] 13.2 Create `compose-activity-sequence` template with tasks:
  - Load sequence pattern impulse
  - Load constituent activity templates
  - Call template-merger service
  - Register composite template
  - Set up Thompson Sampling baseline

- [ ] 13.3 Create `optimize-workflow-cost` template with tasks:
  - Load workflow execution metrics
  - Identify high-cost tasks
  - Propose caching or determinization
  - Create optimized variant

- [ ] 13.4 Create `repair-failing-activity` template with tasks:
  - Load failing activity template
  - Load recent failure traces
  - Analyze common failure modes
  - Generate repaired variant with improved validation
  - Register variant with variant_of link

## 14. Emergent Shape Network (activity-api)

- [ ] 14.1 Create `sql/schemas/045-emergent-shape-stats.surql` with network topology views
- [ ] 14.2 Implement `v_shape_usage` view: aggregate shapes from activity input_shapes/output_shapes
- [ ] 14.3 Implement `v_shape_network` view: show shape transformations (input→output edges across activities)
- [ ] 14.4 Create `/v2/shapes/network` endpoint returning shape topology and edge weights
- [ ] 14.5 Create `/v2/shapes/usage` endpoint returning shape frequency statistics
- [ ] 14.6 Add shape suggestions in recommendation response based on observed usage (not predefined list)

## 15. Selection-to-Execution Correlation (activity-api)

- [ ] 15.1 Ensure `/recommend` returns `correlation_id` in each recommendation
- [ ] 15.2 Update MiniBob to pass `correlation_id` when storing execution trace
- [ ] 15.3 Add join query in `GET /v2/activities/execution-traces/:id` to include selection metadata
- [ ] 15.4 Create `v_selection_outcomes` view joining thompson_selection_log with execution results
- [ ] 15.5 Add explainability endpoint: `GET /v2/activities/selections/:correlation_id/outcome`

## 16. Production Deployment Verification

- [ ] 16.1 Deploy all schema changes to production cluster
- [ ] 16.2 Run shape backfill migration on production database
- [ ] 16.3 Verify meta-activity templates are accessible via `/recommend`
- [ ] 16.4 Execute `debug-failed-execution` on a real failing trace
- [ ] 16.5 Verify Thompson Sampling scores update after meta-activity execution
- [ ] 16.6 Monitor `impulse_shape_activity_score` table growth over 24 hours
- [ ] 16.7 Generate learning loop health report showing:
  - Templates with shapes vs without
  - Selection log entries per day
  - Shape-conditioned score coverage
  - Meta-activity execution count
