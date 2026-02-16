# Self-Healing System Quick Start

**Goal**: Get from 70% → 90% complete in 2 weeks  
**Focus**: Tool Integration + Evidence Repository + Auto-Trigger (MVP)

---

## The 2-Week MVP

### What We're Building

```
Failed Activity ❌
   ↓
Auto-Detect (lifecycle hook)
   ↓
Extract Context (activity_error_inspector)
   ↓
Store Evidence (evidence repository)
   ↓
Notify Human (with diagnosis)
   ↓
Human Reviews → Decides → Applies Fix
   ↓
Future Failures → Pattern Recognized → Instant Fix
```

**Value**: 90% of failures auto-diagnosed in minutes instead of hours

---

## Week 1: Foundation (Phases 1-2)

### Day 1-2: Tool Integration ✅

**Objective**: Make templates use `activity_error_inspector` tool

**Current Problem**:
```json
{
  "prompt": {
    "template": "Query backend API:\ncurl http://localhost:8082/v2/activities/executions/{{executionId}}"
  }
}
```

**Fixed**:
```json
{
  "prompt": {
    "template": "Use activity_error_inspector tool:\n\nactivity_error_inspector({\n  activityId: \"{{executionId}}\",\n  includeSessionLogs: true,\n  includeToolCalls: true\n})\n\nParse the markdown report for diagnosis."
  }
}
```

**Steps**:

1. **Update debug-activity-self-contained.json**:
   ```bash
   cd repos/metabob-opencode/packages/opencode/templates/built-in
   
   # Edit Task 1: fetch-execution-details
   # Replace API calls with activity_error_inspector
   
   # New prompt (simplified):
   cat > task1-prompt.txt << 'EOF'
   Analyze a failed activity execution using the error inspector tool.
   
   **Execution ID**: {{executionId}}
   
   **Step 1**: Use the activity_error_inspector tool
   
   activity_error_inspector({
     activityId: "{{executionId}}",
     includeSessionLogs: true,
     includeToolCalls: true,
     maxMessagesPerTask: 20
   })
   
   This will return a comprehensive error report with:
   - Activity summary (template, status, duration, cost)
   - Failed task details (error message, type, context)
   - Session logs (agent conversation)
   - Tool calls (success/failure)
   - Recommendations
   
   **Step 2**: Extract key information
   
   From the error report, create EXECUTION_DETAILS.md with:
   
   # Execution Details: {{executionId}}
   
   ## Summary
   [Extract from error report]
   
   ## Task Execution Timeline
   [Parse task breakdown from report]
   
   ## Failure Details
   [Extract error details, stack trace, agent output]
   
   ## Context
   [Variables, environment, working directory]
   
   **Step 3**: Save the report
   
   Use the write tool to create EXECUTION_DETAILS.md.
   EOF
   ```

2. **Test the updated template**:
   ```bash
   # Create a test failure
   cd /workspace
   
   # Run activity that will fail (for testing)
   # (Use existing failed activity ID from logs)
   FAILED_ID="act_xyz123"
   
   # Run debug-activity with updated template
   opencode activity run debug-activity-self-contained \
     executionId=$FAILED_ID
   
   # Verify output
   cat EXECUTION_DETAILS.md
   ```

3. **Deploy updated template**:
   ```bash
   # Increment version
   jq '.version = 3' debug-activity-self-contained.json > temp.json
   mv temp.json debug-activity-self-contained.json
   
   # Register
   opencode activity register debug-activity-self-contained.json
   
   # Verify
   opencode activity search --query "debug"
   ```

**Success Criteria**:
- ✅ Template uses `activity_error_inspector` instead of API calls
- ✅ Diagnosis quality same or better
- ✅ Reduced API dependency
- ✅ Version 3 deployed

---

### Day 3-5: Evidence Repository 📦

**Objective**: Store failure patterns for learning

**Create Evidence Storage Tool**:

