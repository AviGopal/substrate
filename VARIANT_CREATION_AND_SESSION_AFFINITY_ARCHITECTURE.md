# Variant Creation and Session Affinity Architecture

## Executive Summary

This document explains:
1. **What happens when metabob-rpc-api receives duplicate activity IDs** (auto-variant creation)
2. **Why this is the essence of variant creation** (content-addressable variants)
3. **How to ensure session-local variant affinity** (session gets its own created variant)

## Current State: Metabob RPC API Duplicate Registration Behavior

### What Happens with Duplicate IDs

When `POST /v2/activities/templates` receives a template with the **same name but different content**:

```python
# server/actions/activity.py:create_template()

def create_template(redis: StrictRedis, template_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Logic:
    1. Generate template_id from name (e.g., 'Add Feature' → 'add-feature')
    2. Generate content_hash from task_steps + description
    3. Generate variant_id = template_id + content_hash
    4. Check if variant_id exists:
       - If exists: return existing (idempotent) ✅
       - If new: create variant ✅
    5. Check if template_id has other variants:
       - If yes: set generation = max(existing) + 1, link parent
       - If no: set generation = 0 (first variant)
    """
    
    # Example: Same name, different content
    name = "add-feature-complete"  # SAME
    template_id = "add-feature-complete"  # SAME
    
    # Different content → different hash
    content_hash_v1 = "a1b2c3d4"  # First version
    content_hash_v2 = "e5f6g7h8"  # Modified version
    
    variant_id_v1 = "add-feature-complete-a1b2c3d4"  # First variant
    variant_id_v2 = "add-feature-complete-e5f6g7h8"  # Second variant (auto-created!)
```

### Key Properties

**✅ Idempotent**: Same content → returns existing variant
**✅ Auto-variant**: Different content → creates new variant automatically
**✅ Genealogy**: Tracks parent_hash and generation
**✅ Content-addressable**: Variant ID includes content hash

## Why This Is The Essence of Variant Creation

### Traditional Approach (Manual)
```typescript
// Manual variant creation (old way)
1. Agent says: "I want to create a variant of add-feature-complete"
2. Call: POST /templates/{parent_id}/variants
3. Provide: changes object
4. System: Creates variant explicitly

Problems:
❌ Agent must explicitly request variant
❌ Requires understanding of variant API
❌ Extra API call
❌ Risk of creating unnecessary variants
```

### Content-Addressable Approach (Automatic)
```typescript
// Automatic variant creation (current way)
1. Agent says: "Register this improved template: add-feature-complete"
2. Call: POST /templates
3. Provide: template with same name, different content
4. System: Detects content difference, auto-creates variant

Benefits:
✅ Natural workflow - just register improved template
✅ Idempotent - same content doesn't create duplicate
✅ Content-addressable - variants are deterministic
✅ No explicit variant API knowledge needed
✅ Genealogy tracking automatic
```

### Content-Addressable Variants = Git-like Immutability

```
Similar to Git:
- Same content = same hash (idempotent)
- Different content = different hash (new variant)
- Parent relationships tracked
- Immutable - can't change variant once created

Benefits:
✅ Reproducibility: Same content → same variant_id
✅ Deduplication: Automatic across all sessions
✅ Traceability: Clear genealogy from parent to child
✅ Safety: Can't accidentally modify existing variant
```

## The Problem: Session Affinity for Newly Created Variants

### Current Behavior (Undesirable)

```typescript
// Session A creates improved variant
Session A:
  1. Executes activity → fails with task error
  2. Trailblazing creates improved variant: "add-feature-complete-NEW_HASH"
  3. Registers variant with POST /templates
  4. Variant created: generation=1

Session A (next execution):
  5. Executes same activity again
  6. Template selection happens:
     - List variants: [gen0, gen1] ← Both available!
     - Thompson Sampling: Random selection based on alpha/beta
     - Result: Might select gen0 (original failing variant) ❌
  7. Session A hits SAME ERROR it just fixed!

Problem: Session that created variant doesn't preferentially use it!
```

