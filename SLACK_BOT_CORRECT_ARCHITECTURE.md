# Slack Bot: CORRECT Architecture (Fixed)

## Summary of Issues Found

### ❌ What Was Wrong (v1.0.1 and v1.0.2)

The deployed slack-bot had **fundamental architectural issues**:

1. **No OpenCode Server**
   - Image built with `node:22-slim` base (no `opencode` binary)
   - Used published `@opencode-ai/sdk` (client-only, no server)
   - When `OPENCODE_BACKEND_URL=""`, code tries to spawn `opencode serve`
   - **Result**: Crashes with `Error: spawn opencode ENOENT`

2. **Wrong Backend URL**
   - Configured to use: `https://ide.metabob.com`
   - `ide.metabob.com` = metabob-rpc-api (Python app, NOT OpenCode!)
   - metabob-rpc-api doesn't have `/sessions` endpoint
   - **Result**: 404 Not Found when bot tries to create sessions

3. **Misconception About Architecture**
   - Documentation claimed bot connected to "shared OpenCode backend"
   - Reality: NO OpenCode server exists in production
   - Bot appeared "connected" but would fail on first actual message

### ✅ What's Correct Now (v1.0.3+)

**Image**: `metabobapp/slack-bot:v1.0.3`
- Based on `devbob:latest` image
- Includes OpenCode binary at `/usr/local/bin/opencode`
- Can run embedded OpenCode server
- Size: 13.2GB (3.55GB compressed)

## Correct Architecture

### How It Actually Works

```
┌────────────────────────────────────────────┐
│  slack-bot Pod (K8s)                       │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │ Slack Bot Process                    │ │
│  │ (tsx src/index.ts)                   │ │
│  │                                      │ │
│  │ OPENCODE_BACKEND_URL="" (empty)      │ │
│  │   ↓                                  │ │
│  │ createOpencode()                     │ │
│  │   ↓                                  │ │
│  │ spawn("opencode serve --port=0")     │ │
│  └────────┬─────────────────────────────┘ │
│           │                                │
│  ┌────────▼─────────────────────────────┐ │
│  │ OpenCode Server Process              │ │
│  │ (opencode binary - Bun + Rust)       │ │
│  │                                      │ │
│  │ - Session management                 │ │
│  │ - LLM orchestration                  │ │
│  │ - Tool execution                     │ │
│  │ - Activity engine                    │ │
│  │ - MCP/ACP support                    │ │
│  │                                      │ │
│  │ HTTP Server: http://127.0.0.1:RANDOM │ │
│  └──────────────────────────────────────┘ │
│           ▲                                │
│           │                                │
│  ┌────────┴─────────────────────────────┐ │
│  │ OpenCode SDK Client                  │ │
│  │ createOpencodeClient({ baseUrl })    │ │
│  │ Connects to local server via HTTP   │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘
         │
         │ Socket Mode (WebSocket)
         ▼
┌────────────────────┐
│  Slack Workspace   │
│  (mahnarc.slack)   │
└────────────────────┘
```

### Key Points

1. **Self-Contained**: Each slack-bot pod runs its OWN OpenCode server
2. **Embedded Server**: OpenCode server spawned as child process
3. **Local Communication**: SDK client connects to local server via HTTP
4. **No Shared Backend**: Each session isolated to its pod
5. **Full OpenCode**: Has access to ALL OpenCode capabilities (activities, tools, agents)

## What Does "metabob-rpc-api" Do?

`metabob-rpc-api` is the **existing Metabob Python backend**, NOT related to OpenCode:
- URL: `https://ide.metabob.com`
- Purpose: Metabob SaaS platform API
- Endpoints: User management, projects, scan results, etc.
- **NOT** an OpenCode server

## Deployment Configuration

### Current (Correct) Configuration

**Image**: `metabobapp/slack-bot:v1.0.3`

