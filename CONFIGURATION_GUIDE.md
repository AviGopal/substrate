# OpenCode Configuration Guide for DevBob

This guide explains how to configure OpenCode for both the **host machine** (running activities locally) and **devbob containers** (running activities in Docker), ensuring both use the same Metabob backend.

## Overview

The DevBob setup requires **two separate OpenCode configurations**:

1. **Host Configuration** (`~/.opencode/opencode.json`)
   - Used when running `opencode` on your local machine
   - Connects to Metabob backend via `http://localhost:8080` (or remote URL)
   - Configured using `./devbob config init`

2. **DevBob Container Configuration** (`configs/opencode.devbob.json`)
   - Used by devbob containers running in Docker
   - Connects to Metabob backend via Docker service name: `http://metabob-rpc-api-server:8080`
   - Pre-configured and mounted automatically at container startup

**Both configurations share the same Metabob backend** for unified code analysis and activity templates.

## Quick Start (3 Steps)

```bash
# 1. Copy and configure environment file
cp .env.devbob.example .env.devbob
# Edit .env.devbob and set your API keys

# 2. Load environment and initialize configs
source .env.devbob
./devbob config init

# 3. Verify configuration
./devbob config verify
```

## Detailed Setup

### Step 1: Configure Environment Variables

Create `.env.devbob` from the example:

```bash
cp .env.devbob.example .env.devbob
```

Edit `.env.devbob` and set:

```bash
# Required: At least one LLM API key
ANTHROPIC_API_KEY=sk-ant-your-key-here
# OR
OPENAI_API_KEY=sk-your-key-here

# Required: Metabob backend URL
# Option 1: Backend on localhost (most common)
METABOB_API_URL=http://localhost:8080

# Option 2: Backend on remote server
# METABOB_API_URL=http://your-server-ip:8080

# Option 3: Using ngrok tunnel
# METABOB_API_URL=https://your-ngrok-id.ngrok.io

# Optional: Metabob API key (if your backend requires it)
METABOB_API_KEY=
```

### Step 2: Load Environment

Load environment variables into your shell:

```bash
source .env.devbob
```

Alternatively, export them manually:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export METABOB_API_URL=http://localhost:8080
```

### Step 3: Initialize Host Configuration

Run the initialization command:

```bash
./devbob config init
```

This will:
- Create `~/.opencode/opencode.json` with your environment variables
- Validate that API keys are set
- Configure Metabob backend URL from `$METABOB_API_URL`
- Enable Metabob MCP integration

**Note:** If config already exists, use `./devbob config init --force` to overwrite.

### Step 4: Verify Configuration

Test that everything is configured correctly:

```bash
./devbob config verify
```

This checks:
- ✅ Host config exists and has no placeholders
- ✅ Metabob backend is reachable
- ✅ API keys are configured
- ✅ MCP integration is enabled
- ✅ DevBob container config exists

### Step 5: Start Services

If verification passes, start the backend and agents:

```bash
# Start Metabob backend services
./devbob backend

# Wait for backend to be healthy (~10-15 seconds)
# Then start devbob agents
./devbob start
```

## Configuration Files Explained

### Host Config: `~/.opencode/opencode.json`

**Purpose:** Used when running OpenCode on your local machine

**Location:** `~/.opencode/opencode.json`

**Generated from:** `configs/opencode.host.json` (template)

**Key Settings:**
```json
{
  "metabob": {
    "enabled": true,
    "base_url": "http://localhost:8080",  // Uses $METABOB_API_URL
    "auto_inject": true
  },
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "sk-ant-..."  // Uses $ANTHROPIC_API_KEY
      }
    }
  },
  "mcp": {
    "metabob": {
      "enabled": true,
      "command": ["metabob-cli", "mcp", "--transport", "stdio"],
      "environment": {
        "METABOB_API_URL": "http://localhost:8080"
      }
    }
  }
}
```

**When to update:**
- When Metabob backend URL changes
- When switching API keys
- When enabling/disabling MCP integration

**Update command:**
```bash
./devbob config update
```

### DevBob Container Config: `configs/opencode.devbob.json`

**Purpose:** Used by devbob containers running in Docker

**Location:** `configs/opencode.devbob.json`

**Mounted to:** `/workspace/.opencode/opencode.json` (inside containers)

**Key Settings:**
```json
{
  "metabob": {
    "enabled": true,
    "base_url": "http://metabob-rpc-api-server:8080",  // Docker service name
    "auto_inject": true
  },
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "${ANTHROPIC_API_KEY}"  // Injected at container startup
      }
    }
  }
}
```

**Important:** This config uses Docker service names (e.g., `metabob-rpc-api-server`) instead of `localhost`, because containers communicate via Docker networks.

**When to update:**
- Rarely needed (pre-configured correctly)
- Only if changing MCP settings or Metabob features
- Manual edits: `./devbob config edit devbob`

## Configuration Management Commands

### `./devbob config init`

Initialize OpenCode configurations for host and devbob.

**Usage:**
```bash
./devbob config init           # Create config if it doesn't exist
./devbob config init --force   # Overwrite existing config
```

**What it does:**
1. Loads environment from `.env.devbob` (if exists)
2. Validates API keys are set
3. Creates `~/.opencode/opencode.json` from template
4. Substitutes placeholders with actual environment variables
5. Shows configured values

**Requirements:**
- At least one of: `$ANTHROPIC_API_KEY` or `$OPENAI_API_KEY`
- Optional: `$METABOB_API_URL` (defaults to `http://localhost:8080`)

