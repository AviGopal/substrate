# Multi-Instance Coordination Review & Implementation Plan

**Date**: 2026-02-24  
**Status**: 🎯 **READY FOR IMPLEMENTATION**  
**Blocking Issue**: Multiple OpenCode instances causing git conflicts and data loss

---

## Executive Summary

### Current State Analysis

**Problem Identified**:
- **2 concurrent OpenCode instances running** (PID 1937121, 1999075)
- **Git conflicts occurring** - one instance reset another's commits (Thompson Sampling work)
- **Development activities blocked** - cannot safely run improvement activities
- **Self-reflection limited** - multiple instances compete rather than coordinate

**Infrastructure Available**:
- ✅ repos/platform - Full Kubernetes infrastructure (DigitalOcean)
- ✅ Docker containers running: devbob-clean, Redis, SurrealDB, API server, Celery
- ✅ Dask/Prefect for distributed computing
- ✅ ArgoCD for GitOps deployments
- ✅ Helmfile for service management

**Recent Work**:
- ✅ Thompson Sampling & Improvement Gradients restored (code exists, NOT TESTED)
- ✅ Platform submodule updated with latest infrastructure
- ✅ Comprehensive documentation of three-state ontology
- ⚠️ Activity template created: `setup-multi-instance-coordination`

---

## Solution: Multi-Instance Coordination System

### Template Created: `setup-multi-instance-coordination`

**Category**: Infrastructure  
**Tasks**: 7 (parallel execution optimized)  
**Estimated Cost**: ~$1.12  
**Estimated Duration**: 12-25 minutes  
**Status**: ✅ Registered and ready to execute

### Core Components

#### 1. **Distributed Locks** (Task 2)
- **Purpose**: Prevents concurrent git operations causing resets
- **Implementation**: Redis SET NX EX pattern with timeout/deadlock detection
- **Features**:
  - `@distributed_lock` decorator for easy use
  - Exponential backoff retry strategy
  - Ownership verification before release
  - Context manager support (`with` statement)

#### 2. **Work Queue System** (Task 3)
- **Purpose**: Fair distribution of activities across instances
- **Implementation**: Redis sorted sets with priority support
- **Features**:
  - Priority-based scheduling
  - Work claiming with lease expiration
  - Automatic reclaim of expired work
  - Fair distribution algorithm

#### 3. **Instance Registry** (Task 4)
- **Purpose**: Track active workers and detect failures
- **Implementation**: Heartbeat monitoring with automatic cleanup
- **Features**:
  - Registration with capability reporting
  - Heartbeat interval: 5s (configurable)
  - Timeout detection: 15s (configurable)
  - Automatic deregistration of dead instances

#### 4. **State Synchronization** (Task 5)
- **Purpose**: Coordinate shared state without conflicts
- **Implementation**: Optimistic locking with version numbers
- **Strategies**:
  - `fail-fast`: Raise error on conflict (default)
  - `last-write-wins`: Overwrite with latest
  - `merge`: Attempt to merge compatible changes

#### 5. **Orchestration Integration** (Task 6)
- **Purpose**: Leverage existing Dask/Prefect infrastructure
- **Integration Points**:
  - Dask task coordination hooks
  - Prefect workflow management
  - Performance monitoring (<20% overhead target)
  - Graceful degradation when unavailable

#### 6. **Validation & Testing** (Task 7)
- **Comprehensive Tests**:
  - Multi-instance concurrent test harness
  - Git operation conflict verification
  - Lock acquisition/release validation
  - Failover and recovery testing

### Task Dependency Graph

```
1. setup-redis-infrastructure (foundation)
   ├─→ 2. implement-distributed-locks
   ├─→ 3. create-work-queue-system  
   └─→ 4. build-instance-registry
         ↓
      [Tasks 2, 3, 4 complete in parallel]
         ↓
      ┌─────────────────────┴─────────────────────┐
      ↓                                             ↓
   5. implement-state-synchronization    6. integrate-orchestration-systems
      └─────────────────────┬─────────────────────┘
                            ↓
                   7. validate-and-document
```

