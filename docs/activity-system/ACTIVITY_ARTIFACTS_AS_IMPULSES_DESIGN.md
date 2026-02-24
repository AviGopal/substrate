# Activity Artifacts as Impulses: Design Specification

**Status**: Design  
**Created**: 2026-02-21  
**Purpose**: Enable OS-agnostic artifact storage and composition for activities

---

## Problem Statement

### Current Issue
Activities that generate artifacts (reports, analysis files, structured data) face sandbox violations when using absolute temp paths:

```typescript
// Activity template validation command
{
  "command": "test $(grep -c 'Pattern' {{output_dir}}/report.md) -ge 5",
  "expected_exit_code": 0
}

// When output_dir = "/tmp/activity-output"
// ❌ Error: This command references paths outside of repository
```

### Why This Matters
1. **Sandbox Security**: Activities can't reference `/tmp/` (outside repo)
2. **OS Portability**: `/tmp/` is Unix-specific (Windows uses `%TEMP%`)
3. **Activity Composition**: No clean way to pass artifacts between activities
4. **Reproducibility**: Temp files disappear, breaking replay

---

## Solution: Artifacts as Impulses

### Core Concept

**Treat activity artifacts (files, reports, data) as first-class impulses**

```
Activity A → Generates artifacts → Stored as impulses → Activity B references impulses
```

### Architecture

#### 1. New Impulse Pointer Type: `activityArtifact`

```typescript
// Add to ActivityTemplate.Impulse.Pointer union
| { 
    type: "activityArtifact"
    activityId: string           // Which activity created it
    taskId?: string              // Optional: specific task output
    artifactPath: string         // Relative path: "report.md", "data/output.json"
    storageBackend?: "file" | "db" | "auto"  // Where to store (default: auto)
  }
```

**Example**:
```typescript
{
  type: "activityArtifact",
  activityId: "act_mlvpwfzu_6c504b1196e35cd2",
  taskId: "calculate-deltas-and-generate-report",
  artifactPath: "assessment-report.md",
  storageBackend: "auto"
}
```

#### 2. OS-Agnostic Temp Directory Management

```typescript
// New module: src/activity/artifact-storage.ts

export class ArtifactStorage {
  /**
   * Get OS-agnostic temp directory for activity
   * 
   * Returns:
   *   - Linux/macOS: /tmp/opencode-activities/{activityId}/
   *   - Windows: %TEMP%\opencode-activities\{activityId}\
   *   - Fallback: {repo}/.metabob/activity-artifacts/{activityId}/
   */
  static getTempDir(activityId: string): string {
    const osTempBase = os.tmpdir() // OS-agnostic
    return path.join(osTempBase, "opencode-activities", activityId)
  }

  /**
   * Store artifact content
   * 
   * Strategies:
   *   - "file": Store in OS temp directory
   *   - "db": Store in SurrealDB/Storage as blob
   *   - "auto": Small files (<1MB) → db, large files → file
   */
  static async store(
    activityId: string,
    artifactPath: string,
    content: string | Buffer,
    backend: "file" | "db" | "auto" = "auto"
  ): Promise<void>

  /**
   * Load artifact content from storage
   */
  static async load(
    activityId: string,
    artifactPath: string
  ): Promise<string>

  /**
   * Clean up activity artifacts after completion
   */
  static async cleanup(activityId: string): Promise<void>
}
```

#### 3. Enhanced Activity Variable Interpolation

**Current**:
```json
{
  "output_dir": "/tmp/activity-output"  // ❌ Hardcoded, not portable
}
```

**Enhanced**:
```json
{
  "output_dir": "{{ACTIVITY_TEMP_DIR}}"  // ✅ Interpolated at runtime
}
```

**Built-in Variables**:
- `{{ACTIVITY_TEMP_DIR}}` → OS-agnostic temp directory for this activity
- `{{ACTIVITY_ID}}` → Current activity ID
- `{{REPO_ROOT}}` → Repository root path
- `{{ARTIFACT_PATH:filename}}` → Full path to artifact file

#### 4. Impulse Resolver Enhancement

```typescript
// Add to impulse-resolver.ts

case "activityArtifact": {
  try {
    // Load artifact from storage
    const content = await ArtifactStorage.load(
      pointer.activityId,
      pointer.artifactPath
    )
    
    log.info("activity artifact loaded", {
      activityId: pointer.activityId,
      artifactPath: pointer.artifactPath,
      size: content.length
    })
    
    return content
  } catch (error) {
    log.error("failed to load activity artifact", {
      activityId: pointer.activityId,
      artifactPath: pointer.artifactPath,
      error
    })
    return `// Artifact not found: ${pointer.artifactPath}`
  }
}
```

#### 5. Automatic Artifact Capture

**Post-Task Hook**: Automatically capture artifacts after each task

```typescript
// In task execution completion

