# Multi-Instance Coordination: Goals and Constraints

**Date**: 2026-02-28  
**Purpose**: Define clear goals and constraints for multi-instance coordination design  
**Context**: Analysis requested to understand design principles

---

## Executive Summary

The multi-instance coordination system has **clear, well-documented goals** focused on **eliminating git conflicts and enabling safe parallel execution** across multiple OpenCode instances. The constraints are **pragmatic and infrastructure-focused**, balancing simplicity with robustness.

**Key Insight**: This is **NOT a distributed computing research project**. It's an **operational necessity** to prevent data loss from concurrent git operations between competing instances.

---

## Primary Goals

### 1. 🎯 **IMMEDIATE: Stop Git Conflicts** (Priority: CRITICAL)

**Problem Statement**:
- 2 concurrent OpenCode instances running (PID 1937121, 1999075)
- Git commits from one instance reset by the other
- Recent Thompson Sampling work lost due to conflicts
- Development activities blocked by competing instances

**Goal**:
- **Reduce git conflict rate from "multiple per day" to ZERO**
- Enable multiple instances to safely execute git operations
- Prevent data loss from concurrent commits
- Unblock development progress immediately

**Success Metric**: 0 git conflicts in 24-hour test period

**Why This Matters**:
> "Our commits reset by other instance" (from SESSION_HONEST_STATUS_THOMPSON_GRADIENTS.md)
> 
> This is a **blocking issue preventing all improvement activities**. If we can't trust that our work won't be overwritten, we can't make progress.

---

### 2. 🎯 **PRIMARY: Enable Safe Parallel Execution**

**Goal**:
- Multiple OpenCode instances can work simultaneously without conflicts
- Instances coordinate on shared resources (git, file system, database)
- Work is distributed fairly across available instances
- No instance blocks others unnecessarily

**Target Scenarios**:
- 2-5 instances working on same codebase (immediate)
- 10+ instances in K8s deployment (future)
- Mixed environments (local dev + K8s pods)

**Success Metrics**:
- ✅ Coordination overhead <20%
- ✅ Work distribution fairness: coefficient of variation <0.2
- ✅ Lock acquisition latency <100ms p99
- ✅ No deadlocks or frozen instances
- ✅ Automatic recovery from instance crashes

---

### 3. 🎯 **SECONDARY: Enable Scalable Self-Reflection**

**Goal**:
- Run continuous self-reflection activities across multiple instances
- Collect execution data systematically for learning
- Feed learnings back to activity templates automatically
- Measure "becoming" velocity (system improvement rate)

**Vision**:
> "Enable self-reflection activities running continuously" → "System improving continuously"
> (from MULTI_INSTANCE_COORDINATION_REVIEW.md)

**Success Metrics**:
- ✅ 5+ instances running coordinated activities
- ✅ Activity template improvements accumulating
- ✅ Thompson Sampling metrics updating correctly
- ✅ Measurable system "becoming" velocity

---

### 4. 🎯 **LONG-TERM: Platform for Distributed Activities**

**Goal**:
- Activity execution engine scales horizontally
- Complex workflows span multiple instances
- Cross-instance dataflow tracing
- Orchestration with Dask/Prefect

**Use Cases**:
- Large-scale codebase analysis (multiple repos in parallel)
- Multi-environment deployments (dev, staging, prod simultaneously)
- Distributed testing (parallel test execution across instances)
- Knowledge accumulation (Library Learning System at scale)

**Success Metrics**:
- ✅ Dask/Prefect integration operational
- ✅ Multi-codebase work distribution efficient
- ✅ Cross-vessel activity delegation functional
- ✅ Observability dashboard deployed

---

## Primary Constraints

### 1. ⚙️ **INFRASTRUCTURE: Use Existing Services**

**Constraint**: Leverage already-running infrastructure, don't add new dependencies

**Available Infrastructure**:
- ✅ Redis (metabob-redis container, port 6379, 4 days uptime)
- ✅ SurrealDB (metabob-surreal container, port 8000, 16 hours uptime)
- ✅ Kubernetes clusters (DigitalOcean, ops/dev/prod)
- ✅ Dask/Prefect for orchestration (repos/platform)

**Design Decision**:
> "Use existing metabob-redis container" (from MULTI_INSTANCE_COORDINATION_REVIEW.md)

