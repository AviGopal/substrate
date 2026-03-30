## Context

MiniBob currently executes activities defined externally - templates stored in the backend or provided via API. This design introduces **activities as executable specifications** that MiniBob creates through self-discovery and validates through instrumentation.

**Current state:**
- Activities are static templates executed by MiniBob
- No mechanism for activities to create other activities
- Code execution happens without introspection or validation
- No way to verify code behavior matches activity intent

**Constraints:**
- Must work with Node.js/Bun codebases (initial scope)
- Cannot require source code modification for instrumentation
- Instrumentation must be deterministic and reproducible
- Must integrate with existing activity execution and trace storage

## Goals / Non-Goals

**Goals:**
- Enable MiniBob to discover capabilities and create activities autonomously
- Instrument Node.js code at strategic points without source modification
- Capture complete execution traces through instrumented paths
- Validate traced behavior against activity-defined expectations
- Learn whether to fix code or update expectations based on validation results

**Non-Goals:**
- Full code coverage instrumentation (only strategic junction points)
- Language support beyond Node.js/TypeScript initially
- Real-time debugging or step-through execution
- Production runtime instrumentation (dev/test only)
- General-purpose testing framework (focused on activity validation)

## Decisions

### 1. Activity Composition via Recursive Execution

**Decision:** Activities can invoke MiniBob's activity executor to run other activities.

**Rationale:**
- Reuses existing execution infrastructure
- Natural composition pattern (activities are just structured LLM prompts)
- Enables emergent behavior through discovered patterns
- All composed executions still produce traces for learning

**Alternatives considered:**
- Activity DSL for composition → Too rigid, limits emergence
- Separate composition engine → Unnecessary complexity, dual execution paths

**Implementation:** Add `createActivity()` and `runActivity()` to MiniBob's tool set, available to LLM during activity execution.

### 2. Instrumentation via Module Interception

**Decision:** Use Node.js module loader hooks to intercept function calls at import boundaries.

**Rationale:**
- No source modification required
- Works with TypeScript and JavaScript
- Deterministic (same code path = same trace)
- Can target specific modules/functions strategically

**Alternatives considered:**
- AST transformation → Requires build step, complicates toolchain
- Proxy wrappers → Manual, doesn't scale to full codebases
- VM instrumentation → Too low-level, performance overhead

**Implementation:** Node.js `--experimental-loader` with custom ESM loader that wraps target functions with trace capture.

### 3. Expectation Definitions as Impulses

**Decision:** Expectations are impulse metadata, not separate schemas.

**Rationale:**
- Expectations describe predicted state at trace points
- Impulses already represent "data with metadata for reasoning"
- Validation becomes impulse comparison (expected vs actual)
- Fits existing impulse resolution and storage patterns

**Alternatives considered:**
- Separate expectation schema → Duplicates impulse structure
- Embedded in activity tasks → Makes expectations implicit, harder to evolve

**Implementation:** New impulse type `execution-expectation` with fields: `tracePointId`, `expectedState`, `tolerance`, `validationStrategy`.

### 4. Bidirectional Learning via Intent Markers

**Decision:** Activities declare whether code should conform to expectations or vice versa using `intent` field.

**Rationale:**
- Sometimes code is wrong (bug fixes, new features)
- Sometimes expectations are wrong (misunderstood requirements, evolved intent)
- Learning system needs explicit signal about direction
- Enables gradual refinement of both code and activities

**Alternatives considered:**
- Always update expectations → Can't detect bugs
- Always fix code → Brittle, fights against evolution
- LLM decides each time → Inconsistent, expensive

**Implementation:** Activity tasks have `intent: "code-must-conform" | "expectations-may-evolve"` field. Failed validations trigger different learning paths.

### 5. Strategic Instrumentation Only

**Decision:** Instrument "junction points" explicitly identified by activities, not comprehensive coverage.

**Rationale:**
- Full coverage is expensive and noisy
- Strategic points (APIs, data transforms, async boundaries) capture essence
- Activities declare what matters for validation
- Traces remain human-readable and useful for learning