async function captureTaskArtifacts(
  activityId: string,
  taskId: string,
  outputDir: string
): Promise<ActivityTemplate.Impulse.Schema[]> {
  
  const artifacts = await fs.readdir(outputDir, { recursive: true })
  const impulses: ActivityTemplate.Impulse.Schema[] = []
  
  for (const artifactPath of artifacts) {
    const fullPath = path.join(outputDir, artifactPath)
    const content = await fs.readFile(fullPath, "utf-8")
    
    // Store artifact
    await ArtifactStorage.store(activityId, artifactPath, content, "auto")
    
    // Create impulse
    const impulse: ActivityTemplate.Impulse.Schema = {
      id: `${activityId}_artifact_${taskId}_${artifactPath.replace(/\W+/g, "_")}`,
      type: "activityArtifact",
      pointer: {
        type: "activityArtifact",
        activityId,
        taskId,
        artifactPath,
        storageBackend: "auto"
      },
      budget: Math.ceil(content.length / 4), // Token estimate
      priority: "medium",
      loaded: false,
      scope: "activity",
      activityId
    }
    
    impulses.push(impulse)
  }
  
  return impulses
}
```

#### 6. Sandbox Whitelist Enhancement

```typescript
// Update sandbox validation to allow activity temp directories

export class SandboxValidator {
  static isPathAllowed(commandPath: string, cwd: string): boolean {
    // Existing checks...
    
    // NEW: Allow activity temp directories
    const activityTempPattern = /opencode-activities\/act_[a-z0-9_]+/
    if (activityTempPattern.test(commandPath)) {
      return true
    }
    
    return false
  }
}
```

---

## Usage Examples

### Example 1: Documentation Assessment Activity (Current Use Case)

**Before** (broken):
```json
{
  "variables": {
    "output_dir": "/tmp/activity-assess-documentation-conformity"
  },
  "validation": {
    "commands": [{
      "command": "test $(grep -c 'Score' {{output_dir}}/report.md) -ge 5"
    }]
  }
}
```
❌ Sandbox violation: `/tmp/` outside repo

**After** (working):
```json
{
  "variables": {
    "output_dir": "{{ACTIVITY_TEMP_DIR}}"
  },
  "validation": {
    "commands": [{
      "command": "test $(grep -c 'Score' {{ACTIVITY_TEMP_DIR}}/report.md) -ge 5"
    }]
  }
}
```
✅ Sandbox allows activity temp dir

**Artifact Access**:
```typescript
// Activity B references Activity A's artifacts via impulse
{
  id: "assessment-report",
  type: "activityArtifact",
  pointer: {
    type: "activityArtifact",
    activityId: "act_mlvpwfzu_6c504b1196e35cd2",
    artifactPath: "assessment-report.md"
  },
  budget: 6000
}
```

### Example 2: Multi-Activity Composition

**Scenario**: Analysis → Transform → Report

```typescript
// Activity 1: Analyze codebase
const activity1 = await executeActivity({
  templateId: "analyze-codebase",
  variables: {
    target: "src/",
    output_dir: "{{ACTIVITY_TEMP_DIR}}"
  }
})

// Artifacts automatically captured:
// - analysis.json (stored as impulse)
// - metrics.csv (stored as impulse)

// Activity 2: Transform data (references Activity 1 artifacts)
const activity2 = await executeActivity({
  templateId: "transform-data",
  impulses: [
    {
      id: "input-analysis",
      type: "activityArtifact",
      pointer: {
        type: "activityArtifact",
        activityId: activity1.id,
        artifactPath: "analysis.json"
      },
      budget: 5000
    }
  ]
})

// Activity 3: Generate report (references Activity 2 artifacts)
const activity3 = await executeActivity({
  templateId: "generate-report",
  impulses: [
    {
      id: "transformed-data",
      type: "activityArtifact",
      pointer: {
        type: "activityArtifact",
        activityId: activity2.id,
        artifactPath: "transformed-output.json"
      },
      budget: 3000
    }
  ]
})
```

### Example 3: Debugging Failed Activities

```bash
# List artifacts from failed activity
opencode activity artifacts act_mlvpwfzu_6c504b1196e35cd2

# Output:
# - document-inventory.json (10.5 KB)
# - architecture-reference.json (10.2 KB)
# - conformity-scores.json (18.8 KB)
# - assessment-report.md (23.4 KB)
# - required-deltas.md (26.5 KB)

# View specific artifact
opencode activity artifact act_mlvpwfzu_6c504b1196e35cd2 assessment-report.md

# Export artifacts to local directory
opencode activity export act_mlvpwfzu_6c504b1196e35cd2 ./exported-artifacts/
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (2-3 hours)
1. ✅ Design specification (this document)
2. Add `activityArtifact` pointer type to schema
3. Implement `ArtifactStorage` class (OS-agnostic paths)
4. Add impulse resolver case for `activityArtifact`
5. Implement built-in variable interpolation (`{{ACTIVITY_TEMP_DIR}}`)

### Phase 2: Sandbox & Validation (1-2 hours)
6. Update sandbox whitelist for activity temp directories
7. Update validation command execution to allow artifact paths
8. Add pre-flight validation for artifact references

