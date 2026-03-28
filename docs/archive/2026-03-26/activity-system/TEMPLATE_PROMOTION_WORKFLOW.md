# Activity Template Promotion Workflow

## Overview

This document describes the end-to-end workflow for proving the activity system works, iterating on templates, and promoting the best-performing variants to metabob-proto for distribution.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Template Lifecycle                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CREATE                                                       │
│     ├─ Manual: Write JSON                                       │
│     ├─ Programmatic: Use create-activity-self-contained         │
│     └─ Evolution: Use evolve-activity-self-contained            │
│                                                                  │
│  2. STORE                                                        │
│     ├─ Backend: metabob-rpc-api PostgreSQL                      │
│     ├─ Content-addressable: name + content hash                 │
│     └─ Auto-variant: Same name, different content = new variant │
│                                                                  │
│  3. EXECUTE                                                      │
│     ├─ OpenCode: CLI, ACP, or TUI                              │
│     ├─ Metrics: Success, cost, duration tracked                 │
│     └─ Thompson Sampling: Auto-selects best variant             │
│                                                                  │
│  4. EVALUATE                                                     │
│     ├─ Success Rate: % of successful executions                 │
│     ├─ Cost: Average $$$ per execution                          │
│     ├─ Duration: Average time in seconds                        │
│     └─ Threshold: 80%+ success over 5+ executions               │
│                                                                  │
│  5. PROMOTE                                                      │
│     ├─ Validate metrics meet threshold                          │
│     ├─ Export from backend                                      │
│     ├─ Commit to metabob-proto                                  │
│     └─ Tag release for distribution                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Templates Required for Minimum Functionality

### Bootstrap Templates (Infrastructure)
1. **create-activity-self-contained** (100% success rate required)
   - Purpose: Create new templates programmatically
   - Status: ⚠️ Currently 0% (7 executions) - NEEDS FIXING
   - Priority: CRITICAL - Required to create all other templates

2. **evolve-activity-self-contained** (80%+ success rate)
   - Purpose: Improve existing templates based on metrics
   - Status: ⚠️ Currently 0% (1 execution) - NEEDS FIXING
   - Priority: HIGH - Required for template improvement

### Core Workflow Templates (Feature/Bugfix)
3. **add-feature-complete** (80%+ success rate)
   - Purpose: Add new features with tests and commits
   - Status: ❌ Not yet created
   - Priority: HIGH - Common workflow

4. **fix-bug-complete** (80%+ success rate)
   - Purpose: Fix bugs with root cause analysis
   - Status: ⚠️ Currently 0% (4 executions) - EXISTS BUT NEEDS FIXING
   - Priority: HIGH - Common workflow

5. **refactor-with-tests** (80%+ success rate)
   - Purpose: Refactor code while maintaining functionality
   - Status: ❌ Not yet created
   - Priority: MEDIUM - Common workflow

### Specialized Templates (Tool/Infrastructure)
6. **create-subagent** (NEW)
   - Purpose: Create specialized subagents
   - Status: ✅ NEW - Not yet executed
   - Priority: MEDIUM - For extensibility

7. **validate-architecture-compliance** (100% success)
   - Purpose: Validate system architecture
   - Status: ✅ 100% (1 execution)
   - Priority: LOW - Already working

## Testing Workflow

### Option 1: Shell Script (Simple)

```bash
# Test activity system end-to-end
./test-activity-system-proof.sh "template-name"

# This will:
# 1. Verify devbob-clean container is running
# 2. Check backend connectivity
# 3. Create template using create-activity-self-contained
# 4. Verify template is stored in backend
# 5. Execute the created template
# 6. Generate comprehensive logs and report
```

### Option 2: TypeScript via ACP (Advanced)

```bash
# Test via ACP protocol (more reliable)
./test-activity-via-acp.ts

# This will:
# 1. Connect to devbob-clean via ACP
# 2. Send prompts to create template
# 3. Verify backend storage
# 4. Execute template via ACP
# 5. Generate JSON report with full metrics
```

### Option 3: Manual Testing

```bash
# 1. Start clean devbob container
docker-compose --profile stable --profile devbob up -d

# 2. Connect and create template
docker exec -it devbob-clean bash
opencode run

# In OpenCode prompt:
# "Create an activity template for adding logging statements"

# 3. Check backend storage
curl http://localhost:8080/v2/activities/templates | jq '.[] | {name, variant_id, success_rate}'

# 4. Execute template
opencode run
# "Use the add-logging-statements template to add logging to sample.py"
```

## Metrics Collection

### Automatic Metrics (Tracked by Backend)
- **Success Rate**: % of executions that complete without errors
- **Execution Count**: Total number of times template was executed
- **Average Cost**: Mean cost in dollars across all executions
- **Average Duration**: Mean time in seconds across all executions
- **Generation**: Variant generation number (0 = original, 1+ = evolved)