### What SHOULD Happen (Session Affinity)

```typescript
// Session A creates improved variant and gets affinity
Session A:
  1. Executes activity → fails with task error
  2. Trailblazing creates improved variant: "add-feature-complete-NEW_HASH"
  3. Registers variant with POST /templates
  4. System records: "Session A prefers variant NEW_HASH"
  5. Session A continues execution with NEW VARIANT immediately

Session A (next execution):
  6. Executes same activity again
  7. Template selection checks session affinity:
     - Session A has affinity for variant NEW_HASH
     - Override Thompson Sampling → use affinity variant
     - Result: Always uses NEW_HASH ✅
  8. Session A uses improved variant, avoids error

Session B (unrelated session):
  9. Executes same activity
  10. No affinity → normal Thompson Sampling
  11. Gradually discovers gen1 is better through learning

Result: Session that created variant uses it immediately,
       Other sessions discover it gradually through Thompson Sampling
```

## Proposed Solution: Session-Variant Affinity Table

### Architecture

#### 1. Storage Schema (Redis)

```python
# Key: session:variant:affinity:{session_id}
# Value: JSON map of template_id → preferred_variant_id

{
  "add-feature-complete": "add-feature-complete-e5f6g7h8",
  "fix-bug-complete": "fix-bug-complete-abc123",
  ...
}

# Example Redis operations:
redis.hset(f"session:variant:affinity:{session_id}", 
           template_id, 
           variant_id)

redis.hget(f"session:variant:affinity:{session_id}", 
           template_id)
```

#### 2. Metabob RPC API Changes

```python
# server/actions/activity.py

def record_session_variant_affinity(
    redis: StrictRedis,
    session_id: str,
    template_id: str,
    variant_id: str,
    ttl_seconds: int = 86400 * 7  # 7 days
) -> None:
    """
    Record that a session prefers a specific variant.
    
    Called when:
    - Session creates new variant via trailblazing
    - Session explicitly derives variant
    - Session is created with variant parameter
    
    TTL: 7 days (adjustable)
    """
    key = f"session:variant:affinity:{session_id}"
    redis.hset(key, template_id, variant_id)
    redis.expire(key, ttl_seconds)
    
    logger.info(f"Session {session_id} affinity: {template_id} → {variant_id}")


def get_session_variant_affinity(
    redis: StrictRedis,
    session_id: str,
    template_id: str
) -> Optional[str]:
    """
    Get session's preferred variant for a template.
    
    Returns:
    - variant_id if affinity exists
    - None if no affinity
    """
    key = f"session:variant:affinity:{session_id}"
    variant_id = redis.hget(key, template_id)
    
    if variant_id:
        return variant_id.decode() if isinstance(variant_id, bytes) else variant_id
    
    return None


def select_variant_for_session(
    redis: StrictRedis,
    session_id: str,
    template_id: str
) -> str:
    """
    Select variant for session, considering affinity.
    
    Algorithm:
    1. Check session affinity first
    2. If affinity exists → return affinity variant
    3. If no affinity → Thompson Sampling
    
    This ensures:
    - Session that created variant uses it immediately
    - Other sessions discover it through learning
    """
    # Check affinity first
    affinity_variant = get_session_variant_affinity(redis, session_id, template_id)
    if affinity_variant:
        logger.info(f"Using affinity variant: {affinity_variant} for session {session_id}")
        return affinity_variant
    
    # No affinity → Thompson Sampling
    template_pattern = f"activity:template:{template_id}-*"
    variant_keys = redis.keys(template_pattern)
    
    if not variant_keys:
        raise ValueError(f"No variants found for template: {template_id}")
    
    # Load all variants and their metrics
    variants = []
    for key in variant_keys:
        variant_id = key.decode().replace("activity:template:", "")
        metrics_json = redis.get(f"activity:metrics:{variant_id}")
        
        if metrics_json:
            metrics = json.loads(metrics_json)
            alpha = metrics.get("thompson_alpha", 1.0)
            beta = metrics.get("thompson_beta", 1.0)
            
            # Sample from Beta distribution
            sample = sample_beta(alpha, beta)
            variants.append((variant_id, sample))
    
    # Select variant with highest sampled value
    selected = max(variants, key=lambda x: x[1])
    logger.info(f"Thompson Sampling selected: {selected[0]} (sample={selected[1]:.3f})")
    
    return selected[0]
```

