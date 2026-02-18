# Slack Bot: Pragmatic Solution

## Problem Summary

1. Current slack-bot (v1.0.2): No opencode binary → crashes
2. DevBob-based image (v1.0.3): 13GB, takes hours to push, runs from source
3. No standalone OpenCode server deployed in production

## Recommended Solution: Deploy Shared OpenCode Server

Instead of embedding OpenCode in each slack-bot pod, deploy ONE shared OpenCode server that all slack-bots connect to.

### Architecture

```
┌─────────────────────────────────┐
│  opencode-server deployment     │
│  Image: devbob:latest           │
│  CMD: opencode acp --port=8080  │
│  Service: opencode-server:8080  │
└───────────────┬─────────────────┘
                │
       ┌────────┴────────┐
       │                 │
┌──────▼──────┐  ┌──────▼──────┐
│ slack-bot-1 │  │ slack-bot-2 │
│ v1.0.2      │  │ v1.0.2      │
│ (light)     │  │ (light)     │
│ 1.56GB      │  │ 1.56GB      │
└─────────────┘  └─────────────┘
```

### Benefits

- ✅ Use existing v1.0.2 image (already pushed)
- ✅ Small image size (1.56GB)
- ✅ Fast deployments
- ✅ Shared OpenCode server (single 13GB image)
- ✅ Can scale slack-bot pods independently
- ✅ Sessions persist on server restart

### Configuration

**OpenCode Server**:
```yaml
image: devbob:latest
command: ["opencode", "acp", "--hostname=0.0.0.0", "--port=8080"]
env:
  - ANTHROPIC_API_KEY: <from-secret>
service:
  port: 8080
```

**Slack Bot**:
```yaml
image: metabobapp/slack-bot:v1.0.2
env:
  - OPENCODE_BACKEND_URL: "http://opencode-server:8080"
  - SLACK_BOT_TOKEN: <from-secret>
  - SLACK_APP_TOKEN: <from-secret>
  - SLACK_SIGNING_SECRET: <from-secret>
```

## Implementation Steps

1. Create `opencode-server` chart
2. Deploy opencode-server to K8s
3. Update slack-bot to use `OPENCODE_BACKEND_URL=http://opencode-server:8080`
4. Deploy slack-bot v1.0.2 (already pushed)
5. Test in Slack

Ready to implement?
