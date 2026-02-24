# Next Session: Impulse Integration and Delta Application

**Date**: 2026-02-20  
**Status**: Ready for Implementation  
**Priority**: HIGH - Enables automated activity composition workflows

---

## Quick Start Summary

### What's Complete ✅
1. **Phase 2 Activity Artifacts System** - Fully validated ($1.17, 2 tests passed)
2. **Assessment artifacts generated** - 66 documentation deltas (3 critical applied, 63 remaining)
3. **Apply template created** - `apply-documentation-deltas` (49KB, 5 tasks)
4. **Impulse tagging pattern designed** - Complete specification in `IMPULSE_TAGGING_PATTERN.md`
5. **Schema mismatch documented** - Analysis and solution in `ACTIVITY_ARTIFACTS_WORKFLOW_LEARNINGS.md`

### What's Needed ⏳
1. **Memory agent impulse tag resolution** - Implement `@impulse:` prefix detection and resolution
2. **Test end-to-end workflow** - Apply deltas via impulse-based automation
3. **Apply remaining 63 deltas** - Validate automation time savings

---

## Current State

### Artifacts Available

**Assessment Output** (`tmp/activity-assess-documentation-conformity/`):
- `required-deltas.json` - 66 deltas (38KB)
- `required-deltas.md` - Human-readable (32KB)
- `assessment-report.md` - Executive summary (11KB)
- `conformity-scores.json` - Per-document scores (40KB)
- `architecture-reference.json` - Core paradigm (13KB)
- `document-inventory.json` - 41 documents (13KB)

**Total**: 6 files, 156KB

### Deltas Status

| Priority | Total | Applied | Remaining |
|----------|-------|---------|-----------|
| Critical | 3 | 3 ✅ | 0 |
| High | 1 | 0 | 1 |
| Medium | 62 | 0 | 62 |
| **Total** | **66** | **3** | **63** |

**Applied Deltas** (Commit `66abf55`):
- delta-006: COMMUNICATION_FLOW_ARCHITECTURE.md (line 404)
- delta-005: TEMPLATE_MANAGEMENT_ARCHITECTURE.md (line 145)
- delta-007: VARIANT_CREATION_AND_SESSION_AFFINITY_ARCHITECTURE.md (line 867)

**Remaining HIGH Priority** (delta-003):
- File: IMPULSE_ACTIVITY_ARCHITECTURE_EXPLAINED.md
- Issue: Document uses "the agent" without explaining bridge paradigm
- Change: Add bridge explanation (LLM + activities + tools transform instructional → functional state)
- Effort: ~10 minutes (document-wide terminology addition)

---

## Implementation Tasks

### Task 1: Implement Memory Agent Impulse Tag Resolution

**Location**: Memory agent pre-execution hook

**Requirements**:
1. **Tag Detection**
   ```typescript
   // Scan activity variables for @impulse: tags
   const impulseTagPattern = /@impulse:(\w+):([^@\s]+)/g
   
   function detectImpulseTags(variables: Record<string, any>): ImpulseTag[] {
     const tags: ImpulseTag[] = []
     for (const [key, value] of Object.entries(variables)) {
       if (typeof value === 'string') {
         const matches = value.matchAll(impulseTagPattern)
         for (const match of matches) {
           tags.push({
             variable: key,
             fullTag: match[0],
             type: match[1],        // activityOutput, file, component, metabobIssue
             identifier: match[2],   // template-id, path, query
             originalValue: value
           })
         }
       }
     }
     return tags
   }
   ```