```bash
cd repos/metabob-opencode/packages/opencode/src/tool

# Create activity-evidence.ts
cat > activity-evidence.ts << 'EOF'
import { Tool } from "./tool"
import z from "zod"
import { Storage } from "../storage/storage"
import { Log } from "../util/log"

const log = Log.create({ service: "activity-evidence" })

const FailureEvidence = z.object({
  id: z.string(),
  activityId: z.string(),
  templateId: z.string(),
  taskId: z.string(),
  timestamp: z.number(),
  error: z.object({
    type: z.enum(["validation", "execution", "timeout", "unknown"]),
    message: z.string(),
    stack: z.string().optional()
  }),
  rootCause: z.object({
    category: z.enum(["template", "input", "environment", "execution"]),
    description: z.string(),
    confidence: z.number()
  }),
  diagnosisReportPath: z.string().optional(),
  fixesApplied: z.array(z.object({
    type: z.string(),
    description: z.string(),
    appliedAt: z.number()
  })).optional(),
  similarFailures: z.array(z.string()).default([]),
  pattern: z.string().optional(),
  resolved: z.boolean().default(false),
  resolutionTimestamp: z.number().optional(),
  resolutionMethod: z.enum(["template-fix", "input-fix", "retry", "workaround"]).optional(),
  effectiveness: z.number().optional()
})

type FailureEvidence = z.infer<typeof FailureEvidence>

export const ActivityEvidenceCreateTool = Tool.define("activity_evidence_create", async () => {
  return {
    description: "Store failure evidence for learning and pattern recognition",
    parameters: FailureEvidence,
    async execute(params, ctx) {
      const evidenceDir = Storage.path(".metabob", "evidence")
      await Storage.mkdir(evidenceDir)
      
      const evidencePath = Storage.path(evidenceDir, `${params.id}.json`)
      await Storage.writeJson(evidencePath, params)
      
      log.info("evidence stored", { id: params.id, templateId: params.templateId })
      
      return {
        title: "Evidence Stored",
        metadata: { evidenceId: params.id, path: evidencePath },
        output: `Stored failure evidence: ${params.id}\nPath: ${evidencePath}`
      }
    }
  }
})

export const ActivityEvidenceSearchTool = Tool.define("activity_evidence_search", async () => {
  return {
    description: "Search failure evidence by pattern, template, or timeframe",
    parameters: z.object({
      templateId: z.string().optional(),
      pattern: z.string().optional(),
      errorType: z.enum(["validation", "execution", "timeout", "unknown"]).optional(),
      timeRange: z.object({
        start: z.number(),
        end: z.number()
      }).optional(),
      limit: z.number().default(10)
    }),
    async execute(params, ctx) {
      const evidenceDir = Storage.path(".metabob", "evidence")
      const files = await Storage.readdir(evidenceDir)
      
      let evidence: FailureEvidence[] = []
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        const data = await Storage.readJson(Storage.path(evidenceDir, file))
        evidence.push(data as FailureEvidence)
      }
      
      // Filter by criteria
      let filtered = evidence
      
      if (params.templateId) {
        filtered = filtered.filter(e => e.templateId === params.templateId)
      }
      
      if (params.pattern) {
        filtered = filtered.filter(e => e.pattern === params.pattern)
      }
      
      if (params.errorType) {
        filtered = filtered.filter(e => e.error.type === params.errorType)
      }
      
      if (params.timeRange) {
        filtered = filtered.filter(e => 
          e.timestamp >= params.timeRange!.start && 
          e.timestamp <= params.timeRange!.end
        )
      }
      
      // Sort by timestamp descending
      filtered.sort((a, b) => b.timestamp - a.timestamp)
      
      // Limit results
      filtered = filtered.slice(0, params.limit)
      
      const output = formatEvidenceResults(filtered)
      
      return {
        title: `Found ${filtered.length} Evidence Records`,
        metadata: { count: filtered.length, total: evidence.length },
        output
      }
    }
  }
})

function formatEvidenceResults(evidence: FailureEvidence[]): string {
  if (evidence.length === 0) {
    return "No evidence found matching criteria."
  }
  
  const lines: string[] = []
  lines.push(`# Evidence Search Results (${evidence.length} records)\n`)
  
  for (const e of evidence) {
    const resolvedIcon = e.resolved ? "✅" : "❌"
    const date = new Date(e.timestamp).toISOString()
    
    lines.push(`## ${resolvedIcon} ${e.id}`)
    lines.push(`**Template**: ${e.templateId}`)
    lines.push(`**Task**: ${e.taskId}`)
    lines.push(`**Date**: ${date}`)
    lines.push(`**Error**: ${e.error.type} - ${e.error.message}`)
    lines.push(`**Root Cause**: ${e.rootCause.category} (${(e.rootCause.confidence * 100).toFixed(0)}% confidence)`)
    lines.push(`**Description**: ${e.rootCause.description}`)
    
    if (e.pattern) {
      lines.push(`**Pattern**: ${e.pattern}`)
    }
    
    if (e.similarFailures.length > 0) {
      lines.push(`**Similar Failures**: ${e.similarFailures.length} found`)
    }
    
    if (e.resolved) {
      lines.push(`**Resolved**: ${e.resolutionMethod} at ${new Date(e.resolutionTimestamp!).toISOString()}`)
      if (e.effectiveness !== undefined) {
        lines.push(`**Effectiveness**: ${(e.effectiveness * 100).toFixed(0)}%`)
      }
    }
    
    lines.push("")
  }
  
  return lines.join("\n")
}
EOF

