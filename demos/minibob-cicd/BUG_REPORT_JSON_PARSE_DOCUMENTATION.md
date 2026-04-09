# Bug Report: JSON Parse Errors in Documentation Generation

**Date**: 2026-04-09
**Severity**: High
**Status**: Identified
**Affected Component**: MiniBob Improviser (write tool with long content)

## Summary

MiniBob consistently fails to generate long documentation files during improvisation due to JSON parse errors. The LLM response containing documentation content gets truncated, leaving unterminated strings.

## Evidence

From execution log `/tmp/claude-1000/-home-avi-documents-work-exp-repo-metabob-devbob/tasks/b3c07e1.output`:

```
[Improviser]  JSON parse error on step 10, retry 1/3
[Improviser]  Error: JSON Syntax Error: JSON Parse error: Unterminated string

The JSON you generated:
{"thought":"...","action":"write","params":{"path":"./IMPULSE_CHAINING_GUIDE.md","content":"# Impulse Chaining and Activity Composition Guide\n\n**Purpose**: Learn how to...
```

## Systematic Pattern

- **Frequency**: 15+ occurrences in single execution
- **Trigger**: `write` tool with `content` field >500 characters
- **Impact**: Goal fails to complete despite 3 improvisation turns
- **Workaround**: MiniBob adapts to use `bash` with heredoc

## Root Cause

When improvising, MiniBob asks LLM to return JSON like:
```json
{
  "action": "write",
  "params": {
    "path": "docs/guide.md",
    "content": "<hundreds of lines of markdown here>"
  }
}
```

The LLM response gets truncated mid-string, causing JSON parse failure.

## Affected Activities

- Documentation generation tasks
- Any improvisation requiring long file writes
- Multi-paragraph content creation

## Recommended Fix

### Option 1: Streaming Write (Best)
Add `write_streaming` tool that accepts content in chunks:
```typescript
{
  action: "write_streaming",
  params: {
    path: "docs/guide.md",
    append: true  // vs overwrite
  }
}
// Next step provides content
```

### Option 2: Force Bash Heredoc
Teach MiniBob to always use `bash` for long writes:
```json
{
  "action": "bash",
  "params": {
    "command": "cat > docs/guide.md << 'EOF'\n<content here>\nEOF"
  }
}
```

### Option 3: Max Content Length
Validate `write` tool params and reject if `content.length > 1000`:
```typescript
if (params.content.length > 1000) {
  throw new Error("Content too long for write tool. Use bash with heredoc or write_streaming.");
}
```

## Impact on Goals

Despite JSON errors, MiniBob completed partial documentation:
- `docs/activity-composition-guide.md` - 416 lines ✅
- `docs/impulse-chaining-guide.md` - 287 lines ✅
- `docs/basic-patterns.md` - created ✅

Goal marked as "not achieved" but substantial work completed.

## Workaround Currently Used

MiniBob self-corrects after 2-3 retries by switching from `write` to `bash`:
```json
{
  "action": "bash",
  "params": {
    "command": "cat >> docs/guide.md << 'EOF'\n## Section\nContent...\nEOF"
  }
}
```

This works but wastes turns (max 3 turns, 2 spent on retries).

## Thompson Sampling Impact

This bug affects activity selection:
- Activities requiring documentation get lower α scores
- Improvisation appears less reliable than it is
- Templates extracted from failed attempts don't capture successful workarounds

## Next Steps

1. Implement Option 1 (write_streaming tool)
2. Add validation to write tool (Option 3)
3. Document pattern in activity creation guide
4. Extract successful bash heredoc pattern as template
5. Update Thompson Sampling to ignore "JSON parse" failures differently than logic failures

## Related Issues

- Max improvisation turns (3) too low for complex tasks
- LLM token limits not respected in tool param generation
- Retry logic doesn't detect "content too long" vs actual JSON errors

## Bug #2: Unknown Tool 'ls'

**Evidence**: From bug detection execution:
```
[Improviser]  Step 9 failed: Unknown tool: ls
```

**Root Cause**: MiniBob LLM generates tool calls for `ls` but this tool is not registered in the available tool set.

**Impact**: Activity execution fails when LLM chooses non-existent tool

**Available Tools**: bash, read, write, edit, glob, grep (based on CLAUDE.md)

**Fix**: Either:
1. Add `ls` tool wrapper around `bash` with `ls` command
2. Teach LLM to use `bash` tool with `ls` command instead
3. Add tool validation in activity templates to prevent unknown tool usage

## Bug #3: Hang Detection Timeout on JSON Parse Retry

**Evidence**: From execution log exit code 124:
```
Hang timeout: No activity for 1800s
This suggests a hang rather than slow progress.
```

**Root Cause**: When JSON parse error occurs on step 10 retry 1/3, MiniBob appears to hang waiting for LLM response

**Sequence**:
1. Step 10: JSON parse error (unterminated string)
2. Retry 1/3: Requesting LLM decision
3. No response for 1800s (30 minutes)
4. Hang detector kills process with exit 124

**Impact**:
- Task appears to complete but exits with failure code
- Documentation partially created (7-9 steps completed)
- Thompson Sampling records as failure despite partial success

**Fix**:
1. Add timeout per LLM call (not just global hang timeout)
2. Detect infinite retry loops and fail fast
3. Consider JSON parse errors as "abandon this approach" not "retry indefinitely"

## Meta-Bug

The bug detection task itself hit bugs #1 and #2:
1. JSON parse error when trying to write bug analysis
2. Unknown tool 'ls' when trying to list files

The composition documentation task hit bugs #1 and #3:
1. JSON parse error on step 10
2. Hang timeout during retry

This demonstrates the systematic nature of these issues across different goal types.
