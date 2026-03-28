# Vessel Development Guide

## Overview

This guide describes the multi-vessel DevBob development environment where each vessel (codebase repository) is managed by its own DevBob container that can communicate with other vessels via ACP (Agent Client Protocol) and collaborate through activities and impulses.

## Architecture

### Vessels

Each vessel represents a distinct codebase with its own DevBob agent:

| Vessel | Type | ACP Port | MCP Port | Container | Role |
|--------|------|----------|----------|-----------|------|
| **metabob-rpc-api** | Python/FastAPI | 3001 | 8081 | devbob-rpc-api | Backend API manager |
| **metabob-cli** | Python/Click | 3002 | 8083 | devbob-cli | CLI tool manager |
| **metabob-opencode** | TypeScript/Bun | 3003 | 8084 | devbob-opencode | OpenCode manager |
| **metabob-dashboard** | TypeScript/Next.js | 3004 | 8085 | devbob-dashboard | Frontend manager |
| **cpg-inference** | Python/ML | 3005 | 8086 | devbob-cpg | CPG inference manager |
| **platform** | Multi-service | 3006 | 8087 | devbob-platform | Platform orchestrator |

### Communication

Vessels communicate through:

1. **ACP (Agent Client Protocol)**: Direct vessel-to-vessel task delegation
2. **Activities**: Structured multi-task workflows shared via backend
3. **Impulses**: Contextual data sharing between agents
4. **Backend API**: Shared state via SurrealDB and Redis

### Network Topology

```
┌─────────────────────────────────────────────────────────────┐
│                     Host Machine                             │
│                                                              │
│  devctl CLI                                                  │
│    │                                                         │
│    ├─> docker://devbob-rpc-api:3001 (ACP)                  │
│    ├─> docker://devbob-cli:3002 (ACP)                      │
│    ├─> docker://devbob-opencode:3003 (ACP)                 │
│    ├─> docker://devbob-dashboard:3004 (ACP)                │
│    ├─> docker://devbob-cpg:3005 (ACP)                      │
│    └─> docker://devbob-platform:3006 (ACP)                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         │
         ├─────────> devbob-network (inter-vessel comms)
         │
         └─────────> metabob-network (backend services)
                            │
                            ├─> Redis (6379)
                            ├─> SurrealDB (8000)
                            └─> API Server (8080)
```

## Development Workflows

### Branch Strategy