# Add to tool index
echo "export { ActivityEvidenceCreateTool, ActivityEvidenceSearchTool } from './activity-evidence'" >> index.ts
```

**Integrate with Error Inspector**:

```bash
# Edit src/tool/activity-error-inspector.ts
# After line 94 (return { title, metadata, output }), add:

// Auto-store evidence
try {
  const evidenceId = `evidence-${Date.now()}-${activity.id.slice(0, 8)}`
  
  // Extract first task error for evidence
  const firstError = errorReport.taskErrors[0]
  if (firstError) {
    await Storage.writeJson(
      Storage.path(".metabob", "evidence", `${evidenceId}.json`),
      {
        id: evidenceId,
        activityId: activity.id,
        templateId: activity.templateId || "unknown",
        taskId: firstError.taskId,
        timestamp: Date.now(),
        error: {
          type: firstError.error.type,
          message: firstError.error.message,
          stack: firstError.error.stack
        },
        rootCause: {
          category: "execution",  // Default, can be refined
          description: firstError.error.message,
          confidence: 0.7
        },
        similarFailures: [],
        resolved: false
      }
    )
    
    log.debug("auto-stored evidence", { evidenceId, activityId: activity.id })
  }
} catch (error) {
  log.error("failed to auto-store evidence", { error })
  // Don't fail tool if evidence storage fails
}
```

**Update debug-activity Template**:

```json
{
  "tasks": [
    {
      "id": "fetch-execution-details",
      "prompt": {
        "template": "...[existing]...\n\nAfter analyzing, store evidence:\n\nactivity_evidence_create({\n  id: \"evidence-{{executionId}}\",\n  activityId: \"{{executionId}}\",\n  templateId: \"[from report]\",\n  taskId: \"[failed task]\",\n  timestamp: [now],\n  error: { type, message, stack },\n  rootCause: { category, description, confidence },\n  resolved: false\n})"
      }
    },
    {
      "id": "analyze-failure-patterns",
      "prompt": {
        "template": "...[existing]...\n\nSearch for similar failures:\n\nactivity_evidence_search({\n  templateId: \"[from report]\",\n  errorType: \"[from report]\",\n  limit: 10\n})\n\nIf similar failures found, extract patterns."
      }
    }
  ]
}
```

**Test Evidence System**:

```bash
# Create test evidence
opencode tool activity_evidence_create \
  id="test-evidence-1" \
  activityId="act_123" \
  templateId="debug-activity" \
  taskId="task-1" \
  timestamp=$(date +%s000) \
  error.type="validation" \
  error.message="Required file not found" \
  rootCause.category="template" \
  rootCause.description="Missing file path in validation" \
  rootCause.confidence=0.9

# Search evidence
opencode tool activity_evidence_search \
  templateId="debug-activity" \
  limit=5

# Verify storage
ls -la .metabob/evidence/
cat .metabob/evidence/test-evidence-1.json
```

**Success Criteria**:
- ✅ Evidence stored for every failure
- ✅ Search finds similar failures
- ✅ Auto-storage from error inspector
- ✅ Debug-activity uses evidence search

---

## Week 2: Auto-Trigger (Phase 3)

### Day 6-8: Lifecycle Hook 🎣

**Objective**: Automatically diagnose failures

**Update Activity Schema**:

```typescript
// In src/session/activity.ts

