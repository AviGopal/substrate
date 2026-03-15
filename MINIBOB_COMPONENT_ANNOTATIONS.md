# minibob-standalone-execution Component Annotations

## Component 1: HTTP Server Entry Point (index.ts)

**Component**: startServer() function in repos/minibob/index.ts

**Role in Flow**: Primary entry point for minibob standalone execution. Initializes all subsystems and exposes HTTP API for user-initiated activities and vessel-to-vessel communication.

**Data Transformation**: 
- Environment variables → MinibobConfig
- HTTP Request → ActivityExecution
- VesselManifest → Backend registration

**Business Logic**:
The HTTP server enforces the vessel contract: minibob must be discoverable (via /health, /config), executable (via /run), and communicative (via /acp). This enables:
- Kubernetes orchestration (health checks for pod lifecycle)
- Backend task distribution (vessel registration)
- User-initiated activities (POST /run)
- Vessel-to-vessel delegation (POST /acp)

**Design Decision**: 
Used Bun.serve() instead of Express/Fastify because:
- Zero dependencies (reduces attack surface)
- Native HTTP/2 support
- Built-in WebSocket (future ACP streaming)
- Faster startup time (critical for K8s pod scaling)
- Smaller container image (~50MB vs ~200MB with Node+Express)

**Constraints**:
- Single-threaded (Bun limitation) - no parallel activity execution
- No request queuing - concurrent requests block each other
- No graceful shutdown - in-flight activities lost on pod termination
- No request body size limits - DoS risk
- Fire-and-forget backend registration - continues even if registration fails

**Business Context**:
Minibob is designed as a minimal autonomous agent vessel. The HTTP server is intentionally simple to reduce operational complexity. The fire-and-forget pattern for backend communication ensures minibob can operate independently even when the backend is unavailable, supporting the "standalone" execution model.

---

## Component 2: Activity Execution Engine (activity.ts)

**Component**: ActivityExecutor class in repos/minibob/src/activity.ts

**Role in Flow**: Core business logic component that orchestrates LLM-driven task execution. Transforms declarative activity templates into concrete execution results through iterative LLM + tool calling.

**Data Transformation**:
- ActivityTemplate + Variables → ActivityExecution
- Template tasks → Topologically sorted execution order
- ContextRequirements → Loaded Impulses
- Task prompts → LLM completions → Tool executions → Task results
- Task results → activityOutput impulses (for downstream tasks)

**Business Logic**:
Enforces the activity execution contract:
1. Context requirements must be satisfied before execution
2. Tasks execute in dependency order (topological sort)
3. Each task must pass validation before marked complete
4. Failed tasks retry up to maxAttempts with error context
5. Execution metrics (duration, cost, tokens) tracked for learning

**Design Decision**: 
Chose imperative execution (executor class) over declarative engine because:
- Need fine-grained control over LLM tool calling loop
- Must handle stateful impulse loading/caching
- Requires custom retry logic with error context injection
- Enables nesting (activity tool calls executor recursively)
- Allows optimization of impulse loading (lazy + budget-aware)

Alternative considered: Workflow engine like Temporal
- Rejected because: Adds heavyweight dependency, over-engineered for single-vessel use case

**Constraints**:
- Sequential task execution only (no parallelism despite DAG structure)
  - Why: Simplifies debugging, matches LLM single-threaded nature
  - Future: Could parallelize independent tasks for speed
- Token budget per impulse, but no total activity budget
  - Risk: Runaway costs if many large impulses
- No checkpoint/resume - execution state lost on crash
  - Impact: Long-running activities vulnerable to pod evictions
- activityOutputs Map shared across nested executions
  - Risk: Race conditions if parallel execution added

**Business Context**:
Activity execution is the primary value delivery mechanism. Templates encode reusable workflows (e.g., "add REST endpoint", "fix bug"), and the executor brings them to life. The learning loop depends on execution metrics reported to backend, enabling Thompson Sampling optimization. This is why validation and metric tracking are first-class concerns.

**Traceability**:
- Each execution gets unique ID: act_{timestamp}_{random}
- Task results stored with status, duration, error
- Execution reported to MCP backend for learning
- Links to boredom tasks via executionId field

---

## Component 3: Autonomous Boredom System (boredom.ts)

**Component**: BoredomTaskExecutor class in repos/minibob/src/boredom.ts