**Why This Matters**:
- Faster deployment (no new services to set up)
- Lower operational overhead (one less thing to monitor)
- Proven reliability (services already battle-tested)

**Implications**:
- Redis as primary coordination backend (locks, queues, registry)
- SurrealDB for persistent state and metrics
- No new databases, message brokers, or coordination services needed

---

### 2. ⚙️ **PERFORMANCE: Coordination Overhead <20%**

**Constraint**: Coordination must be lightweight, not bottleneck execution

**Measurement**:
```
Overhead = (Time_with_coordination - Time_without_coordination) / Time_without_coordination

Target: Overhead < 0.20 (20%)
```

**Why 20%**:
- Acceptable performance tax for safety and scalability
- Aggressive enough to force efficient design
- Loose enough to allow comprehensive coordination

**Design Implications**:
- **Connection pooling**: Reuse Redis connections (10 per instance)
- **Async operations**: Non-blocking coordination calls where possible
- **Minimal network round-trips**: Batch operations, reduce chattiness
- **Local caching**: Cache registry data, reduce repeated queries
- **Optimistic locking**: Fail-fast, don't block on conflicts

**Monitoring**:
```python
metrics = {
  "operation_latency_increase": "Target <20%",
  "redis_connection_pool_usage": "Monitor saturation",
  "network_rtt_to_redis": "Track baseline",
  "lock_acquisition_latency": "Target <100ms p99"
}
```

---

### 3. ⚙️ **RELIABILITY: Graceful Degradation**

**Constraint**: System must remain operational even when coordination fails

**Scenarios**:
1. **Redis unavailable**: Fall back to single-instance mode (no coordination)
2. **Lock timeout**: Release locks automatically (no deadlocks)
3. **Instance crashes**: Reclaim work from dead instances
4. **Network partition**: Instances operate independently, reconcile later

**Design Patterns**:

**Circuit Breaker**:
```python
if redis_connection_failed():
  if failure_count > threshold:
    logger.warning("Redis unavailable, entering single-instance mode")
    disable_coordination()
    use_noop_registry()
```

**Automatic Lock Expiration**:
```python
# All locks have TTL
lock = acquire_lock(resource="git", timeout=300)  # 5 min max
# No deadlocks - lock auto-releases after timeout
```

**Dead Instance Detection**:
```python
# Heartbeat monitoring
if time_since_heartbeat(vessel_id) > heartbeat_timeout:
  logger.warning(f"Vessel {vessel_id} appears dead, reclaiming work")
  reclaim_expired_work(vessel_id)
  deregister_vessel(vessel_id)
```

**Why This Matters**:
> "Risk 1: Redis becomes single point of failure → Mitigation: Graceful degradation to single-instance mode"
> (from MULTI_INSTANCE_COORDINATION_REVIEW.md)

**Success Metric**: System continues operating (degraded) during coordination failures

---

### 4. ⚙️ **SAFETY: Fail-Fast on Conflicts**

**Constraint**: Default conflict resolution strategy is **fail-fast**, not silent overwrite

**Rationale**:
- Data integrity > availability (for development workflows)
- Better to fail loudly than corrupt state silently
- Explicit conflict resolution preferred over automatic merge

**Conflict Resolution Strategies** (configurable):

1. **fail-fast** (default): Raise error on conflict, require manual resolution
2. **last-write-wins**: Overwrite with latest (use carefully)
3. **merge**: Attempt to merge compatible changes (experimental)

**Design Decision**:
```typescript
conflict_strategy: "fail-fast"  // Safest default
```