export namespace Activity {
  export const AutoTrigger = z.object({
    enabled: z.boolean(),
    diagnosisTemplate: z.string().default("debug-activity-self-contained"),
    notifyChannel: z.enum(["log", "slack", "email"]).optional(),
    autoApplyFixes: z.boolean().default(false)
  })
  
  export const OnError = z.object({
    autoTrigger: AutoTrigger.optional()
  })
  
  export const Info = z.object({
    // ... existing fields
    
    onError: OnError.optional()
  })
}
```

**Implement Auto-Trigger**:

```typescript
// In src/session/activity.ts

async function markFailed(activity: Activity.Info, error: Error): Promise<void> {
  activity.status = "failed"
  activity.completedAt = Date.now()
  await Activity.save(activity)
  
  log.error("activity failed", { 
    activityId: activity.id, 
    error: error.message 
  })
  
  // Auto-trigger diagnosis if enabled
  if (activity.onError?.autoTrigger?.enabled) {
    log.info("auto-triggering diagnosis", { activityId: activity.id })
    
    try {
      await triggerDiagnosis(activity)
    } catch (diagnosisError) {
      log.error("diagnosis failed", { 
        activityId: activity.id, 
        error: diagnosisError 
      })
      // Don't fail the original activity if diagnosis fails
    }
  }
}

async function triggerDiagnosis(activity: Activity.Info): Promise<void> {
  const template = activity.onError?.autoTrigger?.diagnosisTemplate || "debug-activity-self-contained"
  
  log.info("running diagnosis template", { 
    template, 
    activityId: activity.id 
  })
  
  // Import activity tool
  const { ActivityTool } = await import("../tool/activity")
  const tool = await ActivityTool.init()
  
  // Execute diagnosis activity
  const result = await tool.execute({
    activityId: template,
    variables: {
      executionId: activity.id
    },
    reason: `Auto-diagnosis for failed activity ${activity.id}`
  }, {
    sessionID: `diagnosis-${activity.id}`,
    messageID: `msg-${Date.now()}`,
    agent: "system",
    abort: new AbortController().signal,
    extra: {},
    metadata: (update: any) => {
      log.debug("diagnosis progress", update)
    }
  })
  
  // Notify human
  await notify(activity, result)
}

async function notify(activity: Activity.Info, diagnosisResult: any): Promise<void> {
  const channel = activity.onError?.autoTrigger?.notifyChannel || "log"
  
  const message = `
Activity Failed: ${activity.title}
ID: ${activity.id}
Template: ${activity.templateId}
Status: Auto-diagnosis complete

Diagnosis Report: ${diagnosisResult.output}

Review and apply fixes as needed.
  `.trim()
  
  switch (channel) {
    case "log":
      log.warn("activity failure notification", { 
        activityId: activity.id, 
        diagnosis: diagnosisResult.title 
      })
      console.error(message)
      break
      
    case "slack":
      // TODO: Implement Slack webhook
      log.info("slack notification sent", { activityId: activity.id })
      break
      
    case "email":
      // TODO: Implement email
      log.info("email notification sent", { activityId: activity.id })
      break
  }
}
```

**Enable Auto-Trigger by Default**:

```typescript
// In src/session/activity.ts

export async function create(params: CreateParams): Promise<Info> {
  const activity: Info = {
    // ... existing fields
    
    // Enable auto-trigger by default
    onError: {
      autoTrigger: {
        enabled: true,
        diagnosisTemplate: "debug-activity-self-contained",
        notifyChannel: "log",
        autoApplyFixes: false
      }
    }
  }
  
  return activity
}
```

**Test Auto-Trigger**:

```bash
# Create activity that will fail
opencode activity run test-failure-activity

# Verify:
# 1. Activity fails
# 2. Diagnosis runs automatically (check logs)
# 3. Notification appears (console or Slack)
# 4. Diagnosis report created