- **feat/**: Feature branches for new functionality
- **fix/**: Bug fix branches
- **develop**: Integration branch for testing
- **main**: Production-ready code

### PR Workflow

1. **Create feature branch** from `develop`
2. **Develop** in vessel container with live codebase mounting
3. **Test** using vessel-specific test suites
4. **Create PR** to `develop` via activity
5. **Review** with cross-vessel integration checks
6. **Merge** after approval and CI passes

### Vessel Responsibilities

Each vessel agent is responsible for:

- ✅ **Code quality**: Ensuring linting, formatting, and style compliance
- ✅ **Testing**: Running and maintaining test suites
- ✅ **Documentation**: Keeping docs in sync with code
- ✅ **Dependencies**: Managing package updates and compatibility
- ✅ **Git hygiene**: Clean commits, descriptive messages, proper branching
- ✅ **Integration**: Coordinating with other vessels when needed

## Guidelines & Conventions

### Git Commit Guidelines

**Enforced via activities:**

1. **Commit message format**:
   ```
   type(scope): short description
   
   Longer explanation if needed.
   Why this change was necessary.
   What alternatives were considered.
   ```

2. **Commit types**:
   - `feat`: New feature
   - `fix`: Bug fix
   - `refactor`: Code restructuring without behavior change
   - `test`: Adding or updating tests
   - `docs`: Documentation changes
   - `chore`: Build, config, or tooling changes
   - `perf`: Performance improvements

3. **Scope**: Use vessel name or component
   - `feat(api): add user authentication endpoint`
   - `fix(cli): resolve config file parsing error`

### Code Review Guidelines

**Enforced via activities:**

1. **Self-review before PR**:
   - Run `metabob_search_codebase_issues` to find problems
   - Fix all HIGH severity issues
   - Document design decisions with `metabob_annotate_component`

2. **Cross-vessel dependencies**:
   - Use `metabob_analyze_change_impact` to assess blast radius
   - If change affects multiple vessels, coordinate via activities

3. **PR description must include**:
   - Summary of changes (bullet points)
   - Why the change was needed
   - Testing performed
   - Breaking changes (if any)
   - Related issues/PRs

### Inter-Vessel Communication Guidelines

**When to use ACP delegation:**

- ✅ Feature requires changes in multiple vessels
- ✅ Need expertise from another vessel's domain
- ✅ Coordinating schema changes (proto updates)
- ✅ Integration testing across services

**Example delegation:**
```bash
# From devbob-dashboard, delegate API work to devbob-rpc-api
devctl delegate --from dashboard --to rpc-api \
  --task "Add GET /api/users/:id/profile endpoint" \
  --share-impulse "userProfileDesign"
```

### Activity-Enforced Rules

The following rules are enforced automatically via activity templates:

1. **No direct push to main/develop** without PR
2. **All PRs require passing tests** before merge
3. **High severity Metabob issues** must be fixed before PR
4. **Breaking changes** require updating dependent vessels
5. **Proto changes** trigger rebuild of all affected vessels
6. **Version bumps** follow semver and update all changelogs

## Host Interaction

### devctl CLI

The `devctl` command provides host-level control over vessels:

```bash
# Start all vessels
devctl start

# Start specific vessels
devctl start rpc-api cli

# Stop all vessels
devctl stop

# Delegate task to vessel
devctl delegate --to opencode --task "Fix TypeScript errors"

# Execute activity in vessel
devctl exec --vessel cli --activity fix-bug-complete \
  --vars '{"bugDescription":"CLI crashes on --version"}'

# View vessel logs
devctl logs cli

# SSH into vessel
devctl shell opencode

# Run command in vessel
devctl run --vessel rpc-api -- pytest tests/

# Check vessel health
devctl status

# List all vessels
devctl list
```

### Direct Docker Access

For advanced use cases:

```bash
# View logs
docker logs devbob-rpc-api

# Execute command
docker exec -it devbob-cli sh

# Connect to ACP server
curl http://localhost:3001/config
```

## Activity Templates

### Vessel Development Activities

#### 1. vessel-feature-complete

Implement a feature end-to-end with tests, documentation, and PR creation.

**Variables:**
- `featureName`: Name of the feature
- `featureDescription`: What the feature does
- `affectedVessels`: List of vessels that need changes
- `createPR`: Whether to create PR automatically (default: true)

**Usage:**
```bash
devctl exec --vessel rpc-api --activity vessel-feature-complete \
  --vars '{
    "featureName": "user-profile-api",
    "featureDescription": "Add user profile CRUD endpoints",
    "affectedVessels": ["rpc-api", "dashboard"],
    "createPR": true
  }'
```

#### 2. vessel-fix-bug-complete

Fix a bug with root cause analysis, tests, and documentation.

**Variables:**
- `bugDescription`: Description of the bug
- `reproduction`: Steps to reproduce
- `expectedBehavior`: What should happen
- `actualBehavior`: What actually happens

#### 3. vessel-coordinate-change

Coordinate a change across multiple vessels.

**Variables:**
- `changeDescription`: What needs to change
- `leadVessel`: Vessel coordinating the change
- `dependentVessels`: Vessels that need updates
- `breakingChanges`: Whether this introduces breaking changes

#### 4. vessel-create-pr

Create a PR with proper description, labels, and reviewers.

**Variables:**
- `branchName`: Feature branch to PR
- `targetBranch`: Target branch (default: develop)
- `prTitle`: PR title
- `prDescription`: PR description (auto-generated if omitted)

#### 5. vessel-review-pr

Review a PR from another vessel with integration checks.

**Variables:**
- `prNumber`: PR number to review
- `sourceVessel`: Vessel that created the PR
- `checkIntegration`: Whether to run integration tests

## Environment Variables

### Per-Vessel Configuration

Each vessel container supports:

```bash
# Identity
CODEBASE_NAME=<vessel-name>
HOSTNAME=devbob-<vessel-name>
AGENT_ROLE=<vessel-name>-codebase-manager

# Git Configuration
GIT_AUTO_PUSH=false              # Auto-push commits
GIT_PUSH_ON_EXIT=true            # Push on container shutdown
REPO_CHECKOUT_MODE=skip          # Use mounted repo

# Network
ACP_PORT=<unique-port>           # ACP server port
ACP_HOSTNAME=0.0.0.0             # Listen on all interfaces

# Backend Connection
METABOB_API_URL=http://api-server-dev:8080
METABOB_PROJECT_ID=<vessel-name>-dev
METABOB_API_KEY=<api-key>

# LLM Providers
ANTHROPIC_API_KEY=<key>
OPENAI_API_KEY=<key>

# Logging
LOG_LEVEL=INFO
WAIT_FOR_BACKEND=true
```

### Host Environment

Configure in `.env` file:

```bash
# Backend credentials
METABOB_API_KEY=local-dev-key
ANTHROPIC_API_KEY=<your-key>

# Git workflow
DEVBOB_AUTO_PUSH=false
DEVBOB_PUSH_ON_EXIT=true

# Logging
LOG_LEVEL=INFO

# Database ports
REDIS_PORT=6379
SURREAL_PORT=8000
```

## Quick Start

### 1. Initial Setup

```bash
# Create networks
docker network create metabob-network
docker network create devbob-network

# Build DevBob image
docker build -f docker/Dockerfile.devbob -t devbob:latest .

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start Backend Services

```bash
docker-compose --profile stable up -d
```

Wait for services to be healthy:
```bash
docker-compose ps
```

### 3. Start Vessel Containers

```bash
# Start all vessels
docker-compose --profile devbob-dev up -d

# Or start specific vessels
docker-compose up -d devbob-rpc-api devbob-cli
```

### 4. Verify Setup

```bash
# Check all vessels are running
devctl status

# Test inter-vessel communication
devctl delegate --from cli --to rpc-api --task "Echo test"
```

### 5. Start Development

```bash
# Pick a vessel and start working
devctl shell opencode

# Inside container:
cd /workspace
git checkout -b feat/my-feature
# ... make changes ...
git commit -m "feat(opencode): add my feature"
```

## Troubleshooting

### Vessel won't start

1. Check logs: `docker logs devbob-<vessel-name>`
2. Verify backend is healthy: `docker-compose ps`
3. Check network connectivity: `docker network inspect devbob-network`

### ACP communication fails

1. Verify ports are exposed: `docker ps`
2. Test connection: `curl http://localhost:3001/config`
3. Check firewall rules

### Git push fails from vessel

1. Ensure SSH keys are mounted or configured
2. Check git remote configuration
3. Verify network access to GitHub

### Activity execution hangs

1. Check vessel logs for errors
2. Verify backend API is accessible
3. Check activity template configuration
4. Increase timeout if needed

## Best Practices

### DO ✅

- Use activities for structured workflows
- Coordinate cross-vessel changes via ACP
- Fix HIGH severity Metabob issues before PR
- Annotate design decisions with `metabob_annotate_component`
- Write descriptive commit messages
- Test changes before creating PR
- Keep vessels focused on their domain

### DON'T ❌

- Push directly to main/develop without PR
- Make cross-vessel changes without coordination
- Ignore Metabob warnings in your changes
- Create PRs with failing tests
- Mix multiple concerns in one commit
- Bypass activity-enforced guidelines

## Further Reading

- [Activity Templates Documentation](./ACTIVITY_TEMPLATES.md)
- [ACP Protocol Specification](./ACP_PROTOCOL.md)
- [Impulse System Guide](./IMPULSE_SYSTEM.md)
- [Metabob Integration](./METABOB_INTEGRATION.md)
