# Impulse Tagging: Hints, Not Guarantees

**Date**: 2026-02-20  
**Status**: Critical Design Update  
**Context**: Impulse tags are suggestions for the memory agent, not hard requirements

---

## Critical Insight

**Primary agents don't know what impulses are available.** Therefore, `@impulse:` tags are:
- ✅ **Hints** to help the memory agent find relevant context
- ✅ **Suggestions** that might not resolve to actual data
- ✅ **Best-effort references** that require graceful fallback
- ❌ **NOT guaranteed** to exist or resolve successfully

---

## Why This Matters

### The Reality of Activity Composition

**Scenario 1: Activity Output Doesn't Exist**
```javascript
// Primary agent suggests:
activity({
  templateId: "apply-documentation-deltas",
  variables: {
    deltaImpulseId: "@impulse:activityOutput:assess-documentation-conformity"
  }
})

// But assess-documentation-conformity has NEVER been run!
// Memory agent cannot resolve the tag.
```

**Scenario 2: File Has Been Moved**
```javascript
// Primary agent suggests:
deltaImpulseId: "@impulse:file:tmp/deltas.json"

// But file was cleaned up or moved to different directory
// Memory agent cannot find the file.
```

**Scenario 3: Stale Reference**
```javascript
// Primary agent suggests activity from 3 days ago:
deltaImpulseId: "@impulse:activityOutput:old-assessment"

// But there's a newer assessment from today
// Should memory agent use old or new? Or ask?
```

---

## Memory Agent Responsibilities

### 1. Tag Resolution with Graceful Fallback

The memory agent MUST handle these cases:

#### Case A: Tag Resolves Successfully ✅
```typescript
// Tag: @impulse:activityOutput:assess-documentation-conformity
// Found: act_mlvsqd7o_32dca50cbaefef49 (2 hours ago)
// Action: Create impulse, load content, replace tag with impulse ID

Result: Variable becomes "imp_assess_20260220_123456"
Status: ✅ Resolved
```

#### Case B: Tag Cannot Resolve - Alternative Available 🔄
```typescript
// Tag: @impulse:activityOutput:assess-documentation-conformity
// Not Found: No executions of that template
// But Found: assess-documentation-conformity-to-core-architecture (similar name, 2 hours ago)

Action: 
  1. Log: "Exact match not found, trying similar..."
  2. Use similar execution as fallback
  3. Create impulse from fallback
  4. Add metadata: { resolvedFrom: "fallback", originalTag: "..." }
  5. Replace tag with impulse ID

Result: Variable becomes "imp_assess_fallback_20260220_123456"
Status: ⚠️ Resolved via fallback
```

#### Case C: Tag Cannot Resolve - Search Alternatives 🔍
```typescript
// Tag: @impulse:file:tmp/deltas.json
// Not Found: File doesn't exist at that path

Action:
  1. Search for similar files: find . -name "*deltas.json" -type f
  2. If found: List alternatives
  3. If multiple: Use most recent OR ask user
  4. If none: Proceed without (see Case D)

Result: Variable becomes path to alternative OR removed
Status: ⚠️ Resolved via search
```

#### Case D: Tag Cannot Resolve - Proceed Without ⏭️
```typescript
// Tag: @impulse:activityOutput:non-existent-activity
// Not Found: No matching activities, no alternatives

Action:
  1. Log warning: "Could not resolve @impulse tag"
  2. Remove tag from variable OR set to empty/null
  3. Let activity task handle missing data gracefully
  4. Track metric: impulse_resolution_failed

Result: Variable becomes null or removed
Status: ❌ Could not resolve - activity proceeds without
```

---

## Fallback Strategies

### Strategy 1: Fuzzy Matching (Recommended)

When exact identifier doesn't match, try:

```typescript
async function fuzzyResolveActivityOutput(identifier: string) {
  // Exact match
  let execution = await findExecution({ templateId: identifier })
  if (execution) return execution
  
  // Remove hyphens/underscores, try again
  const normalized = identifier.replace(/[-_]/g, '')
  execution = await findExecution({ 
    templateId: { $regex: new RegExp(normalized, 'i') }
  })
  if (execution) {
    log(`Fuzzy match: ${identifier} → ${execution.templateId}`)
    return execution
  }
  
  // Try partial match (contains)
  execution = await findExecution({
    templateId: { $regex: new RegExp(identifier, 'i') }
  })
  if (execution) {
    log(`Partial match: ${identifier} → ${execution.templateId}`)
    return execution
  }
  
  // Give up
  return null
}
```

