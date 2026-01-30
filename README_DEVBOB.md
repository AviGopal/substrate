# DevBob - AI Agent Development Environment

> Containerized AI agents that clone repositories, execute tasks, and push changes autonomously.

## Overview

DevBob provides isolated, containerized AI agents where each container:

- 🤖 **Runs OpenCode** - AI agent IDE with full development capabilities
- 🔍 **Uses Metabob CLI** - Sidecar for code analysis and quality checks
- 🌳 **Clones Git Repos** - Automatically clones specified repository and branch
- 📡 **Awaits Instructions** - Listens on ACP (Agent Communication Protocol) port
- 🚀 **Pushes Changes** - Commits and pushes work back to the remote branch
- 🔐 **SSH Integrated** - Uses your local SSH keys for git operations

## Quick Start (3 Minutes)

```bash
# 1. Clone and navigate
cd /path/to/metabob-devbob

# 2. Run interactive setup
./scripts/quick-start.sh

# 3. That's it! Containers are running.
```

The quick start script will:
- ✅ Check prerequisites
- ✅ Build OpenCode binaries
- ✅ Configure environment
- ✅ Build Docker image
- ✅ Start containers

## Manual Setup

If you prefer manual control, follow the [BOOTSTRAP_GUIDE.md](./BOOTSTRAP_GUIDE.md):

```bash
# 1. Build OpenCode binaries
cd repos/metabob-opencode/packages/opencode
bun run build

# 2. Configure environment
cp configs/.env.devbob configs/.env.devbob.local
vim configs/.env.devbob.local  # Add your API keys and repo URLs

# 3. Build Docker image
./scripts/build-devbob.sh

# 4. Start containers
cd configs
docker-compose -f docker-compose.devbob.yaml --env-file .env.devbob.local up -d
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your Machine (Host)                          │
│                                                                 │
│  ~/.ssh/  ──────────────────────────────────────┐              │
│   ├── id_ed25519 (mounted read-only)            │              │
│   └── id_ed25519.pub                            │              │
│                                                  ▼              │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              DevBob Container                          │    │
│  │  ┌──────────────────────────────────────────────┐     │    │
│  │  │  /workspace (volume)                         │     │    │
│  │  │  ├── .git/  (cloned from REPO_URL)          │     │    │
│  │  │  ├── src/                                    │     │    │
│  │  │  ├── tests/                                  │     │    │
│  │  │  └── .opencode/ (agent state)               │     │    │
│  │  └──────────────────────────────────────────────┘     │    │
│  │                                                        │    │
│  │  OpenCode (ACP :3004) ◄──── External Tasks           │    │
│  │       │                                                │    │
│  │       └──► metabob-cli (MCP) ◄──► Code Analysis      │    │
│  │                                                        │    │
│  │  On commit: git push origin REPO_BRANCH               │    │
│  └────────────────────────────────────────────────────────┘    │
│                         │                                      │
│                         ▼                                      │
│               GitHub/GitLab (Remote)                           │
└─────────────────────────────────────────────────────────────────┘
```

## Usage Examples

### Send Task via curl

```bash
# Create a session and send a task
curl -X POST http://localhost:3004/acp/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Refactor the authentication module to use JWT tokens"
  }'

# Response:
# {"sessionId": "abc123", "status": "running"}

# Check status
curl http://localhost:3004/acp/sessions/abc123

# Stream output
curl http://localhost:3004/acp/sessions/abc123/stream
```

### Send Task via OpenCode CLI

If you have OpenCode installed on your host:

```bash
# Connect to container
opencode connect docker://devbob-opencode

# Send task
opencode task "Add comprehensive tests for the user service"

# Check status
opencode status
```

### Access Container Shell

```bash
# Enter container
docker exec -it devbob-opencode bash

# Inside container:
cd /workspace
git status
git log --oneline
opencode --help
metabob-cli --help
```

## Configuration

### Environment Variables (.env.devbob.local)

**Required:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx    # Your Anthropic API key
DEVBOB_OPENCODE_REPO=git@github.com:org/repo.git
DEVBOB_OPENCODE_BRANCH=feat/my-feature
```

**Optional:**
```bash
# Git behavior
DEVBOB_CHECKOUT_MODE=shallow        # shallow, full, or skip
DEVBOB_AUTO_PUSH=false              # Push after every commit
DEVBOB_PUSH_ON_EXIT=true            # Push when container stops

# Backend (optional)
METABOB_API_URL=http://api:8080    # Metabob backend for sync
METABOB_PROJECT_ID=my-project       # Multi-agent coordination

# Logging
LOG_LEVEL=INFO                      # DEBUG, INFO, WARN, ERROR
```

### Multiple Repositories

Configure multiple containers for different repos:

```bash
# .env.devbob.local
DEVBOB_CLI_REPO=git@github.com:org/metabob-cli.git
DEVBOB_CLI_BRANCH=main

DEVBOB_OPENCODE_REPO=git@github.com:org/opencode.git
DEVBOB_OPENCODE_BRANCH=feat/new-feature