**Alternatives considered:**
- Automatic coverage instrumentation → Too much noise, storage bloat
- Manual source annotations → Requires code changes, doesn't work for dependencies
- Entry/exit only → Misses internal state transitions

**Implementation:** Activities declare trace points via `instrumentationSpec` with module path, function name, and capture strategy (args, result, state snapshot).

### 6. Self-Discovery via Bootstrap Activities

**Decision:** Ship MiniBob with seed "discovery" activities that inspect environment and generate domain-specific activities.

**Rationale:**
- Cold start problem: how does MiniBob learn without activities?
- Bootstrap activities are meta-activities (create activities from observations)
- Can inspect package.json, detect frameworks, scan APIs
- Generated activities become starting library for that codebase

**Alternatives considered:**
- Manual activity library → Doesn't scale, requires maintenance
- LLM generates ad-hoc → No reuse, no learning
- Static analysis only → Misses runtime behavior

**Implementation:** Core bootstrap activities: `discover-npm-scripts`, `discover-test-frameworks`, `discover-api-routes`, `discover-data-models`. Each produces activity templates stored in backend.

## Risks / Trade-offs

**[Performance overhead from instrumentation]**
→ Mitigation: Instrumentation only in dev/test, not production. Strategic points only, not full coverage.

**[Node.js loader hooks are experimental]**
→ Mitigation: Fallback to runtime wrapping via Proxy if loader unavailable. Document version requirements.

**[Activities creating activities could diverge from useful patterns]**
→ Mitigation: Thompson Sampling still selects successful patterns. Failures are traced and learned from. Manual review of high-performing generated activities.

**[Expectation drift: code changes break all expectations]**
→ Mitigation: Expectations are versioned with activity templates. Failed validations trigger expectation review activities. Intent markers guide whether to fix or update.

**[Storage growth from execution traces]**
→ Mitigation: Trace retention policy (keep successful traces sampled, keep all failures). Aggregation into learned patterns. Compression of redundant state snapshots.

**[Complexity of bidirectional learning]**
→ Mitigation: Start with explicit intent markers (simple). Evolve to LLM-suggested intent based on trace patterns. Keep human in the loop for intent changes.

## Migration Plan

**Phase 1: Foundation (weeks 1-2)**
- Package MiniBob as npm module with programmatic API
- Implement activity composition (createActivity, runActivity tools)
- Build bootstrap discovery activities
- Deploy and test in metabob-devbob itself

**Phase 2: Instrumentation (weeks 3-4)**
- Implement ESM loader hook with trace capture
- Add execution-expectation impulse type
- Integrate trace storage with metabob-activity-api
- Test with simple example project

**Phase 3: Validation (weeks 5-6)**
- Build expectation comparison engine
- Implement intent-based learning paths
- Create validation activities that run instrumented code
- Integrate with Thompson Sampling

**Phase 4: Self-Teaching (weeks 7-8)**
- Deploy discovery activities to generate project-specific activities
- Monitor generated activity success rates
- Refine bootstrap activities based on learning
- Document patterns for other projects

**Rollback strategy:**
- Phase 1-2: Remove npm package, revert to container-only MiniBob
- Phase 3-4: Disable instrumentation loader, fall back to non-validated execution

## Open Questions

1. **How granular should trace points be?** Function-level, statement-level, or declaration-driven?
   - Leaning toward: Declaration-driven by activities, default to function boundaries

2. **Should expectations be probabilistic (tolerance ranges) or exact?**
   - Leaning toward: Both - strict for deterministic code, tolerant for async/timing-dependent

3. **How to handle instrumentation of third-party dependencies?**
   - Leaning toward: Only instrument application code initially, expand to deps if activity requests it

4. **Should MiniBob auto-generate expectations from successful traces?**
   - Leaning toward: Yes - ribosome pattern applies here too. Successful traces become expected behavior.

5. **How to prevent runaway activity creation?**
   - Leaning toward: Rate limits on composition depth, storage quota per project, manual approval for new template categories