### Strategy 2: Recent Execution Heuristic

If identifier is vague, use most recent relevant execution:

```typescript
async function resolveActivityOutputHeuristic(identifier: string) {
  // Try exact match first
  let execution = await findExecution({ templateId: identifier })
  if (execution) return execution
  
  // Fallback: Find ANY recent activity output
  // Assumption: User likely wants most recent relevant work
  const recentExecutions = await findExecutions({
    orderBy: 'createdAt',
    order: 'desc',
    limit: 10,
    filter: { 
      status: 'completed',
      hasArtifacts: true  // Only activities that produced outputs
    }
  })
  
  if (recentExecutions.length > 0) {
    const chosen = recentExecutions[0]
    log(`Using recent execution heuristic: ${chosen.templateId}`)
    return chosen
  }
  
  return null
}
```

### Strategy 3: User Confirmation (Interactive Fallback)

When ambiguous, ask the user:

```typescript
async function resolveWithUserConfirmation(identifier: string, alternatives: Execution[]) {
  const message = `
Could not find exact match for: @impulse:activityOutput:${identifier}

Found these alternatives:
${alternatives.map((alt, i) => 
  `${i+1}. ${alt.templateId} (${timeAgo(alt.createdAt)})`
).join('\n')}

Which should I use? (1-${alternatives.length}, or 'skip' to proceed without)
  `.trim()
  
  const response = await promptUser(message)
  
  if (response === 'skip') {
    return null
  }
  
  const index = parseInt(response) - 1
  if (index >= 0 && index < alternatives.length) {
    return alternatives[index]
  }
  
  // Invalid response, use first alternative
  log('Invalid choice, using first alternative')
  return alternatives[0]
}
```

### Strategy 4: Activity-Provided Defaults

Activities can suggest default impulses if tags don't resolve:

```json
{
  "templateId": "apply-documentation-deltas",
  "variables": [{
    "name": "deltaImpulseId",
    "type": "string",
    "required": true,
    "defaultSource": "recentActivityOutput",
    "defaultCriteria": {
      "templatePattern": "*assess*documentation*",
      "requiresArtifacts": true,
      "maxAgeHours": 24
    }
  }]
}
```

Then memory agent can:
```typescript
if (!resolvedImpulse && variable.defaultSource === 'recentActivityOutput') {
  const criteria = variable.defaultCriteria
  const execution = await findRecentActivityOutput(criteria)
  if (execution) {
    log(`Using default source: ${execution.templateId}`)
    return execution
  }
}
```

---

## Error Messages & User Guidance

### Good Error Message (Helpful)

```
❌ Impulse Resolution Failed

Tag: @impulse:activityOutput:assess-documentation-conformity
Error: No executions found for template "assess-documentation-conformity"

Recent activities that produced outputs:
  1. assess-documentation-conformity-to-core-architecture (2 hours ago) ✨ Suggested
  2. test-activity-artifact-system (3 hours ago)
  3. create-activity (12 hours ago)

Suggestions:
  • Did you mean: assess-documentation-conformity-to-core-architecture?
  • Run the assessment first: activity({ templateId: "assess-documentation-conformity" })
  • Or provide a file path instead: @impulse:file:tmp/deltas.json

The activity will proceed WITHOUT this impulse. It may fail or produce incomplete results.
```

### Bad Error Message (Not Helpful)

```
Error: Impulse not found
```

---

## Auto-Proposal Pattern (Future Enhancement)

In the future, the system can **automatically propose** impulse tags based on:

### Context Analysis

```typescript
// User message: "Apply the documentation deltas"
// Memory agent analyzes:
//   - Recent conversation mentioned assessment
//   - Assessment activity ran 2 hours ago
//   - Artifacts exist in tmp/activity-assess-documentation-conformity/
//
// Auto-propose:
activity({
  templateId: "apply-documentation-deltas",
  variables: {
    deltaImpulseId: "@impulse:activityOutput:assess-documentation-conformity-to-core-architecture"
    // ↑ Automatically filled based on context
  }
})
```

