# OpenCode Configuration - Quick Start

## TL;DR (30 seconds)

```bash
# 1. Load environment
source .env.devbob

# 2. Initialize configs
./devbob config init

# 3. Verify
./devbob config verify

# Done! Start using OpenCode on host or in containers
```

## The Problem This Solves

**Issue:** OpenCode on host machine needs to connect to the same Metabob backend as devbob containers, but they use different URLs:

- **Host:** `http://localhost:8080` (connects via localhost)
- **DevBob Containers:** `http://metabob-rpc-api-server:8080` (connects via Docker network)

**Solution:** Separate config files for host and containers, both using the same backend.

## Two Configurations

| Config | Location | Used By | Backend URL |
|--------|----------|---------|-------------|
| **Host** | `~/.opencode/opencode.json` | Your local machine | `http://localhost:8080` |
| **DevBob** | `configs/opencode.devbob.json` | Docker containers | `http://metabob-rpc-api-server:8080` |

## Setup Commands

### First Time Setup

```bash
# 1. Load environment variables
source .env.devbob

# 2. Create host config from environment
./devbob config init

# 3. Test connectivity
./devbob config verify
```

### Update Config (After Environment Changes)

```bash
# Update environment
export METABOB_API_URL=http://new-server:8080

# Refresh config
./devbob config update

# Verify
./devbob config verify
```

### Force Recreate Config

```bash
source .env.devbob
./devbob config init --force
```

## Verification Checklist

Run `./devbob config verify` to check:

- ✅ Host config exists
- ✅ No placeholder values
- ✅ Metabob backend reachable
- ✅ API keys configured
- ✅ MCP enabled
- ✅ `metabob-cli` in PATH
- ✅ DevBob config exists

## Common Commands

```bash
# Show config status
./devbob config show

# Test configuration
./devbob config verify

# Edit host config
./devbob config edit host

# Edit devbob config
./devbob config edit devbob

# Update from environment
./devbob config update

# Full help
./devbob config help
```

## Environment Variables

Set in `.env.devbob`:

```bash
# Required: At least one LLM API key
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...

# Required: Backend URL (for host)
METABOB_API_URL=http://localhost:8080

# Optional: Backend API key
METABOB_API_KEY=
```

## Testing

### Test Host OpenCode

```bash
opencode

# In OpenCode:
search_activities({ "category": "feature" })
```

### Test DevBob Container

```bash
./devbob start
./devbob tui devbob-opencode

# In container:
# Use activity templates normally
```

## Troubleshooting

### "No API key found"

```bash
# Add key to .env.devbob
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env.devbob

# Reload and reinit
source .env.devbob
./devbob config update
```

### "Config contains placeholder values"

```bash
# Environment wasn't loaded
source .env.devbob
./devbob config update
./devbob config verify
```

### "Cannot reach Metabob"

```bash
# Start backend first
./devbob backend

# Wait for it to be healthy
sleep 15

# Verify again
./devbob config verify
```

### "Metabob MCP client not found"

```bash
# Check if metabob-cli is in PATH
which metabob-cli

# If not, add backend repo to PATH
export PATH="$PWD/repos/metabob-rpc-api:$PATH"
```

## Full Documentation

For detailed information, see:
- `CONFIGURATION_GUIDE.md` - Complete configuration guide
- `QUICK_START.md` - General DevBob setup
- `BOOTSTRAP_GUIDE.md` - Full system documentation