#### 3. New API Endpoint

```python
# server/routes/activity.py

@router.post("/sessions/{session_id}/variant-affinity", status_code=201)
async def set_session_variant_affinity(
    session_id: str,
    affinity_data: Dict[str, Any],
    redis: StrictRedis = Depends(get_redis_connection),
) -> Dict[str, Any]:
    """
    Set session's preferred variant for a template.
    
    Called by OpenCode when:
    - Trailblazing creates variant
    - Activity creates variant during execution
    - User explicitly derives variant
    
    Request Body:
    {
      "template_id": "add-feature-complete",
      "variant_id": "add-feature-complete-e5f6g7h8",
      "reason": "Created by trailblazing in session_abc123",
      "ttl_days": 7  # Optional, default 7
    }
    
    Returns:
    {
      "session_id": "session_abc123",
      "template_id": "add-feature-complete",
      "variant_id": "add-feature-complete-e5f6g7h8",
      "expires_at": "2026-02-27T12:00:00Z"
    }
    """
    template_id = affinity_data["template_id"]
    variant_id = affinity_data["variant_id"]
    ttl_days = affinity_data.get("ttl_days", 7)
    
    record_session_variant_affinity(
        redis, 
        session_id, 
        template_id, 
        variant_id,
        ttl_seconds=ttl_days * 86400
    )
    
    return {
        "session_id": session_id,
        "template_id": template_id,
        "variant_id": variant_id,
        "expires_at": (datetime.utcnow() + timedelta(days=ttl_days)).isoformat()
    }


@router.get("/sessions/{session_id}/variant-affinity")
async def get_session_affinities(
    session_id: str,
    redis: StrictRedis = Depends(get_redis_connection),
) -> Dict[str, Any]:
    """
    Get all variant affinities for a session.
    
    Returns:
    {
      "session_id": "session_abc123",
      "affinities": {
        "add-feature-complete": "add-feature-complete-e5f6g7h8",
        "fix-bug-complete": "fix-bug-complete-abc123"
      }
    }
    """
    key = f"session:variant:affinity:{session_id}"
    affinities_raw = redis.hgetall(key)
    
    affinities = {
        k.decode() if isinstance(k, bytes) else k: 
        v.decode() if isinstance(v, bytes) else v
        for k, v in affinities_raw.items()
    }
    
    return {
        "session_id": session_id,
        "affinities": affinities
    }
```

#### 4. Integration with Template Selection

```python
# Modify list_templates() to accept optional session_id
def list_templates(
    redis: StrictRedis,
    category: Optional[str] = None,
    limit: int = 50,
    session_id: Optional[str] = None  # NEW
) -> List[Dict[str, Any]]:
    """
    If session_id provided, mark affinity variants with metadata.
    """
    templates = []
    
    # Load session affinities if provided
    affinities = {}
    if session_id:
        key = f"session:variant:affinity:{session_id}"
        affinities_raw = redis.hgetall(key)
        affinities = {
            k.decode() if isinstance(k, bytes) else k: 
            v.decode() if isinstance(v, bytes) else v
            for k, v in affinities_raw.items()
        }
    
    # ... existing template loading logic ...
    
    for template in templates:
        # Mark if this variant is session's affinity
        template_id = template["activity_id"]
        variant_id = template["variant_id"]
        
        if session_id and affinities.get(template_id) == variant_id:
            template["session_affinity"] = True
            template["affinity_session"] = session_id
    
    return templates
```

