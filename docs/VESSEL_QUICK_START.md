# Vessel Quick Start Guide

**5-minute guide to vessel discovery and interaction**

## Setup (One-Time)

### 1. Install Dependencies
```bash
cd repos/terminal
bun install
```

### 2. Create Config
```bash
mkdir -p ~/.metabob
cat > ~/.metabob/config.json <<'JSON'
{
  "vessels": {
    "terminal": {
      "type": "http",
      "endpoint": "http://localhost:9137",
      "capabilities": ["terminalState", "terminalCommand", "terminalOutput"]
    }
  }
}
JSON
```

## Usage

### Vessel Identity

As of April 2026 (minibob `341bfb5`), vessels must supply their own `vessel_id` — the old hostname fallback was removed. Callers that want discovery registration or trace attribution must set one of:

- `MINIBOB_VESSEL_ID` (env)
- `MINIBOB_INSTANCE_ID` (env, legacy alias)
- `POD_NAME` (env, Kubernetes downward API)
- `discovery.vesselId` in `~/.metabob/config.json` or project config

If none are set, discovery registration is skipped and activity traces emit with an undefined `vessel_id`, which excludes them from vessel-grouped learning queries.

### Start Terminal Vessel
```bash
# In terminal 1
cd repos/terminal
export MINIBOB_VESSEL_ID="terminal-$(hostname)-$$"  # explicit, stable per process
bun run src/index.ts --port 9137
```

Expected:
```
🌐 HTTP server listening on port 9137
✅ Registered with backend
```

### Test Discovery
```bash
# In terminal 2
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run demos/vessel-discovery-demo.ts
```

Expected:
```
📡 Backend discovery...
  ✓ terminal-vessel-1 (http://localhost:9137)

📝 Config discovery...
  ✓ terminal (http://localhost:9137)

🔎 Codebase introspection...
  ✓ Found 9 npm scripts

✓ Found 3 vessels
```

### Interact with Vessel
```bash
# Spawn terminal
./repos/terminal/cli/terminal-cli.ts spawn shell

# Returns: term-abc123

# Send command
./repos/terminal/cli/terminal-cli.ts send term-abc123 "echo 'Hello from vessel'"

# View state
./repos/terminal/cli/terminal-cli.ts state term-abc123
```

## Quick Tests

### 1. Health Check
```bash
curl http://localhost:9137/health | jq
```

Expected:
```json
{
  "status": "ok",
  "vessel": "terminal",
  "shapes": ["terminalState", "terminalCommand", "terminalOutput"]
}
```

### 2. Resolve Impulse
```bash
curl -X POST http://localhost:9137/v2/impulses/resolve \
  -H "Content-Type: application/json" \
  -d '{"pointer": {"type": "terminalState", "terminalId": "term-abc123"}}' | jq
```

### 3. List Active Terminals
```bash
curl -X POST http://localhost:9137/v2/terminals/list \
  -H "Content-Type: application/json" \
  -d '{"filter": "all"}' | jq
```

## Common Patterns

### Pattern 1: Activity Using Terminal
```json
{
  "tasks": [{
    "id": "run-test",
    "resolver": "terminal",
    "config": { "command": "npm test" },
    "outputShapes": ["terminalState"]
  }]
}
```

### Pattern 2: Multi-Vessel Activity
```json
{
  "tasks": [
    {
      "id": "terminal-output",
      "resolver": "terminal",
      "outputShapes": ["terminalState"]
    },
    {
      "id": "analyze",
      "resolver": "llm",
      "inputShapes": ["terminalState"]
    }
  ]
}
```

### Pattern 3: Vessel Bundle
```json
{
  "development": {
    "vessels": {
      "terminal": {
        "autoStart": true,
        "command": "bun run repos/terminal/src/index.ts --port 9137"
      }
    }
  }
}
```

## Troubleshooting

**Vessel not found?**
```bash
# Check registration
curl http://localhost:9137/health

# Check config
cat ~/.metabob/config.json | jq .vessels
```

**Port in use?**
```bash
# Use different port
bun run src/index.ts --port 9138

# Update config
jq '.vessels.terminal.endpoint = "http://localhost:9138"' ~/.metabob/config.json
```

**Discovery not working?**
```bash
# Run demo with verbose output
DEBUG=1 bun run demos/vessel-discovery-demo.ts
```

## Next Steps

1. Read: `docs/architecture/VESSEL_DISCOVERY_AND_INTERACTION.md`
2. Run: `demos/vessel-discovery-demo.ts`
3. Study: `demos/vessel-interaction-example.md`
4. Build: Your own vessel!

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun run src/index.ts --port 9137` | Start vessel |
| `curl http://localhost:9137/health` | Health check |
| `./cli/terminal-cli.ts spawn shell` | Spawn terminal |
| `./cli/terminal-cli.ts list` | List terminals |
| `./cli/state-space-inspector.ts` | View state space |
| `bun run demos/vessel-discovery-demo.ts` | Test discovery |