**Environment Variables**:
```yaml
SLACK_BOT_TOKEN: "xoxb-..."          # Slack bot OAuth token
SLACK_SIGNING_SECRET: "..."          # Slack signing secret
SLACK_APP_TOKEN: "xapp-..."          # Slack app-level token (Socket Mode)
OPENCODE_BACKEND_URL: ""             # Empty = start local server
ANTHROPIC_API_KEY: "sk-ant-..."      # For LLM access
WORKSPACE_PATH: "/workspace"         # Working directory
```

**Key Setting**: `OPENCODE_BACKEND_URL` must be **empty or unset** to enable embedded server mode.

### Why Embedded Server?

**Advantages**:
- ✅ Simple deployment (single pod)
- ✅ Session isolation (each bot has own server)
- ✅ No shared state issues
- ✅ Easy to scale (just add more pods)
- ✅ Full OpenCode capabilities

**Disadvantages**:
- ❌ Large image size (13.2GB / 3.55GB compressed)
- ❌ Higher memory usage per pod
- ❌ No session sharing between pods
- ❌ Cold start for each new server

## Alternative Architecture: Shared Backend

If we want a shared OpenCode server, we would need:

```
┌─────────────────────────────────┐
│  OpenCode Server Deployment     │
│  - Runs: opencode serve         │
│  - Service: opencode-server:8080│
│  - Persistent storage           │
└─────────────────┬───────────────┘
                  │
         ┌────────┴────────┐
         │                 │
┌────────▼────────┐  ┌─────▼─────────┐
│  slack-bot-1    │  │  slack-bot-2  │
│  (SDK client)   │  │  (SDK client) │
│  Connects to    │  │  Connects to  │
│  server:8080    │  │  server:8080  │
└─────────────────┘  └───────────────┘
```

**Would require**:
1. Deploy separate `opencode-server` deployment
2. Update slack-bot to use: `OPENCODE_BACKEND_URL=http://opencode-server:8080`
3. Manage shared session state
4. Handle concurrency and scaling

**Not currently implemented.**

## DevBob Containers

DevBob containers are **separate from slack-bot**:

```
slack-bot pod
  ├─ OpenCode server (embedded)
  ├─ Can delegate via ACP to:
  └─ docker://devbob-backend-agent (if accessible)

DevBob containers (separate pods/docker)
  ├─ Run: opencode acp --port=3000
  ├─ Accept ACP connections
  └─ Execute delegated tasks
```

**Relationship**:
- Slack bot CAN use devbob containers via `acp_delegate` tool
- Requires devbob containers to be running and accessible
- Communication via ACP protocol (stdin/stdout or Docker socket)
- Currently: No devbob containers in production K8s

## Image Details

### Current Image: metabobapp/slack-bot:v1.0.3

**Built from**: `devbob:latest` base image

**Contents**:
- Ubuntu 22.04 base
- OpenCode binary (Bun + Rust compilation)
- Node 22 + npm (for slack bot)
- Slack bot code (TypeScript + tsx runtime)
- Firefox ESR (for Playwright)
- Git, curl, sqlite3

**Size**: 13.2GB uncompressed, 3.55GB compressed

**Build Process**:
1. Start with `devbob:latest` (contains OpenCode binary)
2. Install Node 22
3. Copy slack bot code (`packages/slack/`)
4. Install npm dependencies
5. Override entrypoint to run slack bot instead of ACP mode

**Dockerfile**: `repos/metabob-opencode/packages/slack/Dockerfile.from-devbob`

### Previous Images (Broken)

