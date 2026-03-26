# Production Backend Migration Guide

**Date**: February 16, 2026  
**Purpose**: Migrate local development environment from localhost backend to shared production backend

---

## Overview

This guide walks through migrating your local dev environment to use the production backend (`devbob` project) as the shared stable backend, replacing the local Docker-based backend.

### What Will Change

**Before Migration**:
- Backend: `http://localhost:8080` (Docker Compose)
- Database: `ws://localhost:8000` (local SurrealDB)
- API Key: Local development key

**After Migration**:
- Backend: Production URL (shared, stable)
- Database: Production (managed)
- API Key: Production `devbob` project key

---

## Prerequisites

Before starting, you need:

1. **Production Backend URL**
   - Example: `https://api.metabob.com`
   - Get this from your ops team or infrastructure docs

2. **Production API Key for `devbob` project**
   - Format: `mb_xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - Should have `admin:*` or activity execution permissions

3. **Optional: Project ID**
   - Default: `default`
   - Change if using a specific project

---

## Migration Steps

### Step 1: Test Migration (Dry Run)

First, verify what will change without modifying any files:

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

python migrate_to_production_backend.py \
  --url "https://api.metabob.com" \
  --api-key "mb_YOUR_PRODUCTION_KEY_HERE" \
  --dry-run
```

**Expected Output**:
```
======================================================================
Production Backend Migration
======================================================================

Target Backend: https://api.metabob.com
API Key: mb_YOUR_PRODUCTION_KEY_HERE...
Mode: DRY RUN

🔍 Verifying backend connection...
   URL: https://api.metabob.com/health
   ✓ Backend is healthy (HTTP 200)

🔑 Testing API key authentication...
   URL: https://api.metabob.com/v2/session
   ✓ Authentication successful!
   Session ID: devbob:default:...
   Organization: devbob

======================================================================
Updating Configuration Files
======================================================================

✓ Found config: repos/metabob-cli/.metabob/config.json

📝 repos/metabob-cli/.metabob/config.json
  → base_url: http://localhost:8080 → https://api.metabob.com
  → api_key: mb_TfdRc58VlhLz... → mb_YOUR_PRODUCTION_KEY...
  [DRY RUN] Would update

... (similar for other config files)

======================================================================
Migration Summary
======================================================================

Config files found: 3
Config files updated: 3

⚠️  DRY RUN - No files were modified
   Remove --dry-run to apply changes
```

### Step 2: Execute Migration

Once the dry run looks good, apply the changes:

```bash
python migrate_to_production_backend.py \
  --url "https://api.metabob.com" \
  --api-key "mb_YOUR_PRODUCTION_KEY_HERE"
```

**Expected Output**:
```
======================================================================
Production Backend Migration
======================================================================

Target Backend: https://api.metabob.com
API Key: mb_YOUR_PRODUCTION_KEY_HERE...
Mode: LIVE

... (connection tests pass)

📝 repos/metabob-cli/.metabob/config.json
  → base_url: http://localhost:8080 → https://api.metabob.com
  → api_key: mb_TfdRc58VlhLz... → mb_YOUR_PRODUCTION_KEY...
  ✓ Updated

... (all configs updated)

✅ Migration complete!

Next steps:
  1. Verify MCP server: metabob-cli mcp --transport stdio
  2. Test from OpenCode: Use metabob tools in a session
  3. Check activity execution: search_activities + activity
```

### Step 3: Verify MCP Server

Test that the MCP server can connect to the production backend:

```bash
cd repos/metabob-cli
metabob-cli mcp --transport stdio
```

Send a test request (paste this JSON line):
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
```

**Expected Response** (should include production backend URL in tools):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "metabob-mcp-server",
      "version": "..."
    },
    "capabilities": {
      "tools": { ... }
    }
  }
}
```

Press `Ctrl+C` to exit.

### Step 4: Test From OpenCode

1. **Start OpenCode session**:
   ```bash
   cd repos/metabob-opencode/packages/opencode
   node dist/cli/opencode.js
   ```

2. **Test MCP tools**:
   ```
   > Use the search_activities tool to find activity templates
   ```

3. **Verify backend connection**:
   Should see activities from production database, not local templates.

### Step 5: Shutdown Local Backend (Optional)

If migration is successful, you can stop the local Docker backend:

```bash
cd repos/metabob-rpc-api
docker-compose down
```

**Note**: Keep Docker Compose files for future local development if needed.

---

## Configuration Files Updated

The migration script updates these files automatically:

### 1. `repos/metabob-cli/.metabob/config.json`
```json
{
  "base_url": "https://api.metabob.com",
  "api_key": "mb_YOUR_PRODUCTION_KEY_HERE",
  "state_directory": ".metabob"
}
```

### 2. `repos/metabob-opencode/.metabob/config.json`
```json
{
  "base_url": "https://api.metabob.com",
  "api_key": "mb_YOUR_PRODUCTION_KEY_HERE",
  "state_directory": ".metabob"
}
```

