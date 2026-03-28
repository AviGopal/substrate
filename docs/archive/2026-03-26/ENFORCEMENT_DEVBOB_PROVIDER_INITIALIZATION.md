# Enforcement Summary: DevBob Provider Initialization

## Root Cause Analysis

### Primary Issue
**Read-only mount at `/workspace/.config/opencode` prevents package installation and config writes**

- K8s deployment mounts ConfigMap at `/workspace/.config/opencode` as read-only
- OpenCode tries to create `package.json` and install SDK packages in this directory
- Write operations fail with `EROFS: read-only file system` error
- This causes ProviderInitError during SDK initialization

### Secondary Issue  
**ConfigMap uses `${ANTHROPIC_API_KEY}` syntax which doesn't work in static JSON**

- Static JSON files cannot perform bash-style environment variable substitution
- The apiKey field ends up as literal string `"${ANTHROPIC_API_KEY}"` instead of actual key value
- Provider initialization fails because apiKey is not valid

### Tertiary Issue
**K8s deployment doesn't use devbob-entrypoint.sh initialization script**

- Deployment runs `opencode acp` directly
- Entrypoint script never executes
- Config file is never created with proper environment variable substitution

## Investigation Findings

| Finding | Status | Verification |
|---------|--------|--------------|
| Cache directory `/root/.cache/opencode` is writable | ✅ VERIFIED | `mkdir -p /root/.cache/opencode/test && echo success` → success |
| `ANTHROPIC_API_KEY` environment variable is set | ✅ VERIFIED | `env \| grep ANTHROPIC_API_KEY` → ANTHROPIC_API_KEY=sk-ant-api03-... |
| Workspace is read-write | ✅ VERIFIED | `touch /workspace/testfile.txt` → SUCCESS |
| `/workspace/.config/opencode` is mounted read-only | ❌ ROOT CAUSE | `mount \| grep workspace` → ro,relatime,discard |
| `@ai-sdk/anthropic` package installs successfully | ✅ VERIFIED | `bun add @ai-sdk/anthropic@latest` → installed @ai-sdk/anthropic@3.0.58 |
| SDK module can be imported and initialized | ✅ VERIFIED | `bun -e 'import(...); createAnthropic({...})'` → SDK created: function |

## Changes Applied

### 1. helm/charts/devbob/templates/deployment.yaml

**Change**: Added initContainer to copy ConfigMap to writable location with environment variable substitution

**Before**:
```yaml
spec:
  serviceAccountName: {{ include "devbob.fullname" . }}
  containers:
  - name: devbob
    # ... container spec
    volumeMounts:
    - name: config
      mountPath: /workspace/.config/opencode
      readOnly: true  # ❌ READ-ONLY MOUNT
```

**After**:
```yaml
spec:
  serviceAccountName: {{ include "devbob.fullname" . }}
  initContainers:
  - name: setup-config
    image: busybox:latest
    command:
    - sh
    - -c
    - |
      mkdir -p /workspace/.config/opencode
      cp /config-readonly/opencode.json /workspace/.config/opencode/opencode.json
      # Substitute environment variables
      sed -i "s/\${ANTHROPIC_API_KEY}/$ANTHROPIC_API_KEY/g" /workspace/.config/opencode/opencode.json
      sed -i "s/\${METABOB_API_KEY}/$METABOB_API_KEY/g" /workspace/.config/opencode/opencode.json
    env:
    - name: ANTHROPIC_API_KEY
      valueFrom:
        secretKeyRef:
          name: {{ include "devbob.fullname" . }}-secrets
          key: anthropic-api-key
    - name: METABOB_API_KEY
      valueFrom:
        secretKeyRef:
          name: {{ include "devbob.fullname" . }}-secrets
          key: metabob-api-key
    volumeMounts:
    - name: workspace
      mountPath: /workspace
    - name: config
      mountPath: /config-readonly
      readOnly: true
  containers:
  - name: devbob
    # ... container spec
    volumeMounts:
    - name: workspace
      mountPath: /workspace
    # ✅ Config now in /workspace/.config/opencode (writable)
```

