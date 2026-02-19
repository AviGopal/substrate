# Session Summary - Configuration Management via Helmfile

## Date: 2026-02-19

## What We Fixed

### Problem
OpenCode configuration was hardcoded in the Docker image or entrypoint script, requiring image rebuilds for config changes and not following GitOps best practices.

### Solution
Implemented proper Kubernetes ConfigMap-based configuration management through Helmfile.

## Changes Made

### 1. Created ConfigMap Template ✅
**File**: `repos/platform/metabob-apps/charts/opencode-server/charts/templates/configmap.yaml`

- Renders `opencode.json` from Helm values
- Supports all OpenCode configuration sections:
  - sessionMemory
  - metabob integration
  - mcp servers
  - remote servers

### 2. Updated Values File ✅
**File**: `repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml`

Added complete OpenCode configuration structure:
```yaml
opencode:
  config:
    share: "disabled"
    sessionMemory:
      enabled: true
      analysis:
        timeout: 10000
        model: "claude-3-5-haiku-20241022"
      budgets:
        perImpulse: 2000
        total: 10000
    metabob:
      enabled: true
      max_issues: 5
      min_severity: "MEDIUM"
      inject_annotations: true
      auto_impact_analysis: true
```

### 3. Updated Deployment Template ✅
**File**: `repos/platform/metabob-apps/charts/opencode-server/charts/templates/deployment.yaml`

Added ConfigMap volume mount:
```yaml
volumeMounts:
- name: opencode-config
  mountPath: /root/.config/opencode
  readOnly: true

volumes:
- name: opencode-config
  configMap:
    name: {{ include "opencode-server.fullname" . }}
```

### 4. Updated Chart Version ✅
**File**: `repos/platform/metabob-apps/charts/opencode-server/charts/Chart.yaml`

- Version: 1.0.0 → 1.0.1
- AppVersion: 1.0.0 → 1.0.1

### 5. Created Documentation ✅
**File**: `HELMFILE_CONFIG_MANAGEMENT.md`

Comprehensive guide on:
- Configuration architecture
- Making configuration changes
- Environment-specific configs
- Troubleshooting

### 6. Created Test Script ✅
**File**: `test-helm-config.sh`

Validates:
- Helm chart syntax
- Template rendering
- ConfigMap presence
- Volume mount configuration
- Valid Kubernetes manifests

## Verification

### ConfigMap Renders Correctly ✅
```bash
./test-helm-config.sh
```

Output shows properly rendered `opencode.json` ConfigMap:
- ✓ Helm chart syntax valid
- ✓ Templates rendered successfully
- ✓ ConfigMap found
- ✓ Volume mount configured
- ✓ Valid Kubernetes manifest

### Rendered Config Sample
```json
{
  "$schema": "https://opencode.ai/config.json",
  "share": "disabled",
  "sessionMemory": {
    "enabled": true,
    "analysis": {
      "timeout": 10000,
      "model": "claude-3-5-haiku-20241022",
      "provider": "anthropic"
    },
    "budgets": {
      "perImpulse": 2000,
      "total": 10000
    },
    "maxImpulsesPerTurn": 5
  },
  "metabob": {
    "enabled": true,
    "max_issues": 5,
    "min_severity": "MEDIUM",
    "inject_annotations": true,
    "auto_impact_analysis": true,
    "cli_path": "metabob-cli",
    "auto_inject": true,
    "template_auto_registration": {
      "enabled": true,
      "behavior": "best-effort",
      "strategy": "on-create"
    }
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Git Repository (Source of Truth)                        │
│  └─ production.opencode-server.values.yaml              │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Helmfile Apply
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Kubernetes ConfigMap                                     │
│  └─ opencode-server                                     │
│     └─ data.opencode.json                               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Volume Mount
                  ▼
┌─────────────────────────────────────────────────────────┐
│ Pod: opencode-server                                     │
│  └─ /root/.config/opencode/opencode.json                │
│     (ConfigMap mounted as read-only file)               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  │ Config Load
                  ▼
┌─────────────────────────────────────────────────────────┐
│ OpenCode Process                                         │
│  └─ Reads config at startup                             │
│  └─ Uses configuration for runtime behavior             │
└─────────────────────────────────────────────────────────┘
```

## Benefits

### ✅ GitOps Compliant
- Configuration is version-controlled in Git
- All changes tracked with commit history
- Auditable and reviewable
- Easy rollback with `git revert`

### ✅ Environment-Specific
- Different configs per environment (prod/staging/dev)
- Same Docker image, different configurations
- No image rebuilds for config changes

