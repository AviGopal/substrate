# Helmfile Configuration Management

## Overview

OpenCode configuration is now properly managed through Kubernetes ConfigMaps in the Helm chart, following GitOps best practices.

## Architecture

```
Helmfile Values (Git)
    ↓
ConfigMap Template (Helm)
    ↓
ConfigMap (Kubernetes)
    ↓
Mounted to Pod (/root/.config/opencode/opencode.json)
    ↓
OpenCode Reads Config at Runtime
```

## Configuration Structure

### 1. Values File (Source of Truth)
**Location**: `repos/platform/metabob-apps/charts/opencode-server/values/production.opencode-server.values.yaml`

```yaml
opencode:
  hostname: "0.0.0.0"
  port: 8080
  
  config:
    share: "disabled"
    
    sessionMemory:
      enabled: true
      analysis:
        timeout: 10000
        model: "claude-3-5-haiku-20241022"
        provider: "anthropic"
      budgets:
        perImpulse: 2000
        total: 10000
      maxImpulsesPerTurn: 5
    
    metabob:
      enabled: true
      max_issues: 5
      min_severity: "MEDIUM"
      inject_annotations: true
      auto_impact_analysis: true
      cli_path: "metabob-cli"
      auto_inject: true
      template_auto_registration:
        enabled: true
        behavior: "best-effort"
        strategy: "on-create"
```

### 2. ConfigMap Template
**Location**: `repos/platform/metabob-apps/charts/opencode-server/charts/templates/configmap.yaml`

Renders the values into a Kubernetes ConfigMap with `opencode.json` key.

### 3. Deployment Mount
**Location**: `repos/platform/metabob-apps/charts/opencode-server/charts/templates/deployment.yaml`

```yaml
volumeMounts:
- name: opencode-config
  mountPath: /root/.config/opencode
  readOnly: true

volumes:
- name: opencode-config
  configMap:
    name: {{ include "opencode-server.fullname" . }}
    items:
    - key: opencode.json
      path: opencode.json
```

## Making Configuration Changes

### Update Session Memory Settings

1. **Edit values file**:
   ```yaml
   opencode:
     config:
       sessionMemory:
         budgets:
           perImpulse: 3000  # Changed from 2000
           total: 15000      # Changed from 10000
   ```

2. **Apply with Helmfile**:
   ```bash
   cd repos/platform/metabob-apps
   helmfile -e production diff --selector name=opencode-server
   helmfile -e production apply --selector name=opencode-server
   ```

3. **Restart pods** (if needed):
   ```bash
   kubectl rollout restart deployment/opencode-server -n metabob
   ```

### Update Metabob Integration

1. **Edit values file**:
   ```yaml
   opencode:
     config:
       metabob:
         enabled: true
         max_issues: 10     # Changed from 5
         min_severity: "LOW"  # Changed from "MEDIUM"
   ```

2. **Apply changes**:
   ```bash
   helmfile -e production apply --selector name=opencode-server
   ```

### Add MCP Server Configuration

1. **Edit values file**:
   ```yaml
   opencode:
     config:
       mcp:
         metabob:
           type: "remote"
           url: "http://metabob-mcp-server:8080"
           enabled: true
   ```

2. **Apply changes**:
   ```bash
   helmfile -e production apply --selector name=opencode-server
   ```

### Add Remote Server Configuration

1. **Edit values file**:
   ```yaml
   opencode:
     config:
       remote:
         staging:
           host: "staging.metabob.com"
           user: "deploy"
           directory: "/var/www/staging"
           port: 22
           auto_sync: false
   ```

2. **Apply changes**:
   ```bash
   helmfile -e production apply --selector name=opencode-server
   ```

## Environment-Specific Configuration

### Production
**File**: `production.opencode-server.values.yaml`
- Conservative memory budgets
- MEDIUM+ severity issues
- Auto-injection enabled

### Integration
**File**: `integration.opencode-server.values.yaml` (if exists)
- Higher memory budgets for testing
- LOW severity issues for thorough testing
- Debug logging enabled

### Default
**File**: `default.opencode-server.values.yaml` (if exists)
- Development settings
- All features enabled

## Verification

### Check ConfigMap
```bash
kubectl get configmap opencode-server -n metabob -o yaml
```

### Check Mounted Config in Pod
```bash
kubectl exec -n metabob deployment/opencode-server -- cat /root/.config/opencode/opencode.json
```

### Check OpenCode is Using Config
```bash
kubectl logs -n metabob -l app.kubernetes.io/name=opencode-server --tail=50 | grep -i config
```

## Benefits of This Approach

✅ **GitOps**: Configuration is version-controlled in Git  
✅ **Environment-specific**: Different configs per environment (prod/staging/dev)  
✅ **Auditable**: All changes tracked in Git history  
✅ **Rollback**: Easy to revert with `git revert` + helmfile apply  
✅ **No Rebuilds**: Change config without rebuilding Docker image  
✅ **Secrets Separation**: API keys still in Secrets, config in ConfigMap  
✅ **Declarative**: Helmfile manages the desired state  

## Comparison: Before vs After

### ❌ Before (Baked into Image)
- Config hardcoded in Dockerfile or entrypoint script
- Change config → rebuild image → push → deploy
- Different images per environment
- No Git history of config changes
- Can't see config without inspecting container

### ✅ After (Helmfile-Managed ConfigMap)
- Config in values.yaml (Git)
- Change config → edit values → helmfile apply
- Same image, different configs per environment
- Full Git history and diffs
- View config with `kubectl get configmap`

## Migration Notes

The Docker image still contains a default `opencode.json`, but the Kubernetes deployment **overrides** it by mounting the ConfigMap at `/root/.config/opencode/opencode.json`.

OpenCode's config resolution order:
1. `/root/.config/opencode/opencode.json` (our mounted ConfigMap) ← **Used**
2. `./opencode.json` (current directory)
3. Baked-in defaults

## Troubleshooting

### Config Not Applied
```bash
# Check ConfigMap exists
kubectl get configmap -n metabob | grep opencode

# Check ConfigMap content
kubectl describe configmap opencode-server -n metabob

# Check volume mount
kubectl get pod -n metabob -l app.kubernetes.io/name=opencode-server -o yaml | grep -A 10 volumeMounts

# Restart deployment
kubectl rollout restart deployment/opencode-server -n metabob
```

### Invalid JSON
```bash
# Validate ConfigMap rendering
cd repos/platform/metabob-apps
helmfile -e production template --selector name=opencode-server | grep -A 50 "kind: ConfigMap"

# Check for JSON syntax errors
helmfile -e production template --selector name=opencode-server | grep -A 50 "opencode.json" | jq .
```

## Future Enhancements

- Add validation in CI/CD to ensure opencode.json is valid JSON
- Add schema validation against OpenCode's JSON schema
- Support multiple config profiles (dev, debug, minimal)
- Auto-generate values from OpenCode schema