### `./devbob config update`

Refresh host config from current environment variables.

**Usage:**
```bash
# Update environment
export METABOB_API_URL=http://new-server:8080

# Refresh config
./devbob config update
```

**What it does:**
1. Loads environment from `.env.devbob` (if exists)
2. Regenerates `~/.opencode/opencode.json` with new values
3. Shows updated values

**Use cases:**
- Metabob backend URL changed
- Switched API keys
- Fixed incorrect configuration

### `./devbob config verify`

Test configuration and connectivity.

**Usage:**
```bash
./devbob config verify
```

**What it checks:**
- ✅ Host config exists and is valid JSON
- ✅ No placeholder values (like `PLACEHOLDER`)
- ✅ Metabob backend is reachable (HTTP request to `/status`)
- ✅ API keys are configured and valid length
- ✅ MCP integration is enabled
- ✅ `metabob-cli` is in PATH (if MCP enabled)
- ✅ DevBob container config exists

**Exit codes:**
- `0`: All checks passed
- `1`: One or more checks failed

### `./devbob config show`

Display configuration status.

**Usage:**
```bash
./devbob config show
```

**What it shows:**
- Host config location and status
- Metabob enabled/disabled
- Backend URL
- MCP enabled/disabled
- DevBob config location and status
- Environment variables (masked keys)

### `./devbob config edit`

Edit configuration files.

**Usage:**
```bash
./devbob config edit host     # Edit host config
./devbob config edit devbob   # Edit devbob container config
```

**Opens:** Config file in `$EDITOR` (defaults to `nano`)

## Common Issues and Solutions

### Issue 1: "No API key found"

**Error:**
```
❌ No API key found! Set ANTHROPIC_API_KEY or OPENAI_API_KEY
```

**Solution:**
1. Edit `.env.devbob` and add your API key:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```
2. Load environment: `source .env.devbob`
3. Re-run: `./devbob config init`

### Issue 2: "Config contains placeholder values"

**Error:**
```
❌ Config contains placeholder values (not substituted)
```

**Cause:** Environment variables weren't set when `config init` was run.

**Solution:**
```bash
source .env.devbob
./devbob config update
./devbob config verify
```

### Issue 3: "Cannot reach Metabob backend"

**Error:**
```
⚠️  Cannot reach Metabob at http://localhost:8080
```

**Cause:** Metabob backend isn't running.

**Solution:**
```bash
# Start backend services
./devbob backend

# Wait 10-15 seconds for services to be healthy
sleep 15

# Verify again
./devbob config verify
```

### Issue 4: "Metabob MCP client not found"

**Error:**
```
Metabob MCP client not found. Check opencode.json configuration.
```

**Cause:** MCP configuration issue or `metabob-cli` not in PATH.

**Solution:**

1. Check if `metabob-cli` is installed:
   ```bash
   which metabob-cli
   ```

2. If not found, check if it's in the backend project:
   ```bash
   # From metabob-devbob directory
   ls -la repos/metabob-rpc-api/metabob-cli
   
   # Add to PATH
   export PATH="$PWD/repos/metabob-rpc-api:$PATH"
   ```

3. Verify MCP config in `~/.opencode/opencode.json`:
   ```json
   {
     "mcp": {
       "metabob": {
         "enabled": true,
         "type": "local",
         "command": ["metabob-cli", "mcp", "--transport", "stdio"]
       }
     }
   }
   ```

### Issue 5: "Host and devbob using different backends"

**Problem:** Activities work in containers but not on host (or vice versa).

**Diagnosis:**
```bash
# Check host config
jq '.metabob.base_url' ~/.opencode/opencode.json

