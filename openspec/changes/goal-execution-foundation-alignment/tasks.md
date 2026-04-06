## 1. Type System Updates

- [ ] 1.1 Add `resolverRequirements` field to `ActivityTask` interface in `repos/minibob/src/types.ts`
- [ ] 1.2 Add failure type enum and extended pattern fields to MCP client types in `repos/minibob/src/mcp.ts`
- [ ] 1.3 Add `ImpulseShape` type alias and schema types to `repos/minibob/src/types.ts`

## 2. Pre-Execution Validation

- [ ] 2.1 Create `checkPreValidationRules()` function in `repos/minibob/src/activity.ts`
- [ ] 2.2 Implement `requiredFiles` pre-check (verify files exist before LLM)
- [ ] 2.3 Implement `forbiddenPatterns` pre-check (verify patterns absent before LLM)
- [ ] 2.4 Add early return in `executeWithLLM()` when pre-validation passes
- [ ] 2.5 Add logging for pre-validation skips with execution trace metadata

## 3. Error Impulse Context

- [ ] 3.1 Create `createErrorImpulse()` function in `repos/minibob/src/impulse.ts`
- [ ] 3.2 Generate error impulse ID format: `error:{taskId}:{activityId}:{timestamp}`
- [ ] 3.3 Set error impulse shape to `previous_attempt_error` with attempt metadata
- [ ] 3.4 Add error impulse to task impulse list on retry in `activity.ts`
- [ ] 3.5 Remove string concatenation of error context from prompt building
- [ ] 3.6 Add error impulse relevance tracking on retry success/failure

## 4. Failure Pattern Recording

- [ ] 4.1 Extend `recordToolArgumentPattern` MCP call with failure type fields
- [ ] 4.2 Call pattern recording on validation failure with `failureType: 'validation'`
- [ ] 4.3 Call pattern recording on execution failure with `failureType: 'execution'`
- [ ] 4.4 Call pattern recording on timeout with `failureType: 'timeout'`
- [ ] 4.5 Track individual tool success within failed tasks (`toolSucceeded` field)

## 5. Schema Extraction Integration

- [ ] 5.1 Create `extractInputSchemaFromExecution()` in `repos/minibob/src/template-generator.ts`
- [ ] 5.2 Create `extractOutputSchemaFromExecution()` in `repos/minibob/src/template-generator.ts`
- [ ] 5.3 Create `calculateSchemaConfidenceFromExecution()` in `repos/minibob/src/template-generator.ts`
- [ ] 5.4 Call schema extraction in `assembleTemplateFromExecution()`
- [ ] 5.5 Include `input_schema` and `output_schema` in MCP registration payload
- [ ] 5.6 Add schema confidence logging for low-confidence templates

## 6. Composition Impulse Flow

- [ ] 6.1 Extend `recordComposition` MCP call with impulse flow fields
- [ ] 6.2 Extract input impulse IDs and shapes from execution result
- [ ] 6.3 Extract output impulse IDs and shapes from execution trace
- [ ] 6.4 Include impulse flow data when calling `recordComposition`
- [ ] 6.5 Add optional `impulseEvolution` tracking (created/modified/deleted)

## 7. Tool Filtering in Execution

- [ ] 7.1 Create `filterToolsForTask()` function in `repos/minibob/src/activity.ts`
- [ ] 7.2 Filter out tools listed in `resolverRequirements.excludeTools`
- [ ] 7.3 Validate tools listed in `resolverRequirements.requiredTools` are available
- [ ] 7.4 Fail task with clear error if required tool unavailable
- [ ] 7.5 Log tool filtering decisions in execution trace metadata

## 8. Ribosome Resolver Requirements Inference

- [ ] 8.1 Add `inferResolverRequirements()` to `repos/minibob/src/template-generator.ts`
- [ ] 8.2 Populate `requiredTools` from tools actually used in execution
- [ ] 8.3 Suggest `excludeTools` for dangerous tools not used in safe tasks
- [ ] 8.4 Preserve `preferredResolver` from existing `inferResolver()` detection
- [ ] 8.5 Include `resolverRequirements` in generated template tasks

## 9. Backend Schema Updates

- [ ] 9.1 Add `failure_type` and `failure_reason` columns to tool argument pattern table
- [ ] 9.2 Add `input_impulse_shapes` and `output_impulse_shapes` to composition graph table
- [ ] 9.3 Create `composition_impulse_flow` table for detailed tracking
- [ ] 9.4 Add `input_schema` and `output_schema` fields to activity template table
- [ ] 9.5 Add `schema_confidence` field to activity template metadata

## 10. Backend API Updates

- [ ] 10.1 Extend `recordToolArgumentPattern` endpoint to accept failure fields
- [ ] 10.2 Extend `recordComposition` endpoint to accept impulse flow fields
- [ ] 10.3 Extend template registration to store schemas
- [ ] 10.4 Add failure pattern aggregation to recommendation queries
- [ ] 10.5 Add impulse-conditioned success queries to composition API

## 11. MCP Client Updates

- [ ] 11.1 Update `recordToolArgumentPattern` in MCP client with failure fields
- [ ] 11.2 Update `recordComposition` in MCP client with impulse flow fields
- [ ] 11.3 Update template registration in MCP client with schema fields
- [ ] 11.4 Add type guards for new optional fields

## 12. Testing

- [ ] 12.1 Add unit tests for pre-validation rule checking
- [ ] 12.2 Add unit tests for error impulse creation
- [ ] 12.3 Add unit tests for tool filtering logic
- [ ] 12.4 Add unit tests for schema extraction functions
- [ ] 12.5 Add integration test for full execution with new features
- [ ] 12.6 Verify backward compatibility with existing templates

## 13. Documentation and Cleanup

- [ ] 13.1 Update `IMPULSE_ACTIVITY_FOUNDATION.md` with new patterns
- [ ] 13.2 Add inline documentation for new functions
- [ ] 13.3 Update type documentation in `types.ts`
- [ ] 13.4 Remove deprecated error string concatenation code
