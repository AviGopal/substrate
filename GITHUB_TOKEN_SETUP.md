# GitHub Token Setup for DevBob

## Quick Setup Guide

### Step 1: Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens/new
2. Token name: `devbob-k8s-vessel-access`
3. Expiration: 90 days (or your preference)
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Actions workflows)
   - ✅ `write:packages` (if using GitHub Packages)

5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

### Step 2: Add Token to .env File

```bash
# Add to /home/avi/documents/work/exp-repo/metabob-devbob/.env
echo "GITHUB_TOKEN=ghp_yourTokenHere" >> .env
```

### Step 3: Create Kubernetes Secret

```bash
cd /home/avi/documents/work/exp-repo/metabob-devbob

# Load token from .env
export $(grep GITHUB_TOKEN .env | xargs)

# Create K8s secret
kubectl create secret generic github-credentials \
  --from-literal=token=$GITHUB_TOKEN \
  -n metabob \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify secret created
kubectl get secret github-credentials -n metabob
```

### Step 4: Update DevBob Deployment

The deployment needs to:
1. Mount GITHUB_TOKEN as environment variable
2. Configure git to use token for HTTPS cloning

---

## Automated Setup Script

Run this after creating the token:

```bash
./scripts/setup-github-token.sh
```

---

## Manual Testing (Before Helm Deploy)

Test the token works:

```bash
# Export token
export GITHUB_TOKEN=ghp_yourTokenHere

# Test clone with token
git clone https://oauth2:${GITHUB_TOKEN}@github.com/avigopal/opencode.git /tmp/test-clone

# If successful, cleanup
rm -rf /tmp/test-clone
```

---

## URL Format for Private Repos

### SSH Format (old):
```
git@github.com:avigopal/opencode
```

### HTTPS with Token (new):
```
https://oauth2:${GITHUB_TOKEN}@github.com/avigopal/opencode.git
```

### Vessel Repository URLs

| Repo | HTTPS URL with Token |
|------|---------------------|
| opencode | `https://oauth2:${GITHUB_TOKEN}@github.com/avigopal/opencode.git` |
| rpc-api | `https://oauth2:${GITHUB_TOKEN}@github.com/metabobproject/metabob-rpc-api.git` |
| platform | `https://oauth2:${GITHUB_TOKEN}@github.com/MetabobProject/platform.git` |
| proto | `https://oauth2:${GITHUB_TOKEN}@github.com/metabob-labs/metabob-devbob.git` |

---

## Deployment Configuration

Once token is in K8s secret, the deployment will automatically configure:

1. **Environment Variable**: `GITHUB_TOKEN` from secret
2. **Git Config**: Helper for HTTPS authentication
3. **PR Creation**: `gh` CLI authentication

---

## Verification Steps

After deployment update:

```bash
# Check secret exists
kubectl get secret github-credentials -n metabob

# Check pod has token
kubectl exec -n metabob devbob-pod -- env | grep GITHUB_TOKEN

# Test gh CLI auth
kubectl exec -n metabob devbob-pod -- gh auth status

# Test clone
kubectl exec -n metabob devbob-pod -- sh -c '
  git clone https://oauth2:${GITHUB_TOKEN}@github.com/avigopal/opencode.git /workspace/opencode-test
'
```

---

## Security Notes

- ✅ Token stored in K8s secret (encrypted at rest)
- ✅ Not visible in pod describe
- ✅ Only accessible to devbob pod
- ⚠️ Token has full repo access - rotate regularly
- ⚠️ Do NOT commit token to git

---

## Troubleshooting

### "Authentication failed"
- Check token hasn't expired
- Verify token has `repo` scope
- Test token locally first

### "Repository not found"
- Check token has access to private repos
- Verify organization permissions
- Check repository name spelling

### "gh: command failed"
- Run `gh auth login` or `gh auth status` in pod
- May need to set `GH_TOKEN` in addition to `GITHUB_TOKEN`

---

## Next: Run Vessel Validation

After token is configured:

```bash
# Execute vessel validation activity
kubectl exec -n metabob devbob-pod -- \
  /opt/opencode/bin/opencode activity execute vessel-codebase-pull-and-validate \
  --variable repoUrl="https://oauth2:\${GITHUB_TOKEN}@github.com/avigopal/opencode.git" \
  --variable vesselName="opencode" \
  --variable hasGitHubToken="true"
```
