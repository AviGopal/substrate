# Multi-Vessel DevBob Development - Quick Start Guide

## Prerequisites

- Docker and Docker Compose installed
- Anthropic API key (for Claude)
- Git configured with GitHub access
- At least 16GB RAM recommended

## Initial Setup (One-time)

### 1. Clone and Configure

```bash
# Already in the project directory
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Create networks
docker network create metabob-network
docker network create devbob-network

# Configure environment
cat > .env << 'EOF'
# LLM API Keys
ANTHROPIC_API_KEY=your-key-here
OPENAI_API_KEY=your-key-here

# Backend Configuration
METABOB_API_KEY=local-dev-key
METABOB_PROJECT_ID=devbob-local

# Git Workflow
DEVBOB_AUTO_PUSH=false
DEVBOB_PUSH_ON_EXIT=true

# Logging
LOG_LEVEL=INFO

# Database Ports
REDIS_PORT=6379
SURREAL_PORT=8000
SURREALIST_PORT=8001
EOF

# Edit .env with your actual API keys
nano .env
```

### 2. Build DevBob Image

```bash
# Build the OpenCode binary first
cd repos/metabob-opencode
bun install
bun run build --single

# Return to project root and build container
cd ../..
docker build -f docker/Dockerfile.devbob -t devbob:latest .
```

### 3. Add devctl to PATH

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
echo 'export PATH="$PATH:/home/avi/documents/work/exp-repo/metabob-devbob/bin"' >> ~/.bashrc
source ~/.bashrc

# Verify devctl works
devctl --help
```

## Daily Development Workflow

### Start the Environment

```bash
# Start backend services (Redis, SurrealDB, API Server)
devctl start

# This runs:
# 1. docker-compose --profile stable up -d  (backend)
# 2. docker-compose --profile devbob-dev up -d  (all vessels)

# Wait for everything to be healthy
devctl status

# Expected output:
# VESSEL       CONTAINER                 STATUS     HEALTH      ACP PORT
# ----------------------------------------------------------------------------
# rpc-api      devbob-rpc-api           running    healthy     3001
# cli          devbob-cli               running    healthy     3002
# opencode     devbob-opencode          running    healthy     3003
# dashboard    devbob-dashboard         running    healthy     3004
# cpg          devbob-cpg               running    healthy     3005
# platform     devbob-platform          running    healthy     3006
```

### Work on a Feature

#### Option 1: Work Inside a Vessel Container

```bash
# Open shell in the vessel you want to work on
devctl shell opencode

# Inside container:
cd /workspace  # Your repo is mounted here

# Create feature branch
git checkout -b feat/my-awesome-feature

# Make changes using your favorite editor (files are live-mounted)
# Changes you make on host immediately appear in container and vice versa

# When ready, use activity to complete the feature
opencode run --agent activity -- "Implement the feature" \
  --template vessel-feature-complete \
  --vars '{
    "featureName": "add-new-endpoint",
    "featureDescription": "Add GET /api/awesome endpoint",
    "affectedVessels": ["rpc-api"],
    "createPR": true
  }'

# Activity will:
# 1. Implement the feature
# 2. Write tests
# 3. Update docs
# 4. Run quality checks
# 5. Create commits
# 6. Open PR

# Exit container
exit
```

#### Option 2: Work from Host and Delegate to Vessel

```bash
# Edit files on your host machine as usual
cd repos/metabob-opencode
git checkout -b feat/my-feature

# ... make changes ...

# Delegate work to the vessel
devctl delegate --to opencode --task "Add tests for my changes"

# Or run a specific activity
devctl activity \
  --vessel opencode \
  --template vessel-feature-complete \
  --vars '{"featureName":"my-feature","featureDescription":"Adds cool stuff"}'
```

### Coordinate Cross-Vessel Changes

When a feature needs changes in multiple vessels:

```bash
# 1. Create feature branches in affected repos
cd repos/metabob-rpc-api
git checkout -b feat/api-changes

cd ../metabob-dashboard
git checkout -b feat/api-changes

