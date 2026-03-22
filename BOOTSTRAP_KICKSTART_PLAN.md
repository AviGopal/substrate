# Bootstrap Kickstart Plan - Self-Improving System Activation

## Current State Analysis

### ✅ What's Working
- **Infrastructure**: 3 MiniBob pods, 2 healthy API pods, dashboard, SurrealDB, Redis
- **Backend**: Healthy and responding (http://api.minibob.local/health)
- **Templates**: 5 registered in backend with Thompson Sampling baseline (0.5 success rate)
- **MCP**: Connection established between MiniBob and backend
- **Deployment**: All pods running in activity-system namespace

### ❌ What's Broken
1. **Boredom disabled**: "Not in cluster mode" despite MINIBOB_SERVICE_NAME being set
   - Cluster detection via DNS lookup failing (headless service returns multiple IPs)
   - Boredom system requires both MCP + cluster mode

2. **No boredom queue**: Backend missing `/v2/activities/boredom/poll` endpoint
   - No mechanism to populate queue with autonomous tasks
   - No way for MiniBob to receive work when idle

3. **Zero execution traces**: No activities have executed yet
   - Learning system has no data to learn from
   - Thompson Sampling stuck at baseline (α=1, β=1 for all templates)

4. **Templates unnamed**: All 5 registered templates have `name: null`
   - Makes them unidentifiable in dashboard
   - Poor user experience

5. **Vessel registration failing**: 404 on vessel registration endpoint
   - MiniBob can't announce capabilities to backend

## The Three Constraints (User's Assessment)

### Constraint 1: Imperfect Vessels
**Problem**: Current vessels (MiniBob, API, Dashboard) are not optimized for their capabilities.

**Impact**:
- MiniBob has cluster detection issues
- Backend missing boredom queue
- No vessel capability routing

**Solution Path**: Build observability activities that identify vessel capability mismatches, then create reorganization activities.

### Constraint 2: Imperfect Activities
**Problem**: Registered activities may not be optimal for their goals.

**Impact**:
- 5 templates all at 50% success rate (baseline)
- No execution data to validate effectiveness
- No variant creation happening

**Solution Path**: Execute activities, capture outcomes, let Thompson Sampling + ribosome optimize over time.

### Constraint 3: Insufficient Observability
**Problem**: Can't observe our own functionality well enough to improve it.

**Impact**:
- Can't see why boredom is disabled
- Can't track capability usage across vessels
- Can't identify reorganization opportunities

**Solution Path**: Create instrumentation activities that expose system internals, build dashboard views for vessel capabilities.

## Kickstart Strategy

We need to bootstrap in phases, each phase building capability for the next:

### Phase 0: Fix Critical Blockers (Manual)
**Goal**: Get ONE activity to execute end-to-end

**Tasks**:
1. Fix cluster mode detection in MiniBob
   - Change from DNS lookup to pod count check
   - Use Kubernetes downward API or replica count

2. Implement basic boredom queue in backend
   - Simple Redis-backed queue
   - POST /v2/activities/boredom/poll returns highest priority template
   - POST /v2/activities/boredom/enqueue adds tasks to queue

3. Register vessel capabilities endpoint
   - POST /v2/vessels/register
   - Store vessel manifests with capabilities

4. Fix template names in registration
   - Ensure name field is populated when registering from MiniBob

**Success Criteria**:
- Boredom starts: See "[Boredom] Starting task executor" in logs
- First execution: One activity executes via boredom loop
- Execution trace stored: Backend shows traces > 0

### Phase 1: Bootstrap Observability Activities
**Goal**: Create activities that help us understand the system

**Activities to Create**:
1. **`inspect-vessel-health.json`**
   - Checks pod status, logs, resource usage
   - Reports capability availability
   - Identifies configuration issues
   - Stores findings as impulse

2. **`analyze-execution-traces.json`**
   - Queries backend for recent executions
   - Identifies failure patterns
   - Generates improvement recommendations
   - Creates impulses pointing to problematic executions

3. **`audit-template-performance.json`**
   - Pulls Thompson Sampling stats for all templates
   - Identifies low-performing templates
   - Creates improvement goals
   - Generates variant suggestions

4. **`trace-capability-usage.json`**
   - Monitors which tools/capabilities are used
   - Identifies underutilized vessel capabilities
   - Suggests capability reorganization
   - Stores usage patterns as impulses

**Success Criteria**:
- 4 new observability activities registered
- First observability activity executes successfully
- Dashboard shows execution data
- Impulses created from observations

### Phase 2: Self-Improving Activity Loop
**Goal**: Enable autonomous activity improvement

**Activities to Create**:
1. **`debug-failed-activity.json`** (CRITICAL)
   - Triggered when activity fails
   - Uses impulse pointing to execution trace
   - Analyzes failure (logs, state transitions, tool calls)
   - Creates fixed variant via goal-seeking
   - Registers variant with backend

2. **`optimize-successful-activity.json`**
   - Triggered for activities with >70% success rate
   - Uses impulse pointing to metrics
   - Analyzes cost, duration, token usage
   - Creates optimized variant (fewer tokens, faster)
   - Registers variant for A/B testing

3. **`merge-activity-variants.json`**
   - Finds multiple variants of same activity
   - Identifies winner based on Thompson Sampling
   - Deprecates losers
   - Consolidates into single optimal template

4. **`create-activity-from-goal.json`**
   - Goal-seeking workflow
   - Uses ribosome to extract template from successful execution
   - Validates template on fresh execution
   - Registers if validation passes

**Success Criteria**:
- Failed activity triggers debug automatically
- Fixed variant created and registered
- Thompson Sampling shows diverging α/β values
- At least one variant outperforms original

### Phase 3: Vessel Capability Reorganization
**Goal**: Redistribute capabilities to optimal vessels

**Activities to Create**:
1. **`analyze-vessel-boundaries.json`**
   - Scans all vessel code
   - Identifies capability clusters (groups of related functions)
   - Detects boundary violations (capabilities split across vessels)
   - Generates reorganization plan

2. **`extract-capability-to-vessel.json`**
   - Takes capability cluster + target vessel
   - Moves code from source to target
   - Updates imports and dependencies
   - Registers new capability with backend
   - Tests integration

3. **`create-specialized-vessel.json`**
   - Identifies capability cluster that should be separate vessel
   - Scaffolds new vessel (Docker, Helm, basic structure)
   - Migrates capability code
   - Deploys to cluster
   - Registers with capability router

4. **`optimize-capability-routing.json`**
   - Analyzes which vessels handle which tasks
   - Identifies inefficient routing (e.g., MiniBob doing heavy compute)
   - Suggests routing rules
   - Implements routing in backend

**Success Criteria**:
- Vessel boundary analysis complete
- One capability successfully extracted to different vessel
- New specialized vessel deployed
- Tasks routed to optimal vessels

### Phase 4: Continuous Autonomous Improvement
**Goal**: System optimizes itself without human intervention

**Mechanisms**:
1. **Boredom Queue Population**
   - Failed execution → enqueue debug-failed-activity
   - Successful high-volume execution → enqueue optimize-successful-activity
   - Multiple variants exist → enqueue merge-activity-variants
   - New goal type appears → enqueue create-activity-from-goal
   - Capability cluster detected → enqueue extract-capability-to-vessel

2. **Thompson Sampling in Action**
   - Every execution updates α/β for template
   - Backend selects probabilistically (exploration vs exploitation)
   - Variants compete automatically
   - Winners emerge through data, not reasoning

3. **Impulse-Driven Debugging**
   - Execution trace stored → impulse created
   - Debug activity uses impulse for context
   - Goal-seeking generates fix
   - Ribosome extracts fix as template
   - Template registered and competes with original

4. **Dashboard Visibility**
   - Real-time execution monitoring
   - Template performance comparison
   - Vessel capability usage
   - Learning loop visualization

**Success Criteria**:
- System runs for 24 hours with zero manual intervention
- At least 10 executions occur autonomously
- At least 2 new templates created via ribosome
- At least 1 template shows >70% success rate
- Dashboard shows continuous activity

## Implementation Sequence

### Immediate (Next 2 Hours)
1. Fix cluster mode detection in MiniBob
2. Implement boredom queue in backend
3. Implement vessel registration endpoint
4. Deploy changes, verify boredom starts
5. Manually enqueue first observability activity
6. Verify first autonomous execution

### Short Term (Next 1-2 Days)
1. Create 4 observability activities
2. Manually execute each once to validate
3. Register with backend
4. Let boredom queue populate from observations
5. Monitor dashboard for autonomous executions

### Medium Term (Next 1 Week)
1. Create self-improving activity loop (4 activities)
2. Trigger first failure debugging workflow
3. Verify variant creation and registration
4. Monitor Thompson Sampling divergence
5. Document learning patterns observed

### Long Term (Next 2-4 Weeks)
1. Create vessel reorganization activities
2. Analyze current vessel boundaries
3. Execute first capability extraction
4. Deploy specialized vessel
5. Measure improvement in routing efficiency

## Success Metrics

### Immediate Success (Hours)
- [ ] Boredom loop running (logs show polling)
- [ ] First activity executes autonomously
- [ ] Execution trace stored in backend
- [ ] Dashboard shows live execution

### Short Term Success (Days)
- [ ] 10+ autonomous executions
- [ ] 5+ new templates registered
- [ ] Thompson Sampling shows divergence (α/β vary)
- [ ] First variant outperforms original

### Medium Term Success (Weeks)
- [ ] 100+ autonomous executions
- [ ] 20+ templates registered
- [ ] At least 3 templates >70% success rate
- [ ] Failed activity auto-debugged and fixed
- [ ] Capability extracted to different vessel

### Long Term Success (Months)
- [ ] 1000+ autonomous executions
- [ ] 50+ templates registered
- [ ] 10+ specialized vessels deployed
- [ ] System optimizes itself faster than humans could
- [ ] New capabilities emerge from composition

## Risk Mitigation

### Risk: Runaway Execution Costs
**Mitigation**:
- Set daily cost budget in backend ($10/day initially)
- Boredom queue pauses when budget exceeded
- Alert when 80% of budget consumed
- Dashboard shows cost trends

### Risk: Infinite Debug Loops
**Mitigation**:
- Max retry limit per template (3 attempts)
- Exponential backoff on failures
- Mark template as "deprecated" after repeated failures
- Human review queue for persistent failures

### Risk: Capability Fragmentation
**Mitigation**:
- Require observability activity before reorganization
- Validate capability boundaries via automated tests
- Rollback mechanism for failed reorganizations
- Human approval for new vessel deployment

### Risk: Loss of Visibility
**Mitigation**:
- All activities create execution traces
- Dashboard must always be accessible
- Backup observability via kubectl logs
- Weekly manual audits of system health

## Next Action

**TO START THE KICKSTART:**

```bash
# 1. Create this issue in tracking system
# (Captures the plan for accountability)

# 2. Begin Phase 0 work
#    - Fix cluster mode detection
#    - Implement boredom queue
#    - Deploy changes
#    - Verify first execution

# 3. Once first execution succeeds:
#    - Create Phase 1 observability activities
#    - Enqueue them manually
#    - Monitor dashboard for autonomous runs
```

**EXPECTED TIMELINE TO SELF-SUSTAINING SYSTEM:**
- Phase 0: 2-4 hours (manual fixes)
- Phase 1: 1-2 days (observability)
- Phase 2: 3-5 days (self-improvement)
- Phase 3: 1-2 weeks (reorganization)
- Phase 4: Continuous (autonomous operation)

**Total: ~2-3 weeks to fully autonomous self-improving system**

---

**This plan transforms the idle deployment into a continuously learning, self-optimizing system that demonstrates the process-of-becoming in action.**
