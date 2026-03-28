# OpenCode MiniBob Integration Configuration Fix

## Problem
OpenCode was configured with `minibob.enabled: true` but missing the `minibob.url` field. This caused the MiniBob integration to fall back to the default endpoint without explicitly configured backend URL.

## Solution
Added `minibob.url` to the OpenCode configuration in `repos/metabob-opencode/packages/opencode/opencode.json`:

```json
"minibob": {
  "enabled": true,
  "url": "http://api.minibob.local",
  "timeout": 30000,
  "fallback_to_local": true
}
```

## How It Works

### Configuration Flow
1. **OpenCode loads config** from `opencode.json`
2. **MinibobIntegration.initialize()** is called for each session
3. **MCP client initialization** uses `config.minibob?.url || "http://api.minibob.local"`
4. **MiniBob library** connects to backend for Thompson Sampling

### Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenCode Session                          │
│                                                               │
│  User calls goal({ goal, context, options })                │
│    ↓                                                          │
│  MinibobIntegration.submitGoal()                            │
│    ↓                                                          │
│  Initialize executor with config:                            │
│    - provider: anthropic/openai                              │
│    - apiKey: from config                                     │
│    - model: claude-sonnet-4-20250514                        │
│    - workingDirectory: Instance.directory                    │
│    - customTools: MCP tools from OpenCode                    │
│    ↓                                                          │
│  Initialize MiniBob MCP client:                              │
│    - endpoint: http://api.minibob.local                      │
│    - timeout: 30000ms                                        │
│    ↓                                                          │
│  GoalProcessor.executeGoal(goal, context, options)          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│              MiniBob Library (@metabob/minibob)              │
│                                                               │
│  GoalProcessor.getRecommendations():                         │
│    ↓                                                          │
│  MCPClient.recommendActivities(                              │
│    taskDescription: goal.intent,                             │
│    category: goal.type,                                      │
│    loadedImpulses: impulseIds,                               │
│    limit: 3                                                  │
│  )                                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│         Backend API (metabob-activity-api)                   │
│         http://api.minibob.local                             │
│                                                               │
│  POST /v2/activities/recommend                               │
│    - Thompson Sampling algorithm                             │
│    - Historical execution data                               │
│    - Returns ranked recommendations                          │
└─────────────────────────────────────────────────────────────┘
```

## MiniBob as Library Integration

### Key Principle
**MiniBob should be a library that we embed in anything, not just a standalone service.**

### What This Means for OpenCode

1. **Library Integration** ✅
   - OpenCode imports `@metabob/minibob` as a dependency
   - Each session gets its own `ActivityExecutor` instance
   - OpenCode's MCP tools are passed as `customTools` to MiniBob

2. **Application Code as Composable Activities**
   - OpenCode's existing tools (bash, read, write, edit, etc.) become available to MiniBob
   - MiniBob can use these tools when executing activities
   - Activities can compose OpenCode's functionality

3. **Backend for Learning**
   - Backend (metabob-activity-api) stores execution traces
   - Thompson Sampling recommends best activities based on history
   - Pattern recognition and learning happen server-side
   - MiniBob library remains lightweight (~3k LOC)

### Two Integration Types

**Type 1: Docker Deployment (vessel mode)**
- MiniBob runs as standalone container
- Has its own set of tools (bash, read, write, git, etc.)
- Connects to backend for activity templates and learning
- Used for: Boredom activities, autonomous development

**Type 2: Library Embedding (application mode)** ← **This is what OpenCode does**
- MiniBob imported as `@metabob/minibob` npm package
- Application provides custom tools to MiniBob
- Application code becomes composable through activities
- Used for: Instrumenting applications with structured workflows

## Configuration Files

### `/repos/metabob-opencode/packages/opencode/opencode.json` (FIXED)
```json
{
  "minibob": {
    "enabled": true,
    "url": "http://api.minibob.local",
    "timeout": 30000,
    "fallback_to_local": true
  }
}
```

### `/repos/metabob-opencode/.opencode/opencode.json` (Already correct)
```json
{
  "minibob": {
    "enabled": true,
    "url": "http://api.minibob.local",
    "timeout": 30000
  }
}
```

## Verification

The integration is verified by checking:

1. **Config loads correctly**: `config.minibob?.url === "http://api.minibob.local"`
2. **MCP client initializes**: `initializeMCP({ endpoint: mcpEndpoint, timeout: 30000 })`
3. **Backend connection**: MiniBob can fetch templates and recommendations
4. **Activity execution**: Activities run through MiniBob's ActivityExecutor

## Next Steps

1. **Deploy backend**: Ensure `http://api.minibob.local` is running (metabob-activity-api)
2. **Build images**: Build Docker images for MiniBob and backend
3. **Deploy to k8s**: Use helmfile to deploy the activity system
4. **Test integration**: Run a goal through OpenCode and verify backend recommendations work

## Files Changed

- `repos/metabob-opencode/packages/opencode/opencode.json`: Added `url` field to `minibob` config

## Architecture Compliance

✅ **Separation of Concerns**
- MiniBob (library): Executes activities, resolves local impulses
- Backend (API): Stores data, Thompson Sampling, resolves all impulse types
- OpenCode (application): Provides tools, UI, session management

✅ **Vessel Architecture**
- OpenCode is a vessel that embeds MiniBob library
- MiniBob provides the process-of-becoming mechanism
- Backend provides learning and storage

✅ **Impulse-Driven**
- Activities use impulses for context injection
- Backend resolves non-local impulse types
- Learning happens through impulse relevance tracking
