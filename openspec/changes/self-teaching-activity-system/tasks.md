## 1. Foundation - Activity Composition

- [x] 1.1 Add `createActivity` tool to MiniBob's tool registry (accepts template definition, validates, stores via backend)
- [x] 1.2 Add `runActivity` tool to MiniBob's tool registry (accepts activity ID + impulses, executes nested activity)
- [x] 1.3 Implement composition depth tracking in activity executor (track chain, enforce max depth limit)
- [x] 1.4 Add composition relationship fields to execution trace schema (parent_execution_id, composition_chain, depth)
- [x] 1.5 Update activity execution to support composed activities (load dynamically created templates, maintain separate impulse contexts)
- [ ] 1.6 Create tests for basic composition (activity creates and runs another activity)
- [ ] 1.7 Add composition metrics to backend (track success rates for activities as standalone vs composed)

## 2. Self-Discovery Bootstrap Activities

- [ ] 2.1 Create `discover-npm-scripts` bootstrap activity (parse package.json, generate activities for each script)
- [ ] 2.2 Create `discover-test-frameworks` bootstrap activity (detect Jest/Vitest/Mocha, generate test activities)
- [ ] 2.3 Create `discover-api-routes` bootstrap activity (scan for Express/Hono routes, generate route test activities)
- [ ] 2.4 Create `discover-dependencies` bootstrap activity (inventory node_modules, generate dependency exploration activities)
- [ ] 2.5 Implement bootstrap trigger on first session (detect new project, run discovery activities)
- [ ] 2.6 Add discovery results caching (store discovered capabilities, skip rediscovery on subsequent sessions)
- [ ] 2.7 Add force rediscovery mechanism (CLI flag or triggered by package.json changes)
- [ ] 2.8 Create tests for each bootstrap activity with example projects

## 3. Node.js Integration - NPM Package

- [ ] 3.1 Create npm package structure for MiniBob (setup package.json, entry points, exports)
- [ ] 3.2 Implement programmatic API (MiniBob class with executeActivity, executeActivityTemplate methods)
- [ ] 3.3 Add TypeScript definitions export (generate .d.ts files for full API)
- [ ] 3.4 Implement configuration loading from package.json minibob section
- [ ] 3.5 Add CLI commands (minibob run, minibob list, minibob discover)
- [ ] 3.6 Create example project demonstrating npm usage
- [ ] 3.7 Write integration tests for programmatic API
- [ ] 3.8 Publish initial version to npm registry (or private registry for testing)

## 4. Code Instrumentation Framework

- [ ] 4.1 Research and select Node.js instrumentation approach (ESM loader hooks vs runtime wrapping)
- [ ] 4.2 Implement ESM loader hook for function interception (wrap target functions with trace capture)
- [ ] 4.3 Add instrumentation spec parsing (read module path, function name, capture strategy from activity)
- [ ] 4.4 Implement trace point ID generation (stable IDs from module path + function name)
- [ ] 4.5 Add capture strategies (args-result, state-snapshot, async-lifecycle)
- [ ] 4.6 Implement TypeScript support (resolve TS source paths to compiled JS, use source maps)
- [ ] 4.7 Add validation of instrumentation targets (check module/function exist before execution)
- [ ] 4.8 Create example instrumented application for testing
- [ ] 4.9 Write tests for each capture strategy

## 5. Execution Tracing

- [ ] 5.1 Design trace data schema (trace point entries with ID, timestamp, args, result, state, metadata)
- [ ] 5.2 Implement trace capture at instrumentation points (record function calls, returns, errors)
- [ ] 5.3 Add trace size limits (bound state snapshot size, limit trace point count)
- [ ] 5.4 Implement trace aggregation for repeated patterns (compress tight loops)
- [ ] 5.5 Add trace storage integration (link traces to activity execution records in backend)
- [ ] 5.6 Implement trace retrieval API (query traces by execution ID, activity ID, outcome)
- [ ] 5.7 Add trace diff capability (compare traces across executions)
- [ ] 5.8 Create trace visualization component in activity dashboard
- [ ] 5.9 Write tests for trace capture and storage

## 6. New Impulse Types

- [ ] 6.1 Define `instrumentation-point` impulse schema (module path, function name, capture strategy, trace point ID)
- [ ] 6.2 Implement instrumentation-point resolver in backend (validate targets, return metadata)
- [ ] 6.3 Define `trace-snapshot` impulse schema (trace point ID, execution ID, captured state, filters)
- [ ] 6.4 Implement trace-snapshot resolver in backend (query trace storage, apply filters)
- [ ] 6.5 Define `execution-expectation` impulse schema (trace point ID, expected state, validation strategy, tolerance, intent)
- [ ] 6.6 Implement execution-expectation resolver in backend (load expectations with versioning)
- [ ] 6.7 Define `validation-result` impulse schema (expectation ID, execution ID, outcome, confidence, expected vs actual)
- [ ] 6.8 Implement validation-result resolver in backend (store results, update metrics)
- [ ] 6.9 Add backend storage for all new impulse types (SurrealDB schemas with indexes)
- [ ] 6.10 Update MiniBob impulse delegation logic (handle new types, fallback to backend gracefully)