**Execution Pattern**: Tree with parallel branches
- **Sequential**: Task 1 (Redis setup)
- **Parallel**: Tasks 2-4 (coordination primitives)
- **Parallel**: Tasks 5-6 (integration layers)
- **Sequential**: Task 7 (validation)

**Time Efficiency**: 52% faster with parallelization (12 min vs 25 min)

---

## Configuration

### Default Configuration (All Variables Optional)

```typescript
{
  redis_host: "localhost",               // Use existing Redis
  redis_port: 6379,
  redis_db: 0,
  redis_password: "",
  lock_timeout: 300,                     // 5 minutes
  lock_retry_delay: 0.1,                 // 100ms initial
  heartbeat_interval: 5,                 // 5 seconds
  heartbeat_timeout: 15,                 // 15 seconds
  work_queue_name: "opencode:activities",
  instance_registry_key: "opencode:instances",
  max_instances: 10,
  conflict_strategy: "fail-fast",        // Safest default
  enable_dask_integration: true,
  enable_prefect_integration: true,
  test_mode: false
}
```

### Recommended First Execution

```typescript
activity({
  templateId: "setup-multi-instance-coordination",
  variables: {
    redis_host: "localhost",  // Use existing metabob-redis container
    redis_port: 6379,
    test_mode: true,          // Start with testing
    enable_dask_integration: false,  // Enable incrementally
    enable_prefect_integration: false
  },
  reason: "Initial deployment of coordination system to prevent git conflicts between the 2 running OpenCode instances"
})
```

---

## Implementation Roadmap

### Phase 1: Critical Foundation (NOW - Blocking Issue)
**Goal**: Stop git conflicts immediately

1. **Execute coordination setup activity** ⏳
   ```bash
   # This will create the coordination infrastructure
   opencode activity \
     --template setup-multi-instance-coordination \
     --variables '{"test_mode": true}' \
     --reason "Deploy coordination to fix git conflict issue"
   ```

2. **Test with 2 instances** 🧪
   - Keep existing instances running
   - Execute concurrent git operations test
   - Verify no conflicts occur
   - Measure coordination overhead

3. **Deploy to production mode** 🚀
   - Set `test_mode: false`
   - Enable Dask/Prefect integration
   - Monitor for 24 hours

**Success Criteria**:
- ✅ 0 git conflicts in 24-hour test
- ✅ Coordination overhead < 20%
- ✅ Both instances can work simultaneously

### Phase 2: Test Critical Features (URGENT)
**Goal**: Validate recent Thompson Sampling work

⚠️ **CRITICAL REMINDER** (from SESSION_HONEST_STATUS_THOMPSON_GRADIENTS.md):

**Thompson Sampling & Improvement Gradients**: Code exists but **NOT TESTED**

**Test Procedure Required**:
```bash
# 1. Execute ANY activity
opencode activity --template hello-world-minimal --variables '{"testId": "ts-test", "name": "test"}' --reason "Testing Thompson Sampling metrics"

# 2. Check metrics IMMEDIATELY after
jq -r 'select(.id == "hello-world-minimal") | 
  {id, executions, successRate, allocationWeight, improvementGradient}' \
  ~/.local/share/opencode/storage/activity-template/*.json

# 3. Verify:
# - executions incremented (23 → 24)
# - allocationWeight updated (1 → ~0.957)
# - improvementGradient calculated (null → ~0.95)
```

**Only after verification can we claim**:
- ✅ Thompson Sampling is functional
- ✅ Improvement Gradients are functional
- ✅ System progressed from 30% → 70% functional

### Phase 3: Scale Operations
**Goal**: Launch multiple coordinated instances

1. **Launch coordinated instances** (use repos/platform)
   - Deploy via Kubernetes (DigitalOcean)
   - Configure with coordination enabled
   - Monitor instance registry