### Proposal Logic

```typescript
async function proposeImpulseForVariable(variable: VariableDefinition, context: SessionContext) {
  if (variable.name.includes('delta') || variable.name.includes('assessment')) {
    // Look for recent assessment activities
    const assessments = await findRecentExecutions({
      templatePattern: '*assess*',
      hasArtifacts: true,
      maxAgeHours: 24
    })
    
    if (assessments.length > 0) {
      return `@impulse:activityOutput:${assessments[0].templateId}`
    }
  }
  
  if (variable.name.includes('file') || variable.name.includes('input')) {
    // Look for recently created files matching pattern
    const recentFiles = await findRecentFiles({
      pattern: '**/*.json',
      maxAgeHours: 24,
      minSizeBytes: 100
    })
    
    if (recentFiles.length > 0) {
      return `@impulse:file:${recentFiles[0].path}`
    }
  }
  
  return null // No good proposal
}
```

### Auto-Proposal UI

```
┌─────────────────────────────────────────────────────────────┐
│ Activity: apply-documentation-deltas                        │
├─────────────────────────────────────────────────────────────┤
│ Required Variables:                                         │
│                                                             │
│ deltaImpulseId: [Auto-proposed ✨]                          │
│   @impulse:activityOutput:assess-documentation-conformity   │
│   From: Recent activity (2 hours ago)                       │
│   Alternative: Specify manually                             │
│                                                             │
│ priorityFilter: [Not set]                                   │
│   Suggestions: high, medium, all                            │
│                                                             │
│ Accept proposals? (Y/n/edit):                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Guidelines

### Memory Agent Pre-Execution Hook

```typescript
async function resolveImpulseTags(variables: Record<string, any>, context: SessionContext) {
  const tags = detectImpulseTags(variables)
  const resolutionLog: ResolutionLog[] = []
  
  for (const tag of tags) {
    const resolver = getResolver(tag.type)
    let resolved = false
    let impulseId = null
    
    // Strategy 1: Try exact resolution
    try {
      const result = await resolver.resolve(tag.identifier)
      impulseId = result.impulseId
      resolved = true
      resolutionLog.push({
        tag: tag.fullTag,
        status: 'resolved',
        strategy: 'exact',
        impulseId
      })
    } catch (error) {
      // Strategy 2: Try fuzzy matching
      try {
        const result = await resolver.resolveFuzzy(tag.identifier)
        impulseId = result.impulseId
        resolved = true
        resolutionLog.push({
          tag: tag.fullTag,
          status: 'resolved',
          strategy: 'fuzzy',
          impulseId,
          warning: `Used fuzzy match: ${result.actualIdentifier}`
        })
      } catch (fuzzyError) {
        // Strategy 3: Try defaults/heuristics
        if (hasDefaultSource(tag.variable)) {
          try {
            const result = await resolveDefault(tag.variable)
            impulseId = result.impulseId
            resolved = true
            resolutionLog.push({
              tag: tag.fullTag,
              status: 'resolved',
              strategy: 'default',
              impulseId,
              warning: 'Used default source'
            })
          } catch (defaultError) {
            // Give up
          }
        }
      }
    }
    
    if (resolved && impulseId) {
      // Replace tag with impulse ID
      variables[tag.variable] = variables[tag.variable].replace(tag.fullTag, impulseId)
    } else {
      // Could not resolve - proceed without
      resolutionLog.push({
        tag: tag.fullTag,
        status: 'failed',
        error: 'No resolution strategy succeeded',
        action: 'Proceeding without impulse'
      })
      
      // Remove tag or set to null
      if (isRequiredVariable(tag.variable)) {
        throw new Error(generateHelpfulErrorMessage(tag, context))
      } else {
        variables[tag.variable] = null
      }
    }
  }
  
  // Log all resolutions for debugging
  logResolutions(resolutionLog)
  
  return variables
}
```

### Activity Task Handling Missing Impulses

Activities should gracefully handle missing impulses:

```
# Task: Load and Filter Documentation Deltas

