# Activity Lifecycle Logging Validation Status

## Current State: Logs Exist But Not Validated at Runtime

### Commits
- ✅ **305a9ab6**: Added 8 lifecycle log points (feat: comprehensive lifecycle logging)
- ✅ **DevBob Image**: Built with lifecycle logging code
- ✅ **Source Code**: All 8 log statements verified in source

### Log Points Added (src/tool/activity.ts, src/session/activity.ts, etc.)

1. **Activity Start** (`src/tool/activity.ts:478`)
   ```typescript
   log.info(`Activity: ${template.name} starting`, {
     activityId: 'will-be-assigned',
     templateId: template.id,
     category: template.category,
     taskCount: template.tasks?.length ?? 0,
     variant: selectionResult.variant,
   })
   ```

2. **Task Start** (`src/tool/activity.ts:2348`)
   ```typescript
   log.info(`Task starting: ${task.id}`, {
     taskId: task.id,
     description: task.description,
     activityId: _activity.id,
     subagent: task.subagent,
     dependencies: task.dependencies,
   })
   ```

3. **Task Complete** (`src/tool/activity.ts:2501`)
   ```typescript
   log.info(`Task completed: ${taskId}`, {
     taskId,
     description: task.description,
     activityId: _activity.id,
     attempts: result.attempts,
     duration: result.duration,
     durationSeconds: Math.round(result.duration / 1000),
     cost: result.cost,
     status: result.status,
   })
   ```

4. **Activity Complete** (`src/session/activity.ts:1131+`)
   ```typescript
   log.info(`Activity completed: ${activity.title}`, {
     activityId: id,
     templateId: activity.templateId,
     status: activity.status,
     duration: activity.stats.duration,
     ...
   })
   ```

5. **Storage Write** (`src/storage/storage.ts:275+`)
   ```typescript
   log.info("storage write confirmed", {
     path: target,
     sizeBytes,
     sizeKB: Math.round(sizeBytes / 1024),
     key: key.join('/'),
   })
   ```

6. **Git Commit** (`src/session/activity-git.ts:150+`)
   ```typescript
   log.info(`Git commit created: ${sha.slice(0, 7)}`, {
     sha,
     shortSha: sha.slice(0, 7),
     filesChanged: filesChanged.length,
     files: filesChanged,
     message: sanitizedMessage.split('\n')[0],
   })
   ```

7. **Memory Agent Init** (`src/session/memory-agent.ts:470+`)
   ```typescript
   log.info("Memory agent initializing", {
     sessionID,
     activityId,
     contextRequirements: template.contextRequirements?.length ?? 0,
   })
   ```

8. **Memory Agent Complete** (`src/session/memory-agent.ts:619+`)
   ```typescript
   log.info(`Memory agent gathered ${impulseCount} impulses`, {
     sessionID,
     activityId,
     impulseCount,
     totalBudget,
     highPriority: impulses.filter(i => i.priority === 'high').length,
   })
   ```

### Why Local Testing Failed

**Problem**: Executed `activity` tool in current session which loaded OpenCode code BEFORE commit 305a9ab6.

**Evidence**:
- DEBUG log at line 467 appeared in logs ✅
- INFO log at line 478 did NOT appear ❌
- Both logs are consecutive in source code
- Only explanation: Code version mismatch

**Timeline**:
- 08:26:26 - Commit 305a9ab6 added logs
- 08:28:00 - Binary rebuilt with logs
- 08:28:00 - DevBob pod built with logs
- [Earlier] - Current session started (before commit)
- 09:01:00 - Executed activity in current session (old code)

### Validation Requirements

To properly validate lifecycle logging:

1. **Use Fresh Process**: Either DevBob pod OR new local process
2. **Execute Real Activity**: Must create files, run tests, make commits
3. **Capture Logs**: Stream logs during execution
4. **Verify All 8 Patterns**: Check each log point appears

### DevBob Readiness

**DevBob Pod Status**:
- ✅ Pod: `devbob-794b69b4f4-rhnwg`
- ✅ Image: Built with lifecycle logging (post-305a9ab6)
- ✅ Port forward: `localhost:8080 → devbob:8080`
- ✅ ACP transport: Fixed and working

**What DevBob Is Missing**:
- ❌ Activity templates not installed in `/workspace`
- ✅ Workaround: Use ACP to delegate to DevBob from local

### Recommended Validation Approach

**Option A: Direct DevBob Execution** (if templates installed):
```bash
kubectl exec -n metabob devbob-794b69b4f4-rhnwg -- \\
  opencode activity fix-bug-complete \\
  --variables '{"bugDescription":"test","files":["test.ts"]}' \\
  --reason "Lifecycle validation"

kubectl logs -n metabob devbob-794b69b4f4-rhnwg --tail=200 | \\
  grep -E "Activity.*starting|Task starting|Task completed|Activity completed"
```

**Option B: Local Fresh Process**:
```bash
repos/metabob-opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode \\
  activity fix-bug-complete \\
  --variables '{"bugDescription":"test lifecycle","files":["test.ts"]}' \\
  --reason "Lifecycle validation" \\
  --print-logs  # Logs to stderr instead of file

# Check logs
tail -200 ~/.local/share/opencode/log/dev.log | \\
  grep -E "Activity.*starting|Task starting"
```

**Option C: Validation Harness** (automated):
```bash
cd repos/metabob-opencode
bun test/validation-harnesses/run-activity-lifecycle-validation.ts
```

### Success Criteria

All 8 log patterns must appear in output:
- [ ] "Activity: [name] starting"
- [ ] "Memory agent initializing"
- [ ] "Memory agent gathered N impulses"
- [ ] "Task starting: [id]"
- [ ] "Task completed: [id]"
- [ ] "storage write confirmed"
- [ ] "Git commit created: [hash]"
- [ ] "Activity completed: [title]"

### Next Actions

1. **Install bootstrap templates in DevBob** OR
2. **Run validation harness locally with fresh process** OR
3. **Use local activity tool with `--print-logs` flag**

## Status: 98% Complete

- ✅ Lifecycle logs implemented
- ✅ Code committed and deployed
- ⏳ Runtime validation pending (requires fresh process)

**Blocker**: Session code version mismatch prevented validation in current session.

**Resolution**: Use fresh process (DevBob, new local session, or validation harness).