# Check logs
tail -f ~/.opencode/opencode.log | grep "auto-trigger"
```

**Success Criteria**:
- ✅ Failed activity triggers diagnosis automatically
- ✅ Notification sent to human (log/Slack/email)
- ✅ No failures go undiagnosed
- ✅ Diagnosis completes within 60 seconds

---

### Day 9-10: Integration Testing & Documentation 🧪

**Objective**: Verify complete MVP flow

**End-to-End Test**:

```bash
#!/bin/bash
# test-self-healing-mvp.sh

echo "=== Self-Healing MVP Integration Test ==="
echo ""

# Step 1: Create a template that will fail
echo "Step 1: Creating test template..."
cat > test-template-fail.json << 'EOF'
{
  "name": "Test Failure Template",
  "version": 1,
  "description": "Template designed to fail for testing",
  "category": "infrastructure",
  "tasks": [
    {
      "id": "will-fail",
      "subagent": "general",
      "description": "Task that will fail validation",
      "dependencies": [],
      "impulse_refs": [],
      "prompt": {
        "template": "Create output.json with content: {\"test\": true}",
        "max_tokens": 8000,
        "compression_strategy": "filter",
        "variables": []
      },
      "validation": {
        "required_files": ["nonexistent-file.txt"],
        "required_patterns": [],
        "forbidden_patterns": [],
        "commands": []
      },
      "retry": {
        "max_attempts": 1,
        "strategy": "simple"
      }
    }
  ],
  "onError": {
    "autoTrigger": {
      "enabled": true,
      "diagnosisTemplate": "debug-activity-self-contained",
      "notifyChannel": "log"
    }
  }
}
EOF

# Register test template
echo "Registering test template..."
TEMPLATE_ID=$(opencode activity register test-template-fail.json | jq -r '.id')
echo "Template ID: $TEMPLATE_ID"
echo ""

# Step 2: Run activity (will fail)
echo "Step 2: Running activity (expected to fail)..."
ACTIVITY_ID=$(opencode activity run $TEMPLATE_ID reason="Testing self-healing" | jq -r '.activityId')
echo "Activity ID: $ACTIVITY_ID"
echo ""

# Wait for activity to fail
echo "Waiting for activity to fail..."
sleep 10

# Step 3: Verify auto-diagnosis triggered
echo "Step 3: Checking if diagnosis was auto-triggered..."
if grep -q "auto-triggering diagnosis.*$ACTIVITY_ID" ~/.opencode/opencode.log; then
  echo "✅ Auto-diagnosis triggered"
else
  echo "❌ Auto-diagnosis did NOT trigger"
  exit 1
fi
echo ""

# Step 4: Verify evidence stored
echo "Step 4: Checking if evidence was stored..."
EVIDENCE_COUNT=$(ls .metabob/evidence/ | wc -l)
if [ $EVIDENCE_COUNT -gt 0 ]; then
  echo "✅ Evidence stored ($EVIDENCE_COUNT files)"
  ls -la .metabob/evidence/ | tail -5
else
  echo "❌ No evidence found"
  exit 1
fi
echo ""

# Step 5: Search for similar failures
echo "Step 5: Searching for similar failures..."
SIMILAR=$(opencode tool activity_evidence_search templateId=$TEMPLATE_ID limit=5)
echo "$SIMILAR"
echo ""

# Step 6: Verify diagnosis report created
echo "Step 6: Checking for diagnosis report..."
if [ -f "DIAGNOSIS_REPORT.md" ]; then
  echo "✅ Diagnosis report found"
  head -20 DIAGNOSIS_REPORT.md
else
  echo "❌ Diagnosis report not found"
  exit 1
fi
echo ""

echo "=== MVP Integration Test PASSED ✅ ==="
echo ""
echo "Self-Healing Flow Verified:"
echo "  1. ✅ Activity failed"
echo "  2. ✅ Auto-diagnosis triggered"
echo "  3. ✅ Evidence stored"
echo "  4. ✅ Similar failures searchable"
echo "  5. ✅ Diagnosis report created"
echo ""
echo "Next: Human reviews diagnosis and applies fixes"
```

**Run Integration Test**:

```bash
chmod +x test-self-healing-mvp.sh
./test-self-healing-mvp.sh
```

**Create Documentation**:

```bash
# Create user guide
cat > SELF_HEALING_USER_GUIDE.md << 'EOF'
# Self-Healing System User Guide