## Objective
Load documentation deltas from an impulse OR file path OR prompt user.

## Input Variables
- **deltaImpulseId**: `{{deltaImpulseId}}` - Impulse ID, file path, or null

## Steps

1. **Load Deltas with Fallback**
   
   **If deltaImpulseId is an impulse ID:**
   - Use impulse tools to load content
   - Proceed normally
   
   **Else if deltaImpulseId looks like a file path:**
   - Read file directly with Read tool
   - Parse JSON content
   - Proceed normally
   
   **Else if deltaImpulseId is null or invalid:**
   - Search for recent delta files: `find . -name "*deltas.json" -mtime -1`
   - If found: Use most recent
   - If not found: Ask user to provide file path
   - If user declines: Fail gracefully with helpful error

2. **Validate Data Schema**
   - Once data is loaded (from ANY source), validate schema
   - Handle both generic and assessment-specific schemas
   - If invalid: Log schema issues and fail with details

[Rest of task continues normally...]
```

---

## Metrics to Track

### Resolution Success Rates

```typescript
interface ImpulseResolutionMetric {
  tag: string
  type: string  // activityOutput, file, component, metabobIssue
  identifier: string
  status: 'resolved' | 'resolved-fuzzy' | 'resolved-default' | 'failed'
  strategy: 'exact' | 'fuzzy' | 'default' | 'user-confirmation' | null
  resolutionTimeMs: number
  fallbackUsed: boolean
  error?: string
}
```

**Questions to Answer**:
- What % of tags resolve successfully?
- Which fallback strategies are most effective?
- Which tag types fail most often?
- Are users providing accurate hints?

### Example Metrics Dashboard

```
Impulse Tag Resolution (Last 7 Days)

Overall Success Rate: 87%
  ├─ Exact Match:      73% (146/200)
  ├─ Fuzzy Match:      10% (20/200)
  ├─ Default Source:    4% (8/200)
  └─ Failed:           13% (26/200)

By Type:
  activityOutput:  92% success (110/120)
  file:            75% success (45/60)
  component:       90% success (18/20)
  metabobIssue:    —   (not yet used)

Common Failures:
  1. Stale references (activity ran >24h ago, artifacts cleaned up)
  2. Typos in identifier (assess-docs vs assess-documentation)
  3. Activity never executed (user assumed it ran)

Recommendations:
  • Add artifact retention policy (keep for 7 days)
  • Improve fuzzy matching for common typos
  • Suggest running prerequisite activities
```

---

## Summary: Key Design Principles

### 1. Tags are Hints, Not Contracts ⚠️
- Primary agents don't know what exists
- Memory agent uses best effort to resolve
- Graceful degradation when resolution fails

### 2. Fallback is Not Failure ✅
- Fuzzy matching is acceptable
- Using recent/similar data is better than nothing
- User confirmation can resolve ambiguity

### 3. Activities Must Handle Missing Data 🛡️
- Don't assume impulses will always resolve
- Provide alternative data sources (direct file paths)
- Fail gracefully with helpful error messages

### 4. Learn and Improve 📈
- Track which tags succeed/fail
- Identify patterns in failures
- Improve auto-proposal over time

### 5. User Guidance is Critical 📚
- Show what was found/not found
- Suggest alternatives
- Explain why resolution failed
- Provide clear next steps

---

## Next Steps

### For Memory Agent Implementation
1. Implement tag detection (as documented)
2. Add fuzzy matching for all resolver types
3. Implement default source resolution
4. Add comprehensive error messages with suggestions
5. Track resolution metrics

### For Activity Templates
1. Update task prompts to handle null impulse IDs
2. Add fallback logic (file paths, search, user prompts)
3. Document required vs optional impulses
4. Specify default sources where applicable

### For User Experience
1. Show resolution status (exact/fuzzy/default/failed)
2. Warn when fallbacks are used
3. Suggest running prerequisite activities
4. Preview impulse content before activity execution

---

**Status**: Critical design update - impulse tags are hints requiring robust fallback strategies  
**Impact**: Memory agent must gracefully handle missing/stale/ambiguous references  
**Benefit**: More flexible, user-friendly activity composition even when references are imperfect