## 7. Expectation Validation

- [ ] 7.1 Implement validation engine (compare trace snapshots against execution-expectation impulses)
- [ ] 7.2 Add validation strategies (strict-equality, structural, semantic with LLM, custom validator)
- [ ] 7.3 Implement tolerance-based validation (numeric ranges, pattern matching)
- [ ] 7.4 Add validation result recording (store outcomes with confidence scores)
- [ ] 7.5 Implement validation metrics aggregation (success rate per expectation across executions)
- [ ] 7.6 Create validation report generation (summary of passed/failed expectations with diffs)
- [ ] 7.7 Write tests for each validation strategy
- [ ] 7.8 Add validation visualization to activity dashboard

## 8. Adaptive Expectations - Intent-Driven Learning

- [ ] 8.1 Add intent field to execution-expectation schema (code-must-conform, expectations-may-evolve)
- [ ] 8.2 Implement code-must-conform learning path (failed validations trigger fix-validation-failure activity)
- [ ] 8.3 Implement expectations-may-evolve learning path (failed validations trigger update-expectation activity)
- [ ] 8.4 Create fix-validation-failure activity template (analyzes trace, proposes code fix)
- [ ] 8.5 Create update-expectation activity template (generates new expectation from consistent new behavior)
- [ ] 8.6 Implement expectation versioning (track history with timestamps, reasons, triggering executions)
- [ ] 8.7 Add expectation generation from successful traces (extract patterns from 5+ consistent executions)
- [ ] 8.8 Implement regression vs evolution classification (consistency heuristics)
- [ ] 8.9 Add user override mechanism (manually mark validation as bug or evolution)
- [ ] 8.10 Track classification accuracy and improve over time (learn from outcomes)

## 9. Activity Library Creation

- [ ] 9.1 Create file operation activities (read-file, write-file, edit-file, glob-files, grep-files)
- [ ] 9.2 Create dependency management activities (install-deps, update-deps, audit-deps, list-deps)
- [ ] 9.3 Create test execution activities (run-tests, run-test-file, watch-tests, coverage)
- [ ] 9.4 Create build process activities (build, clean, typecheck, lint)
- [ ] 9.5 Add activity metadata for discoverability (descriptions, required impulses, outputs, prerequisites)
- [ ] 9.6 Implement activity search and filtering (by capability, success rate, recency)
- [ ] 9.7 Add user-defined activity library (save successful discovered activities)
- [ ] 9.8 Create activity library management UI component in dashboard
- [ ] 9.9 Write tests for core library activities

## 10. Integration and End-to-End Testing

- [ ] 10.1 Create example Node.js project with MiniBob integration (package.json with minibob config)
- [ ] 10.2 Run self-discovery on example project (verify bootstrap activities generate domain-specific activities)
- [ ] 10.3 Execute generated activities with instrumentation (verify traces captured correctly)
- [ ] 10.4 Define expectations and run validation (verify conformance checking works)
- [ ] 10.5 Trigger validation failures intentionally (verify learning paths execute correctly)
- [ ] 10.6 Test activity composition in real scenarios (activity creates and runs multiple activities)
- [ ] 10.7 Verify trace storage and retrieval through full pipeline
- [ ] 10.8 Test expectation evolution through multiple executions
- [ ] 10.9 Deploy to metabob-devbob itself (dogfood the system)
- [ ] 10.10 Monitor dashboard for self-teaching behavior (continuous activity generation and execution)

## 11. Documentation and Refinement

- [ ] 11.1 Document npm package usage (README with installation, configuration, API reference)
- [ ] 11.2 Document activity composition patterns (examples of activities creating activities)
- [ ] 11.3 Document instrumentation spec format (how to declare trace points in activities)
- [ ] 11.4 Document expectation definitions (validation strategies, intent markers, tolerance)
- [ ] 11.5 Create developer guide for creating custom bootstrap activities
- [ ] 11.6 Document learning loop behavior (when code is fixed vs expectations updated)
- [ ] 11.7 Add troubleshooting guide (common issues with instrumentation, trace capture)
- [ ] 11.8 Create video walkthrough of self-teaching system in action
- [ ] 11.9 Refine based on dogfooding feedback (adjust from metabob-devbob usage)
- [ ] 11.10 Prepare blog post or talk explaining the architecture