### 5. OpenCode Client Changes

#### A. Util: Metabob Client Extension

```typescript
// repos/metabob-opencode/packages/opencode/src/util/metabob.ts

export namespace Metabob {
  /**
   * Set session's preferred variant after creation
   */
  export async function setSessionVariantAffinity(params: {
    sessionId: string
    templateId: string
    variantId: string
    reason: string
    ttlDays?: number
  }): Promise<void> {
    const { sessionId, templateId, variantId, reason, ttlDays } = params
    
    log.info("setting session variant affinity", {
      sessionId,
      templateId,
      variantId,
      reason,
    })
    
    try {
      await client.post(
        `/v2/activities/sessions/${sessionId}/variant-affinity`,
        {
          template_id: templateId,
          variant_id: variantId,
          reason,
          ttl_days: ttlDays || 7,
        }
      )
      
      log.info("session variant affinity set successfully", {
        sessionId,
        templateId,
        variantId,
      })
    } catch (error) {
      log.error("failed to set session variant affinity", {
        sessionId,
        templateId,
        variantId,
        error,
      })
      // Don't throw - affinity is a nice-to-have, not critical
    }
  }
  
  /**
   * Get session's variant affinities
   */
  export async function getSessionVariantAffinities(
    sessionId: string
  ): Promise<Record<string, string>> {
    try {
      const response = await client.get(
        `/v2/activities/sessions/${sessionId}/variant-affinity`
      )
      return response.data.affinities || {}
    } catch (error) {
      log.warn("failed to get session variant affinities", { sessionId, error })
      return {}
    }
  }
  
  /**
   * Search templates with session affinity awareness
   */
  export async function searchTemplatesWithAffinity(params: {
    sessionId: string
    category?: string
    limit?: number
  }): Promise<ActivityVariant[]> {
    const { sessionId, category, limit } = params
    
    const response = await client.get("/v2/activities/templates", {
      params: {
        category,
        limit: limit || 50,
        session_id: sessionId,  // NEW: Pass session ID
      },
    })
    
    const templates = response.data.templates || []
    
    // Log affinity variants
    const affinityVariants = templates.filter((t: any) => t.session_affinity)
    if (affinityVariants.length > 0) {
      log.info("session has variant affinities", {
        sessionId,
        affinityCount: affinityVariants.length,
        variants: affinityVariants.map((v: any) => v.variant_id),
      })
    }
    
    return templates
  }
}
```

#### B. Trailblazing Executor Integration

```typescript
// repos/metabob-opencode/packages/opencode/src/session/trailblazing-executor.ts

export namespace TrailblazingExecutor {
  export async function createTemplateVariant(
    baseTemplate: ActivityTemplate.Schema,
    taskId: string,
    recoveryAttempts: RecoveryAttempt[],
    activityId?: string,
    sessionId?: string,  // NEW: Track which session created variant
  ): Promise<ActivityTemplate.Schema> {
    // ... existing variant creation logic ...
    
    const variant = await ActivityTemplate.evolve(baseTemplate, {
      reason: EvolutionReason.TRAILBLAZING,
      notes: `Learned from ${recoveryAttempts.length} recovery attempts in task ${taskId}`,
      improvised: true,
      metadata: {
        // ... existing metadata ...
      },
    })
    
    // Register variant with metabob-rpc-api
    await TemplateRepository.save(variant, ["metabob"])
    
    // NEW: Set session affinity if sessionId provided
    if (sessionId && activityId) {
      await Metabob.setSessionVariantAffinity({
        sessionId: sessionId,
        templateId: baseTemplate.id,
        variantId: variant.id,
        reason: `Created by trailblazing in session ${sessionId}`,
        ttlDays: 7,
      })
      
      log.info("set session affinity for trailblazed variant", {
        sessionId,
        templateId: baseTemplate.id,
        variantId: variant.id,
      })
    }
    
    return variant
  }
}
```

