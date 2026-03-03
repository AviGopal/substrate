# Git Workflow Sync Activity Template

## Summary

I've created a **reusable git workflow sync activity template** with the following design:

### Template Structure

**Name**: Git Workflow Sync  
**Category**: infrastructure  
**Purpose**: Synchronize local branch with remote (fetch, rebase, push)

### Tasks (4 steps)

1. **fetch-and-status**: Fetch from remote and check current branch status
2. **handle-uncommitted-changes**: Commit, stash, or discard uncommitted files
3. **rebase-on-remote**: Rebase current branch on remote tracking branch
4. **push-to-remote**: Push rebased branch to remote

### Features

- ✅ Automatic conflict detection and resolution guidance
- ✅ Support for stashing WIP changes
- ✅ Force-with-lease for safe force pushes
- ✅ Comprehensive status documentation throughout
- ✅ Validation commands to ensure clean state

### File Location

**Bootstrap path**: `repos/metabob-proto/activities/bootstrap/git-workflow-sync.json`

### Current Status

**Created**: File written but schema conversion needed  
**Issue**: Bootstrap template schema differs from cached template schema:
- Bootstrap uses: `name`, `version`, `tasks`, prompt.`maxTokens`, prompt.`compressionStrategy`
- Cached uses: `activity_id`, `task_steps`, context_rules.`max_tokens`, context_rules.`compression_strategy`

### Next Steps

**Option 1**: Manually convert to correct schema and commit  
**Option 2**: Use the template as-is and let the registration process handle conversion  
**Option 3**: Create via `create-activity` template (which failed earlier due to validation issues)

## Recommended Action

Since I've already committed the file, let me:

1. Fix the JSON schema to match bootstrap format
2. Register it properly
3. Test execution

Or, you can manually sync the current branch using these commands:

```bash
# Option A: Manual sync (quick solution)
git fetch origin
git rebase origin/prompts/metabob-devbob-mlpu1y8l  # or your remote branch
git push origin prompts/metabob-devbob-mlpu1y8l

# Option B: Wait for template to be fixed and use:
# activity({ templateId: "git-workflow-sync", variables: {}, reason: "Sync branch" })
```

## Template Design Rationale

The git-workflow-sync template automates a common developer workflow that is:
- **Error-prone**: Easy to forget steps or make mistakes
- **Repetitive**: Same sequence for every sync
- **Context-dependent**: Requires handling various states (clean, dirty, conflicts)
- **Learnable**: Success patterns can improve over time via Thompson Sampling

Once registered, this template will join the bootstrap templates and be available across all projects.
