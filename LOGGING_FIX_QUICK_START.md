# Production Logging Fix - Quick Start Guide

## What Was Fixed ✅

### Commit: 2834f687
**Branch**: `feat/acp-delegation-improvements`

### Files Changed (3)

1. **`packages/opencode/src/util/log.ts`**
   - Added `OPENCODE_LOG_LEVEL` environment variable support
   - Valid values: DEBUG, INFO, WARN, ERROR
   - Default: INFO

2. **`packages/opencode/src/session/activity-template.ts`** (Line 1279)
   - Changed: `console.warn()` → `log.warn()`
   - Reason: Respects log level filtering

3. **`packages/opencode/src/cli/cmd/tui/util/clipboard.ts`** (6 instances)
   - Changed: `console.log()` → `log.debug()`
   - Reason: Debug-level messages, hidden in production

## How To Use

### Development (Default)
```bash
# Shows: INFO, WARN, ERROR
# Hides: DEBUG
opencode acp --port 3000
```

### Production (Recommended)
```bash
# Shows: WARN, ERROR only
# Hides: DEBUG, INFO
OPENCODE_LOG_LEVEL=WARN opencode acp --port 3000
```

### Debug Mode
```bash
# Shows: Everything (DEBUG, INFO, WARN, ERROR)
OPENCODE_LOG_LEVEL=DEBUG opencode acp --port 3000
```

### Docker Deployment
```yaml
environment:
  OPENCODE_LOG_LEVEL: WARN  # Production
  # or
  OPENCODE_LOG_LEVEL: DEBUG  # Debugging
```

## What Stays in Console

**User-facing output is PRESERVED**:
- ✅ `packages/opencode/src/cli/cmd/serve.ts` - ACP server startup messages
- ✅ `packages/opencode/src/cli/cmd/stats.ts` - Statistics output
- ✅ GitHub integration error messages
- ✅ CLI help text and prompts

**What gets filtered** (production with WARN level):
- ❌ Debug clipboard operations
- ❌ Info-level service initialization
- ❌ Template cache operations
- ❌ Session memory management details

## Testing

### Verify in Container
```bash
# 1. Check current level
docker exec devbob-clean sh -c 'echo $OPENCODE_LOG_LEVEL'

# 2. Test with WARN level
docker exec -e OPENCODE_LOG_LEVEL=WARN devbob-clean opencode --version

# 3. Check logs (should see fewer messages)
docker logs devbob-clean 2>&1 | grep -E "^(INFO|WARN|ERROR|DEBUG)" | wc -l
```

### Verify in Host
```bash
cd repos/metabob-opencode

# Test 1: Default (INFO)
bun run packages/opencode/src/index.ts --version

# Test 2: Production (WARN)
OPENCODE_LOG_LEVEL=WARN bun run packages/opencode/src/index.ts --version

# Test 3: Debug (DEBUG)
OPENCODE_LOG_LEVEL=DEBUG bun run packages/opencode/src/index.ts --version
```

## Expected Behavior

### Log Level Filtering
| Level | DEBUG | INFO | WARN | ERROR |
|-------|-------|------|------|-------|
| DEBUG | ✅    | ✅   | ✅   | ✅    |
| INFO  | ❌    | ✅   | ✅   | ✅    |
| WARN  | ❌    | ❌   | ✅   | ✅    |
| ERROR | ❌    | ❌   | ❌   | ✅    |

### Production Build (WARN)
```
# What you should see:
WARN  service=memory-monitor ...
ERROR Fatal error: ...

# What you should NOT see:
DEBUG Clipboard operation ...
INFO  service=template-cache ...
INFO  service=sdk-loader ...
```

## Current Status

### ✅ Completed
- Code changes committed (2834f687)
- Environment variable support implemented
- Documentation written

### ⚠️ Testing Blocked By
- devbob-clean container: MCP initialization hangs
- metabob-cli: Incomplete Python dependencies
- Port 3000: Never starts listening

### 📝 Next Steps
1. Fix metabob-cli installation in container
2. Test logging with activity execution
3. Merge to main branch
4. Update production deployment

## Quick Merge Checklist

When ready to merge:
```bash
cd repos/metabob-opencode

# 1. Verify branch
git branch --show-current
# Should be: feat/acp-delegation-improvements

# 2. Check commits
git log --oneline main..HEAD
# Should include: 2834f687 fix(logging): ...

# 3. Merge to main
git checkout main
git merge feat/acp-delegation-improvements

# 4. Tag release
git tag -a v0.x.x -m "Production logging improvements"

# 5. Push
git push origin main --tags
```

## Troubleshooting

### Container won't start
```bash
# Check backend is healthy
curl http://localhost:8080/health

# Check network connectivity
docker exec devbob-clean curl -sf http://api-server-dev:8080/health

# Check metabob-cli installation
docker exec devbob-clean /opt/metabob-cli/.venv/bin/python --version
```

### Logs still showing debug messages
```bash
# Verify environment variable is set
echo $OPENCODE_LOG_LEVEL

# Check config loading
docker logs devbob-clean 2>&1 | grep "OPENCODE_LOG_LEVEL"

# Restart with explicit level
OPENCODE_LOG_LEVEL=WARN opencode acp --port 3000
```

### MCP initialization hangs
```bash
# Test metabob-cli directly
docker exec devbob-clean /opt/metabob-cli/.venv/bin/python -m metabob_cli.mcp.server --help

# If fails, install missing dependencies
docker exec devbob-clean /opt/metabob-cli/.venv/bin/pip install tabulate fastapi uvicorn httpx
```

## Related Documentation

- `PRODUCTION_BUILD_LOG_CLEANUP.md` - Full deployment guide
- `PRODUCTION_LOGGING_VERIFICATION_SESSION.md` - This session's detailed notes
- Commit: 2834f687 - Code changes
- Branch: feat/acp-delegation-improvements
