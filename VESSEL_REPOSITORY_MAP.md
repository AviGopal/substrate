# Vessel Repository Mapping

## Local Repos → GitHub Remotes

| Local Path | Vessel Name | SSH URL | HTTPS URL (if public) |
|------------|-------------|---------|----------------------|
| `repos/metabob-opencode/` | **opencode** | `git@github.com:avigopal/opencode` | - |
| `repos/metabob-rpc-api/` | **rpc-api** | `git@github.com:metabobproject/metabob-rpc-api` | - |
| `repos/platform/` | **platform** | `git@github.com:MetabobProject/platform.git` | - |
| `repos/metabob-proto/` | **proto** | `git@github.com:metabob-labs/metabob-devbob.git` | - |
| `repos/metabob-cli/` | **cli** | *(check remote)* | - |
| `repos/metabob-dashboard/` | **dashboard** | *(check remote)* | - |
| `repos/cpg-inference/` | **cpg** | *(check remote)* | - |

## Authentication Methods

### Current Repos Use SSH

All repos use SSH URLs (`git@github.com:org/repo`), which requires:

1. **SSH Key mounted in devbob pod**
2. **OR convert to HTTPS with GITHUB_TOKEN**

---

## Option 1: Mount SSH Key (Recommended for Multiple Repos)

### Create Secret with SSH Key
```bash
# From your local machine
kubectl create secret generic github-ssh-key \
  --from-file=id_rsa=$HOME/.ssh/id_rsa \
  --from-file=id_rsa.pub=$HOME/.ssh/id_rsa.pub \
  --from-file=known_hosts=$HOME/.ssh/known_hosts \
  -n metabob
```

### Update Deployment
```yaml
# In repos/platform/metabob-apps/charts/devbob/charts/templates/deployment.yaml

# Add volume
volumes:
  - name: ssh-key
    secret:
      secretName: github-ssh-key
      defaultMode: 0400  # Read-only for owner

# Add volumeMount
volumeMounts:
  - name: ssh-key
    mountPath: /root/.ssh
    readOnly: true
```

### Test Clone
```bash
kubectl exec -n metabob devbob-pod -- \
  git clone git@github.com:avigopal/opencode /workspace/opencode
```

---

## Option 2: HTTPS with GITHUB_TOKEN (Simpler, Less Secure)

### Convert SSH URLs to HTTPS
```bash
# SSH format:
git@github.com:avigopal/opencode

# HTTPS format with token:
https://oauth2:${GITHUB_TOKEN}@github.com/avigopal/opencode.git
```

### Create Secret with Token
```bash
kubectl create secret generic github-token \
  --from-literal=token=ghp_yourTokenHere \
  -n metabob
```

### Update Deployment
```yaml
env:
  - name: GITHUB_TOKEN
    valueFrom:
      secretKeyRef:
        name: github-token
        key: token
```

### Test Clone
```bash
kubectl exec -n metabob devbob-pod -- sh -c '
  git clone https://oauth2:${GITHUB_TOKEN}@github.com/avigopal/opencode.git /workspace/opencode
'
```

---

## Vessel Configuration for Each Repo

### Vessel: opencode (metabob-opencode)
```json
{
  "vesselName": "opencode",
  "repoUrl": "git@github.com:avigopal/opencode",
  "branch": "main",
  "language": "TypeScript",
  "packageManager": "bun",
  "testCommand": "bun test",
  "buildCommand": "bun run build"
}
```

### Vessel: rpc-api (metabob-rpc-api)
```json
{
  "vesselName": "rpc-api",
  "repoUrl": "git@github.com:metabobproject/metabob-rpc-api",
  "branch": "develop",
  "language": "Python",
  "packageManager": "pip",
  "testCommand": "pytest",
  "buildCommand": "python setup.py build"
}
```

### Vessel: platform (MetabobProject/platform)
```json
{
  "vesselName": "platform",
  "repoUrl": "git@github.com:MetabobProject/platform.git",
  "branch": "feat/add-redis-to-dev-storage",
  "language": "Mixed (Go, Python, Helm)",
  "packageManager": "multiple",
  "testCommand": "make test",
  "buildCommand": "make build"
}
```

### Vessel: proto (metabob-devbob)
```json
{
  "vesselName": "proto",
  "repoUrl": "git@github.com:metabob-labs/metabob-devbob.git",
  "branch": "main",
  "language": "Mixed (TypeScript, Python, JSON)",
  "packageManager": "npm",
  "testCommand": "npm test",
  "buildCommand": "npm run build"
}
```

---

## Quick Test with SSH Key

