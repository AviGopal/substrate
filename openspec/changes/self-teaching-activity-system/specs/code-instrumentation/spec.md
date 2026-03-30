## ADDED Requirements

### Requirement: Inject trace points without source modification
The system SHALL instrument Node.js code at specified functions without modifying source files.

#### Scenario: Instrument function via module loader
- **WHEN** activity specifies instrumentation for module path and function name
- **THEN** system wraps target function with trace capture using ESM loader hooks

#### Scenario: Instrumentation persists across module reloads
- **WHEN** instrumented module is imported multiple times
- **THEN** instrumentation applies consistently to all imports

#### Scenario: Uninstrumented code runs normally
- **WHEN** code paths without instrumentation execute
- **THEN** system does not intercept or modify behavior

### Requirement: Strategic junction point targeting
Activities SHALL declare specific instrumentation points rather than comprehensive coverage.

#### Scenario: Instrument by declaration
- **WHEN** activity includes instrumentationSpec with module and function targets
- **THEN** system instruments only specified junction points

#### Scenario: Default junction points for framework patterns
- **WHEN** activity requests instrumentation for common patterns (API routes, middleware)
- **THEN** system applies framework-specific defaults (Express route handlers, Hono middleware)

#### Scenario: Validate instrumentation targets exist
- **WHEN** activity specifies non-existent module or function
- **THEN** system returns error before execution with clear diagnostic

### Requirement: Capture strategies for different contexts
The system SHALL support multiple capture strategies appropriate to the junction point type.

#### Scenario: Capture function arguments and return value
- **WHEN** instrumentation uses "args-result" capture strategy
- **THEN** system records input arguments, return value, and execution time

#### Scenario: Capture state snapshots
- **WHEN** instrumentation uses "state-snapshot" capture strategy
- **THEN** system captures arguments, return value, and accessible closure variables

#### Scenario: Capture async operation lifecycle
- **WHEN** instrumentation targets async function or Promise
- **THEN** system records initiation, resolution/rejection, and duration

### Requirement: Instrumentation is deterministic
The same code execution path SHALL produce identical trace structure with equivalent state data.

#### Scenario: Repeated execution produces consistent traces
- **WHEN** same activity runs same code path multiple times
- **THEN** trace structure is identical (same trace points, same order)

#### Scenario: Non-deterministic values are marked
- **WHEN** captured state includes timestamps, random values, or external data
- **THEN** system tags these as non-deterministic in trace metadata

#### Scenario: Trace point IDs are stable
- **WHEN** instrumentation targets a function
- **THEN** trace point ID is derived from module path and function name (stable across runs)

### Requirement: Instrumentation works with TypeScript
The system SHALL instrument TypeScript code compiled to JavaScript.

#### Scenario: Instrument TypeScript functions
- **WHEN** activity targets TypeScript source paths
- **THEN** system resolves to compiled JavaScript and instruments correctly

#### Scenario: Source maps for error reporting
- **WHEN** instrumented TypeScript code throws error
- **THEN** system reports error with original TypeScript line numbers

#### Scenario: Type information preserved in traces
- **WHEN** capturing TypeScript function arguments
- **THEN** system includes type annotations in trace metadata where available
