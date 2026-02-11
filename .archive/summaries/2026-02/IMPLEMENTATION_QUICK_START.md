# Activity System Implementation: Quick Start Guide

## Immediate Actions (This Week)

### Step 1: Review and Approve Plan (30 minutes)

**Who**: Tech lead + 2 engineers  
**When**: Today  
**What**: Review `ACTIVITY_SYSTEM_IMPLEMENTATION_PLAN.md`

**Decision points**:
- [ ] Approve 4-week timeline
- [ ] Assign engineers (Week 1-4 tasks)
- [ ] Confirm staging/production deployment process
- [ ] Agree on success metrics

---

### Step 2: Audit Current State (Day 1-2, 4 hours)

**Engineer 1**: Inventory activity tools

```bash
cd repos/metabob-opencode/packages/opencode

# Find all activity tools
ls src/tool/*activity* src/tool/*template*.ts

# Document each tool's purpose and usage
# Output: ACTIVITY_TOOLS_INVENTORY.md
```

**Engineer 2**: Measure agent behavior (if logs available)

```bash
# Analyze tool usage frequency
grep "tool_call" logs/sessions/*.log | \
  grep -i activity | \
  awk '{print $3}' | sort | uniq -c | sort -rn

# Document current behavior
# Output: AGENT_BEHAVIOR_BASELINE.md
```

**Deliverable**: Two documents showing current state

---

### Step 3: Quick Win - Hide Tools (Day 3-4, 6 hours)

**File**: `repos/metabob-opencode/packages/opencode/src/agent/tool-registry.ts` (create new)

```typescript
/**
 * Tool visibility configuration
 */
export const TOOL_VISIBILITY = {
  // Core tools (agents see these)
  agent: [
    "activity",
    "search_activities"
  ],
  
  // Developer tools (hidden by default)
  developer: [
    "debug_activity_execution",
    "activity_error_inspector",
    "activity_replay",
    "register_activity_template",
    "list_activity_templates",
    "get_activity_template",
    "post_activity_result"
  ]
}

export function getToolsForAgent(mode: string, devMode: boolean = false): string[] {
  const tools = [...TOOL_VISIBILITY.agent]
  if (devMode) tools.push(...TOOL_VISIBILITY.developer)
  return tools
}
```

**File**: Update `src/agent/agent.ts` to use this config

**Test**: 
```bash
bun test test/agent/tool-visibility.test.ts
```

**Commit**: "feat: hide activity debug tools from agents"

---

### Step 4: Quick Win - Simplify Descriptions (Day 5, 3 hours)

**File 1**: `repos/metabob-opencode/packages/opencode/src/tool/activity.txt`

Replace content (keep it to 25 lines):

```txt
Execute a multi-step activity workflow.

Use when:
  ✓ Task matches an available activity
  ✓ Need validated, consistent results
  ✓ Multi-step workflow required

Parameters:
  - activityId: From search_activities results
  - variables: Required inputs (see template)
  - reason: Brief explanation of goal

Example:
  activity({
    activityId: "add-rest-endpoint",
    variables: { method: "POST", path: "/api/users" },
    reason: "Create user registration endpoint"
  })

The framework automatically:
  • Gathers context
  • Executes tasks
  • Validates results
  • Records outcomes for learning
```

**File 2**: `repos/metabob-opencode/packages/opencode/src/tool/search-activities.txt`

Replace content (keep it to 25 lines):

```txt
Discover available activity workflows.

Returns templates with:
  • Success rates (reliability indicator)
  • Brief descriptions
  • Required variables (verbose mode)

Parameters:
  - category (optional): "feature", "bugfix", "refactor", "tool"
  - query (optional): Search term
  - verbose (optional): Show full details (default: false)

Examples:
  search_activities({})
  search_activities({ category: "feature" })
  search_activities({ query: "endpoint", verbose: true })

Modes:
  - compact (default): IDs and success rates (~300 bytes)
  - verbose: Full details including costs (~2KB)

Use before running activities to find template IDs.
Higher success rates = more reliable templates.
```

**Test**:
```bash
# Verify tool still works
bun test test/tool/activity.test.ts
bun test test/tool/search-activities.test.ts
```

**Commit**: "docs: simplify activity tool descriptions"

---

## Week 1 Complete Checklist

By end of Week 1 (Friday), you should have:

- [ ] Current state documented (2 docs)
- [ ] Tool visibility config created
- [ ] 8 tools hidden from agents
- [ ] 2 tools visible to agents
- [ ] Tool descriptions simplified (37+38 → 25+25 lines)
- [ ] All tests passing
- [ ] PR ready for review
- [ ] No functionality broken

**Validation**:
```bash
# Check tool count
bun run check-agent-tools --mode activity
# Expected: 2 activity tools visible

# Check description length
wc -l src/tool/activity.txt src/tool/search-activities.txt
# Expected: ~50 lines total

# Run full test suite
bun test
# Expected: All pass
```

---

## Week 2-4 Quick Reference

### Week 2: AGENTS.md + Auto-Reporting

**Main tasks**:
1. Edit AGENTS.md activity section (500→100 lines)
2. Add reportOutcomeToMetabob() to template-executor.ts
3. Remove post_activity_result tool