**Reason**: Allows ConfigMap to be mounted read-only while still providing writable config directory for opencode. Init container performs environment variable substitution before main container starts.

**Impact Analysis**: 
- Non-breaking change
- Requires pod restart to take effect
- Config is now writable, allowing opencode to create package.json and install SDK packages
- Environment variables are properly substituted into config

## Data Flow After Fix

```
K8s Pod Startup
  → initContainer: setup-config
    → Mount ConfigMap at /config-readonly (read-only)
    → Copy to /workspace/.config/opencode (writable)
    → Substitute ${ANTHROPIC_API_KEY} with actual value
    → Substitute ${METABOB_API_KEY} with actual value
  → Main Container: devbob
    → Read config from /workspace/.config/opencode/opencode.json ✅
    → ANTHROPIC_API_KEY has actual value, not template string ✅
    → Provider initialization succeeds ✅
    → SDK packages install to /root/.cache/opencode ✅
    → opencode run works without ProviderInitError ✅
```

## Validation Plan

1. **Deploy updated Helm chart**
   ```bash
   helm upgrade devbob helm/charts/devbob -n metabob
   ```

2. **Wait for pod to restart**
   ```bash
   kubectl rollout status deployment/devbob -n metabob
   ```

3. **Check initContainer logs**
   ```bash
   kubectl logs -n metabob <pod-name> -c setup-config
   ```
   Expected: "Init container finished successfully"

4. **Verify config file content**
   ```bash
   kubectl exec -n metabob <pod-name> -- cat /workspace/.config/opencode/opencode.json | grep apiKey
   ```
   Expected: `"apiKey": "sk-ant-api03-..."` (actual key, not template)

5. **Test opencode run**
   ```bash
   kubectl exec -n metabob <pod-name> -- opencode run "What is 2+2?"
   ```
   Expected: No ProviderInitError, successful execution

## Component Annotations

### helm/charts/devbob/templates/deployment.yaml:initContainers
- **Purpose**: Copy ConfigMap to writable location with environment variable substitution
- **Design Decision**: Use initContainer pattern instead of modifying opencode code
- **Reason**: Keeps infrastructure concerns separate from application code. Allows ConfigMap to remain read-only for security while still enabling runtime config customization.

### helm/charts/devbob/templates/deployment.yaml:volumeMounts
- **Purpose**: Remove read-only config mount from main container
- **Design Decision**: Config now created by initContainer in workspace PVC
- **Reason**: Workspace PVC is already writable, reuse it instead of requiring separate writable volume for config.

## Related Files

- Helm deployment: `helm/charts/devbob/templates/deployment.yaml` (MODIFIED)
- ConfigMap: `helm/charts/devbob/templates/configmap.yaml` (NO CHANGES NEEDED)
- OpenCode provider: `repos/metabob-opencode/packages/opencode/src/provider/provider.ts` (NO CHANGES NEEDED)
- OpenCode global paths: `repos/metabob-opencode/packages/opencode/src/global/index.ts` (NO CHANGES NEEDED)

## Success Criteria

- ✅ initContainer successfully creates `/workspace/.config/opencode/opencode.json`
- ✅ Environment variables are substituted correctly
- ✅ Main container can read and write to `/workspace/.config/opencode`
- ✅ OpenCode provider initialization succeeds
- ✅ `opencode run` command executes without ProviderInitError
- ✅ SDK packages install successfully to `/root/.cache/opencode`

## Rollback Plan

If the fix doesn't work:
1. Revert Helm chart: `helm rollback devbob -n metabob`
2. Check initContainer logs for errors
3. Verify environment variables are properly set in secrets
4. Consider alternative approaches (see enforcement impulse)

