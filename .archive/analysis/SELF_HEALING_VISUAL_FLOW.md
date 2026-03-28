# Self-Healing System Visual Flow

## Current State vs. Desired State

### Before Self-Healing (Manual Process) ❌

```
┌──────────────────────────────────────────────────────────────┐
│                     Activity Execution                        │
│                                                               │
│  Template → Task 1 ✅ → Task 2 ✅ → Task 3 ❌ FAILED         │
└──────────────────────────────────────────────────────────────┘
                               │
                               │ STOPS HERE
                               ↓
                    ┌──────────────────────┐
                    │   Activity Failed    │
                    │   Status: "failed"   │
                    └──────────────────────┘
                               │
                               │ Hours/Days Later...
                               ↓
                    ┌──────────────────────┐
                    │  Human Notices ⏰     │
                    │  "Why did this fail?" │
                    └──────────────────────┘
                               │
                               │ Manual Investigation
                               ↓
                    ┌──────────────────────┐
                    │  Check Logs 📜       │
                    │  Read Error Messages │
                    │  Google Stack Trace  │
                    └──────────────────────┘
                               │
                               │ Guesswork
                               ↓
                    ┌──────────────────────┐
                    │  Maybe Try Fix? 🤷    │
                    │  "Hope this works"   │
                    └──────────────────────┘
                               │
                               ↓
                    ┌──────────────────────┐
                    │  Re-run Activity     │
                    │  (From scratch!)     │
                    └──────────────────────┘
                               │
                               ↓
                    Success? Or Another Failure? 🎲
```

**Problems**:
- ⏰ **Slow**: Hours to days for diagnosis
- 🤷 **Unreliable**: Guesswork and trial-and-error
- 💸 **Expensive**: Re-run entire activity from scratch
- 🔁 **No Learning**: Same failures repeat
- 📉 **Low Confidence**: "Hope this works"

---

### After Self-Healing (Automated Process) ✅

```
┌──────────────────────────────────────────────────────────────┐
│                     Activity Execution                        │
│                                                               │
│  Template → Task 1 ✅ → Task 2 ✅ → Task 3 ❌ FAILED         │
└──────────────────────────────────────────────────────────────┘
                               │
                               │ AUTOMATIC (< 60 seconds)
                               ↓
                    ┌──────────────────────┐
                    │   Activity Failed    │
                    │   Status: "failed"   │
                    │   onError.autoTrigger│
                    └──────────────────────┘
                               │
                               │ Lifecycle Hook Fires
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                  AUTO-DIAGNOSIS PIPELINE                         │
│                                                                  │
│  ┌─────────────────┐    ┌──────────────────┐                   │
│  │ Error Inspector │ → │ Extract Context  │                   │
│  │ (Tool)          │    │ - Session logs   │                   │
│  └─────────────────┘    │ - Tool calls     │                   │
│                         │ - Error details  │                   │
│                         └──────────────────┘                   │
│                                  │                               │
│                                  ↓                               │
│                         ┌──────────────────┐                   │
│                         │ Store Evidence   │                   │
│                         │ (Repository)     │                   │
│                         └──────────────────┘                   │
│                                  │                               │
│                                  ↓                               │
│                         ┌──────────────────┐                   │
│                         │ Pattern Match    │                   │
│                         │ (Similar?)       │                   │
│                         └──────────────────┘                   │
│                                  │                               │
│                    ┌─────────────┴─────────────┐              │
│                    │                             │              │
│             Found Similar?                No Match             │
│                    │                             │              │
│                    ↓                             ↓              │
│         ┌──────────────────┐         ┌──────────────────┐    │
│         │ Apply Known Fix  │         │ Deep Diagnosis   │    │
│         │ (Pattern-based)  │         │ (debug-activity) │    │
│         └──────────────────┘         └──────────────────┘    │
│                    │                             │              │
│                    └─────────────┬───────────────┘              │
│                                  │                               │
│                                  ↓                               │
│                         ┌──────────────────┐                   │
│                         │ Generate Report  │                   │
│                         │ (DIAGNOSIS.md)   │                   │
│                         └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ Notification Sent
                               ↓
                    ┌──────────────────────┐
                    │  Human Notified 🔔   │
                    │  + Diagnosis Report  │
                    │  + Quick Actions     │
                    │  + Confidence Score  │
                    └──────────────────────┘
                               │
                               │ Human Decides
                               ↓
                    ┌──────────────────────┐
                    │  Apply Fix           │
                    │  (Recommended)       │
                    └──────────────────────┘
                               │
                               ↓
                    ┌──────────────────────┐
                    │  Replay Activity     │
                    │  (From Task 3!)      │
                    └──────────────────────┘
                               │
                               ↓
                    ┌──────────────────────┐
                    │  Success ✅          │
                    │  Store Effectiveness │
                    └──────────────────────┘
                               │
                               │ Learning Loop
                               ↓
                    Future Failures → Instant Fix
```