DEVBOB_RPC_API_REPO=git@github.com:org/rpc-api.git
DEVBOB_RPC_API_BRANCH=develop
```

Start all containers:
```bash
docker-compose -f configs/docker-compose.devbob.yaml --env-file .env.devbob.local up -d
```

Each agent will:
- Clone its respective repository
- Work independently
- Push changes to its branch
- (Optionally) Coordinate via Metabob backend

## Git Workflow

### Clone on Startup
```
Container starts → Clone REPO_URL@REPO_BRANCH → Configure git → Wait for tasks
```

### Commit Behavior
```
Agent makes changes → Creates commit → Push behavior:
  • GIT_AUTO_PUSH=true  → Push immediately
  • GIT_AUTO_PUSH=false → Accumulate commits
```

### Push on Exit
```
Container stops → GIT_PUSH_ON_EXIT=true? → Push all unpushed commits → Exit
```

### Branch Tracking
Each container tracks the branch it was started with:
- Commits are made to that branch
- Pushes go to `origin/<branch>`
- No automatic merging or branch switching

## Directory Structure

```
metabob-devbob/
├── configs/
│   ├── .env.devbob              # Example configuration
│   ├── .env.devbob.local        # Your local config (gitignored)
│   ├── Dockerfile.devbob        # Container image definition
│   ├── docker-compose.devbob.yaml  # Container orchestration
│   ├── devbob-entrypoint.sh     # Container startup script
│   ├── devbob-config.json       # OpenCode configuration template
│   └── zombie-reaper.sh         # Process management
├── scripts/
│   ├── quick-start.sh           # Interactive setup
│   ├── build-devbob.sh          # Build Docker image
│   └── bootstrap-devbob.sh      # Install activity templates
├── repos/
│   ├── metabob-opencode/        # OpenCode source (for building)
│   └── metabob-cli/             # Metabob CLI source (for building)
├── templates/
│   └── *.json                   # Activity templates for agents
├── BOOTSTRAP_GUIDE.md           # Comprehensive setup guide
└── README_DEVBOB.md             # This file
```

## Port Assignments

| Container | ACP Port | Description |
|-----------|----------|-------------|
| devbob-opencode | 3004 | OpenCode repository agent |
| devbob-cli | 3003 | CLI tool agent |
| devbob-rpc-api | 3001 | Backend API agent |
| devbob-dashboard | 3002 | Frontend dashboard agent |

Access any agent:
```bash
curl http://localhost:3004/acp/sessions  # OpenCode
curl http://localhost:3003/acp/sessions  # CLI
# etc.
```

## Common Operations

### View Logs
```bash
# All containers
docker-compose -f configs/docker-compose.devbob.yaml logs -f

# Specific container
docker-compose -f configs/docker-compose.devbob.yaml logs -f devbob-opencode
```

### Restart Container
```bash
docker-compose -f configs/docker-compose.devbob.yaml restart devbob-opencode
```

### Stop All
```bash
docker-compose -f configs/docker-compose.devbob.yaml down
```

### Update Configuration
```bash
# Edit config
vim configs/.env.devbob.local

# Restart to apply
docker-compose -f configs/docker-compose.devbob.yaml restart
```

### Check Git Status Inside Container
```bash
docker exec devbob-opencode git -C /workspace status
docker exec devbob-opencode git -C /workspace log --oneline -10
```

## Troubleshooting

### Issue: Container Won't Start
```bash
# Check logs
docker logs devbob-opencode

# Common causes:
# - Missing API key in .env.devbob.local
# - OpenCode binaries not built
# - Port already in use
```

### Issue: Git Clone Failed
```bash
# Verify SSH key access
ssh -T git@github.com

# Check SSH keys are mounted
docker exec devbob-opencode ls -la /root/.ssh

# Verify repo URL is correct
echo $DEVBOB_OPENCODE_REPO
```

### Issue: Can't Push Changes
```bash
# Check SSH key has write access
ssh -T git@github.com

# Check branch exists
git ls-remote origin feat/branch

# Manual push inside container
docker exec -it devbob-opencode bash
cd /workspace && git push origin feat/branch
```

### Issue: API Key Not Working
```bash
# Verify API key
echo $ANTHROPIC_API_KEY

# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

## Advanced Usage

### Custom Activity Templates

Place activity templates in `templates/`:

```bash
# Install templates
./scripts/bootstrap-devbob.sh

# Templates are auto-loaded by agents
```

### Multi-Agent Coordination

Configure backend in `.env.devbob.local`:
```bash
METABOB_API_URL=http://metabob-api:8080
METABOB_PROJECT_ID=my-multi-agent-project
```

Agents will:
- Sync activity templates
- Share code analysis results
- Coordinate cross-repo changes

### Development Mode

Mount local code instead of cloning:

```yaml
# docker-compose.override.yaml
services:
  devbob-opencode:
    volumes:
      - ../repos/metabob-opencode:/workspace
    environment:
      REPO_CHECKOUT_MODE: skip
```

## Security Notes

- SSH keys are mounted **read-only** from your local `~/.ssh`
- API keys are stored in `.env.devbob.local` (gitignored)
- Container runs as root (required for git/ssh operations)
- Network isolation via Docker networks
- No SSH server exposed (SSH client only for git)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

See [LICENSE](./LICENSE)

## Support

- 📖 Documentation: [BOOTSTRAP_GUIDE.md](./BOOTSTRAP_GUIDE.md)
- 🐛 Issues: GitHub Issues
- 💬 Community: Discord
- 📧 Email: support@metabob.com

---

**Made with ❤️ by the Metabob Team**