### Manual Evaluation (Human Review)
- **Output Quality**: Does the template produce correct results?
- **Consistency**: Does it work across different inputs?
- **Documentation**: Are tasks well-described?
- **Variable Design**: Are variables intuitive and complete?

## Promotion Criteria

A template is ready for promotion when:

1. ✅ **Quantitative Metrics**
   - Success rate ≥ 80% 
   - Execution count ≥ 5
   - Average cost < $2.00 (configurable per template)
   - Average duration < 600s (10 minutes)

2. ✅ **Qualitative Assessment**
   - Manual review confirms output quality
   - Works across diverse inputs
   - Documentation is clear and complete
   - No security or safety concerns

3. ✅ **Technical Validation**
   - Template JSON is valid
   - All required fields present
   - Variables are well-defined
   - Tasks are logically sequenced

## Promotion Process

### Step 1: Identify Candidate

```bash
# List templates with metrics
curl http://localhost:8080/v2/activities/templates | jq '.[] | {
  name,
  variant_id,
  success_rate,
  execution_count,
  avg_cost,
  generation
} | select(.success_rate >= 80 and .execution_count >= 5)'
```

### Step 2: Review Template

```bash
# Get full template details
curl http://localhost:8080/v2/activities/templates/{variant_id} | jq . > candidate-template.json

# Manual review:
# - Check task descriptions
# - Verify variable definitions
# - Review validation rules
# - Assess complexity
```

### Step 3: Run Promotion Script

```bash
# Promote template to metabob-proto
./promote-template-to-proto.sh {variant_id} ../metabob-proto

# This will:
# 1. Fetch template from backend
# 2. Validate metrics meet criteria
# 3. Convert to OpenCode format
# 4. Generate documentation
# 5. Commit to metabob-proto
# 6. Update promotion log
```

### Step 4: Create Release

```bash
cd ../metabob-proto

# Review changes
git show

# Tag release
git tag -a v1.0.0-{template-name} -m "Release {Template Name}"

# Push to remote
git push origin main
git push origin v1.0.0-{template-name}
```

### Step 5: Update Distribution

```bash
# Update OpenCode to use new template
# (This step depends on OpenCode's template loading mechanism)

# Option A: NPM package update
cd repos/metabob-cli
npm update metabob-proto

# Option B: Git submodule update
cd repos/metabob-opencode
git submodule update --remote templates

# Option C: Manual sync
cp ../metabob-proto/templates/{category}/{template}.json \
   repos/metabob-opencode/templates/{category}/
```

## Continuous Improvement Loop

```
┌───────────────────────────────────────────────────┐
│                                                   │
│  1. Execute Template                              │
│     ├─ Users run template                         │
│     └─ Metrics automatically collected            │
│                    ↓                              │
│  2. Thompson Sampling                             │
│     ├─ Backend tracks success rates               │
│     ├─ Auto-selects best variant                  │
│     └─ Explores new variants occasionally         │
│                    ↓                              │
│  3. Identify Improvements                         │
│     ├─ Low success rate → needs fixing            │
│     ├─ High cost → needs optimization             │
│     └─ Slow execution → needs simplification      │
│                    ↓                              │
│  4. Evolve Template                               │
│     ├─ Use evolve-activity-self-contained         │
│     ├─ Creates new variant (generation++)         │
│     └─ Backend stores alongside original          │
│                    ↓                              │
│  5. A/B Test Variants                             │
│     ├─ Thompson Sampling distributes traffic      │
│     ├─ Collects metrics for both                  │
│     └─ Best variant emerges over time             │
│                    ↓                              │
│  6. Promote Winner                                │
│     ├─ Meets success criteria                     │
│     ├─ Save to metabob-proto                      │
│     └─ Becomes new default                        │
│                    ↓                              │
│  7. Retire Old Variants                           │
│     ├─ Mark deprecated in backend                 │
│     ├─ Remove from metabob-proto                  │
│     └─ Keep metrics for historical analysis       │
│                    │                              │
│                    └──────────────┐               │
│                                   ↓               │
│  8. Monitor Performance ──────────┘               │
│     ├─ Success rate tracking                      │
│     ├─ Cost monitoring                            │
│     └─ User feedback                              │
│                                                   │
└───────────────────────────────────────────────────┘
```

## Directory Structure

### Metabob-DevBob (Development)
```
metabob-devbob/
├── proof-logs/                    # Test execution logs
│   └── {timestamp}/
│       ├── PROOF_SUMMARY.md       # Human-readable summary
│       ├── PROOF_REPORT.json      # Machine-readable report
│       ├── backend-templates-*.json
│       ├── template-creation-output.log
│       ├── template-execution-output.log
│       └── session-*.json         # OpenCode session data
├── test-activity-system-proof.sh  # Shell-based test
├── test-activity-via-acp.ts       # ACP-based test
├── promote-template-to-proto.sh   # Promotion script
└── TEMPLATE_PROMOTION_WORKFLOW.md # This file
```