# 2. Start with the backend changes
devctl activity --vessel rpc-api --template vessel-feature-complete \
  --vars '{
    "featureName": "add-user-profile-api",
    "featureDescription": "Add user profile CRUD endpoints",
    "affectedVessels": ["rpc-api", "dashboard"],
    "createPR": false
  }'

# 3. Then update frontend to use new API
devctl activity --vessel dashboard --template vessel-feature-complete \
  --vars '{
    "featureName": "user-profile-ui",
    "featureDescription": "Add user profile management UI",
    "affectedVessels": ["dashboard"],
    "createPR": false
  }'

# 4. Create coordinated PRs
devctl exec rpc-api -- gh pr create --base develop --title "feat(api): user profiles"
devctl exec dashboard -- gh pr create --base develop --title "feat(dashboard): user profile UI"

# Link the PRs in descriptions or comments
```

### Inter-Vessel Communication Example

Vessels can communicate via ACP to delegate tasks:

```bash
# From dashboard vessel, ask rpc-api vessel to create an endpoint
devctl shell dashboard

# Inside dashboard container:
opencode run --agent activity -- \
  "Request rpc-api to add user stats endpoint" \
  --template acp-delegate \
  --vars '{
    "target": "docker://devbob-rpc-api",
    "taskDescription": "Add GET /api/users/:id/stats endpoint",
    "prompt": "Implement endpoint that returns user statistics. Include total posts, comments, and join date.",
    "shareImpulses": ["userStatsDesign"]
  }'
```

### View Logs and Debug

```bash
# View logs for a vessel
devctl logs opencode -f  # Follow mode

# Check health of all vessels
devctl health

# Check specific vessel
devctl health rpc-api

# Inspect vessel configuration
devctl inspect cli

# Execute command in vessel
devctl exec rpc-api -- pytest tests/
devctl exec cli -- mypy metabob_cli/
```

### Stop Everything

```bash
# Stop all vessels
devctl stop

# Stop specific vessels
devctl stop opencode dashboard

# Stop everything including backend
docker-compose --profile stable --profile devbob-dev down

# Stop and remove volumes (clean slate)
docker-compose --profile stable --profile devbob-dev down -v
```

## Common Development Patterns

### Pattern 1: Bug Fix Workflow

```bash
# 1. Reproduce the bug
devctl exec cli -- python -m metabob_cli --version  # Causes crash

# 2. Delegate fix to vessel
devctl activity --vessel cli --template vessel-fix-bug-complete \
  --vars '{
    "bugDescription": "CLI crashes when running --version",
    "reproduction": "Run: metabob-cli --version",
    "expectedBehavior": "Should print version number",
    "actualBehavior": "Crashes with ImportError"
  }'

# 3. Activity will fix, test, and create PR
```

### Pattern 2: Code Review via Activity

```bash
# Review a PR from another developer
devctl activity --vessel rpc-api --template vessel-review-pr \
  --vars '{
    "prNumber": "123",
    "sourceVessel": "rpc-api",
    "checkIntegration": true
  }'

# Activity will:
# - Check code quality with Metabob
# - Run tests
# - Check for breaking changes
# - Verify integration with dependent vessels
# - Post review comments
```

### Pattern 3: Refactoring with Safety Checks

```bash
# Before refactoring, check impact
devctl exec opencode -- opencode run --agent activity -- \
  "Analyze impact of refactoring AuthService" \
  --use-metabob-tools \
  --task "Use metabob_analyze_change_impact on AuthService, then metabob_assess_deletion_safety on unused methods"

# Read the analysis
devctl logs opencode | tail -50

# If safe, proceed with refactor activity
devctl activity --vessel opencode --template vessel-refactor-complete \
  --vars '{
    "refactorDescription": "Extract auth logic into separate service",
    "affectedComponents": ["AuthService", "UserController"],
    "breakingChanges": false
  }'
```

### Pattern 4: Coordinated Proto Update

When updating Protocol Buffers that affect multiple vessels:

```bash
# 1. Update proto definitions
cd repos/metabob-proto
git checkout -b feat/add-user-profile-proto

# Edit .proto files
vim protos/user.proto