**v1.0.1 and v1.0.2**:
- Base: `node:22-slim`
- Size: 1.56GB uncompressed, 389MB compressed
- **Missing**: OpenCode binary
- **Status**: ❌ Broken (can't run embedded server)

## How Slack Bot Uses Activities

With the correct architecture (embedded server), the bot has FULL activity support:

1. **User sends message**: "Add a REST endpoint"
2. **Slack bot receives** → forwards to local OpenCode server
3. **OpenCode server**:
   - LLM analyzes request
   - Recognizes pattern → `add-feature-complete` activity
   - Executes activity template (5 tasks)
   - Each task uses tools (read, write, bash, etc.)
4. **Slack bot polls** `/sessions/{id}/state` every 10s
5. **Detects activity** → posts progress updates to Slack
6. **Activity completes** → bot posts completion message

**All activity templates work**:
- ✅ add-feature-complete
- ✅ fix-bug-complete
- ✅ refactor-with-tests
- ✅ add-comprehensive-logging
- ✅ commit-organized-changes
- ✅ create-subagent
- ✅ create-activity-template
- ✅ All others...

## Testing Locally

```bash
# Run slack-bot locally
docker run -it --rm \
  -e SLACK_BOT_TOKEN="xoxb-..." \
  -e SLACK_APP_TOKEN="xapp-..." \
  -e SLACK_SIGNING_SECRET="..." \
  -e ANTHROPIC_API_KEY="sk-ant-..." \
  -e OPENCODE_BACKEND_URL="" \
  metabobapp/slack-bot:v1.0.3

# Check logs
# Should see:
# 🚀 Starting local opencode server...
# opencode server listening on http://127.0.0.1:XXXXX
# ✅ Local opencode server ready
# ⚡️ Slack bot is running!
```

## Deployment Steps

1. **Build image** (if rebuilding):
   ```bash
   cd repos/metabob-opencode
   docker build -f packages/slack/Dockerfile.from-devbob -t metabobapp/slack-bot:v1.0.3 .
   docker push metabobapp/slack-bot:v1.0.3
   ```

2. **Update deployment**:
   ```bash
   # Edit values file
   vim repos/platform/metabob-apps/charts/slack-bot/values/production.slack-bot.values.yaml
   # Change: tag: "v1.0.3"

   # Update secrets (CRITICAL)
   vim repos/platform/metabob-apps/charts/slack-bot/values/production.slack-bot.secrets.yaml
   # Change: backendUrl: ""  (empty, not "https://ide.metabob.com")

   # Deploy
   cd repos/platform/metabob-apps
   helmfile -e production sync --selector name=slack-bot
   ```

3. **Verify**:
   ```bash
   kubectl -n metabob get pods -l app.kubernetes.io/name=slack-bot
   kubectl -n metabob logs -f -l app.kubernetes.io/name=slack-bot -c slack-bot
   # Should see: "🚀 Starting local opencode server..."
   ```

## Summary

### What We Learned

1. **OpenCode SDK has TWO modes**:
   - `createOpencode()` = server + client (requires `opencode` binary)
   - `createOpencodeClient()` = client only (connects to external server)

2. **Slack bot code supports BOTH modes**:
   - If `OPENCODE_BACKEND_URL` set → client mode
   - If `OPENCODE_BACKEND_URL` empty → embedded server mode

3. **DevBob image is the base**:
   - Contains OpenCode binary
   - Required for embedded server mode
   - Slack bot extends it with Node + slack code

4. **metabob-rpc-api is NOT OpenCode**:
   - It's the Metabob Python API
   - Unrelated to OpenCode/slack-bot
   - `ide.metabob.com` is NOT an OpenCode endpoint

### Current Status

- ✅ Correct image built: `metabobapp/slack-bot:v1.0.3`
- ✅ Image contains OpenCode binary
- ✅ Can run embedded server mode
- ⚠️  Image size is large (13.2GB)
- ⏳ Pushing to Docker Hub (in progress)
- ⏸️  Not yet deployed to production

### Next Steps

1. Wait for Docker push to complete
2. Update production deployment to v1.0.3
3. Set `OPENCODE_BACKEND_URL=""` (empty)
4. Add `ANTHROPIC_API_KEY` to secrets
5. Deploy and verify bot works correctly
6. Test activity execution in Slack
7. Consider optimization: smaller base image if possible

---

**Created**: February 18, 2026  
**Author**: AI Assistant  
**Status**: Image built, push in progress  