**Why fail-fast**:
- Prevents silent data loss (we've already experienced this)
- Forces developers to be aware of conflicts
- Encourages better coordination patterns
- Aligns with git philosophy (explicit conflict resolution)

**Example**:
```python
def update_shared_state(key, value, version):
  current_version = get_version(key)
  if current_version != version:
    if conflict_strategy == "fail-fast":
      raise ConflictError(f"State conflict on {key}: expected v{version}, found v{current_version}")
    elif conflict_strategy == "last-write-wins":
      logger.warning(f"Overwriting {key} v{current_version} with v{version}")
      set_value(key, value, version + 1)
    elif conflict_strategy == "merge":
      merged = merge_values(get_value(key), value)
      set_value(key, merged, version + 1)
```

---

### 5. ⚙️ **SIMPLICITY: Start Minimal, Expand Incrementally**

**Constraint**: Deploy core functionality first, add features incrementally

**Phase 1: Critical Foundation** (NOW - Blocking Issue)
- ✅ Distributed locks (prevent git conflicts)
- ✅ Instance registry (track active instances)
- ✅ Basic health monitoring

**Phase 2: Work Distribution** (Week 2-3)
- ✅ Work queue system
- ✅ Fair scheduling
- ✅ Lease-based work claiming

**Phase 3: Advanced Coordination** (Week 4+)
- ✅ State synchronization
- ✅ Dask/Prefect integration
- ✅ Cross-vessel delegation

**Phase 4: Observability** (Month 2+)
- ✅ Monitoring dashboard
- ✅ Metrics collection
- ✅ Performance tuning

**Why Incremental**:
- Faster time to value (fix git conflicts immediately)
- Lower risk (test each component before adding next)
- Feedback-driven (learn from usage before expanding)
- Easier debugging (smaller surface area initially)

**Design Decision**:
```typescript
// Recommended first execution
{
  test_mode: true,                      // Start with testing
  enable_dask_integration: false,       // Enable incrementally
  enable_prefect_integration: false
}
```

---

### 6. ⚙️ **TESTABILITY: Comprehensive Validation**

**Constraint**: All coordination primitives must be thoroughly tested

**Test Levels**:

1. **Unit Tests**: Each primitive in isolation
   - Lock acquisition/release
   - Queue push/claim/release
   - Registry register/heartbeat/deregister
   - State sync strategies

2. **Integration Tests**: Primitives with Redis
   - Lock timeout and deadlock detection
   - Queue lease expiration and reclaim
   - Registry dead instance cleanup
   - Concurrent operation safety

3. **Multi-Instance Tests**: Full coordination harness
   - 2-5 instances performing concurrent operations
   - Intentional conflict scenarios
   - Instance crash and recovery
   - Network partition simulation

4. **Git Conflict Tests**: Critical path validation
   - 2 instances attempting concurrent git commit
   - Verify lock prevents conflict
   - Measure coordination overhead
   - Validate automatic lock release

**Test Requirement**:
> "Task 7: validate-and-document - Run full test suite, Create multi-instance test harness"
> (from MULTI_INSTANCE_COORDINATION_REVIEW.md)

**Success Criteria**:
- ✅ All unit tests passing
- ✅ Integration tests passing (with Redis)
- ✅ Multi-instance harness validates safety
- ✅ Git conflict test passes (0 conflicts with coordination)

---

## Design Principles (Extracted from Implementation)

### Principle 1: **Distributed Locks as Foundation**

All shared resource access protected by distributed locks:

```python
@distributed_lock(resource="git", timeout=300)
def git_commit(message: str):
    """Protected git operation"""
    # Only one instance can execute at a time
    # Automatic lock release after 5 minutes
    # No deadlocks possible
```

**Why**:
- Prevents race conditions on shared resources
- Simple mental model (mutual exclusion)
- Composable (can lock multiple resources)

---

### Principle 2: **Heartbeat-Based Health Monitoring**

Instance liveness tracked via heartbeats:

```python
# Every 5 seconds
heartbeat(vessel_id, status="running")

# Detection
if time_since_heartbeat(vessel_id) > 15:
  # Mark as dead, reclaim work
```

**Why**:
- Detects crashed instances automatically
- No manual cleanup needed
- Enables work reclamation

---

### Principle 3: **Lease-Based Work Claiming**

Work queue uses leases to prevent lost work:

```python
# Instance claims work with lease
activity_id = claim_work(vessel_id, lease_duration=300)

# Heartbeat extends lease
heartbeat_work(vessel_id, activity_id)

# Expired leases auto-reclaimed
reclaim_expired_work()
```

**Why**:
- Automatic recovery from crashed instances
- No work lost due to instance failure
- Fair work distribution

---

### Principle 4: **Optimistic Locking for State**

Shared state uses version numbers:

```python
# Read state with version
value, version = get_state(key)

# Update with version check
try:
  set_state(key, new_value, expected_version=version)
except ConflictError:
  # Handle conflict based on strategy
```

**Why**:
- Detects concurrent modifications
- Low overhead (no locks on reads)
- Explicit conflict handling

---

### Principle 5: **Connection Pooling for Performance**

Redis connections pooled and reused:

```python
redis_pool = ConnectionPool(
  host=redis_host,
  port=redis_port,
  max_connections=10  # Per instance
)
```

**Why**:
- Reduces connection overhead (<20% target)
- Prevents connection exhaustion
- Improves latency

---

## Non-Goals (What This Is NOT)

### ❌ NOT a General-Purpose Distributed System

**This is NOT**:
- Consensus algorithm (Raft, Paxos)
- Distributed transaction system (2PC, Saga)
- CAP-theorem exploration
- Academic research project

**This IS**:
- Pragmatic solution to specific coordination needs
- Operational tool for safe parallel execution
- Foundation for activity engine scalability

---

### ❌ NOT High-Availability Infrastructure

**This is NOT**:
- 99.99% uptime system
- Multi-region disaster recovery
- Byzantine fault tolerance
- Enterprise-grade clustering

**This IS**:
- Development/research infrastructure
- "Good enough" reliability with graceful degradation
- Single-region deployment (DigitalOcean K8s)

---

### ❌ NOT Real-Time System

**This is NOT**:
- Low-latency (<10ms) coordination
- Hard real-time guarantees
- High-frequency trading requirements

**This IS**:
- Development workflow coordination (human timescales)
- Target: <100ms lock acquisition latency
- Acceptable: 100-500ms for most operations

---

### ❌ NOT Complex Orchestration Engine

**This is NOT**:
- Replacement for Kubernetes orchestration
- Airflow/Prefect alternative
- Complex workflow DAG execution

**This IS**:
- Supplement to existing orchestration (Dask, Prefect)
- Activity-specific coordination layer
- Integration hooks, not replacement

---

## Constraints Summary Table

| Constraint Category | Specific Constraint | Rationale | Impact |
|---------------------|---------------------|-----------|---------|
| **Infrastructure** | Use existing Redis + SurrealDB | No new services to deploy | Faster deployment, lower ops overhead |
| **Performance** | Overhead <20% | Must not bottleneck execution | Connection pooling, async ops, caching |
| **Reliability** | Graceful degradation | Must survive coordination failures | Circuit breakers, fallback modes |
| **Safety** | Fail-fast on conflicts | Prevent silent data loss | Explicit conflict resolution required |
| **Simplicity** | Incremental deployment | Reduce risk, faster value | Phase 1 → Phase 4 rollout |
| **Testability** | Comprehensive tests | Ensure safety before production | Unit, integration, multi-instance tests |
| **Compatibility** | Existing codebase | No breaking changes | Drop-in coordination layer |
| **Observability** | Metrics & monitoring | Operational visibility | Track overhead, conflicts, health |

---

## Trade-offs Made

### Trade-off 1: **Availability vs. Consistency**

**Choice**: Prioritize consistency (fail-fast) over availability

**Why**:
- Development workflows tolerate brief unavailability
- Data loss from conflicts is worse than temporary block
- Aligns with git philosophy (explicit merge conflicts)

**Implication**: Some operations may fail due to conflicts, requiring retry

---

### Trade-off 2: **Simplicity vs. Sophistication**

**Choice**: Simple primitives (locks, queues) over complex protocols (Raft, Paxos)

**Why**:
- Faster to implement and deploy
- Easier to debug and understand
- Good enough for development scale (2-10 instances)
- Can upgrade later if needed

**Implication**: Not suitable for large-scale (100+ instances) deployments

---

### Trade-off 3: **Performance vs. Safety**

**Choice**: Accept 20% overhead for comprehensive coordination

**Why**:
- Safety and correctness more important than raw speed
- 20% is acceptable for development workflows
- Eliminates entire class of bugs (race conditions)

**Implication**: Activity execution 20% slower with coordination enabled

---

### Trade-off 4: **Autonomy vs. Coordination**

**Choice**: Require explicit coordination for shared resources

**Why**:
- Explicit better than implicit (Zen of Python)
- Easier to reason about coordination points
- Forces developers to think about concurrency

**Implication**: Developers must use `@distributed_lock` decorator explicitly

---

## Success Criteria (Complete List)

### Immediate Success (Phase 1)
- ✅ Git conflict rate: 0 (down from multiple per day)
- ✅ Coordination overhead: <20%
- ✅ All unit tests passing
- ✅ Integration tests passing (with Redis)
- ✅ Lock acquisition latency: <100ms p99
- ✅ No deadlocks observed

### Short-term Success (Phase 2-3)
- ✅ Thompson Sampling metrics updating correctly
- ✅ Improvement Gradients calculating properly
- ✅ Activity execution metrics collection verified
- ✅ System functionality: 30% → 70% confirmed
- ✅ Work distribution fairness: CV <0.2
- ✅ Failover time: <30 seconds

### Medium-term Success (Phase 4)
- ✅ 5+ instances running in coordination
- ✅ Dask/Prefect integration operational
- ✅ Self-reflection activities running continuously
- ✅ Activity template improvements accumulating
- ✅ Monitoring dashboard deployed
- ✅ Cross-vessel delegation functional

### Long-term Success (6+ months)
- ✅ 10+ instances coordinated
- ✅ Multi-codebase work distribution efficient
- ✅ System "becoming" velocity measurable
- ✅ Autonomous improvement at scale
- ✅ Zero git conflicts maintained over months

---

## Key Lessons Applied from Recent Sessions

From `docs/SESSION_HONEST_STATUS_THOMPSON_GRADIENTS.md`:

### Lesson 1: **Test Immediately, Don't Assume**

**Problem**:
> "Implemented code ✓, Built code ✓, Committed code ✓, **SKIPPED TESTING** ✗ ← BIG MISTAKE"

**Applied to This Plan**:
- ✅ Test coordination immediately after deployment
- ✅ Verify Thompson Sampling before claiming success
- ✅ Check Functional state (git conflicts stopped) not just Instructional (code exists)
- ✅ Include verification in timeline ("at pace" includes testing)

### Lesson 2: **Trust Functional State, Not Beliefs**

**Problem**:
> "Believed: 'Implemented Thompson Sampling', Reality: Code was removed by other instance"

**Applied to This Plan**:
- ✅ Verify functional behavior (0 git conflicts observed)
- ✅ Don't claim success based on code existence
- ✅ Measure actual outcomes, not intentions

### Lesson 3: **Coordination Required for Multiple Instances**

**Problem**:
> "2 bun processes stepping on each other, Our commits reset by other instance"

**Applied to This Plan**:
- ✅ This entire coordination system addresses root cause
- ✅ Explicit goal: eliminate git conflicts
- ✅ Distributed locks protect shared resources

### Lesson 4: **"At Pace" Includes Verification**

**Problem**:
> "Speed is important, Correctness is critical"

**Applied to This Plan**:
- ✅ Fast deployment (12-25 min activity execution)
- ✅ Comprehensive testing (Task 7 of activity)
- ✅ Verification before production (test_mode: true)

---

## Conclusion: Goals and Constraints are Clear

### Goals are **Specific and Measurable**:
1. ✅ Reduce git conflicts to ZERO (from multiple/day)
2. ✅ Enable 2-5 instances to work safely in parallel
3. ✅ Coordination overhead <20%
4. ✅ Scale to distributed self-reflection activities

### Constraints are **Pragmatic and Justified**:
1. ✅ Use existing infrastructure (Redis, SurrealDB)
2. ✅ Performance target: <20% overhead
3. ✅ Reliability: graceful degradation
4. ✅ Safety: fail-fast on conflicts
5. ✅ Simplicity: incremental deployment
6. ✅ Testability: comprehensive validation

### Design is **Ready for Execution**:
- ✅ Activity template created and registered
- ✅ Infrastructure available (Redis running)
- ✅ Success criteria defined
- ✅ Test strategy documented
- ✅ Rollout plan phased

### Next Step is **Clear**:

```bash
# Execute the coordination setup activity
activity({
  templateId: "setup-multi-instance-coordination",
  variables: {
    redis_host: "localhost",
    redis_port: 6379,
    test_mode: true,                      # Start with testing
    enable_dask_integration: false,       # Enable incrementally
    enable_prefect_integration: false
  },
  reason: "Deploy coordination system to eliminate git conflicts between running instances"
})
```

**Estimated Time**: 12-25 minutes  
**Estimated Cost**: ~$1.12  
**Expected Outcome**: Zero git conflicts, safe parallel execution enabled

---

**Status**: Goals and Constraints Documented  
**Clarity**: HIGH (clear problem, clear solution, clear metrics)  
**Readiness**: READY FOR EXECUTION  
**Blocker**: None (infrastructure available, template ready)