2. **Distribute development activities**
   - Use work queue for activity distribution
   - Monitor fair scheduling
   - Track coordination metrics

3. **Enable self-reflection at scale**
   - Run multiple improvement activities in parallel
   - Collect execution data systematically
   - Feed learnings back to activity templates

### Phase 4: Platform Integration
**Goal**: Full orchestration with Dask/Prefect

1. **Configure Dask cluster** (repos/platform/deployments/research/charts/dask/)
   - Add coordination hooks to Dask workers
   - Deploy wrapper tasks using distributed locks
   - Monitor task distribution

2. **Integrate with Prefect** (repos/platform/deployments/research/charts/prefect/)
   - Create Prefect flows for activity orchestration
   - Add state synchronization between workers
   - Implement result aggregation

3. **Deploy monitoring**
   - Track coordination metrics (locks, queues, heartbeats)
   - Monitor git conflict rate (target: 0)
   - Measure performance overhead

---

## Expected Outputs After Execution

### Source Files (in repository)
```
src/coordination/
├── __init__.py              # Package exports
├── redis_client.py          # Connection manager with pooling
├── distributed_lock.py      # Locks with decorator support
├── work_queue.py            # Priority queue system
├── instance_registry.py     # Heartbeat monitoring
├── state_sync.py            # Conflict resolution
├── dask_integration.py      # Dask coordination hooks
└── prefect_integration.py   # Prefect workflow hooks
```

### Test Files
```
tests/coordination/
├── test_distributed_lock.py       # Lock unit tests
├── test_work_queue.py             # Queue unit tests
├── test_instance_registry.py      # Registry unit tests
├── test_integration.py            # Integration tests
└── test_concurrent_instances.py   # Multi-instance harness
```

### Configuration & Docs
```
config/coordination.yaml           # Configuration template
docs/MULTI_INSTANCE_COORDINATION.md  # Usage documentation
```

---

## Success Metrics

### Immediate (Phase 1)
- ✅ Git conflict rate: 0 (down from multiple per day)
- ✅ Coordination overhead: <20%
- ✅ All unit tests passing
- ✅ Integration tests passing (with Redis)

### Short-term (Phase 2)
- ✅ Thompson Sampling metrics updating correctly
- ✅ Improvement Gradients calculating properly
- ✅ Activity execution metrics collection verified
- ✅ System functionality: 30% → 70% confirmed

### Medium-term (Phase 3)
- ✅ 5+ instances running in coordination
- ✅ Work distribution fairness: coefficient of variation <0.2
- ✅ Failover time: <30 seconds
- ✅ Lock acquisition latency: <100ms p99

### Long-term (Phase 4)
- ✅ Dask/Prefect integration operational
- ✅ Self-reflection activities running continuously
- ✅ Activity template improvements accumulating
- ✅ System "becoming" velocity measurable

---

## Risk Assessment & Mitigation

### Risks Identified

**Risk 1**: Redis becomes single point of failure
- **Likelihood**: Medium
- **Impact**: High (coordination stops)
- **Mitigation**: 
  - Graceful degradation to single-instance mode
  - Redis Sentinel/Cluster support (Phase 4+)
  - Health checks and automatic reconnection

**Risk 2**: Coordination overhead too high
- **Likelihood**: Low
- **Impact**: Medium (slowed operations)
- **Mitigation**:
  - Target <20% overhead (validated in tests)
  - Connection pooling reduces latency
  - Async operations where possible

**Risk 3**: Lock deadlocks
- **Likelihood**: Low
- **Impact**: High (instances frozen)
- **Mitigation**:
  - Timeout-based deadlock detection
  - Automatic lock expiration (5 min default)
  - Lock ownership verification

**Risk 4**: Instance crashes with held locks
- **Likelihood**: Medium
- **Impact**: Medium (temporary block)
- **Mitigation**:
  - Lock timeouts (automatic release)
  - Heartbeat monitoring detects dead instances
  - Lock recovery on instance restart