2. **Type-Specific Resolvers**
   ```typescript
   interface ImpulseResolver {
     type: string
     resolve(identifier: string): Promise<{ impulseId: string, content: any }>
   }
   
   class ActivityOutputResolver implements ImpulseResolver {
     type = 'activityOutput'
     
     async resolve(identifier: string) {
       // Search activity storage for template ID or execution ID
       const activityStorage = getActivityStorage()
       const execution = await activityStorage.findExecution({
         templateId: identifier,  // or activityId: identifier
         orderBy: 'createdAt',
         order: 'desc',
         limit: 1
       })
       
       if (!execution) {
         throw new Error(`Activity execution not found: ${identifier}`)
       }
       
       // Locate artifact directory
       const artifactDir = execution.metadata?.artifactDir || 
                          `tmp/activity-${identifier}/`
       
       // Find primary artifact (required-deltas.json, output.json, etc.)
       const primaryArtifact = await findPrimaryArtifact(artifactDir)
       
       // Load artifact content
       const content = await readFile(primaryArtifact)
       
       // Create impulse
       const impulseId = `imp_${identifier}_${Date.now()}`
       await impulse_create({
         id: impulseId,
         type: 'activityOutput',
         pointer: {
           type: 'activityOutput',
           activityId: execution.id,
           artifactDir,
           primaryArtifact
         },
         budget: Math.ceil(content.length / 4), // Estimate tokens
         priority: 'high',
         metadata: {
           source: 'impulse-tag-resolution',
           resolvedFrom: identifier,
           resolutionTime: Date.now()
         }
       })
       
       await impulse_load({ id: impulseId })
       
       return { impulseId, content }
     }
   }
   
   class FileResolver implements ImpulseResolver {
     type = 'file'
     
     async resolve(identifier: string) {
       // Resolve path (relative to repo root if not absolute)
       const filePath = path.isAbsolute(identifier) 
         ? identifier 
         : path.join(process.cwd(), identifier)
       
       // Read file
       const content = await readFile(filePath, 'utf-8')
       
       // Create impulse
       const impulseId = `imp_file_${path.basename(identifier)}_${Date.now()}`
       await impulse_create({
         id: impulseId,
         type: 'file',
         pointer: { type: 'file', path: filePath },
         budget: Math.ceil(content.length / 4),
         priority: 'high',
         metadata: {
           source: 'impulse-tag-resolution',
           resolvedFrom: identifier
         }
       })
       
       await impulse_load({ id: impulseId })
       
       return { impulseId, content }
     }
   }
   ```

3. **Variable Replacement**
   ```typescript
   async function resolveImpulseTags(variables: Record<string, any>) {
     const tags = detectImpulseTags(variables)
     const resolvers = {
       activityOutput: new ActivityOutputResolver(),
       file: new FileResolver(),
       component: new ComponentResolver(),
       metabobIssue: new MetabobIssueResolver()
     }
     
     for (const tag of tags) {
       const resolver = resolvers[tag.type]
       if (!resolver) {
         throw new Error(`Unknown impulse type: ${tag.type}`)
       }
       
       try {
         const { impulseId } = await resolver.resolve(tag.identifier)
         
         // Replace tag with impulse ID in variable
         variables[tag.variable] = variables[tag.variable].replace(
           tag.fullTag,
           impulseId
         )
         
         // Track metrics
         await trackImpulseResolution({
           tag: tag.fullTag,
           type: tag.type,
           identifier: tag.identifier,
           resolvedTo: impulseId,
           variable: tag.variable,
           success: true
         })
       } catch (error) {
         // Track failure
         await trackImpulseResolution({
           tag: tag.fullTag,
           type: tag.type,
           identifier: tag.identifier,
           error: error.message,
           success: false
         })
         throw error
       }
     }
     
     return variables
   }
   ```

4. **Integration into Activity Execution**
   ```typescript
   // In activity executor, before task execution
   async function executeActivity(templateId, variables, options) {
     // Pre-execution hook: Resolve impulse tags
     const resolvedVariables = await resolveImpulseTags(variables)
     
     // Continue with normal execution using resolved variables
     const execution = await activityEngine.execute({
       templateId,
       variables: resolvedVariables,
       options
     })
     
     return execution
   }
   ```

**Success Criteria**:
- ✅ Tag detection finds all `@impulse:` references in variables
- ✅ ActivityOutputResolver finds recent activity executions
- ✅ File paths resolved and content loaded
- ✅ Impulses created and loaded automatically
- ✅ Tags replaced with impulse IDs in variables
- ✅ Metrics tracked (resolution time, content size, lineage)