### Metabob-Proto (Distribution)
```
metabob-proto/
├── templates/
│   ├── feature/
│   │   ├── add-feature-complete.json
│   │   ├── add-feature-complete.md
│   │   ├── add-logging-statements.json
│   │   └── add-logging-statements.md
│   ├── bugfix/
│   │   ├── fix-bug-complete.json
│   │   └── fix-bug-complete.md
│   ├── refactor/
│   │   ├── refactor-with-tests.json
│   │   └── refactor-with-tests.md
│   └── infrastructure/
│       ├── create-activity-self-contained.json
│       ├── create-activity-self-contained.md
│       ├── evolve-activity-self-contained.json
│       └── evolve-activity-self-contained.md
├── PROMOTIONS.md                  # Promotion history log
└── README.md                      # Distribution documentation
```

## Troubleshooting

### Template Creation Fails

**Symptom**: `create-activity-self-contained` has 0% success rate

**Diagnosis**:
```bash
# Check recent executions
curl http://localhost:8080/v2/activities/templates/{variant_id}/stats | jq '.recent_executions'

# Review session logs
ls -lt /root/.local/share/opencode/sessions/ | head -5
```

**Solutions**:
1. Review task prompts - are they clear enough?
2. Check variable definitions - are they complete?
3. Verify impulse resolution - are context requirements working?
4. Test manually - does the prompt work when given to an agent directly?

### Template Execution Fails

**Symptom**: Created template fails when executed

**Diagnosis**:
```bash
# Execute with verbose logging
opencode run --log-level DEBUG --prompt "Use template X"

# Check validation rules
jq '.tasks[].validation' template.json
```

**Solutions**:
1. Simplify tasks - break complex tasks into smaller steps
2. Add retries - use retry strategy for flaky tasks
3. Improve prompts - make instructions more explicit
4. Add examples - provide example inputs/outputs in task descriptions

### Backend Storage Issues

**Symptom**: Template not appearing in backend after creation

**Diagnosis**:
```bash
# Check backend logs
docker logs api-server-dev | tail -100

# Test backend directly
curl -X POST http://localhost:8080/v2/activities/templates \
  -H "Content-Type: application/json" \
  -d @test-template.json
```

**Solutions**:
1. Verify backend is running and healthy
2. Check database connectivity (PostgreSQL)
3. Review MCP gateway configuration
4. Ensure template JSON is valid

## Next Steps

### Immediate Priority (Blocking)
1. **Fix `create-activity-self-contained`** (0% → 80%+)
   - Current blocker: Template creation is broken
   - Action: Use `evolve-activity-self-contained` to improve it
   - Goal: Get to 80%+ success rate for bootstrapping

2. **Fix `evolve-activity-self-contained`** (0% → 80%+)
   - Current blocker: Template evolution is broken
   - Action: Manual review and fix of task prompts
   - Goal: Enable continuous improvement loop

### Short-Term (Week 1)
3. **Create `add-feature-complete`** (NEW → 80%+)
   - Use fixed `create-activity-self-contained`
   - Test on diverse feature additions
   - Iterate until 80%+ success

4. **Fix `fix-bug-complete`** (0% → 80%+)
   - Review failing executions
   - Improve root cause analysis task
   - Add better validation rules

5. **Create `refactor-with-tests`** (NEW → 80%+)
   - Define clear refactoring patterns
   - Ensure tests are always run
   - Validate no functionality breaks

### Medium-Term (Month 1)
6. **Establish promotion cadence** (Weekly reviews)
   - Every Friday: Review metrics
   - Identify promotion candidates
   - Run promotion process
   - Update metabob-proto

7. **Build template library** (10+ core templates)
   - Cover common workflows
   - Document best practices
   - Share with team

### Long-Term (Quarter 1)
8. **Automate promotion** (CI/CD pipeline)
   - Auto-promote when criteria met
   - Slack notifications
   - Rollback mechanism

9. **Template marketplace** (Community contributions)
   - Accept external templates
   - Review and quality check
   - Distribute via metabob-proto

## Success Metrics

### System Health
- ✅ `create-activity-self-contained` ≥ 90% success
- ✅ `evolve-activity-self-contained` ≥ 80% success
- ✅ Core templates (5+) ≥ 80% success
- ✅ Promotion pipeline runs weekly
- ✅ Metabob-proto updated monthly

### User Impact
- ✅ Template execution time < 5 minutes (P50)
- ✅ Template cost < $1.00 (P50)
- ✅ User satisfaction ≥ 4/5
- ✅ Template reuse rate ≥ 50%

## References

- [Activity Template Backend - Quick Start](./QUICK_START_GUIDE.md)
- [Backend Testing Complete](./BACKEND_TESTING_COMPLETE.md)
- [CLI Integration Complete](./CLI_INTEGRATION_COMPLETE.md)
- [Activity Template Flow Analysis](./activity-template-flow-analysis.md)

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-19  
**Status**: Active  
**Owner**: DevBob Team