### Current Blocking Issues (CRITICAL)

**Issue 1**: 2 instances competing ⚠️
- **Impact**: Git resets, data loss, blocked progress
- **Status**: Template created, ready to execute
- **Action**: Deploy coordination system ASAP

**Issue 2**: Thompson Sampling untested ⚠️
- **Impact**: Can't claim functionality improvement (30% → 70%)
- **Status**: Code exists, tests not run
- **Action**: Execute verification test immediately after coordination deployed

---

## Next Steps (Prioritized)

### TODAY (Highest Priority)

1. ✅ **Review this document** - You are here
2. ⏳ **Execute setup-multi-instance-coordination activity** - Deploy infrastructure
3. ⏳ **Test coordination with 2 instances** - Verify git conflicts stopped
4. ⏳ **Verify Thompson Sampling** - Run verification test (CRITICAL)

### THIS WEEK

5. Deploy to production mode (disable test_mode)
6. Monitor coordination metrics for 48 hours
7. Document any issues and update template
8. Begin Phase 3 (scale to 5 instances)

### THIS MONTH

9. Complete Dask/Prefect integration (Phase 4)
10. Deploy web monitoring dashboard
11. Run self-reflection activities at scale
12. Measure "becoming" velocity

---

## Platform Infrastructure (repos/platform)

### Available Resources

**Kubernetes Clusters** (Terraform-managed, DigitalOcean):
- **Ops Cluster**: ArgoCD, monitoring, vault
  - Context: `metabob-ops-k8s`
  - Namespace: `argocd`
- **Development Cluster**: Development workloads
  - Context: `metabob-development-k8s`
  - Namespace: `metabob`
- **Production Cluster**: Production services
  - Context: `metabob-production-k8s`
  - Namespace: `metabob`

**Orchestration**:
- **Dask**: Distributed computing cluster
  - Chart: `repos/platform/deployments/research/charts/dask/`
  - Application: `repos/platform/applications/dask-application.yaml`
- **Prefect**: Workflow orchestration
  - Chart: `repos/platform/deployments/research/charts/prefect/`
  - Application: `repos/platform/applications/prefect-application.yaml`

**Services** (Docker containers running locally):
- **Redis**: Coordination backend (port 6379)
  - Container: `metabob-redis` (healthy, 4 days uptime)
- **SurrealDB**: Activity metrics storage (port 8000)
  - Container: `metabob-surreal` (16 hours uptime)
- **DevBob**: Development environment (ports 3000, 8082)
  - Container: `devbob-clean` (healthy, 2 days uptime)
- **API Server**: Metabob RPC API (port 8080)
  - Container: `api-server-dev` (8 hours uptime)

**Management Tools**:
- Helmfile for deployment orchestration
- ArgoCD for GitOps
- Terraform for infrastructure provisioning
- Kubectl contexts configured

### Quick Start Commands

```bash
# Check platform infrastructure status
cd repos/platform/infrastructure
make status

# Deploy to development environment
cd repos/platform/deployments
helmfile -e development sync

# Switch Kubernetes contexts
kubectx metabob-development-k8s

# Check running pods
kubectl get pods -n metabob
```

---

## Integration with Existing Systems

### Redis (Primary Coordination Backend)
- **Container**: `metabob-redis` (localhost:6379)
- **Usage**: Distributed locks, work queue, instance registry
- **Configuration**: Connection pooling, 10 connections per instance
- **Monitoring**: Track lock metrics, queue depth, heartbeat success rate

### Dask (Distributed Computing)
- **Location**: repos/platform
- **Integration**: Coordination hooks on Dask workers
- **Usage**: Parallel activity execution with coordination
- **Benefit**: Leverage existing compute cluster

### Prefect (Workflow Orchestration)
- **Location**: repos/platform
- **Integration**: Prefect flows with coordination
- **Usage**: Orchestrate coordinated activity workflows
- **Benefit**: Visual monitoring and retry logic

