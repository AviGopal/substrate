# Metabob Configuration Simplification

## Final Result: Minimal Essential Configuration

### Before (25+ fields)
```json
{
  "metabob": {
    "enabled": true,
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080",
    "api_key": "",
    "auto_inject": true,
    "inject_annotations": true,
    "auto_impact_analysis": true,
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "cache_timeout": 300,
    "context_budget_tokens": 10000,
    "subagent_token_budget": 5000,
    "template_registration": {
      "enabled": true,
      "behavior": "best-effort",
      "strategy": "on-create"
    },
    "template_auto_registration": {
      "enabled": true,
      "behavior": "best-effort",
      "strategy": "on-create"
    },
    "activity_learning": {
      "enabled": true,
      "record_outcomes": true,
      "track_decisions": true,
      "track_impulses": true,
      "auto_recommend": true,
      "recommendation_threshold": 0.7,
      "min_executions_for_learning": 1
    }
  }
}
```

### After (3 required fields + 2 legacy + optional tuning)
```json
{
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080",
    "api_key": ""
  }
}
```

## What Was Removed

### Core Features (Always Enabled)
- `enabled` - Metabob integration is always enabled when configured
- `auto_inject` - Auto-injection is always enabled (core feature)
- `inject_annotations` - Annotation injection is always enabled
- `auto_impact_analysis` - Impact analysis is always enabled

### Template Management (Handled by Backend)
- `template_registration` - Now handled by `create-activity-template` workflow
- `template_auto_registration` - Duplicate, removed entirely
- `activity_learning` - Managed by metabob-rpc-api backend

### File Watching (metabob-cli)
- `watch_files` - Always `True` in production (tests override via constructor)

## What Remains

### Required Configuration
1. **`cli_path`** - Path to metabob-cli binary
2. **`api_key`** - Backend authentication (or METABOB_API_KEY env var)
3. **`base_url`** - Backend API endpoint

### Legacy (Backward Compatibility)
4. **`include_paths`** - File patterns to analyze (auto-detected if not specified)
5. **`exclude_paths`** - File patterns to ignore (uses defaults if not specified)

### Optional Tuning (Sensible Defaults)
- `max_issues` (default: 5)
- `min_severity` (default: "MEDIUM")
- `cache_timeout` (default: 300)
- `context_budget_tokens` (default: 10000)
- `subagent_token_budget` (default: 5000)
- `state_directory` (default: ".metabob")

## Architecture Changes

### Template Registration
**Before:** Configured via `template_registration.behavior`
**After:** Always best-effort, handled by `create-activity-template` template workflow

### Activity Learning
**Before:** Configured via `activity_learning` object with multiple fields
**After:** Managed entirely by metabob-rpc-api backend

### Agent Behavior
**Before:** Mix of global config and agent overrides
**After:** Agent-level overrides still work (`inject_annotations`, `auto_impact_analysis`), but global config is simplified

## Benefits

1. **Clarity**: Only 3 required fields (cli_path, api_key, base_url)
2. **No False Choices**: Can't accidentally disable core features
3. **Backend Control**: Activity learning and template management handled centrally
4. **Simpler Code**: Removed 15+ conditional branches
5. **Better Defaults**: Everything auto-configured for the common case

## Migration Guide

### If you had:
```json
{
  "metabob": {
    "enabled": true,
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080",
    "auto_inject": true,
    "template_registration": { "behavior": "best-effort" },
    "activity_learning": { "recommendation_threshold": 0.7 }
  }
}
```

### Change to:
```json
{
  "metabob": {
    "cli_path": "metabob-cli",
    "base_url": "http://localhost:8080",
    "api_key": ""
  }
}
```

All other features are automatically enabled.

## Test Results

✅ All metabob-opencode tests passing (13/13)
✅ All metabob-cli config tests passing (14/14)
✅ Agent-level overrides still functional
✅ Template registration working (best-effort)

## Files Modified

### metabob-opencode
- `src/config/schemas/metabob.ts` - Simplified schema to 3 required + legacy + optional
- `src/config/config.ts` - Removed template_registration and activity_learning
- `src/session/system.ts` - Removed conditional checks for always-true fields
- `src/session/activity-template.ts` - Simplified registration to always best-effort
- All `opencode.json` files - Minimal configuration

### metabob-cli
- `src/metabob_cli/core/config.py` - Documented `watch_files` always True in production