---

### Task 2: Test End-to-End Impulse Workflow

**Test Command**:
```javascript
activity({
  templateId: "apply-documentation-deltas",
  variables: {
    deltaImpulseId: "@impulse:activityOutput:assess-documentation-conformity",
    priorityFilter: "high",
    maxDeltas: 5,
    dryRun: true,  // First test in dry-run mode
    createCommits: false
  },
  reason: "Test impulse tag resolution with assessment artifacts"
})
```

**Expected Behavior**:
1. Memory agent detects `@impulse:activityOutput:assess-documentation-conformity` tag
2. ActivityOutputResolver searches activity storage
3. Finds `act_mlvsqd7o_32dca50cbaefef49` (most recent assessment execution)
4. Locates `tmp/activity-assess-documentation-conformity/required-deltas.json`
5. Loads 66 deltas from JSON file
6. Creates impulse `imp_assess-documentation-conformity_<timestamp>`
7. Loads impulse into session memory
8. Replaces tag with impulse ID: `deltaImpulseId: "imp_assess-documentation-conformity_<timestamp>"`
9. Activity task 1 receives impulse ID
10. Task uses impulse tools to access delta data
11. Filters to 1 HIGH priority delta
12. Generates application plan (dry-run mode, no actual changes)
13. Activity completes successfully

**Validation**:
- Check logs for impulse tag resolution
- Verify impulse created with correct content
- Confirm activity task received impulse ID
- Review dry-run output shows correct filtering

---

### Task 3: Apply HIGH Priority Delta

**After dry-run success**, run with `dryRun: false`:

```javascript
activity({
  templateId: "apply-documentation-deltas",
  variables: {
    deltaImpulseId: "@impulse:activityOutput:assess-documentation-conformity",
    priorityFilter: "high",
    maxDeltas: 5,
    dryRun: false,           // Actually apply changes
    createCommits: true,      // Create git commits
    commitGrouping: "priority" // One commit per priority level
  },
  reason: "Apply HIGH priority documentation delta (IMPULSE_ACTIVITY_ARCHITECTURE_EXPLAINED.md bridge paradigm)"
})
```

**Expected Changes**:
- `IMPULSE_ACTIVITY_ARCHITECTURE_EXPLAINED.md` modified
- Bridge paradigm explanation added (LLM + activities + tools)
- Git commit created with traceability to delta-003

---

### Task 4: Apply MEDIUM Priority Deltas (Batch Test)

**Test automation at scale**:

```javascript
activity({
  templateId: "apply-documentation-deltas",
  variables: {
    deltaImpulseId: "@impulse:activityOutput:assess-documentation-conformity",
    priorityFilter: "medium",
    maxDeltas: 10,           // Batch of 10
    dryRun: false,
    createCommits: true,
    commitGrouping: "single"  // One commit for all changes
  },
  reason: "Apply batch of MEDIUM priority deltas to test automation scalability"
})
```

**Expected Outcome**:
- 10 MEDIUM priority deltas applied
- Multiple files modified with terminology updates
- Single git commit with all changes
- Time: ~5-10 minutes (vs ~50 minutes manual)
- **90% time savings validated**

---

## Known Issues to Address

### Issue 1: Schema Mismatch

**Problem**: `apply-documentation-deltas` expects generic schema, but assessment produces rich schema.

**Fields Expected**:
```json
{
  "id": "delta-001",
  "file": "path/to/file.md",
  "priority": "CRITICAL",
  "changeType": "update",
  "description": "Change description",
  "content": "New content"
}
```

**Fields Actual**:
```json
{
  "delta_id": "delta-006",
  "file_path": "COMMUNICATION_FLOW_ARCHITECTURE.md",
  "location": "line 404",
  "priority": "critical",
  "issue_type": "unclear_explanation",
  "current_text": "Old text",
  "proposed_change": "New text",
  "rationale": "Why change is needed",
  "estimated_effort": "15 minutes",
  "criterion_id": "check-6"
}
```

**Solution Options**:

**Option A: Update activity template to accept actual schema** (Recommended short-term)
- Modify task 1 prompt to expect `delta_id`, `file_path`, etc.
- Use `current_text` and `proposed_change` instead of `content`
- Handle lowercase priority (`critical` vs `CRITICAL`)

**Option B: Create schema adapter activity** (Recommended long-term)
- New template: `adapt-assessment-deltas`
- Transform assessment schema → generic schema
- Reusable for other workflows

**Option C: Update assessment to produce generic schema**
- Loses rich metadata (not recommended)

**For next session**: Start with Option A (quick fix), then implement Option B (proper solution).

---

## Success Metrics

### Time Savings (Projected)

| Task | Manual | Automated | Savings |
|------|--------|-----------|---------|
| Apply 1 HIGH delta | 10 min | 2 min | 80% |
| Apply 10 MEDIUM deltas | 50 min | 5 min | 90% |
| Apply all 62 MEDIUM deltas | 5 hours | 30 min | 90% |
| **Total (63 remaining)** | **~6 hours** | **~35 min** | **90%** |

### Quality Improvements

| Benefit | Description |
|---------|-------------|
| Consistency | Automated edits use exact proposed text |
| Traceability | Git commits link to delta IDs and assessment criteria |
| Validation | Automated checks prevent broken references |
| Atomicity | Changes grouped logically (per-priority or per-file) |
| Rollback | Easy to revert via git if issues found |

---

## Files to Reference

### Documentation
- `IMPULSE_TAGGING_PATTERN.md` - Complete tag syntax and resolution spec
- `ACTIVITY_ARTIFACTS_WORKFLOW_LEARNINGS.md` - Schema mismatch analysis
- `ACTIVITY_ARTIFACTS_PHASE_2_COMPLETE.md` - Phase 2 validation summary

### Artifacts
- `tmp/activity-assess-documentation-conformity/required-deltas.json` - 66 deltas to apply
- `tmp/activity-assess-documentation-conformity/assessment-report.md` - Executive summary

### Templates
- `.metabob/activities/apply-documentation-deltas.json` - Consumer template (49KB)
- `.metabob/activities/assess-documentation-conformity-to-core-architecture.json` - Producer template

### Previous Commits
- `66abf55` - 3 critical deltas applied manually
- `0d95729` - Impulse tagging pattern specification
- `461ea2f` - Workflow learnings and schema mismatch

---

## Quick Command Reference

### Test Impulse Resolution (Dry-Run)
```bash
opencode activity run apply-documentation-deltas \
  --deltaImpulseId "@impulse:activityOutput:assess-documentation-conformity" \
  --priorityFilter high \
  --maxDeltas 5 \
  --dryRun true \
  --createCommits false
```

### Apply HIGH Priority Delta
```bash
opencode activity run apply-documentation-deltas \
  --deltaImpulseId "@impulse:activityOutput:assess-documentation-conformity" \
  --priorityFilter high \
  --dryRun false \
  --createCommits true
```

### Apply MEDIUM Priority Deltas (Batch)
```bash
opencode activity run apply-documentation-deltas \
  --deltaImpulseId "@impulse:activityOutput:assess-documentation-conformity" \
  --priorityFilter medium \
  --maxDeltas 10 \
  --dryRun false \
  --createCommits true \
  --commitGrouping single
```

---

## Next Session Checklist

- [ ] Implement memory agent impulse tag detection
- [ ] Implement ActivityOutputResolver
- [ ] Implement FileResolver  
- [ ] Add metrics tracking for impulse resolution
- [ ] Test dry-run mode with impulse tag
- [ ] Fix schema mismatch (Option A: update template)
- [ ] Apply 1 HIGH priority delta
- [ ] Apply 10 MEDIUM priority deltas (batch test)
- [ ] Document successful workflow with examples
- [ ] Measure and report time savings

---

**Status**: Infrastructure complete, implementation ready to begin  
**Estimated Session Time**: 2-3 hours for full implementation and testing  
**Expected Outcome**: 11+ deltas applied via automation, 90% time savings validated
