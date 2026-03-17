# Secrets Management for Activity System

## Overview

This directory contains secrets configuration for different deployment environments.

## Local Development (docker-desktop)

For local development, we use plain YAML files that reference environment variables.

### Setup

1. **Set required environment variables**:
   ```bash
   export ANTHROPIC_API_KEY="your-anthropic-api-key-here"
   ```

2. **Create secrets file**:
   ```bash
   cp local.yaml.template local.yaml
   # Edit local.yaml and set your values
   ```

3. **Deploy with secrets**:
   ```bash
   helmfile -f helm/helmfile-activity-minimal.yaml \
     --state-values-file helm/secrets/local.yaml \
     -e local apply
   ```

## Production Deployment

For production environments, use one of these secure approaches:

### Option 1: SOPS Encryption (Recommended)

```bash
# Install SOPS
brew install sops

# Create encrypted secrets file
sops helm/secrets/production.enc.yaml

# Deploy with encrypted secrets
helmfile -f helm/helmfile-activity-minimal.yaml \
  --state-values-file helm/secrets/production.enc.yaml \
  -e production apply
```

### Option 2: Kubernetes Secrets

```bash
# Create Kubernetes secret manually
kubectl create secret generic activity-system-secrets \
  --from-literal=anthropic-api-key=sk-... \
  --from-literal=surrealdb-password=... \
  -n activity-system

# Reference in helmfile with existingSecret
```

### Option 3: External Secrets Operator

Use External Secrets Operator to sync from AWS Secrets Manager, Google Secret Manager, or Azure Key Vault.

## Security Best Practices

1. ✅ **Never commit secrets to git** - All secrets files are gitignored except templates
2. ✅ **Use environment variables** - Reference `${ENV_VAR}` in YAML files
3. ✅ **Encrypt for production** - Use SOPS or cloud-native secret managers
4. ✅ **Rotate regularly** - Change API keys and passwords periodically
5. ✅ **Principle of least privilege** - Only grant necessary permissions

## Required Secrets

### Anthropic API Key (minibob)
- **Purpose**: LLM API access for autonomous vessel
- **Format**: `sk-ant-...`
- **Get from**: https://console.anthropic.com/

### SurrealDB Password
- **Purpose**: Database authentication
- **Format**: Any strong password
- **Generate**: `openssl rand -base64 32`

### Activity API Session Secret
- **Purpose**: JWT token signing
- **Format**: 32+ character hex string
- **Generate**: `openssl rand -hex 32`

## Troubleshooting

### Error: "ANTHROPIC_API_KEY not set"
```bash
# Set the environment variable
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Verify it's set
echo $ANTHROPIC_API_KEY
```

### Error: "secrets file not found"
```bash
# Create from template
cp helm/secrets/local.yaml.template helm/secrets/local.yaml

# Edit with your values
vi helm/secrets/local.yaml
```

### Error: "permission denied"
```bash
# Fix file permissions
chmod 600 helm/secrets/*.yaml
```

## Files

- `local.yaml` - Local development secrets (gitignored)
- `testing.yaml` - Testing environment secrets (gitignored)
- `production.enc.yaml` - Production secrets (SOPS encrypted, can be committed)
- `*.template.yaml` - Templates for creating secrets files
- `.gitignore` - Ensures secrets are not committed
- `README.md` - This file