# Check devbob config
jq '.metabob.base_url' configs/opencode.devbob.json
```

**Solution:**
- Host should use: `http://localhost:8080` (or your remote URL)
- DevBob should use: `http://metabob-rpc-api-server:8080`

If host config is wrong:
```bash
export METABOB_API_URL=http://localhost:8080
./devbob config update
```

## Environment Variables Reference

| Variable | Required | Description | Host Value | DevBob Value |
|----------|----------|-------------|------------|--------------|
| `ANTHROPIC_API_KEY` | Yes (or OpenAI) | Anthropic Claude API key | Same | Same (injected) |
| `OPENAI_API_KEY` | Yes (or Anthropic) | OpenAI API key | Same | Same (injected) |
| `METABOB_API_URL` | Yes | Metabob backend URL | `http://localhost:8080` | `http://metabob-rpc-api-server:8080` |
| `METABOB_API_KEY` | No | Metabob API key (if backend requires auth) | Same | Same (injected) |
| `METABOB_PROJECT_ID` | No | Multi-agent project ID | N/A | `devbob-multi-agent` |

## Testing Your Configuration

### Test 1: Host OpenCode Works

```bash
# Run OpenCode on host
opencode

# In OpenCode, try:
search_activities({ "category": "feature" })
```

**Expected:** List of activity templates returned.

### Test 2: Metabob Backend Reachable

```bash
curl http://localhost:8080/status
```

**Expected:** JSON response with backend status.

### Test 3: DevBob Container Works

```bash
# Start devbob
./devbob start

# Connect to container
./devbob shell devbob-opencode

# Inside container, check config
cat .opencode/opencode.json | jq '.metabob.base_url'
# Should be: "http://metabob-rpc-api-server:8080"

# Test Metabob from inside container
curl http://metabob-rpc-api-server:8080/status
```

**Expected:** JSON response from backend.

### Test 4: Run Activity on Host

```bash
opencode

# In OpenCode:
activity({ 
  templateId: "add-feature-complete",
  variables: { 
    featureName: "test feature",
    files: ["test.txt"],
    description: "Test activity execution"
  },
  reason: "Testing configuration"
})
```

**Expected:** Activity executes successfully with Metabob integration.

## Advanced Configuration

### Using Remote Metabob Backend

If your Metabob backend is on a remote server:

```bash
# In .env.devbob
METABOB_API_URL=http://remote-server.example.com:8080

# Or with ngrok tunnel
METABOB_API_URL=https://abc123.ngrok.io
```

**Important:** DevBob containers still use `http://metabob-rpc-api-server:8080` because they're in the same Docker network.

### Disabling Metabob

If you want to run OpenCode without Metabob:

Edit `~/.opencode/opencode.json`:
```json
{
  "metabob": {
    "enabled": false
  }
}
```

**Note:** Activities will still work, but won't have code analysis features.

### Multiple Metabob Backends

If you need different backends for different projects:

```bash
# Project 1
export METABOB_API_URL=http://project1-backend:8080
./devbob config update

# Project 2 (in different terminal)
export METABOB_API_URL=http://project2-backend:8080
./devbob config update
```

## Next Steps

After configuration is complete:

1. **Start backend:** `./devbob backend`
2. **Start agents:** `./devbob start`
3. **Test activities:** `opencode` (on host) or `./devbob tui` (in container)
4. **Read guides:**
   - `QUICK_START.md` - Basic usage
   - `BOOTSTRAP_GUIDE.md` - Full setup documentation
   - `README_DEVBOB.md` - DevBob architecture

## Support

If you encounter issues:

1. Run: `./devbob config verify`
2. Check logs: `./devbob logs`
3. Review this guide for common issues
4. Check backend status: `curl http://localhost:8080/status`
