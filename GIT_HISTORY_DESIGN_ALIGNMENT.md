# Using Git History to Align with Design Intent

## Quick Reference

### 1. Find When a Feature Was Added
```bash
cd repos/metabob-proto
git log --all --oneline -- proto/metabob/activity/variant.proto
```

### 2. Find Design Documentation
```bash
git log --all --oneline | grep -i "docs:\|design\|architecture"
```

### 3. See What Changed
```bash
git show <commit-hash> --stat
git show <commit-hash> proto/metabob/activity/variant.proto
```

### 4. Find Related Commits
```bash
git log --all --oneline --grep="activity\|template\|variant"
```

### 5. Understand Refactoring Decisions
```bash
# Example: Why was subagent field removed?
git show ab17e3a

# Result: "deprecated - agent behavior now from agentImpulses, not named subagents"
```

## Key Findings from metabob-proto History

### Commit ab17e3a (Feb 5, 2026)
**"refactor: remove deprecated subagent fields"**

**Learning**: 
- `subagent` field in tasks is deprecated
- Agent selection now via `agentImpulses` or defaults
- Don't use named subagent strings in new templates

### Commit 373f278 (Feb 6, 2026)
**"docs: Complete architecture understanding"**

**Learning**:
- NO standalone mode for templates
- ALL operations require MCP + backend
- Flow: Tool → Repository → Loader → MCP → CLI → Backend
- localhost:8080 backend is required

## Protocol as Source of Truth

The **proto files are the canonical schema**:
- `variant.proto` → ActivityVariant message
- `common/types.proto` → Genealogy, EntityStatus, EvolutionType

**Any implementation that deviates is incorrect.**

## Design Intent from Proto Comments

From `variant.proto`:

**TaskStep (Line 18-22)**:
```
// This schema is the canonical task definition used by both the backend
// (storage/serving) and OpenCode (execution).
```

**Intent**: Single schema for all systems. No custom formats.

**ActivityVariant (Line 177-180)**:
```
// SurrealDB Table: activity_variants
// Indexes: variant_id (unique), activity_id, content_hash, status
```

**Intent**: Database schema matches proto exactly.

**VariantPerformanceMetrics (Line 247-253)**:
```
// Thompson Sampling optimization
// SurrealDB Table: variant_performance_metrics
// Indexes: variant_id (unique)
```

**Intent**: Thompson Sampling (MAB) for automatic variant selection.

## Alignment Checklist

When implementing activities:

✅ Does database schema match proto?
✅ Are task_steps arrays populated (not empty)?
✅ Is genealogy tracked?
✅ Are variants content-addressed?
✅ Is Thompson Sampling used for selection?
✅ Do agents see activity_id (not variant_id)?
✅ Is status lifecycle followed (DRAFT → TESTING → ACTIVE)?

If ANY is "no", implementation deviates from design.