### ✅ Declarative Management
- Helmfile manages desired state
- Drift detection with `helmfile diff`
- Idempotent apply operations

### ✅ No Rebuilds Required
- Change config → edit values.yaml → helmfile apply
- No Docker build/push cycle
- Faster iteration

### ✅ Secrets Separation
- Sensitive data (API keys) in Kubernetes Secrets
- Configuration in ConfigMap
- Proper security boundaries

## Comparison: Before vs After

| Aspect | Before (Baked) | After (ConfigMap) |
|--------|----------------|-------------------|
| **Config Location** | Dockerfile/entrypoint | values.yaml (Git) |
| **Change Process** | Rebuild → Push → Deploy | Edit → Helmfile apply |
| **Version Control** | ❌ No Git history | ✅ Full Git history |
| **Environment Management** | Different images | Same image, different configs |
| **Visibility** | Inspect container | `kubectl get configmap` |
| **Rollback** | Redeploy old image | `git revert` + apply |
| **Validation** | Runtime errors | Pre-deploy validation |

## Deployment Workflow

### Current State
1. ✅ Multi-stage Dockerfile created (v1.0.1)
2. ✅ ConfigMap template created
3. ✅ Values file updated with config
4. ✅ Deployment updated with volume mount
5. ✅ Test script validates everything
6. 🔄 Docker build in progress (--no-cache)

### Next Steps
1. **Wait for Docker build** to complete (~5-10 min)
2. **Test binary**: `docker run --rm metabobapp/devbob:v1.0.1 --help`
3. **Push image**: `docker push metabobapp/devbob:v1.0.1`
4. **Deploy with Helmfile**: `./helmfile-deploy-v1.0.1.sh`
5. **Verify ConfigMap**: `kubectl get configmap opencode-server -n metabob -o yaml`
6. **Verify mounted config**: `kubectl exec -n metabob deployment/opencode-server -- cat /root/.config/opencode/opencode.json`
7. **Test Slack bot**: Send "Hello" and verify AI response

## Making Config Changes (Examples)

### Example 1: Increase Memory Budget
```yaml
# Edit: production.opencode-server.values.yaml
opencode:
  config:
    sessionMemory:
      budgets:
        perImpulse: 3000  # ← Changed from 2000
        total: 15000      # ← Changed from 10000
```

Apply:
```bash
helmfile -e production diff --selector name=opencode-server
helmfile -e production apply --selector name=opencode-server
kubectl rollout restart deployment/opencode-server -n metabob
```

### Example 2: Disable Metabob Integration
```yaml
# Edit: production.opencode-server.values.yaml
opencode:
  config:
    metabob:
      enabled: false  # ← Changed from true
```

Apply (same commands as above)

### Example 3: Add MCP Server
```yaml
# Edit: production.opencode-server.values.yaml
opencode:
  config:
    mcp:
      metabob:
        type: "remote"
        url: "http://metabob-mcp-server:8080"
        enabled: true
```

Apply (same commands as above)

## Files Modified

```
repos/platform/metabob-apps/
├── charts/opencode-server/
│   ├── charts/
│   │   ├── Chart.yaml                          # Version bumped to 1.0.1
│   │   └── templates/
│   │       ├── configmap.yaml                  # ✨ NEW: ConfigMap template
│   │       └── deployment.yaml                 # ✨ UPDATED: Volume mount added
│   └── values/
│       └── production.opencode-server.values.yaml  # ✨ UPDATED: Config structure added

Documentation:
├── HELMFILE_CONFIG_MANAGEMENT.md              # ✨ NEW: Comprehensive guide
├── SESSION_SUMMARY_CONFIG_MANAGEMENT.md       # ✨ NEW: This summary
└── test-helm-config.sh                         # ✨ NEW: Validation script
```

## Key Takeaways

1. **Configuration belongs in Git**, not in Docker images
2. **Helm ConfigMaps** are the proper way to manage app config in Kubernetes
3. **Helmfile** provides declarative, GitOps-compliant deployment workflow
4. **Separation of concerns**: Code (image) vs Config (ConfigMap) vs Secrets (Secret)
5. **Environment-specific configs** enable proper SDLC (dev/staging/prod)

## Status

- ✅ ConfigMap implementation complete
- ✅ Helm templates validated
- ✅ Documentation created
- 🔄 Docker v1.0.1 build in progress
- ⏳ Awaiting deployment and testing

Ready to deploy once Docker build completes!