**Benefits**:
- ⚡ **Fast**: < 60 seconds for diagnosis
- 🎯 **Accurate**: Evidence-based recommendations
- 💰 **Efficient**: Resume from failed task only
- 🧠 **Learning**: Patterns recognized, fixes reused
- ✅ **High Confidence**: "This worked before"

---

## Data Flow Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                      EXECUTION LAYER                           │
│                                                                │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │ Task 1   │→→│ Task 2   │→→│ Task 3   │→→│ Task 4   │  │
│  │ (Agent)  │   │ (Agent)  │   │ (Agent)  │   │ (Agent)  │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘  │
│       ↓              ↓              ↓ FAIL        (blocked)   │
│       ✅             ✅             ❌                          │
└───────────────────────────────────────────────────────────────┘
       │              │              │
       │ Metadata     │ Metadata     │ Error Context
       │              │              │
       ↓              ↓              ↓
┌───────────────────────────────────────────────────────────────┐
│                      TRACKING LAYER                            │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Activity.Info                                            │ │
│  │ ┌─────────────┬─────────────┬─────────────┬──────────┐ │ │
│  │ │PromptInfo[]  │CommitInfo[] │Stats        │Impulses  │ │ │
│  │ │- sessionID   │- commits    │- tokens     │- context │ │ │
│  │ │- status      │- files      │- cost       │- budget  │ │ │
│  │ │- duration    │- messages   │- duration   │- loaded  │ │ │
│  │ └─────────────┴─────────────┴─────────────┴──────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
                           │
                           │ OnError Hook
                           ↓
┌───────────────────────────────────────────────────────────────┐
│                      ANALYSIS LAYER                            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ activity_error_inspector                                  ││
│  │ ┌────────────┬──────────────┬────────────┬─────────────┐││
│  │ │Session Logs│Tool Calls    │Validation  │Classification│││
│  │ │- user msgs │- success/fail│- patterns  │- type       │││
│  │ │- agent msgs│- inputs      │- files     │- category   │││
│  │ │- tokens    │- outputs     │- commands  │- confidence │││
│  │ └────────────┴──────────────┴────────────┴─────────────┘││
│  └──────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘
                           │
                           │ Store Evidence
                           ↓
┌───────────────────────────────────────────────────────────────┐
│                      LEARNING LAYER                            │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Evidence Repository (.metabob/evidence/)                │  │
│  │ ┌──────────────┬──────────────┬──────────────────────┐ │  │
│  │ │FailureEvidence│FailureEvidence│FailureEvidence     │ │  │
│  │ │- id: evt_001  │- id: evt_002  │- id: evt_003       │ │  │
│  │ │- pattern: A   │- pattern: A   │- pattern: B        │ │  │
│  │ │- resolved: ✅ │- resolved: ✅ │- resolved: ❌      │ │  │
│  │ │- fix: +tokens │- fix: +tokens │- fix: pending      │ │  │
│  │ └──────────────┴──────────────┴──────────────────────┘ │  │
│  │                                                          │  │
│  │ Pattern Recognition:                                    │  │
│  │ - Pattern A: "Token limit" → fix: +25% tokens (95% eff)│  │
│  │ - Pattern B: "File not found" → fix: add path example  │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                           │
                           │ Pattern Match
                           ↓
┌───────────────────────────────────────────────────────────────┐
│                      DECISION LAYER                            │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ If pattern recognized (confidence > 80%):               │  │
│  │   → Apply known fix automatically                       │  │
│  │                                                          │  │
│  │ If pattern partially matched (confidence 50-80%):       │  │
│  │   → Suggest fix, await human approval                   │  │
│  │                                                          │  │
│  │ If novel pattern (confidence < 50%):                    │  │
│  │   → Run debug-activity for deep diagnosis               │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                           │
                           │ Execute Fix
                           ↓