### Git Operations (Protected by Locks)
- **Critical Section**: All git operations use `@distributed_lock`
- **Lock Timeout**: 5 minutes (configurable)
- **Benefit**: Zero git conflicts between instances

### Activity Execution (Distributed via Queue)
- **Queue**: Redis sorted set with priority
- **Distribution**: Fair scheduling across instances
- **Benefit**: Load balancing and parallel execution

---

## Monitoring & Observability

### Key Metrics to Track

**Lock Metrics**:
- Acquisition latency (target: <100ms p99)
- Hold duration distribution
- Timeout frequency
- Deadlock detection events

**Queue Metrics**:
- Queue depth over time
- Work distribution fairness (CV <0.2)
- Lease expiration rate
- Processing latency

**Instance Metrics**:
- Active instance count
- Heartbeat success rate (target: >99%)
- Failover frequency and duration
- Registration/deregistration events

**Conflict Metrics**:
- Git conflict detection rate (target: 0)
- State conflict resolution attempts
- Conflict resolution strategy usage
- Merge success rate

**Performance Metrics**:
- Coordination overhead percentage (target: <20%)
- Operation latency increase
- Redis connection pool usage
- Network RTT to Redis

### Alerting Thresholds

- 🔴 **CRITICAL**: Git conflict detected
- 🔴 **CRITICAL**: Redis connection failed (>60s)
- 🟡 **WARNING**: Lock acquisition >1s
- 🟡 **WARNING**: Heartbeat miss rate >1%
- 🟡 **WARNING**: Coordination overhead >20%
- 🟢 **INFO**: Instance registered/deregistered

---

## Lessons from Recent Session

From `docs/SESSION_HONEST_STATUS_THOMPSON_GRADIENTS.md`:

### Key Insights

1. **Multiple Instances = Coordination Required**
   - 2 bun processes stepping on each other
   - Our commits reset by other instance
   - **Solution**: This coordination system

2. **ALWAYS TEST IMMEDIATELY**
   - Implemented code ✓
   - Built code ✓
   - Committed code ✓
   - **SKIPPED TESTING** ✗ ← BIG MISTAKE
   - **Lesson**: Test before claiming success

3. **Trust Functional State, Not Beliefs**
   - Believed: "Implemented Thompson Sampling"
   - Reality: Code was removed by other instance
   - **Lesson**: Verify Functional state, not Instructional

4. **"At Pace" Doesn't Mean "Skip Verification"**
   - Speed is important
   - Correctness is critical
   - **Lesson**: Test is part of "at pace"

### Applied to This Plan

- ✅ Test coordination immediately after deployment
- ✅ Verify Thompson Sampling before claiming success
- ✅ Check Functional state (git conflicts stopped) not just Instructional (code exists)
- ✅ Include verification in timeline ("at pace" includes testing)

---

## Documentation References

### Key Documents

- `docs/SESSION_HONEST_STATUS_THOMPSON_GRADIENTS.md` - Recent session learnings
- `docs/IMPLEMENTATION_THOMPSON_AND_GRADIENTS.md` - Thompson Sampling implementation
- `repos/platform/README.md` - Platform infrastructure overview
- `repos/platform/AGENTS.md` - Platform agent guidelines
- `/tmp/activity-template-setup-multi-instance-coordination/SUCCESS.md` - Template details
- `/tmp/activity-template-setup-multi-instance-coordination/REQUIREMENTS.md` - Requirements

### Generated During Template Creation

- `REQUIREMENTS.md` - Comprehensive requirements analysis
- `TASK_GRAPH.md` - Task dependency graph and execution plan
- `setup-multi-instance-coordination.json` - Complete template definition
- `SUCCESS.md` - Usage guide and troubleshooting

---

## Conclusion

### Current Status

**We are ready to solve the blocking coordination issue.**

- ✅ Problem clearly identified (git conflicts from multiple instances)
- ✅ Solution designed and template created
- ✅ Infrastructure available (Redis, Dask, Prefect)
- ✅ Validation plan defined
- ⏳ **Ready to execute** - awaiting your approval

