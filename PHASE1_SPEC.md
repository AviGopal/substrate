# Phase 1: Automatic Annotation Capture

## Goal
Add post-activity hook to automatically generate annotations for changed components, even if agent forgets to call `metabob_annotate_component`.

## Files to Modify

### 1. `repos/metabob-opencode/packages/opencode/src/tool/activity.ts`

**Location**: After activity completes (around line 660-700 where `activity.status = "done"`)

**Add**:
```typescript
// ✅ NEW: Automatic annotation capture (post-activity hook)
if (result.success && config.automaticAnnotations) {
  await captureAnnotationsAutomatically(activity)
}
```

**New Function** (add at bottom of file):
```typescript
async function captureAnnotationsAutomatically(activity: Activity.Info) {
  const log = Log.create({ service: "auto-annotations" })
  
  try {
    log.info("capturing annotations automatically", { activityId: activity.id })
    
    const components = await ActivityComplete.identifyKeyComponents(activity)
    
    if (components.length === 0) {
      log.debug("no key components to annotate")
      return
    }
    
    log.info("identified components for annotation", { count: components.length })
    
    await ActivityComplete.generateAnnotations(activity, components, {
      interactive: false,
      skipAnnotations: false,
      skipPatterns: false
    })
    
    log.info("annotations captured automatically", { count: components.length })
  } catch (error) {
    log.error("failed to capture annotations automatically", { 
      activityId: activity.id,
      error: error instanceof Error ? error.message : String(error)
    })
    // Non-fatal: don't throw, just log
  }
}
```

### 2. `repos/metabob-opencode/packages/opencode/src/config/config.ts`

**Add configuration option**:
```typescript
export const Config = z.object({
  // ... existing fields
  
  activities: z.object({
    automaticAnnotations: z.boolean().default(true),
    annotationStrategy: z.enum(["post-activity", "per-task", "hybrid"]).default("post-activity"),
    maxAnnotationsPerActivity: z.number().default(5),
    annotationMinConfidence: z.number().default(0.7)
  }).optional()
})
```

### 3. Import ActivityComplete

**At top of activity.ts**:
```typescript
import { ActivityComplete } from "../session/activity-complete"
```

## Implementation Steps

1. Read current activity.ts to find exact location for hook
2. Add import for ActivityComplete
3. Add configuration reading for `automaticAnnotations`
4. Add `captureAnnotationsAutomatically()` function
5. Call it after successful activity execution
6. Test with a simple activity that changes files

## Success Criteria

- Activity completes successfully
- Changed files detected via git diff
- Components extracted from changed files
- Annotations generated and stored in Metabob
- No errors thrown (non-fatal if annotation fails)
- Logged: "annotations captured automatically"

## Configuration

Add to `opencode.json`:
```jsonc
{
  "activities": {
    "automaticAnnotations": true
  }
}
```
