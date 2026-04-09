# Vessel Interaction Example

**Practical demonstration of vessel discovery and interaction patterns**

## Quick Start

### 1. Start Terminal Vessel

```bash
cd repos/terminal
bun run src/index.ts --port 9137 &
```

Expected output:
```
🌐 HTTP server listening on port 9137
   Health: http://localhost:9137/health
   Resolve: http://localhost:9137/v2/impulses/resolve
✅ Registered with backend: https://activity.metabob.com
   Vessel ID: terminal-vessel-1
   Endpoint: http://localhost:9137
```

### 2. Create Config File

```bash
# Create .metabob/config.json
cat > .metabob/config.json <<'EOF'
{
  "vessels": {
    "terminal": {
      "type": "http",
      "endpoint": "http://localhost:9137",
      "capabilities": ["terminalState", "terminalCommand", "terminalOutput"]
    }
  }
}
EOF
```

### 3. Run Discovery Demo

```bash
bun run demos/vessel-discovery-demo.ts
```

Now you should see:
```
📡 Backend discovery...
  ✓ terminal-vessel-1 (http://localhost:9137)

📝 Config discovery...
  ✓ terminal (http://localhost:9137)

✓ Found 2 vessels
```

---

## Discovery Sources Comparison

| Source | Vessels Found | Use Case |
|--------|---------------|----------|
| **Backend** | terminal-vessel-1 | Production deployments |
| **Config** | terminal | Local development |
| **Introspection** | codebase | Project-specific commands |

**Combined result:** All three sources provide complementary vessel discovery.

---

## Vessel Interaction Example

### Scenario: Debug Test Failure

**Goal:** Run test in terminal, analyze output, save report

**Vessels involved:**
1. Terminal vessel (run test)
2. LLM resolver (analyze)
3. File vessel (save report)

### Activity Template

```json
{
  "id": "debug-test-with-vessels",
  "name": "Debug Test Failure Using Multiple Vessels",
  "tasks": [
    {
      "id": "spawn-terminal",
      "resolver": "terminal",
      "config": {
        "preset": "shell"
      },
      "outputShapes": ["terminalState"]
    },
    {
      "id": "run-test",
      "resolver": "terminal",
      "inputShapes": ["terminalState"],
      "config": {
        "terminalId": "{{impulses.terminal.metadata.terminalId}}",
        "command": "npm test"
      },
      "outputShapes": ["terminalState"]
    },
    {
      "id": "analyze-output",
      "resolver": "llm",
      "inputShapes": ["terminalState"],
      "prompt": {
        "template": "Analyze test output:\n{{impulses.terminal.content.state.buffer}}\n\nWhat failed and why?"
      },
      "outputShapes": ["analysis"]
    },
    {
      "id": "save-report",
      "resolver": "file",
      "inputShapes": ["analysis"],
      "config": {
        "path": "test-failure-report.md",
        "content": "{{impulses.analysis.content}}"
      },
      "outputShapes": ["file_content"]
    }
  ]
}
```

### Execution Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Discovery Phase                                      │
├─────────────────────────────────────────────────────────┤
│   Shape: terminalState                                  │
│   ↓                                                      │
│   Discovery finds: terminal vessel (localhost:9137)     │
│   ↓                                                      │
│   Health check: OK                                      │
│   ↓                                                      │
│   Route to: http://localhost:9137                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 2. Task Execution                                       │
├─────────────────────────────────────────────────────────┤
│   Task 1: spawn-terminal                                │
│   ├── Resolver: terminal vessel                         │
│   ├── Call: POST /v2/terminals/spawn                    │
│   └── Output: { terminalId: "term-abc123" }            │
│                                                          │
│   Task 2: run-test                                      │
│   ├── Input: terminalId from Task 1                     │
│   ├── Resolver: terminal vessel                         │
│   ├── Call: POST /v2/terminals/send-input              │
│   └── Output: terminalState impulse                    │
│                                                          │
│   Task 3: analyze-output                                │
│   ├── Input: terminalState from Task 2                  │
│   ├── Resolver: LLM                                     │
│   ├── Prompt: "Analyze test output: ..."               │
│   └── Output: analysis impulse                         │
│                                                          │
│   Task 4: save-report                                   │
│   ├── Input: analysis from Task 3                       │
│   ├── Resolver: file vessel                             │
│   ├── Write: test-failure-report.md                    │
│   └── Output: file_content impulse                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 3. Impulse Chain                                        │
├─────────────────────────────────────────────────────────┤
│   terminal-spawn-result                                 │
│       ↓                                                  │
│   terminalState (after test run)                        │
│       ↓                                                  │
│   analysis (LLM reasoning)                              │
│       ↓                                                  │
│   file_content (saved report)                           │
└─────────────────────────────────────────────────────────┘
```

---

## Vessel Bundle Example

### Development Bundle

```json
// .metabob/vessel-bundles.json
{
  "development": {
    "vessels": {
      "terminal": {
        "endpoint": "http://localhost:9137",
        "autoStart": true,
        "command": "bun run repos/terminal/src/index.ts --port 9137"
      },
      "database": {
        "endpoint": "http://localhost:5432",
        "autoStart": false
      },
      "file-watcher": {
        "endpoint": "http://localhost:8888",
        "autoStart": true,
        "command": "bun run repos/file-watcher/src/index.ts"
      }
    }
  },
  "production": {
    "vessels": {
      "terminal": {
        "endpoint": "http://terminal.metabob.local",
        "autoStart": false
      },
      "database": {
        "endpoint": "http://database.metabob.local",
        "autoStart": false
      }
    }
  }
}
```

### Bundle Launcher

```bash
#!/bin/bash
# launch-bundle.sh

