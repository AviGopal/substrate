## Why

MiniBob needs to learn codebases by doing, not by reading documentation. Activities should be the executable specification of code intent, created through self-discovery, instrumented through strategic interception, and validated by comparing traced behavior against expectations. This transforms activities from external automation scripts into intrinsic representations of how code actually works.

## What Changes

- Add MiniBob as a dev dependency to Node.js projects with programmatic API
- Create self-discovery activities that explore runtime environments and generate new activities
- Implement activity composition system allowing activities to create and invoke other activities
- Build deterministic code instrumentation that intercepts execution at strategic junction points
- Add tracing framework that captures state transitions through instrumented code paths
- Create expectation validation system that compares traced behavior against activity predictions
- Implement adaptive expectation system that learns whether code should change to meet activity expectations or vice versa

## Capabilities

### New Capabilities

- `activity-library`: Core library of reusable activities for common Node.js operations (file operations, dependency management, test running, build processes)
- `self-discovery`: Activities that inspect runtime environments, identify capabilities, and generate new activities to exercise those capabilities
- `activity-composition`: System for activities to create, compose, and invoke other activities based on discovered patterns
- `nodejs-integration`: Package MiniBob as npm dependency with programmatic API for embedding in Node.js projects
- `code-instrumentation`: Framework for injecting trace points at function boundaries, async operations, and data transformations without modifying source
- `execution-tracing`: Capture complete state snapshots at instrumentation points including inputs, outputs, intermediate values, and control flow
- `expectation-validation`: Compare traced execution against activity-defined expectations to detect conformance or divergence
- `adaptive-expectations`: Bidirectional learning system that updates either code or activity expectations based on validation results and user-declared intent

### Modified Capabilities

- `activity-execution`: Extend to support activity-created activities and composition patterns
- `impulse-resolution`: Add new impulse types for instrumentation points, trace snapshots, and expectation definitions

## Impact

**Affected Components:**
- `repos/minibob/`: Core execution engine needs composition and instrumentation APIs
- `repos/metabob-activity-api/`: Storage for discovered activities, traces, and learned expectations
- Activity templates: New category for self-discovery and instrumentation activities

**New Dependencies:**
- Node.js instrumentation library (consider `async_hooks`, `inspector`, or custom AST transformation)
- Code transformation tooling for injection (babel/typescript compiler APIs)

**Breaking Changes:**
- None - this is additive to existing activity system

**Developer Workflow Impact:**
- Developers can `npm install minibob` and programmatically run activities
- Activities become living documentation that validates itself against actual code behavior
- Failed expectations trigger learning: either fix code to match intent or update activity to match new intent