### 1. Copy Your SSH Key to K8s
```bash
# Create secret from your SSH key
kubectl create secret generic github-ssh-key \
  --from-file=id_rsa=$HOME/.ssh/id_rsa \
  --from-file=known_hosts=<(ssh-keyscan github.com) \
  -n metabob \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 2. Mount in devbob pod (requires redeploy)
Update `repos/platform/metabob-apps/charts/devbob/charts/templates/deployment.yaml`

### 3. Test immediately (without redeploy)
```bash
# Copy SSH key directly into running pod (temporary)
kubectl exec -n metabob devbob-pod -- mkdir -p /root/.ssh
kubectl cp ~/.ssh/id_rsa metabob/devbob-pod:/root/.ssh/id_rsa
kubectl cp ~/.ssh/id_rsa.pub metabob/devbob-pod:/root/.ssh/id_rsa.pub
kubectl exec -n metabob devbob-pod -- chmod 600 /root/.ssh/id_rsa
kubectl exec -n metabob devbob-pod -- ssh-keyscan github.com >> /root/.ssh/known_hosts

# Now test clone
kubectl exec -n metabob devbob-pod -- \
  git clone git@github.com:avigopal/opencode /workspace/opencode
```

---

## Activity Variables for Each Vessel

### For vessel-codebase-pull-and-validate Activity

**Vessel: opencode**
```json
{
  "repoUrl": "git@github.com:avigopal/opencode",
  "vesselName": "opencode",
  "branch": "main",
  "gitUserName": "DevBob Agent",
  "gitUserEmail": "devbob@metabob.local",
  "skipTestsOnFailure": true,
  "hasGitHubToken": false
}
```

**Vessel: rpc-api**
```json
{
  "repoUrl": "git@github.com:metabobproject/metabob-rpc-api",
  "vesselName": "rpc-api",
  "branch": "develop",
  "gitUserName": "DevBob Agent",
  "gitUserEmail": "devbob@metabob.local",
  "skipTestsOnFailure": true,
  "hasGitHubToken": false
}
```

**Vessel: platform**
```json
{
  "repoUrl": "git@github.com:MetabobProject/platform.git",
  "vesselName": "platform",
  "branch": "feat/add-redis-to-dev-storage",
  "gitUserName": "DevBob Agent",
  "gitUserEmail": "devbob@metabob.local",
  "skipTestsOnFailure": true,
  "hasGitHubToken": false
}
```

---

## Recommended: Mount SSH Key Permanently

### Edit Helm Values
```yaml
# In repos/platform/metabob-apps/charts/devbob/values/default.devbob.secrets.yaml
sshKey:
  enabled: true
  privateKey: "${SSH_PRIVATE_KEY}"
  publicKey: "${SSH_PUBLIC_KEY}"
```

### Update Deployment Template
```yaml
# In repos/platform/metabob-apps/charts/devbob/charts/templates/deployment.yaml

# Add to volumes:
{{- if .Values.sshKey.enabled }}
- name: ssh-key
  secret:
    secretName: {{ include "devbob.fullname" . }}-ssh
    defaultMode: 0400
{{- end }}

# Add to volumeMounts:
{{- if .Values.sshKey.enabled }}
- name: ssh-key
  mountPath: /root/.ssh
  readOnly: true
{{- end }}
```

### Create SSH Secret
```yaml
# In repos/platform/metabob-apps/charts/devbob/charts/templates/secret-ssh.yaml
{{- if .Values.sshKey.enabled }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "devbob.fullname" . }}-ssh
  labels:
    {{- include "devbob.labels" . | nindent 4 }}
type: Opaque
stringData:
  id_rsa: {{ .Values.sshKey.privateKey | quote }}
  id_rsa.pub: {{ .Values.sshKey.publicKey | quote }}
  known_hosts: |
    github.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CTZJKR1S2XVnxsZsBcN8jBdZCnIr3yVD3U7c3R0Z5jYkzSqQpCp4CqGqRWDwmKyZNjXEZfNSRvmJxTvxBVs3D1oVqxRZKlYr6Fv+hI/OYxUCcLm3R3sUjOc7VQpKYZ+bLsWjE6IhZsCkYpLDKC0Q==
{{- end }}
```

### Deploy with SSH Key
```bash
cd repos/platform/metabob-apps
export SSH_PRIVATE_KEY=$(cat ~/.ssh/id_rsa)
export SSH_PUBLIC_KEY=$(cat ~/.ssh/id_rsa.pub)
export $(grep ANTHROPIC ../../.env | xargs)
helmfile -e default --selector 'name=devbob' sync
```

---

## Testing Checklist

- [ ] Create GitHub SSH secret
- [ ] Mount SSH key in devbob pod
- [ ] Test clone avigopal/opencode
- [ ] Test clone metabobproject/metabob-rpc-api
- [ ] Test clone MetabobProject/platform
- [ ] Run vessel-codebase-pull-and-validate on each
- [ ] Verify all vessel workflows work

---

**Next Step:** Mount SSH key and test cloning avigopal/opencode