BUNDLE=${1:-development}

echo "🚀 Launching bundle: $BUNDLE"

# Read bundle config
VESSELS=$(jq -r ".${BUNDLE}.vessels | keys[]" .metabob/vessel-bundles.json)

for VESSEL in $VESSELS; do
  AUTO_START=$(jq -r ".${BUNDLE}.vessels.${VESSEL}.autoStart" .metabob/vessel-bundles.json)

  if [ "$AUTO_START" = "true" ]; then
    COMMAND=$(jq -r ".${BUNDLE}.vessels.${VESSEL}.command" .metabob/vessel-bundles.json)
    echo "  Starting: $VESSEL"
    eval "$COMMAND &"
    sleep 1
  else
    echo "  Registered: $VESSEL (manual start)"
  fi
done

echo "✓ Bundle launched"
```

**Usage:**
```bash
./launch-bundle.sh development
```

---

## Shape-Based Routing Example

### Activity with Multiple Vessel Types

```json
{
  "id": "comprehensive-debug",
  "tasks": [
    {
      "id": "get-terminal-state",
      "outputShapes": ["terminalState"]
    },
    {
      "id": "query-database",
      "outputShapes": ["query_result"]
    },
    {
      "id": "read-logs",
      "outputShapes": ["file_content"]
    },
    {
      "id": "analyze-all",
      "inputShapes": ["terminalState", "query_result", "file_content"],
      "resolver": "llm"
    }
  ]
}
```

### Discovery Resolution

```typescript
const activity = await loadActivity('comprehensive-debug')

for (const task of activity.tasks) {
  for (const shape of task.outputShapes || []) {
    const vessel = await discovery.resolveShape(shape)

    if (!vessel) {
      throw new Error(`No vessel found for shape: ${shape}`)
    }

    console.log(`Task ${task.id} will use ${vessel.name} for ${shape}`)
  }
}
```

**Output:**
```
Task get-terminal-state will use Terminal Vessel for terminalState
Task query-database will use Database Vessel for query_result
Task read-logs will use File Vessel for file_content
Task analyze-all will use LLM Resolver for analysis
```

---

## Testing Vessel Discovery

### 1. Test Backend Discovery

```bash
# Start terminal vessel
cd repos/terminal
bun run src/index.ts --port 9137 &

# Verify registration
curl http://localhost:9137/health
# Returns: {"status":"ok","vessel":"terminal","shapes":["terminalState",...]}

# Query backend
curl https://activity.metabob.com/v2/vessels/list
# Should include terminal-vessel-1
```

### 2. Test Config Discovery

```bash
# Create config
cat > .metabob/config.json <<'EOF'
{
  "vessels": {
    "terminal": {
      "endpoint": "http://localhost:9137",
      "capabilities": ["terminalState"]
    }
  }
}
EOF

# Run discovery
bun run demos/vessel-discovery-demo.ts
# Should find vessel from config
```

### 3. Test Introspection Discovery

```bash
# Ensure package.json has scripts
cat package.json | jq '.scripts'

# Run discovery
bun run demos/vessel-discovery-demo.ts
# Should discover npm:test, npm:build, etc.
```

---

## Next Steps

1. **Implement VesselDiscoveryService** in MiniBob
2. **Create vessel bundle configs** for common setups
3. **Add health checking** to vessel discovery
4. **Build shape index** for fast routing
5. **Add WebSocket support** for live vessel updates

## References

- `docs/architecture/VESSEL_DISCOVERY_AND_INTERACTION.md` - Complete architecture
- `repos/terminal/src/index.ts` - Vessel registration implementation
- `repos/minibob/src/config.ts` - Config-based discovery
- `demos/vessel-discovery-demo.ts` - Working demo code