#### C. Activity Tool Integration

```typescript
// repos/metabob-opencode/packages/opencode/src/tool/activity.ts

// In executeActivity function, after variant creation:

if (trailblazingEnabled && options?.trailblazingOptions) {
  // ... existing trailblazing logic ...
  
  try {
    const variant = await TrailblazingExecutor.createTemplateVariant(
      template,
      taskId,
      recoveryAttempts,
      activity.id,
      activity.negotiationSessionId,  // NEW: Pass session ID
    )
    
    log.info("created trailblazed template variant with session affinity", {
      templateId: template.id,
      variantId: variant.id,
      sessionId: activity.negotiationSessionId,
    })
    
    // Continue execution with new variant immediately
    // (Affinity ensures this session uses new variant)
    
  } catch (variantError) {
    log.warn("failed to create template variant", { error: variantError })
  }
}
```

#### D. Template Selector Integration

```typescript
// repos/metabob-opencode/packages/opencode/src/session/template-selector.ts

export async function select(
  templateId: string,
  backend?: TemplateRepository.Backend,
  sessionId?: string,  // NEW: Session ID for affinity check
): Promise<SelectionResult> {
  log.debug("select ENTRY", { templateId, backend, sessionId })
  
  // NEW: Check session affinity first
  if (sessionId) {
    try {
      const affinities = await Metabob.getSessionVariantAffinities(sessionId)
      const affinityVariantId = affinities[templateId]
      
      if (affinityVariantId) {
        log.info("using session affinity variant", {
          sessionId,
          templateId,
          affinityVariantId,
        })
        
        // Load affinity variant
        const affinityTemplate = await TemplateRepository.get(affinityVariantId, backend)
        if (affinityTemplate) {
          recordSelection({
            requestedId: templateId,
            selectedId: affinityVariantId,
            variant: "candidate",
            fallback: false,
            timestamp: Date.now(),
          })
          
          return {
            template: affinityTemplate,
            selectedId: affinityVariantId,
            variant: "candidate",
            fallback: false,
          }
        } else {
          log.warn("affinity variant not found, falling back to normal selection", {
            sessionId,
            templateId,
            affinityVariantId,
          })
        }
      }
    } catch (error) {
      log.warn("failed to check session affinity, falling back to normal selection", {
        sessionId,
        templateId,
        error,
      })
    }
  }
  
  // ... existing selection logic (Thompson Sampling) ...
}
```

## Usage Examples

### Example 1: Trailblazing Creates Variant

```typescript
// Session executing activity with trailblazing
const sessionId = "session_abc123"

// Activity execution hits error on task-2
// Trailblazing generates recovery prompt
// Task succeeds with recovery

// System creates variant automatically:
const variant = await TrailblazingExecutor.createTemplateVariant(
  baseTemplate,
  "task-2",
  recoveryAttempts,
  activityId,
  sessionId  // ← Session ID tracked
)

// System sets affinity:
await Metabob.setSessionVariantAffinity({
  sessionId: sessionId,
  templateId: "add-feature-complete",
  variantId: variant.id,
  reason: "Created by trailblazing in session_abc123",
})

// Next execution in same session:
const selectedVariant = await TemplateSelector.select(
  "add-feature-complete",
  "all",
  sessionId  // ← Session ID passed
)
// Result: selectedVariant.id === variant.id (affinity variant!)
```

### Example 2: Manual Variant Derivation

```typescript
// Agent explicitly derives variant
const sessionId = "session_xyz789"

// Create improved variant
const improvedTemplate = {
  name: "add-feature-complete",
  description: "Improved with better error handling",
  task_steps: [...],  // Modified tasks
}

// Register with RPC API (auto-creates variant)
const response = await Metabob.registerTemplate(improvedTemplate)
const variantId = response.variant_id

// Set affinity manually
await Metabob.setSessionVariantAffinity({
  sessionId: sessionId,
  templateId: "add-feature-complete",
  variantId: variantId,
  reason: "Manually improved by agent in session_xyz789",
})

// Future executions in this session use improved variant
```

