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
- [x] 9.4 Deploy to production environment (metabob-production)
- [x] 9.5 Verify patterns are recorded to backend database
- [x] 9.6 Verify recommendations endpoint returns patterns with high success rate

---

# Phase 2: Learning Loop Bootstrap ✅

## 10. Shape Backfill for Existing Templates (activity-api) ✅

- [x] 10.1 Create schema migration `sql/migrations/044-backfill-template-shapes.surql` to add default shapes
- [x] 10.2 Implement `inferInputShapesFromPrompt(prompt: string): string[]` function in `src/utils/shape-inference.ts`
- [x] 10.3 Implement `inferOutputShapesFromValidation(validation: object): string[]` function
- [x] 10.4 Integrate shape inference into POST /v2/activities/templates route
- [x] 10.5 Apply backfill to production database (12 templates updated with category-based shapes)
- [x] 10.6 Verify all templates have non-null `input_shapes` and `output_shapes`

## 11. Learning Loop Data Flow Verification (activity-api + minibob) ✅

- [x] 11.1 Verified logging in `storeExecutionTrace` for `input_impulse_shapes` presence
- [x] 11.2 Verified MiniBob passes `input_impulse_shapes` via metadata.inputShapes → MCP extraction
- [x] 11.3 Verified `updateShapeActivityScores()` is called after trace storage (fire-and-forget pattern)
- [x] 11.4 End-to-end data flow verified: inferShape() → metadata → MCP → API → UPSERT
- [x] 11.5 Verified `thompson_selection_log` populated on `/recommend` calls (with correlation_id)
- [x] 11.6 v_shape_execution_stats view created for shape-conditioned score distribution

## 12. Bootstrap Meta-Activity Templates (activity-api) ✅

- [x] 12.1 Create `debug-failed-execution` template (2 tasks: load-and-analyze, propose-fix)
- [x] 12.2 Create `optimize-slow-activity` template (2 tasks: analyze-performance, create-optimized-variant)
- [x] 12.3 Create `extract-template-from-traces` template (3 tasks: validate, extract, register)
- [x] 12.4 Create `compose-activity-sequence` template (3 tasks: discover, merge, register)
- [x] 12.5 Shape performance analysis covered by v_shape_execution_stats view
- [x] 12.6 Deploy meta-activity templates to production (4 templates registered in metabob-production)

## 13. Workflow Composition Activities (activity-api) ✅

- [x] 13.1 Sequence discovery covered by `compose-activity-sequence` template (queries composition graph)
- [x] 13.2 Create `compose-activity-sequence` template with tasks for merging and registration
- [x] 13.3 Cost optimization covered by `optimize-slow-activity` template
- [x] 13.4 Repair functionality covered by `debug-failed-execution` template

## 14. Emergent Shape Network (activity-api) ✅

- [x] 14.1 Create `sql/schemas/045-emergent-shape-stats.surql` with network topology views
- [x] 14.2 Implement `v_shape_usage` view (16 records populated from backfilled templates)
- [x] 14.3 Implement `v_shape_network` view (shape transformation edges)
- [x] 14.4 Create GET `/v2/activities/shapes/network` endpoint
- [x] 14.5 Create GET `/v2/activities/shapes/usage` endpoint
- [x] 14.6 Create GET `/v2/activities/shapes/autocomplete` endpoint (derived from usage)

## 15. Selection-to-Execution Correlation (activity-api) ✅

- [x] 15.1 `/recommend` returns `correlation_id` in each recommendation (existing implementation)
- [x] 15.2 MiniBob passes `correlation_id` when storing execution trace (existing implementation)
- [x] 15.3 Create `sql/schemas/046-selection-outcomes-view.surql` with v_selection_outcomes
- [x] 15.4 Create GET `/v2/activities/execution-traces/selection-outcomes` endpoint
- [x] 15.5 Create GET `/v2/activities/execution-traces/selection-calibration` endpoint
- [x] 15.6 Create GET `/v2/activities/execution-traces/calibration-summary` endpoint

## 16. Production Deployment Verification ✅

- [x] 16.1 Deploy all schema changes to metabob-production cluster
- [x] 16.2 Run shape backfill migration on production database (12 templates updated)
- [x] 16.3 Verify meta-activity templates accessible (4 templates with 'meta.activity' tag)
- [ ] 16.4 Execute `debug-failed-execution` on a real failing trace (awaiting failure)
- [ ] 16.5 Verify Thompson Sampling scores update after meta-activity execution (awaiting execution)
- [ ] 16.6 Monitor `impulse_shape_activity_score` table growth over 24 hours (ongoing)
- [ ] 16.7 Generate learning loop health report (scheduled for next review)
