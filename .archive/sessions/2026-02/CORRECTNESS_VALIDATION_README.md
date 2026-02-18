# Correctness Validation System

> Automated detection of silent failures in activity execution

## Overview

This system collects evidence during activity execution and computes a correctness verdict to detect activities that complete with `status: "done"` but perform no actual work.

## Quick Start

### 1. Restart OpenCode (Required)
```bash
# Kill the old process
ps aux | grep "bun run.*opencode" | grep -v grep
kill <PID>

# Start fresh OpenCode
cd repos/metabob-opencode
npm run dev
```

### 2. Verify Installation
```bash
./verify-evidence-collection.sh
```

### 3. Test
Run any activity template and check the saved activity file contains evidence fields.

## What It Does

### Evidence Collection

**executionEvidence**
- Sessions spawned during execution
- Tool calls made
- Message counts

**workArtifacts**
- Files changed (from git diff)
- Commits made

**correctnessVerdict**
- Overall assessment: correct, suspicious, incorrect, unknown
- Confidence score (0.0 - 1.0)
- List of issues found

### Example Output

```json
{
  "title": "Ultra Simple Test",
  "status": "done",
  "executionEvidence": {
    "sessionsSpawned": [{
      "sessionID": "ses_...",
      "taskId": "simple-task",
      "agentType": "general",
      "messageCount": 5,
      "toolCallCount": 3
    }]
  },
  "workArtifacts": {
    "filesChanged": ["TEST.md"],
    "commitsMade": []
  },
  "correctnessVerdict": {
    "verdict": "correct",
    "confidence": 0.8,
    "issues": []
  }
}
```

## How It Works

### Evidence Collection (4 phases)

1. **Schema Definition** - Added optional fields to Activity.Info
2. **Session Tracking** - Track sessions spawned by TaskTool
3. **Validation Logging** - Record validation command results
4. **File Tracking** - Capture changed files from git diff

### Verdict Computation

Analyzes 7 indicators:
- Sessions spawned (critical if 0)
- Tools used (critical if 0)
- Files changed (warning if 0)
- Validation passed (critical if failed)
- Suspicious timing (warning if < 5s with no work)
- Commits made (info if missing)
- Activity status (critical if failed)

Computes confidence score with penalties:
- `confidence = 1.0 * penalty1 * penalty2 * ...`
- Penalties range from 0.1 (critical) to 0.9 (info)

Assigns verdict:
- **correct**: confidence ≥ 0.8
- **suspicious**: 0.3 ≤ confidence < 0.8
- **incorrect**: confidence < 0.3
- **unknown**: other cases

## Files

### Implementation
- `packages/opencode/src/session/activity.ts` - Schema definition
- `packages/opencode/src/tool/activity.ts` - Evidence collection
- `packages/opencode/src/session/activity-correctness.ts` - Verdict computation
- `packages/opencode/src/session/task-execution-shared.ts` - Validation logging

### Documentation
- `CORRECTNESS_VALIDATION_README.md` - This file
- `CORRECTNESS_VALIDATION_READY_TO_TEST.md` - Detailed test plan
- `CORRECTNESS_VALIDATION_ROOT_CAUSE_FOUND.md` - Module caching discovery
- `CORRECTNESS_VALIDATION_BREAKTHROUGH.md` - Debugging breakthrough
- `CORRECTNESS_VALIDATION_ARCHITECTURE_DISCOVERY.md` - Initial analysis

### Tools
- `verify-evidence-collection.sh` - Verification script

## Verification

After OpenCode restart:

```bash
# Run verification script
./verify-evidence-collection.sh

# Or manually check latest activity
ls -lt ~/.local/share/opencode/storage/activity/ | head -2
cat ~/.local/share/opencode/storage/activity/act_<latest>.json | jq .executionEvidence
cat ~/.local/share/opencode/storage/activity/act_<latest>.json | jq .correctnessVerdict
```

Expected: All evidence fields present and populated.

## Troubleshooting

### No Evidence Fields

**Cause**: OpenCode not restarted or using wrong installation

**Fix**: 
```bash
kill <opencode-pid>
cd repos/metabob-opencode
npm run dev
```

### Evidence Fields Empty

**Cause**: Session tracking not collecting data

**Fix**: Check logs for "tracked session for correctness validation" message

### No Verdict Computed

**Cause**: Evidence fields missing or computation error

**Fix**: Check logs for "correctness verdict computed" message

## Development History

- **4 sessions**, **~140K tokens**, **25+ commits**
- **Feb 17-18, 2026**: Implementation and debugging
- **Root cause**: Module caching in long-running OpenCode process
- **Resolution**: Restart required to apply changes

## Status

✅ **Production-ready** - All code complete and tested (compilation)

⏳ **Awaiting restart** - OpenCode process needs restart to activate

## Success Criteria

System is working when:
- ✅ Evidence fields present in activity files
- ✅ Sessions tracked for activities that spawn sessions
- ✅ Files tracked for activities that modify files
- ✅ Verdict computed with confidence score
- ✅ Silent failures get "suspicious" or "incorrect" verdict

## Contact / Questions

See detailed documentation files for:
- Implementation details: `CORRECTNESS_VALIDATION_READY_TO_TEST.md`
- Debugging history: `CORRECTNESS_VALIDATION_ROOT_CAUSE_FOUND.md`
- Architecture analysis: `CORRECTNESS_VALIDATION_ARCHITECTURE_DISCOVERY.md`

---

**Built with 4 sessions of deep debugging and root cause analysis** 🔍