┌───────────────────────────────────────────────────────────────┐
│                      REPAIR LAYER                              │
│                                                                │
│  ┌────────────────┬────────────────┬──────────────────────┐  │
│  │ Template Fix   │ Input Fix      │ Environment Fix      │  │
│  │ - Edit JSON    │ - Update vars  │ - Install deps       │  │
│  │ - Re-register  │ - Replay       │ - Fix permissions    │  │
│  │ - Validate     │ - Monitor      │ - Configure network  │  │
│  └────────────────┴────────────────┴──────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                           │
                           │ Verify Fix
                           ↓
┌───────────────────────────────────────────────────────────────┐
│                      VALIDATION LAYER                          │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ activity_replay                                         │  │
│  │ ┌──────────────┬──────────────┬──────────────────────┐ │  │
│  │ │ Resume from  │ Apply fixes  │ Monitor result       │ │  │
│  │ │ failed task  │ (variables)  │ - success?           │ │  │
│  │ │ (Task 3)     │ (template)   │ - duration?          │ │  │
│  │ │              │ (environment)│ - cost?              │ │  │
│  │ └──────────────┴──────────────┴──────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
                           │
                           │ Update Evidence
                           ↓
┌───────────────────────────────────────────────────────────────┐
│                      FEEDBACK LAYER                            │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Update FailureEvidence                                  │  │
│  │ - resolved: true                                        │  │
│  │ - resolutionMethod: "template-fix"                      │  │
│  │ - effectiveness: 0.95 (success rate after fix)          │  │
│  │ - resolutionTimestamp: [now]                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  Next time same pattern occurs → Instant fix! ⚡              │
└───────────────────────────────────────────────────────────────┘
```

---

## MVP Timeline (2 Weeks)

```
Week 1: Foundation
├── Day 1-2: Tool Integration
│   ├── Update debug-activity template
│   ├── Use activity_error_inspector
│   └── Deploy v3 ✅
│
├── Day 3-5: Evidence Repository
│   ├── Implement evidence storage
│   ├── Implement evidence search
│   ├── Auto-store from error inspector
│   └── Pattern recognition ✅
│
Week 2: Auto-Trigger
├── Day 6-8: Lifecycle Hook
│   ├── Add onError to Activity.Info
│   ├── Implement auto-trigger
│   ├── Add notification system
│   └── Enable by default ✅
│
├── Day 9-10: Integration Testing
│   ├── End-to-end test
│   ├── Documentation
│   └── MVP Complete ✅

Future: Learning & Validation
├── Week 3-4: Learning System
│   ├── Capture learning data
│   ├── Analyze patterns
│   └── Feed into evolution
│
└── Week 4-6: Validation Loop
    ├── Test before deploy
    ├── A/B testing
    └── Automatic rollback
```

---

## Tool Interaction Diagram

```
Human/Agent
    │
    │ 1. Run Activity
    ↓
┌──────────────┐
│  activity    │  Execute template
│  (tool)      │
└──────────────┘
    │
    │ 2. Execution fails
    ↓
┌──────────────────────────────────────────────────────────┐
│  Activity Lifecycle (src/session/activity.ts)            │
│  ┌────────────────────────────────────────────────────┐ │
│  │ onError hook fires → triggerDiagnosis()            │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
    │
    │ 3. Auto-trigger diagnosis
    ↓
┌──────────────────────┐
│ activity_error_      │  Extract error context
│ inspector (tool)     │
└──────────────────────┘
    │
    │ 4. Store evidence
    ↓
┌──────────────────────┐
│ activity_evidence_   │  Store failure pattern
│ create (tool)        │
└──────────────────────┘
    │
    │ 5. Search similar
    ↓
┌──────────────────────┐
│ activity_evidence_   │  Find similar failures
│ search (tool)        │
└──────────────────────┘
    │
    │ 6. Generate diagnosis
    ↓
┌──────────────────────┐
│ debug-activity       │  Analyze + recommend fixes
│ (template)           │
└──────────────────────┘
    │
    │ 7. Notify human
    ↓
Human
    │
    │ 8. Review + decide
    ↓
┌──────────────────────┐
│ activity_replay      │  Resume with fixes
│ (tool)               │
└──────────────────────┘
    │
    │ 9. Update evidence
    ↓
┌──────────────────────┐
│ activity_evidence_   │  Store fix effectiveness
│ update (tool)        │
└──────────────────────┘
    │
    │ 10. Learning loop
    ↓
