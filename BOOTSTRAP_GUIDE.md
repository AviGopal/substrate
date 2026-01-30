# DevBob Bootstrap Guide

This guide will help you set up the DevBob multi-agent development environment from scratch.

## What is DevBob?

DevBob is a containerized AI agent system where each container:
- Runs **metabob-opencode** (an AI agent IDE)
- Uses **metabob-cli** as a sidecar for code analysis  
- Works on a specific git repository
- Awaits instructions via ACP (Agent Communication Protocol)
- Automatically pushes changes to the specified branch

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DevBob Environment                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ devbob-cli   │  │devbob-opencode│ │ devbob-rpc-api│      │
│  │              │  │               │  │               │      │
│  │ Port: 3003   │  │ Port: 3004    │  │ Port: 3001    │      │
│  │ Repo: CLI    │  │ Repo: OpenCode│  │ Repo: RPC API │      │
│  │ Branch: main │  │ Branch: feat/* │  │ Branch: main  │      │
│  └──────┬───────┘  └──────┬────────┘  └──────┬────────┘      │
│         │                 │                   │               │
│         └─────────────────┴───────────────────┘               │
│                           │                                   │
│                  ┌────────▼────────┐                          │
│                  │  Metabob Backend │                         │
│                  │  (Optional)      │                         │
│                  └──────────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

### 1. System Requirements
- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Bun** (for building OpenCode)
- **Git** with SSH configured
- **8GB+ RAM** (4GB minimum per container)

### 2. Git SSH Setup
DevBob needs SSH access to clone and push to your repositories:

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Add public key to GitHub/GitLab
cat ~/.ssh/id_ed25519.pub
# Copy and paste to: GitHub → Settings → SSH Keys
```

### 3. API Keys
You need at least one LLM provider API key:
- **Anthropic** (recommended): https://console.anthropic.com/
- **OpenAI** (optional): https://platform.openai.com/

## Step-by-Step Setup

### Step 1: Build OpenCode Binaries

DevBob requires pre-built OpenCode binaries:

```bash
cd /path/to/metabob-devbob

# Install dependencies
cd repos/metabob-opencode
bun install --no-optional

# Build binaries for all platforms (takes ~5 minutes)
cd packages/opencode
bun run build

# Verify build
ls -lh dist/
# Should see: opencode-linux-x64, opencode-linux-arm64, etc.
```

### Step 2: Configure Environment

```bash
cd /path/to/metabob-devbob/configs

# Copy example config
cp .env.devbob .env.devbob.local

# Edit configuration
vim .env.devbob.local
```

**Minimal Required Configuration:**
```bash
# LLM API Key (required)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx

# Git Repository URLs (update with your repos)
DEVBOB_RPC_API_REPO=git@github.com:your-org/metabob-rpc-api.git
DEVBOB_RPC_API_BRANCH=main

DEVBOB_CLI_REPO=git@github.com:your-org/metabob-cli.git
DEVBOB_CLI_BRANCH=main

DEVBOB_OPENCODE_REPO=git@github.com:your-org/opencode.git
DEVBOB_OPENCODE_BRANCH=feat/your-feature

# SSH Keys location
SSH_KEY_DIR=~/.ssh

# Git behavior
DEVBOB_AUTO_PUSH=false         # Don't push after every commit
DEVBOB_PUSH_ON_EXIT=true       # Push when container stops
```

### Step 3: Build DevBob Image

```bash
cd /path/to/metabob-devbob

# Build base image (~10 minutes first time)
./scripts/build-devbob.sh

# Or build dev variant with extra tools
./scripts/build-devbob.sh --dev

# Verify image
docker images devbob:latest
```

### Step 4: Start DevBob Containers

```bash
cd /path/to/metabob-devbob/configs

# Start all containers
docker-compose -f docker-compose.devbob.yaml \
  --env-file .env.devbob.local \
  up -d

# Or start specific container
docker-compose -f docker-compose.devbob.yaml \
  --env-file .env.devbob.local \
  up -d devbob-opencode

# Check status
docker-compose -f docker-compose.devbob.yaml ps
```

### Step 5: Verify Setup

```bash
# Check logs
docker-compose -f docker-compose.devbob.yaml logs -f devbob-opencode

# Should see:
# ✓ Repository cloned successfully
# ✓ OpenCode ACP server started on port 3004
# ✓ metabob-cli MCP server started

# Test ACP connectivity
curl http://localhost:3004/acp/sessions

# Should return: {"sessions": []}
```

## Using DevBob

### Sending Tasks via ACP

DevBob containers await instructions via the ACP protocol:

```bash
# Create a new session
curl -X POST http://localhost:3004/acp/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Add unit tests for the authentication module"
  }'

# Get session status
curl http://localhost:3004/acp/sessions/{session_id}

# Stream session output
curl http://localhost:3004/acp/sessions/{session_id}/stream
```

### Via OpenCode CLI (from host)

If you have OpenCode installed locally:

```bash
# Connect to devbob-opencode container
opencode connect docker://devbob-opencode

# Send task
opencode task "Refactor the user service to use dependency injection"
```

### Via Host Orchestrator (Advanced)

For coordinated multi-agent tasks:

```bash
cd /path/to/metabob-devbob

# Start orchestrator
./scripts/devbob-host-orchestrator.sh

# The orchestrator will:
# - Monitor all devbob containers
# - Distribute tasks based on codebase
# - Coordinate cross-repo changes
# - Aggregate results
```

## Git Workflow

### How DevBob Handles Git

1. **On Startup:**
   - Clones the specified repository and branch
   - Configures git with devbob identity
   - Sets up SSH authentication

2. **During Work:**
   - Agent makes code changes
   - Commits with descriptive messages
   - If `GIT_AUTO_PUSH=true`: pushes immediately
   - Otherwise: accumulates commits locally

3. **On Shutdown:**
   - If `GIT_PUSH_ON_EXIT=true`: pushes all unpushed commits
   - Graceful cleanup

### Manual Git Operations

You can also interact with git inside the container:

```bash
# Enter container
docker exec -it devbob-opencode bash

# Check git status
cd /workspace
git status
git log --oneline

# Manual push
git push origin feat/your-feature

# View unpushed commits
git log origin/feat/your-feature..HEAD
```

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REPO_URL` | - | Git repository URL (SSH or HTTPS) |
| `REPO_BRANCH` | `main` | Branch to checkout |
| `REPO_CHECKOUT_MODE` | `shallow` | `shallow`, `full`, or `skip` |
| `REPO_DEPTH` | `1` | Clone depth for shallow mode |
| `GIT_AUTO_PUSH` | `false` | Push after every commit |
| `GIT_PUSH_ON_EXIT` | `false` | Push on container stop |
| `ACP_PORT` | `3000` | ACP server port |
| `ANTHROPIC_API_KEY` | - | Anthropic API key |
| `OPENAI_API_KEY` | - | OpenAI API key |
| `METABOB_API_URL` | - | Backend API URL (optional) |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARN`, `ERROR` |

### Docker Compose Ports

| Container | ACP Port | MCP Port | Description |
|-----------|----------|----------|-------------|
| devbob-rpc-api | 3001 | 8081 | RPC API backend |
| devbob-dashboard | 3002 | 8082 | Frontend dashboard |
| devbob-cli | 3003 | 8083 | CLI tool |
| devbob-opencode | 3004 | 8084 | OpenCode itself |

## Troubleshooting

### Issue: Clone Failed

```
ERROR: Cannot reach repository: git@github.com:org/repo.git
```

**Solution:**
1. Verify SSH key is added to GitHub/GitLab
2. Test SSH connection: `ssh -T git@github.com`
3. Check `SSH_KEY_DIR` points to correct location
4. Ensure SSH keys have correct permissions (600)

### Issue: API Key Not Working

```
ERROR: No LLM API keys configured
```

**Solution:**
1. Verify API key is valid: https://console.anthropic.com/
2. Check `.env.devbob.local` has correct key
3. Restart container: `docker-compose restart devbob-opencode`

### Issue: Container Won't Start

```bash
# Check logs
docker logs devbob-opencode

# Common issues:
# - Missing opencode binaries → Build them first
# - Port already in use → Change ACP_PORT
# - Volume permission issues → Check Docker settings
```

### Issue: Can't Push Changes

```
ERROR: Failed to push commits
```

**Solution:**
1. Check SSH key has write access to repository
2. Verify branch exists: `git ls-remote origin feat/branch`
3. Check branch protection rules in GitHub/GitLab
4. Manual push inside container: `docker exec -it devbob-opencode bash`

## Advanced Topics

### Custom Entrypoint

Override the entrypoint for debugging:

```yaml
# docker-compose.override.yaml
services:
  devbob-opencode:
    entrypoint: ["/bin/bash"]
    command: []
```

### Development Mode

Mount local code for live development:

```yaml
services:
  devbob-opencode:
    volumes:
      - ../repos/metabob-opencode:/workspace
      - ~/.ssh:/root/.ssh:ro
    environment:
      REPO_CHECKOUT_MODE: skip  # Don't clone
```

### Multi-Container Coordination

Use the host orchestrator for complex workflows:

```bash
# Example: Cross-repo refactoring
./scripts/devbob-host-orchestrator.sh << EOF
Task: Refactor authentication to use JWT tokens

Subtasks:
1. [devbob-rpc-api] Update auth endpoints to use JWT
2. [devbob-cli] Update CLI auth commands
3. [devbob-dashboard] Update frontend auth flow
4. [devbob-opencode] Update OpenCode auth integration
EOF
```

## Next Steps

- Read [QUICK_START.md](./QUICK_START.md) for usage examples
- Review [DOGFOODING_QUICK_START.md](../docs/DOGFOODING_QUICK_START.md)
- Check [templates/](../templates/) for activity templates
- Explore [scripts/](../scripts/) for helper utilities

## Support

For issues or questions:
1. Check container logs: `docker-compose logs -f`
2. Review [GitHub Issues](https://github.com/metabobproject/metabob-devbob/issues)
3. Join Discord: https://discord.gg/metabob