### 3. `repos/metabob-opencode/packages/opencode/.metabob/config.json`
```json
{
  "base_url": "https://api.metabob.com",
  "api_key": "mb_YOUR_PRODUCTION_KEY_HERE",
  "state_directory": ".metabob"
}
```

### 4. `repos/metabob-opencode/packages/opencode/opencode.json`

MCP configuration (ensured, not overwritten):
```json
{
  "metabob": {
    "enabled": true,
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "inject_annotations": true,
    "auto_impact_analysis": true,
    "auto_inject": true
  },
  "mcp": {
    "metabob": {
      "type": "local",
      "command": ["metabob", "mcp", "--transport", "stdio"],
      "enabled": true
    }
  }
}
```

---

## Rollback Instructions

If you need to revert to local backend:

### Option 1: Re-run Migration with Localhost

```bash
python migrate_to_production_backend.py \
  --url "http://localhost:8080" \
  --api-key "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"
```

### Option 2: Manual Rollback

Restore these values in all 3 config files:

```json
{
  "base_url": "http://localhost:8080",
  "api_key": "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ",
  "state_directory": ".metabob"
}
```

Then restart local backend:

```bash
cd repos/metabob-rpc-api
docker-compose up -d
```

---

## Troubleshooting

### Issue: Backend Connection Fails

**Error**: `Failed to connect: Connection refused`

**Solution**:
1. Check production backend URL is correct
2. Verify backend is accessible: `curl https://api.metabob.com/health`
3. Check network/firewall settings
4. Confirm VPN is connected (if required)

### Issue: Authentication Fails

**Error**: `HTTP 401: Unauthorized`

**Solution**:
1. Verify API key is correct (starts with `mb_`)
2. Check key is for `devbob` organization
3. Confirm key has `admin:*` or activity permissions
4. Test key manually:
   ```bash
   curl -X POST https://api.metabob.com/v2/session \
     -H "Content-Type: application/json" \
     -H "X-API-Key: mb_YOUR_KEY" \
     -d '{"name": "test"}'
   ```

### Issue: MCP Server Can't Find Config

**Error**: `Config file not found`

**Solution**:
1. Check file exists: `ls -la repos/metabob-cli/.metabob/config.json`
2. Verify permissions: `chmod 644 repos/metabob-cli/.metabob/config.json`
3. Ensure metabob-cli can read it:
   ```bash
   cd repos/metabob-cli
   python -m metabob_cli.core.config
   ```

### Issue: OpenCode Doesn't See MCP Tools

**Error**: No metabob tools available

**Solution**:
1. Check OpenCode config: `cat repos/metabob-opencode/packages/opencode/opencode.json`
2. Verify MCP is enabled: `"enabled": true`
3. Test MCP directly: `metabob-cli mcp --transport stdio`
4. Restart OpenCode session

---

## Verification Checklist

After migration, verify:

- [ ] Backend health check succeeds: `curl https://api.metabob.com/health`
- [ ] API key authentication works (session creation succeeds)
- [ ] MCP server starts without errors
- [ ] MCP server connects to production backend
- [ ] OpenCode session can use metabob tools
- [ ] `search_activities` returns production templates
- [ ] Activity execution works end-to-end
- [ ] Local backend stopped (optional)

---

## Production Backend Information

**Organization**: `devbob`  
**Project**: `default` (or as configured)  
**Permissions Required**:
- `admin:*` (full access) OR
- `activity:read`, `activity:write`, `activity:execute`
- `analysis:read`, `analysis:write`

**Session Management**:
- Sessions expire after 24 hours
- Sessions are automatically refreshed by metabob-cli
- Session tokens stored in `.metabob/session_token`

**Rate Limits** (if applicable):
- Check with ops team for production rate limits
- Typical: 100 req/min for analysis, unlimited for activities

---

## Next Steps After Migration

1. **Test Activity Execution**
   ```
   Use search_activities to find templates
   Execute an activity template end-to-end
   Verify results are stored in production database
   ```

2. **Verify Activity Learning**
   ```
   Execute same activity multiple times
   Check if success metrics improve
   Verify execution history is tracked
   ```

3. **Test Code Quality Tools**
   ```
   Use metabob_search_codebase_issues
   Use metabob_get_priority_issues
   Use metabob_annotate_component
   ```

4. **Monitor Usage**
   ```
   Check session tokens are refreshed
   Monitor API usage (if metrics available)
   Verify no rate limit errors
   ```

---

## Support

**Migration Script**: `migrate_to_production_backend.py`  
**Documentation**: This file (`PRODUCTION_BACKEND_MIGRATION_GUIDE.md`)  
**Related Docs**:
- `DATABASE_INSPECTION_COMPLETE.md` - Database verification
- `MCP_INTEGRATION_SUCCESS.md` - MCP architecture
- `BACKEND_INTEGRATION_COMPLETE.md` - Backend setup

**For Issues**:
1. Check troubleshooting section above
2. Review migration script output for detailed errors
3. Test each component individually (backend, MCP, OpenCode)
4. Contact ops team for production backend access issues

---

**Generated**: February 16, 2026  
**Version**: 1.0  
**Status**: Ready for execution