**Role in Flow**: Autonomous task execution system that polls backend for work when vessel is idle. Enables zero-touch operation and continuous improvement.

**Data Transformation**:
- Idle detection (lastActivityTime > idleThreshold) → Poll trigger
- Backend BoredomTask[] → Priority-sorted queue
- BoredomTask → ActivityExecution (via ActivityExecutor)
- ActivityExecution → BoredomTaskResult → Backend notification

**Business Logic**:
Implements autonomous agent behavior:
1. Monitor activity (track lastActivityTime)
2. Detect idle state (no activity for 60+ seconds)
3. Poll backend for available tasks (GET /boredom-tasks)
4. Execute highest priority task first (critical > high > medium > low)
5. Report result to backend (success/failure + executionId)
6. Reset idle timer and repeat

Priority semantics:
- Critical: Security fixes, production outages (execute immediately)
- High: User-blocking issues, urgent features
- Medium: Enhancements, refactoring
- Low: Cleanup, documentation

**Design Decision**:
Chose polling over push (WebSocket/SSE) because:
- Simpler implementation (no connection management)
- More resilient to backend restarts (auto-reconnect via poll)
- Easier to scale (stateless, no connection pooling)
- Backend controls poll rate (can throttle by returning 404)
- Fits fire-and-forget pattern (no ack required)

Alternative considered: Backend push via WebSocket
- Rejected because: Requires connection lifecycle management, harder to debug

**Constraints**:
- Fixed poll interval (30s) - not adaptive
  - Could be smarter: Exponential backoff on empty responses
- No circuit breaker - polls forever even if backend down
  - Risk: Resource waste, log spam
- Single task execution at a time - no parallel boredom tasks
  - Why: Simplifies state management, prevents resource contention
- No task timeout - could hang on long-running tasks
  - Risk: Vessel stops polling if task never completes

**Business Context**:
Boredom tasks are the key differentiator for "standalone" execution. Unlike traditional CI/CD that waits for commits, minibob proactively looks for work. This enables:
- Continuous code improvement (refactoring, test coverage)
- Proactive issue detection (security scans, dependency updates)
- Zero-touch operations (automatic issue resolution)

The idle threshold prevents thrashing: Minibob only looks for work when genuinely idle, not between every user activity. This balances responsiveness with resource efficiency.

**Learning Loop Integration**:
- executionId links boredom task to activity execution
- Backend tracks which templates succeed for which task types
- Thompson Sampling learns optimal template assignments
- Variant creation happens on backend, not in minibob

---

## Component 4: MCP Backend Integration (mcp.ts)

**Component**: MCPClient class in repos/minibob/src/mcp.ts

**Role in Flow**: Integration boundary that abstracts all backend communication. Enables template discovery, execution reporting, impulse sharing, and vessel registration.

**Data Transformation**:
- Template ID → ActivityTemplate (GET /activity-templates/{id})
- ActivityExecution → JSON payload (POST /activity-executions)
- VesselManifest → Registration payload (POST /vessels)
- Impulse → Shared impulse storage (POST /impulses)
- BoredomTask query → Task array (GET /boredom-tasks)

**Business Logic**:
Implements fire-and-forget resilience pattern:
- All write operations (POST) return boolean, never throw
- All read operations (GET) return null/[] on failure
- Network errors logged but don't propagate
- Execution continues regardless of backend availability

This ensures:
- User activities complete even if backend is down
- Template loading falls back to local filesystem
- Execution reporting is best-effort (learning degrades gracefully)

**Design Decision**:
Chose REST over gRPC/MCP protocol because:
- HTTP/JSON is universally supported (no protocol buffers)
- Easier debugging (curl, browser tools work)
- Works through proxies/firewalls without special config
- Simpler error handling (HTTP status codes)
- Future: Could add MCP protocol for bidirectional streaming

Fire-and-forget pattern chosen because:
- Backend unavailability shouldn't block vessel operation
- Vessel autonomy is primary design goal
- Learning loop is optimization, not requirement
- Idempotent operations safe to retry (vessel registration)

**Constraints**:
- No retry logic - single attempt per request
  - Risk: Transient failures treated as permanent
  - Mitigation: Backend should retry on its end
- No API versioning - schema changes break compatibility
  - Risk: Backend updates require synchronized vessel deployment