### Critical Path Forward

```
TODAY:
1. Execute setup-multi-instance-coordination activity [12-25 min, $1.12]
2. Test with 2 instances [15 min]
3. Verify Thompson Sampling [5 min]
   └─→ TOTAL: ~1 hour to unblock progress

THIS WEEK:
4. Deploy to production [immediate]
5. Scale to 5 instances [Phase 3]
6. Enable continuous self-reflection

OUTCOME:
✅ Git conflicts eliminated
✅ Multiple instances collaborating
✅ Self-reflection activities running
✅ System improving continuously
```

### Value Delivered

**Immediate** (Phase 1):
- Eliminate git conflicts (0 conflicts)
- Safe parallel execution
- Unblock development activities

**Short-term** (Phase 2-3):
- Scale to 5+ coordinated instances
- Continuous self-reflection enabled
- Activity template improvements accelerate

**Long-term** (Phase 4):
- Full orchestration with Dask/Prefect
- Measurable "becoming" velocity
- Autonomous improvement at scale

### Recommendation

**Execute the `setup-multi-instance-coordination` activity now** to:
1. Stop git conflicts immediately
2. Enable safe parallel execution
3. Unblock self-reflection activities
4. Begin collecting improvement data

The infrastructure is ready. The template is registered. The path is clear.

**Ready to proceed?**

---

## Appendix: Activity Template Details

### Variables (All Optional with Sensible Defaults)

```typescript
interface CoordinationVariables {
  // Redis Configuration
  redis_host: string;              // default: "localhost"
  redis_port: number;              // default: 6379
  redis_db: number;                // default: 0
  redis_password: string;          // default: ""
  
  // Lock Configuration
  lock_timeout: number;            // default: 300 (5 min)
  lock_retry_delay: number;        // default: 0.1 (100ms)
  
  // Heartbeat Configuration
  heartbeat_interval: number;      // default: 5 (seconds)
  heartbeat_timeout: number;       // default: 15 (seconds)
  
  // Queue Configuration
  work_queue_name: string;         // default: "opencode:activities"
  instance_registry_key: string;   // default: "opencode:instances"
  max_instances: number;           // default: 10
  
  // Behavior Configuration
  conflict_strategy: "fail-fast" | "last-write-wins" | "merge";  // default: "fail-fast"
  enable_dask_integration: boolean;    // default: true
  enable_prefect_integration: boolean; // default: true
  test_mode: boolean;                  // default: false
}
```

### Task Breakdown

1. **setup-redis-infrastructure** (2-3 min, $0.08)
   - Create Redis connection manager
   - Verify connectivity
   - Set up connection pooling

2. **implement-distributed-locks** (3-5 min, $0.20)
   - Create DistributedLock class
   - Add @distributed_lock decorator
   - Implement exponential backoff
   - Write comprehensive unit tests

3. **create-work-queue-system** (3-5 min, $0.18)
   - Implement priority queue (Redis sorted sets)
   - Add work claiming with lease
   - Create fair scheduling algorithm
   - Write unit tests

4. **build-instance-registry** (2-3 min, $0.12)
   - Create registration system
   - Implement heartbeat monitoring
   - Add dead instance detection
   - Write unit tests

5. **implement-state-synchronization** (4-6 min, $0.25)
   - Create shared state store
   - Implement optimistic locking
   - Add conflict resolution strategies
   - Build result aggregation
   - Write unit tests

6. **integrate-orchestration-systems** (3-5 min, $0.18)
   - Add Dask coordination hooks
   - Integrate with Prefect
   - Create wrapper tasks
   - Add monitoring

7. **validate-and-document** (2-4 min, $0.11)
   - Run full test suite
   - Create multi-instance test harness
   - Perform type checking/linting
   - Write usage documentation

**Total**: 19-31 min (parallel: 12-25 min), $1.12

---

**END OF REVIEW**
