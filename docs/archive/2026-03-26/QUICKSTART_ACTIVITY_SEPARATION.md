# Quick Start: Activity & Impulse Management Separation

**Status:** ✅ Implemented and Validated  
**Last Updated:** 2026-03-04

## TL;DR

Activity templates are now managed centrally via metabob-rpc-api. No more local JSON files. Everything flows through MCP.

```
metabob-opencode → metabob-cli (MCP) → metabob-rpc-api → SurrealDB
```

## Quick Validation

```bash
# Run validation suite
./scripts/validate-activity-impulse-separation.sh

# Expected: 10/10 tests passing ✅
```

## Key Points

### ✅ What Changed

1. **MCP Auto-Configuration**
   - Set `auto_inject: true` in metabob config
   - MCP server auto-starts with correct env vars

2. **No Local Templates**
   - Removed 197 legacy `.json` files from `.metabob/activities/`
   - Code enforces "no local writes" (line 803-813)
   - All templates via RPC API only

3. **Environment Variables**
   - `METABOB_API_URL=http://api.metabob.local`
   - Passed to metabob-cli MCP automatically

### 🎯 How to Use

#### Register a Template

```bash
cd repos/metabob-opencode
opencode

# In OpenCode session:
> # Template is auto-registered via MCP when saved
> # MetabobCLI.registerActivityTemplate() → MCP → RPC API
```

#### Search Templates

```bash
# In OpenCode session:
> search_activities({ category: "feature" })
# Returns templates from RPC API backend
```

#### Execute Activity

```bash
# In OpenCode session:
> activity({
    templateId: "add-feature-complete",
    variables: { featureName: "my-feature", files: ["src/foo.ts"] },
    reason: "Add new feature per user request"
  })
```

### 🔍 Verify Connectivity

```bash
# Test RPC API
curl http://api.metabob.local/
# Expected: {"status":"ok","timestamp":"...","version":"0.16.4"}

# Test with auth
curl -H "Authorization: Bearer mb_devbob_test_simple_2026_v2" \
  http://api.metabob.local/v2/activities/templates
# Expected: {"templates":[...]}

# Check MCP server running
ps aux | grep metabob-cli
# Expected: metabob-cli mcp --transport stdio
```

### 🚨 Troubleshooting

**Problem:** MCP not connecting  
**Solution:** Check `auto_inject: true` in `.opencode/opencode.json`

**Problem:** Templates not found  
**Solution:** Verify `http://api.metabob.local` is accessible

**Problem:** Authentication errors  
**Solution:** Check `METABOB_API_URL` env var is set

**Problem:** Local template files reappearing  
**Solution:** Check code enforcement comments (line 803-813) are present

### 📚 Documentation

- **Architecture:** `ARCHITECTURE_ACTIVITY_IMPULSE_SEPARATION.md`
- **Implementation:** `IMPLEMENTATION_SUMMARY_ACTIVITY_SEPARATION.md`
- **Validation:** `scripts/validate-activity-impulse-separation.sh`

### 🎯 Next Steps

#### Phase 2: Execution Tracking (In Progress)
- [ ] Capture `impulses_loaded` at activity start
- [ ] Track `impulses_created` during execution
- [ ] Record `tool_calls` (LLM interactions)
- [ ] Store execution metadata in RPC API

#### Phase 3: Idempotency Learning (Planned)
- [ ] Analyze execution patterns
- [ ] Identify deterministic transformations
- [ ] Cache execution paths
- [ ] Reduce LLM usage by 90%

### 🔗 Quick Links

```bash
# Architecture doc
cat ARCHITECTURE_ACTIVITY_IMPULSE_SEPARATION.md

# Implementation summary
cat IMPLEMENTATION_SUMMARY_ACTIVITY_SEPARATION.md

# Run validation
./scripts/validate-activity-impulse-separation.sh

# Check archived templates
ls .archive/legacy-local-templates-20260304/
```

### ⚙️ Configuration Reference

**Root:** `.opencode/opencode.json`
```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_KEY": "local-dev-key",
        "METABOB_API_URL": "http://api.metabob.local"
      },
      "enabled": true
    }
  },
  "metabob": {
    "auto_inject": true,
    "base_url": "http://api.metabob.local"
  }
}
```

**OpenCode Repo:** `repos/metabob-opencode/.opencode/opencode.json`
```json
{
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_KEY": "mb_devbob_test_simple_2026_v2",
        "METABOB_API_URL": "http://api.metabob.local"
      },
      "enabled": true
    }
  },
  "metabob": {
    "auto_inject": true,
    "base_url": "http://api.metabob.local"
  }
}
```

---

**Questions?** Check the full architecture docs or run the validation script.