# 2. Regenerate code for all languages
devctl exec platform -- sh -c "cd /workspace && make proto-gen"

# 3. Update affected vessels in sequence
for vessel in rpc-api cli dashboard; do
  devctl activity --vessel $vessel --template vessel-update-proto \
    --vars '{
      "protoFiles": ["user.proto"],
      "breakingChanges": true,
      "migrationSteps": ["Update API handlers", "Update client code"]
    }'
done

# 4. Test integration
devctl exec rpc-api -- pytest tests/integration/
```

## Monitoring and Observability

### Check Vessel Status

```bash
# Quick status check
devctl status

# Detailed health check (tests ACP endpoints)
devctl health

# List all vessels with ports
devctl list
```

### Access Services

- **SurrealDB UI**: http://localhost:8001
- **Redis**: localhost:6379 (use redis-cli)
- **API Server**: http://localhost:8080/docs (Swagger UI)
- **DevBob Vessels**: 
  - rpc-api: http://localhost:3001/config
  - cli: http://localhost:3002/config
  - opencode: http://localhost:3003/config
  - dashboard: http://localhost:3004/config
  - cpg: http://localhost:3005/config
  - platform: http://localhost:3006/config

### Debug Failed Activity

```bash
# View activity execution logs
devctl logs opencode

# Check for errors
devctl logs opencode | grep ERROR

# Retry activity with verbose logging
devctl exec opencode -- opencode run --log-level DEBUG --agent activity -- \
  "Retry the failed activity with debug output"
```

## Tips and Best Practices

### DO ✅

- **Use activities for structured work** - They ensure quality and consistency
- **Commit frequently** - Activities create organized commits for you
- **Fix Metabob issues before PR** - Activities check this automatically
- **Coordinate cross-vessel changes** - Use delegation and shared impulses
- **Test in containers** - Environment matches CI and production
- **Monitor vessel health** - Run `devctl status` regularly

### DON'T ❌

- **Don't push directly to main/develop** - Always use PRs
- **Don't bypass activities** - They enforce quality guidelines
- **Don't ignore cross-vessel impacts** - Use metabob_analyze_change_impact
- **Don't mix concerns in one PR** - Keep changes focused
- **Don't skip tests** - Activities require tests to pass

## Troubleshooting

### Vessel Won't Start

```bash
# Check logs
devctl logs <vessel>

# Check if backend is healthy
docker ps | grep metabob-surreal
docker ps | grep metabob-redis

# Restart backend if needed
docker-compose --profile stable restart

# Rebuild vessel if needed
docker-compose build devbob-<vessel>
docker-compose up -d devbob-<vessel>
```

### ACP Connection Fails

```bash
# Test ACP endpoint
curl http://localhost:3001/config

# Check if port is in use
lsof -i :3001

# Check container networking
docker network inspect devbob-network
```

### Git Operations Fail

```bash
# Ensure SSH keys are available in container
devctl exec opencode -- ssh -T git@github.com

# Or configure git credentials
devctl exec opencode -- git config --global user.name "Your Name"
devctl exec opencode -- git config --global user.email "your@email.com"
```

### Activity Execution Hangs

```bash
# Check vessel logs
devctl logs <vessel> -f

# Check backend API is accessible
curl http://localhost:8080/health

# Increase activity timeout if needed (edit activity template)
```

## Next Steps

1. **Read the full guide**: [VESSEL_DEVELOPMENT_GUIDE.md](docs/VESSEL_DEVELOPMENT_GUIDE.md)
2. **Explore activity templates**: `ls templates/vessel-workflows/`
3. **Customize your workflow**: Edit activities to match your process
4. **Set up CI/CD**: Configure GitHub Actions for automated testing
5. **Add more vessels**: Follow the pattern in docker-compose.yaml

## Getting Help

- **View devctl help**: `devctl --help`
- **View activity docs**: `devctl exec <vessel> -- opencode activity --help`
- **Check vessel logs**: `devctl logs <vessel>`
- **Inspect configuration**: `devctl inspect <vessel>`
- **Test vessel communication**: `devctl delegate --to <vessel> --task "echo test"`

Happy developing! 🚀