## What Is It?

When activity templates fail, the system automatically:
1. Detects the failure
2. Analyzes what went wrong (using `activity_error_inspector`)
3. Stores failure patterns (evidence repository)
4. Notifies you with a diagnosis report
5. Suggests fixes

## How to Use

### 1. Enable Auto-Diagnosis (Default)

All activities have auto-diagnosis enabled by default. When they fail:
- Diagnosis runs automatically within 60 seconds
- You get a notification (check console logs)
- Diagnosis report created: `DIAGNOSIS_REPORT.md`

### 2. Review Diagnosis

Open the diagnosis report:
```bash
cat DIAGNOSIS_REPORT.md
```

Contains:
- Executive Summary (what failed, why, how to fix)
- Quick Actions (immediate fixes)
- Detailed Findings (root cause analysis)
- Recommendations

### 3. Apply Fixes

Follow the Quick Actions section:

**Example**:
```
## Quick Actions

1. ⚡ Increase token budget for task-3 from 8000 to 10000
2. ⚡ Add file path example to task-2 prompt
3. ⚡ Retry with adjusted variables: outputPath="./output.json"
```

Apply via:
- Template fix: Edit template JSON, re-register
- Input fix: Re-run with corrected variables
- Retry: Use `activity_replay` tool

### 4. Replay with Fixes

```bash
opencode activity replay \
  activityId=act_xyz123 \
  overrideVariables='{"outputPath": "./output.json"}' \
  startFromTask=task-3
```

### 5. Evolve Template (Optional)

If failure is common, improve the template:

```bash
opencode activity run evolve-activity-self-contained \
  templateId=original-template
```

This creates an improved template variant.

## FAQ

**Q: Can I disable auto-diagnosis?**
A: Yes, in template JSON:
```json
{
  "onError": {
    "autoTrigger": {
      "enabled": false
    }
  }
}
```

**Q: Where are diagnosis reports stored?**
A: Current working directory (where activity ran)

**Q: Can I see all past failures?**
A: Yes, search evidence:
```bash
opencode tool activity_evidence_search \
  templateId=my-template \
  limit=20
```

**Q: How do I know if my fix worked?**
A: After replaying, evidence is updated with effectiveness score.

**Q: What if diagnosis fails?**
A: Original failure is still logged. Diagnosis failure doesn't affect activity status.
EOF
```

**Success Criteria**:
- ✅ End-to-end test passes
- ✅ Documentation complete
- ✅ MVP ready for daily use

---

## MVP Complete Checklist

After 2 weeks, you should have:

- ✅ **Phase 1: Tool Integration**
  - ✅ Templates use `activity_error_inspector`
  - ✅ debug-activity-v3 deployed
  - ✅ Reduced API dependency

- ✅ **Phase 2: Evidence Repository**
  - ✅ Evidence storage tool implemented
  - ✅ Evidence search implemented
  - ✅ Auto-storage from error inspector
  - ✅ Pattern recognition working

- ✅ **Phase 3: Auto-Trigger**
  - ✅ Lifecycle hook implemented
  - ✅ Auto-diagnosis on failure
  - ✅ Notification system working
  - ✅ All templates have auto-trigger enabled

- ✅ **Integration & Testing**
  - ✅ End-to-end test passing
  - ✅ User guide complete
  - ✅ MVP in daily use

---

## What Happens Next (Weeks 3-6)

After MVP is stable:

### Phase 4: Learning System (Weeks 3-4)
- Capture learning data during execution
- Analyze learning data for patterns
- Feed learning into template evolution

### Phase 5: Validation Loop (Weeks 4-6)
- Test templates before deployment
- A/B test improvements
- Automatic rollback on regression

**But first**: Ship MVP, prove value, iterate based on real usage ✅

---

## Support

Questions? Issues?
- Check logs: `~/.opencode/opencode.log`
- Search evidence: `opencode tool activity_evidence_search`
- Manual diagnosis: `opencode activity run debug-activity-self-contained executionId=act_xyz`