- 30-second timeout - long backend processing fails
  - Trade-off: Prevents hung requests vs allows slow operations
- No request deduplication - same template fetched multiple times
  - Waste: Network bandwidth, backend load
  - Optimization opportunity: Add LRU cache

**Business Context**:
MCP (Metabob Control Plane) backend is the central learning system. It:
- Stores activity templates (shared across all vessels)
- Tracks execution metrics (success rate, duration, cost)
- Implements Thompson Sampling (variant selection)
- Distributes boredom tasks (work assignment)
- Maintains vessel registry (fleet management)

Minibob's relationship to backend is:
- Fetch templates (backend is source of truth)
- Report executions (backend learns from results)
- Receive tasks (backend assigns work)
- Local fallback (works without backend for user activities)

This enables a hybrid architecture: Autonomous local execution with centralized learning.

**Integration Points**:
- Kubernetes DNS: metabob-rpc-api.metabob.svc.cluster.local
- Configuration: MCP_ENDPOINT environment variable
- Authentication: Optional Bearer token (not currently used)
- Timeout: 30s via AbortController

---

## Component 5: Impulse Context Management (impulse.ts)

**Component**: ImpulseStore class in repos/minibob/src/impulse.ts

**Role in Flow**: Context management system that abstracts content loading and enables lazy, budget-aware context provision to LLM. Critical for preventing token explosion.

**Data Transformation**:
- ContextRequirement → Unloaded Impulse
- ImpulsePointer → Raw content (file read, activity output, memo, custom resolver)
- Raw content → Token-estimated content
- Over-budget content → Truncated content (with safety margin)
- Loaded impulses → XML-formatted context string

**Business Logic**:
Implements two-phase context loading:
1. **Creation Phase** (during activity initialization):
   - Parse template.contextRequirements
   - Interpolate variables into source paths
   - Create unloaded impulses (just metadata)
   - Register custom resolvers (e.g., glob)

2. **Loading Phase** (when task references impulse):
   - Resolve pointer to raw content
   - Estimate token count (chars / 4)
   - Truncate if over budget (ratio * 0.9 for safety)
   - Cache loaded content (don't re-load)

**Design Decision**:
Chose lazy loading over eager loading because:
- Templates often declare more context than tasks need
- Conditional tasks (if statements in prompts) may skip impulses
- Budget enforcement more accurate with actual usage
- Memory efficient (only load what's used)

Alternative considered: Eager loading all impulses upfront
- Rejected because: Wastes tokens, could exceed LLM context limit

Chose pointer abstraction over direct file paths because:
- Enables multiple content sources (files, outputs, memos, custom)
- Decouples template from implementation (file path can change)
- Allows future optimizations (remote content, compression)
- Supports testing (mock pointers without filesystem)

**Constraints**:
- Token estimation is approximate (chars / 4)
  - Risk: Real tokenization differs, could exceed budget
  - Mitigation: 10% safety margin (use only 90% of budget)
- Truncation is naive (substring from start)
  - Loss: Might cut important context at end (imports, functions)
  - Better: Intelligent truncation (keep imports + relevant sections)
- No garbage collection - impulses accumulate forever
  - Risk: Long-running vessels OOM from impulse cache
  - Fix: LRU cache with max size (e.g., 1000 impulses)
- activityOutput pointers couple to execution instance
  - Risk: Nested activities could corrupt parent's outputs

**Business Context**:
Impulses are the context provisioning mechanism that makes LLM agents effective. Without impulses, LLM would operate in a vacuum. With impulses, LLM has:
- File contents (read code before modifying)
- Activity outputs (chain tasks together)
- Custom context (glob results, search results, etc.)

Budget enforcement is critical because:
- LLM context windows have limits (200K tokens for Claude)
- Costs scale linearly with tokens ($0.003/1K input tokens)
- Large codebases could easily exceed context limits
- Template authors need guardrails (prevent accidental explosion)

The pointer abstraction enables innovation:
- Future: Semantic search results as impulse
- Future: Remote file fetch from GitHub
- Future: Database query results as impulse
- Future: Multi-modal impulses (images, diagrams)

**Pointer Types**:
1. `file`: Read from filesystem (most common)
2. `memo`: In-memory string (for generated content)
3. `activityOutput`: Previous task's output (task chaining)
4. `custom`: Extensible via resolver functions (glob, search, etc.)
