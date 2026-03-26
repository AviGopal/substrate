# Secrets Setup Guide for Activity System Deployment

## Quick Start (Local docker-desktop)

### 1. Set Required Environment Variables

```bash
# Required: Anthropic API key for minibob LLM access
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Optional: SurrealDB credentials (defaults provided)
export SURREALDB_USERNAME="root"
export SURREALDB_PASSWORD="surrealdb-local-dev-123"
```

### 2. Deploy

```bash
# Simple deployment with auto-build
bash scripts/deploy-activity-system-with-secrets.sh

# Or deploy with helmfile directly
helmfile -f helm/helmfile-activity-minimal.yaml -e local apply
```

### 3. Verify

```bash
# Check pods are running
kubectl get pods -n activity-system

# Run validation
bash scripts/validate-activity-system.sh
```

## Detailed Setup

### Getting Your Anthropic API Key

1. Go to https://console.anthropic.com/
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)

### Setting Environment Variables

#### Temporary (current session only)
```bash
export ANTHROPIC_API_KEY="sk-ant-your-key"
```

#### Persistent (add to ~/.bashrc or ~/.zshrc)
```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-your-key"' >> ~/.bashrc
source ~/.bashrc
```

#### Using .env file (recommended for local dev)
```bash
# Create .env file (gitignored)
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-your-key-here
SURREALDB_USERNAME=root
SURREALDB_PASSWORD=my-secure-password
EOF

# Load environment
source .env

# Deploy
bash scripts/deploy-activity-system-with-secrets.sh
```

## Secrets Architecture

### How Secrets Flow

```
Environment Variables
    ↓
Helmfile Template Rendering
    ↓
Kubernetes Secrets (created by Helm)
    ↓
Pod Environment Variables
    ↓
Application Configuration
```

### Secrets Used

| Secret | Purpose | Required | Default |
|--------|---------|----------|---------|
| `ANTHROPIC_API_KEY` | Minibob LLM access | ✅ Yes | None |
| `SURREALDB_USERNAME` | Database auth | No | `root` |
| `SURREALDB_PASSWORD` | Database auth | No | `surrealdb-local-dev-123` |

### Where Secrets are Used

1. **SurrealDB** (`helm/charts/surrealdb/`)
   - Username/password for database authentication
   - Stored in Kubernetes Secret
   - Mounted as environment variables

2. **metabob-activity-api** (`helm/charts/metabob-activity-api/`)
   - SurrealDB credentials for database connection
   - Session secret for JWT signing (inline, not from env)
   - API keys for authentication (inline, not from env)

3. **minibob** (`repos/minibob/helm/minibob-cluster/`)
   - Anthropic API key for Claude LLM access
   - Stored in Kubernetes Secret `minibob-secrets`
   - Mounted as `ANTHROPIC_API_KEY` environment variable

## Security Best Practices

### ✅ DO

1. **Use environment variables** for local development
2. **Add secrets to .gitignore** (already configured)
3. **Rotate API keys regularly** (every 90 days minimum)
4. **Use different secrets** for each environment (local/testing/production)
5. **Limit API key permissions** to minimum required

### ❌ DON'T

1. **Never commit secrets to git**
2. **Don't share API keys** via email or chat
3. **Don't use production secrets** in local development
4. **Don't log secrets** in application code
5. **Don't store secrets in plain text files** (except local.yaml which is gitignored)

## Production Deployment

For production environments, use one of these secure approaches:

### Option 1: SOPS Encryption (Recommended)

```bash
# Install SOPS
brew install sops

# Configure encryption key (use age or GPG)
age-keygen -o key.txt

# Create encrypted secrets file
sops helm/secrets/production.enc.yaml

# Deploy with encrypted secrets
helmfile -f helm/helmfile-activity-minimal.yaml \
  --state-values-file helm/secrets/production.enc.yaml \
  -e production apply
```

### Option 2: Kubernetes External Secrets

```bash
# Install External Secrets Operator
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  -n external-secrets-system --create-namespace

# Create ExternalSecret resource
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: activity-system-secrets
  namespace: activity-system
spec:
  secretStoreRef:
    name: aws-secretsmanager  # or gcpsm, azurekv
    kind: SecretStore
  target:
    name: activity-system-secrets
  data:
    - secretKey: anthropic-api-key
      remoteRef:
        key: production/anthropic-api-key
EOF
```

### Option 3: Cloud Provider Secret Managers

- **AWS**: AWS Secrets Manager + External Secrets Operator
- **GCP**: Google Secret Manager + External Secrets Operator
- **Azure**: Azure Key Vault + External Secrets Operator

## Troubleshooting

### Error: "ANTHROPIC_API_KEY environment variable is not set"

**Solution**:
```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
# Verify it's set
echo $ANTHROPIC_API_KEY
```

### Error: "minibob.anthropicApiKey is required"

**Cause**: Helmfile template rendering failed because env var is missing.

**Solution**:
```bash
# Set the variable before deployment
export ANTHROPIC_API_KEY="sk-ant-your-key"
helmfile -f helm/helmfile-activity-minimal.yaml -e local apply
```

### Error: "Error: repo helm not found"

**Cause**: Incorrect chart reference in helmfile.

**Solution**: This is a helmfile configuration issue, not a secrets issue. The chart paths should be relative to the helmfile location.

### Secrets not updating after change

**Solution**:
```bash
# Delete existing release
helmfile -f helm/helmfile-activity-minimal.yaml -e local destroy

# Redeploy with new secrets
export ANTHROPIC_API_KEY="new-key-here"
helmfile -f helm/helmfile-activity-minimal.yaml -e local apply
```

## Validation

### Check Secrets are Set Correctly

```bash
# Check SurrealDB secret
kubectl get secret -n activity-system surrealdb -o jsonpath='{.data.password}' | base64 -d
echo

# Check minibob secret
kubectl get secret -n activity-system minibob-secrets -o jsonpath='{.data.anthropic-api-key}' | base64 -d
echo

# Check activity-api secret
kubectl get secret -n activity-system metabob-activity-api -o jsonpath='{.data.surrealdb-password}' | base64 -d
echo
```

### Test API Access

```bash
# Port-forward minibob
kubectl port-forward -n activity-system svc/minibob 8081:8080 &

# Test health endpoint
curl http://localhost:8081/health

# Check logs for API key usage
kubectl logs -n activity-system -l app.kubernetes.io/name=minibob --tail=50
```

## Files Reference

- `helm/secrets/local.yaml` - Local development secrets (gitignored)
- `helm/secrets/README.md` - Secrets management documentation
- `helm/secrets/.gitignore` - Prevents committing secrets
- `scripts/deploy-activity-system-with-secrets.sh` - Deployment script with secrets validation

## Support

If you encounter issues:

1. **Check environment variables are set**: `env | grep -E "(ANTHROPIC|SURREALDB)"`
2. **Verify API key is valid**: Test it in Anthropic Console
3. **Check Kubernetes secrets exist**: `kubectl get secrets -n activity-system`
4. **Review pod logs**: `kubectl logs -n activity-system <pod-name>`
5. **Consult deployment logs**: Review helmfile apply output

## Next Steps

After successful deployment with secrets:

1. ✅ Run validation: `bash scripts/validate-activity-system.sh`
2. ✅ Test API endpoints (see ACTIVITY_SYSTEM_QUICKSTART.md)
3. ✅ Execute test activity via minibob
4. ✅ Verify learning loop closure
5. ✅ Monitor logs for issues