### Phase 3: Automatic Capture (2-3 hours)
9. Implement post-task artifact scanning
10. Auto-create impulses for discovered artifacts
11. Store artifacts in activity.impulses record
12. Update TUI to show artifacts

### Phase 4: CLI & Tooling (1-2 hours)
13. Add `activity artifacts` command
14. Add `activity artifact` command (view specific)
15. Add `activity export` command (download artifacts)

### Phase 5: Template Updates (1 hour)
16. Update `assess-documentation-conformity` template
17. Add artifact examples to template library
18. Document artifact patterns in QUICK_REFERENCE

---

## Benefits

### 1. **OS Portability** ✅
- Works on Linux, macOS, Windows
- No hardcoded `/tmp/` paths
- Falls back to repo directory if needed

### 2. **Sandbox Safety** ✅
- Activity temp directories whitelisted
- No arbitrary file access outside repo
- Secure by default

### 3. **Activity Composition** ✅
- Clean artifact passing between activities
- Declarative impulse references
- No manual file management

### 4. **Reproducibility** ✅
- Artifacts stored in database
- Survive temp directory cleanup
- Activity replay has access to artifacts

### 5. **Debugging** ✅
- Inspect artifacts from failed activities
- Export artifacts for analysis
- Understand what activity produced

---

## Alternative Designs Considered

### Option A: Store Everything in Database
**Pros**: No temp directories, perfect reproducibility  
**Cons**: Large artifacts bloat database, slow for GB-scale data

### Option B: Use Repo Subdirectory Only
**Pros**: Simple, no temp directory issues  
**Cons**: Pollutes repo, not suitable for large artifacts

### Option C: Hybrid (CHOSEN)
**Pros**: Small artifacts in DB, large in temp, configurable  
**Cons**: More complex, but handles all cases

---

## Open Questions

1. **Artifact Retention Policy**: How long to keep artifacts?
   - **Proposal**: Keep for 7 days, then cleanup (configurable)
   - **Rationale**: Balance reproducibility vs disk usage

2. **Size Limits**: Maximum artifact size?
   - **Proposal**: 100MB per artifact, 500MB per activity
   - **Rationale**: Prevent disk exhaustion

3. **Compression**: Should we compress artifacts?
   - **Proposal**: Auto-compress text files >100KB (gzip)
   - **Rationale**: Save storage, minimal CPU cost

4. **Cross-Session Access**: Can Activity B in Session 2 access artifacts from Activity A in Session 1?
   - **Proposal**: Yes, artifacts are activity-scoped (not session-scoped)
   - **Rationale**: Enable true activity composition across time

---

## Success Criteria

### Must Have (MVP)
- ✅ `activityArtifact` pointer type implemented
- ✅ OS-agnostic temp directory support
- ✅ Sandbox whitelist for activity directories
- ✅ Variable interpolation (`{{ACTIVITY_TEMP_DIR}}`)
- ✅ Impulse resolver loads artifacts
- ✅ `assess-documentation-conformity` template works

### Should Have (V1)
- ✅ Automatic artifact capture
- ✅ CLI commands for artifact inspection
- ✅ Storage backend selection (file/db/auto)
- ✅ Artifact cleanup policy

### Nice to Have (V2)
- ⏸ Artifact versioning (track changes over time)
- ⏸ Artifact compression (save storage)
- ⏸ Artifact streaming (handle GB-scale files)
- ⏸ Artifact signing (verify integrity)

---

## Related Systems

### Impulse System
- Artifacts are impulses with lazy loading
- Follow impulse budget/priority model
- Integrate with impulse serialization (ACP)

### Activity System
- Artifacts stored in `Activity.impulses` record
- Cleanup on activity deletion
- Replay loads artifacts from storage

### Storage System
- Use existing `Storage.write()` / `Storage.read()`
- Schema: `["activity-artifact", activityId, artifactPath]`
- Leverage SurrealDB for large artifacts

### Sandbox System
- Whitelist activity temp directories
- Validate artifact paths at execution time
- Prevent directory traversal attacks

---

## Migration Path

### Existing Activities
**No Breaking Changes**: Existing activities continue to work

### Opt-In Enhancement
Templates can add artifacts incrementally:
```json
{
  "variables": {
    "output_dir": "{{ACTIVITY_TEMP_DIR}}"  // Opt-in
  }
}
```

### Gradual Rollout
1. Phase 1: Infrastructure only (no template changes)
2. Phase 2: Update failing templates (like `assess-documentation-conformity`)
3. Phase 3: Encourage new templates to use artifacts
4. Phase 4: Deprecate absolute paths in validation commands

---

## Conclusion

**Activity artifacts as impulses** solves the sandbox violation issue while providing:
- OS portability
- Activity composition
- Reproducibility
- Debugging support

This design builds on existing impulse infrastructure, requires minimal changes, and unlocks powerful activity orchestration patterns.

**Next Steps**:
1. Review and approve design
2. Implement Phase 1 (core infrastructure)
3. Fix `assess-documentation-conformity` template
4. Roll out to other artifact-generating activities