### Example 3: Cross-Session Behavior

```typescript
// Session A creates variant
Session A:
  - Trailblazing creates: add-feature-complete-v2
  - Affinity set: Session A → v2
  - Executions: Always use v2 ✅

// Session B (no affinity)
Session B:
  - First execution: Thompson Sampling → might get v1 or v2
  - v2 succeeds → alpha increases
  - Second execution: Thompson Sampling → higher chance of v2
  - Eventually: v2 dominates because it's better

// Session C (also no affinity)
Session C:
  - Independent Thompson Sampling
  - Gradually learns v2 is better
  - Contributes to v2's metrics

Result:
- Session A: Immediate benefit from its improved variant
- Sessions B & C: Gradual discovery through Thompson Sampling
- System: Learns which variant is globally better over time
```

## Benefits

### 1. Session-Local Improvement Retention
✅ Session that creates variant uses it immediately
✅ No regression to old failing variant
✅ Trailblazing pays off instantly

### 2. Global Learning Preserved
✅ Other sessions still use Thompson Sampling
✅ System learns which variant is globally better
✅ Bad variants get naturally filtered out

### 3. Natural Workflow
✅ No explicit variant API calls needed
✅ Just register improved template (auto-variants)
✅ Affinity recorded automatically

### 4. Safety & Isolation
✅ Session affinity expires (7 days default)
✅ Doesn't affect other sessions
✅ Can override affinity if needed

### 5. Debuggability
✅ Can query session affinities
✅ Clear audit trail of variant creation
✅ Metrics track affinity vs Thompson Sampling

## Migration Path

### Phase 1: Add Affinity Storage (Backend)
- Add Redis schema for affinity tracking
- Add API endpoints: POST/GET session affinity
- No breaking changes

### Phase 2: Add Affinity in Variant Creation (OpenCode)
- Update TrailblazingExecutor to record affinity
- Update activity tool to pass sessionId
- Backward compatible (affinity is optional)

### Phase 3: Add Affinity in Template Selection (OpenCode)
- Update TemplateSelector to check affinity first
- Update activity tool to pass sessionId to selector
- Backward compatible (falls back to Thompson Sampling)

### Phase 4: Testing & Validation
- Test trailblazing workflow end-to-end
- Test cross-session isolation
- Test affinity expiration
- Test Thompson Sampling still works

### Phase 5: Monitoring & Tuning
- Add metrics for affinity hit rate
- Monitor variant selection distribution
- Tune TTL based on usage patterns
- Consider per-template affinity weights

## Open Questions

1. **Affinity TTL**: 7 days? Per-session? Per-template?
2. **Affinity Override**: Should agent be able to explicitly ignore affinity?
3. **Multi-Session Activities**: What if activity spans multiple sessions?
4. **Affinity Inheritance**: Should child sessions inherit parent affinity?
5. **Affinity Metrics**: How to track affinity effectiveness?

## Conclusion

**Current State**:
- ✅ Auto-variant creation works (content-addressable)
- ✅ Thompson Sampling works
- ❌ Session affinity missing (session doesn't prefer its own variant)

**Proposed Solution**:
- ✅ Add session-variant affinity table (Redis hash)
- ✅ Record affinity when variant created
- ✅ Check affinity before Thompson Sampling
- ✅ TTL-based expiration (7 days)
- ✅ Backward compatible (affinity optional)

**Result**:
- Session that creates variant uses it immediately
- Other sessions discover it gradually through Thompson Sampling
- System learns globally which variants are best
- Natural workflow - just register improved templates

**Next Steps**:
1. Implement affinity storage in metabob-rpc-api
2. Add affinity endpoints to API
3. Integrate affinity in TrailblazingExecutor
4. Integrate affinity in TemplateSelector
5. Test end-to-end workflow
6. Monitor and tune