Future Failures → Faster Resolution
```

---

## Evidence Repository Structure

```
.metabob/
├── evidence/
│   ├── evidence-1708123456-act_abc1.json
│   │   {
│   │     "id": "evidence-1708123456-act_abc1",
│   │     "activityId": "act_abc123",
│   │     "templateId": "add-feature-complete",
│   │     "taskId": "implement-feature",
│   │     "timestamp": 1708123456000,
│   │     "error": {
│   │       "type": "validation",
│   │       "message": "Required file not found: output.json"
│   │     },
│   │     "rootCause": {
│   │       "category": "template",
│   │       "description": "Task doesn't specify output directory",
│   │       "confidence": 0.9
│   │     },
│   │     "pattern": "missing-output-path",
│   │     "similarFailures": ["evidence-1708120000-act_xyz9"],
│   │     "resolved": true,
│   │     "resolutionMethod": "template-fix",
│   │     "resolutionTimestamp": 1708125000000,
│   │     "effectiveness": 0.95
│   │   }
│   ├── evidence-1708130000-act_def4.json
│   ├── evidence-1708135000-act_ghi7.json
│   └── ...
│
├── learning/
│   ├── learning-add-feature-complete.json
│   │   {
│   │     "templateId": "add-feature-complete",
│   │     "records": [...],
│   │     "patterns": {
│   │       "success": ["Pattern A", "Pattern B"],
│   │       "failure": ["Pattern X", "Pattern Y"]
│   │     },
│   │     "recommendations": [...]
│   │   }
│   └── ...
│
└── patterns/
    ├── missing-output-path.json
    │   {
    │     "name": "missing-output-path",
    │     "occurrences": 15,
    │     "resolvedCount": 14,
    │     "effectiveness": 0.93,
    │     "fix": {
    │       "type": "template",
    │       "description": "Add output path example to prompt",
    │       "template": "Create output.json in ./output/ directory"
    │     }
    │   }
    └── ...
```

---

## Success Metrics Dashboard

```
╔════════════════════════════════════════════════════════════╗
║         Self-Healing System Health Dashboard                ║
╠════════════════════════════════════════════════════════════╣
║                                                             ║
║  📊 Failure Detection                                       ║
║  ├── Total Failures (30 days): 47                          ║
║  ├── Auto-Diagnosed: 45 (95.7%)  ✅                         ║
║  └── Missed: 2 (4.3%)            ⚠️                         ║
║                                                             ║
║  🎯 Pattern Recognition                                     ║
║  ├── Known Patterns: 8                                     ║
║  ├── Pattern Matches: 38/47 (80.9%)  ✅                    ║
║  └── Novel Failures: 9/47 (19.1%)                          ║
║                                                             ║
║  ⚡ Response Time                                           ║
║  ├── Avg Diagnosis Time: 43s     ✅ (target: <60s)         ║
║  ├── Avg Fix Time: 12m           ✅ (down from 4h)         ║
║  └── End-to-End Resolution: 18m  ✅                         ║
║                                                             ║
║  🔧 Fix Effectiveness                                       ║
║  ├── Successful Fixes: 42/47 (89.4%)  ✅                   ║
║  ├── Failed Fixes: 3/47 (6.4%)                             ║
║  └── Pending: 2/47 (4.3%)                                  ║
║                                                             ║
║  📈 Learning Progress                                       ║
║  ├── Evidence Records: 47                                  ║
║  ├── Patterns Learned: 8                                   ║
║  └── Avg Pattern Effectiveness: 92%  ✅                     ║
║                                                             ║
║  💰 Cost Savings                                            ║
║  ├── Avg Cost per Diagnosis: $0.12                         ║
║  ├── Saved Re-runs: 38 (resume from failure)               ║
║  └── Estimated Savings: $67.50/month  ✅                    ║
║                                                             ║
╚════════════════════════════════════════════════════════════╝

Top Patterns:
1. missing-output-path      (15 occurrences, 93% fix rate)
2. token-limit-exceeded     (12 occurrences, 100% fix rate)
3. validation-timeout       (8 occurrences, 87% fix rate)

Recommendations:
• Update 3 templates with token budget increases
• Add output path examples to 2 templates
• Document validation best practices
```

---

## Next Steps

1. **Start Week 1** (Tool Integration + Evidence Repository)
2. **Monitor Progress** (Use dashboard metrics)
3. **Ship MVP** (2 weeks from start)
4. **Iterate** (Learn from real usage)
5. **Scale** (Phases 4-5 when ready)

**Ready to begin? Start with Phase 1 (Day 1-2): Tool Integration** ✅