**Time**: 3 engineer-days  
**Risk**: Low

### Week 3: Improve create-activity-template

**Main tasks**:
1. Create validate-activity-template.sh script
2. Update create-activity-template.json (v3→v4)
3. Split Task 1 into 3 subtasks
4. Add enhanced validation
5. Run 10 test executions

**Time**: 4 engineer-days  
**Risk**: Medium (validation might be too strict)

### Week 4: Deploy and Monitor

**Main tasks**:
1. Deploy to staging
2. Monitor for 48 hours
3. Run 20 baseline executions
4. Compare v3 vs v4
5. Deploy to production
6. Set up continuous monitoring

**Time**: 2 engineer-days  
**Risk**: Low (rollback plan in place)

---

## Critical Success Factors

### 1. Don't Break Existing Workflows

**Validation strategy**:
- Test all built-in templates after each change
- Keep developer mode flag to re-enable tools if needed
- Gradual rollout (staging → canary → production)

### 2. Measure Everything

**Before changes**:
- Agent tool usage patterns
- Activity success rates
- Average execution times

**After changes**:
- Compare all metrics
- Verify improvements
- No regressions

### 3. Fast Rollback Capability

**If issues occur**:
```bash
# Option 1: Git revert
git revert <commit-hash>

# Option 2: Feature flag
ENABLE_ACTIVITY_IMPROVEMENTS=false

# Option 3: Developer mode
includeDevTools: true
```

### 4. Clear Communication

**What changes**:
- Agents see fewer tools (simpler)
- Tool descriptions shorter (clearer)
- AGENTS.md focused on usage (easier)
- create-activity-template more reliable (better)

**What doesn't change**:
- Activity execution still works
- Templates still registered
- Metabob still learns
- All functionality preserved

---

## Getting Started Right Now

### If You're Ready to Start Immediately

```bash
# 1. Clone and branch
cd repos/metabob-opencode
git checkout -b feature/activity-improvements-week1
cd packages/opencode

# 2. Create tool visibility config (30 min)
cat > src/agent/tool-registry.ts << 'EOF'
export const TOOL_VISIBILITY = {
  agent: ["activity", "search_activities"],
  developer: ["debug_activity_execution", "activity_error_inspector", ...]
}

export function getToolsForAgent(mode: string, devMode = false): string[] {
  const tools = [...TOOL_VISIBILITY.agent]
  if (devMode) tools.push(...TOOL_VISIBILITY.developer)
  return tools
}
EOF

# 3. Update agent.ts to use config (15 min)
# Edit src/agent/agent.ts
# Add: const tools = getToolsForAgent(config.mode, config.devMode)

# 4. Simplify tool descriptions (30 min)
# Edit src/tool/activity.txt (reduce to 25 lines)
# Edit src/tool/search-activities.txt (reduce to 25 lines)

# 5. Test (15 min)
bun test

# 6. Commit
git add .
git commit -m "feat: simplify activity tools for agents

- Hide 8 debug/internal tools from agents
- Show only 2 core orchestration tools
- Simplify tool descriptions (75→50 lines)
- Focus agents on WHAT/WHEN not HOW

Impact: Reduces agent distraction, faster orchestration"

# 7. Push and create PR
git push -u origin feature/activity-improvements-week1
```

**Time to first PR**: ~2 hours

---

## Questions and Answers

### Q: What if agents need debug tools?

**A**: Developer mode flag re-enables them:
```json
{
  "agent": {
    "activity": {
      "includeDevTools": true
    }
  }
}
```

### Q: What if validation is too strict?

**A**: We test with 10 diverse templates first. If >5% false rejections, we relax validation before deploying.

### Q: How do we know if it's working?

**A**: Measure:
- Tool call count per activity execution (should decrease)
- Agent confusion indicators (fewer debug tool attempts)
- Success rates (should improve or stay same)
- Time to activity execution (should decrease)

### Q: What if we want to rollback?

**A**: Three options:
1. Git revert (instant)
2. Feature flag (instant)
3. Developer mode (per-agent)

All changes are additive or configurable, not destructive.

---

## Contact and Support

**Questions about plan**:
- Review `ACTIVITY_SYSTEM_IMPLEMENTATION_PLAN.md`
- Check specific docs for details

**Questions about architecture**:
- Review `ACTIVITY_SYSTEM_COMPLETE_ARCHITECTURE.md`
- Check `ACTIVITY_REGISTRATION_AND_LEARNING.md`

**Questions about specific improvements**:
- Tool simplification: `ACTIVITY_TOOL_SIMPLIFICATION_SUMMARY.md`
- Template improvements: `CREATE_ACTIVITY_TEMPLATE_IMPROVEMENTS.md`

**Ready to start**: Follow "Getting Started Right Now" section above

---

## Summary

**What**: Simplify activity system to focus agents on orchestration  
**Why**: Agents distracted by 10+ tools and 500+ lines of implementation details  
**How**: Hide tools, simplify descriptions, improve templates  
**When**: 4 weeks from start to production  
**Who**: 2 engineers Week 1, 1 engineer Weeks 2-4  
**Outcome**: Faster orchestration, higher success rates, better learning  

**Start now**: 2 hours to first PR (Week 1 quick wins)
