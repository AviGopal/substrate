# Secrets Management Specification

## Overview

This document defines the centralized secrets management system for metabob-devbob deployment across local, canary, and production environments using SOPS + Age encryption with Helmfile.

**Design Principles:**
1. **Single Source of Truth**: One secrets file per environment
2. **Encryption at Rest**: All secrets encrypted in git using SOPS
3. **Minimal Configuration**: Secrets defined once, referenced everywhere
4. **Deploy from Scratch**: Clean deployment capability for all environments
5. **No Dangerous Defaults**: Charts have no fallback credentials

---

## Architecture

### Centralized Secrets Structure

```
repos/deployment/
├── .sops.yaml                          # Encryption rules (commit)
├── .gitignore                          # Exclude unencrypted files
│
├── secrets/                            # Centralized secrets directory
│   ├── README.md                       # Documentation
│   ├── local.secrets.yaml              # ENCRYPTED - Local dev (commit)
│   ├── canary.secrets.yaml             # ENCRYPTED - Canary env (commit)
│   ├── production.secrets.yaml         # ENCRYPTED - Production (commit)
│   │
│   ├── .local.secrets.yaml.dec         # DECRYPTED - gitignored (local only)
│   ├── .canary.secrets.yaml.dec        # DECRYPTED - gitignored (CI/CD only)
│   └── .production.secrets.yaml.dec    # DECRYPTED - gitignored (CI/CD only)
│
├── environments/                       # Non-sensitive configuration
│   ├── local.values.yaml               # Public config only
│   ├── canary.values.yaml              # Public config only
│   └── production.values.yaml          # Public config only
│
├── helmfiles/
│   ├── local.yaml.gotmpl              # References secrets/local.secrets.yaml
│   ├── canary.yaml.gotmpl             # References secrets/canary.secrets.yaml
│   └── production.yaml.gotmpl         # References secrets/production.secrets.yaml
│
└── scripts/
    ├── deploy-local.sh                # Entry point: Local deployment
    ├── deploy-canary.sh               # Entry point: Canary deployment
    ├── deploy-production.sh           # Entry point: Production deployment
    ├── generate-secrets.sh            # Generate secure random secrets
    └── validate-secrets.sh            # Pre-deployment validation
```

---

## Secrets Schema

### Canonical Structure

Each `secrets/{env}.secrets.yaml` follows this schema:

```yaml
# Environment: {local|canary|production}
# Encrypted by SOPS - committed to git in encrypted form
# Decrypted automatically by helm-secrets during deployment

# =============================================================================
# SURREALDB - Database Credentials
# =============================================================================
surrealdb:
  # Root administrative credentials
  username: "root"
  password: "<SECURE_PASSWORD>"  # 32+ characters, generated

  # Connection details (non-sensitive but included for completeness)
  url: "http://surrealdb.activity-system.svc.cluster.local:8000"
  namespace: "activity-system"
  database: "learning_loop"

# =============================================================================
# MINIBOB INSTANCE - Vessel Authentication
# =============================================================================
minibob:
  # Instance identity
  instanceId: "minibob-{env}-001"

  # Instance API key for authentication to backend
  # Format: {prefix}_{env}_{random}
  instanceApiKey: "<SECURE_API_KEY>"  # 64+ characters

  # LLM provider credentials
  anthropicApiKey: "sk-ant-<KEY>"

  # Internal API authentication
  metabobApiKey: "<SECURE_API_KEY>"

  # Git operations (optional)
  github:
    token: "ghp_<TOKEN>"  # Fine-grained PAT with repo scope
    userName: "MiniBob Agent"
    userEmail: "minibob@metabob.{env}"

# =============================================================================
# IDENTITY VESSEL - API Key & JWT Signing
# =============================================================================
identityVessel:
  # Secret for signing API keys and JWT tokens
  # CRITICAL: Must be unique per environment, 32+ characters
  apiKeySecret: "<SECURE_SECRET>"  # HS256 signing key

# =============================================================================
# INIT DATA - Bootstrap Credentials
# =============================================================================
initData:
  # Default organization
  organization:
    id: "metabob_{env}"
    name: "Metabob {Environment}"

  # Initial users
  users:
    # Admin user
    - email: "admin@metabob.{env}"
      name: "Admin User"
      password: "<SECURE_PASSWORD>"
      role: "admin"
      orgId: "metabob_{env}"

    # Service account for automation
    - email: "service@metabob.{env}"
      name: "Service Account"
      password: "<SECURE_PASSWORD>"
      role: "service"
      orgId: "metabob_{env}"
      apiKeys:
        - name: "{env}-service-key"
          key: "<SECURE_API_KEY>"
          scopes: ["read", "write", "admin"]

# =============================================================================
# INTERNAL DASHBOARD - Admin UI Authentication
# =============================================================================
internalDashboard:
  credentialId: "internal-dashboard-{env}"
  secret: "<SECURE_SECRET>"  # Session signing secret

# =============================================================================
# OPTIONAL SERVICES
# =============================================================================
# LLM Proxy (if enabled)
llmProxy:
  enabled: false
  anthropicApiKey: "sk-ant-<KEY>"  # Can reuse minibob.anthropicApiKey

# GitHub App (if enabled)
githubApp:
  enabled: false
  appId: ""
  privateKey: ""
  webhookSecret: ""
```

---

## Entry Points

### 1. Local Development (`deploy-local.sh`)

**Prerequisites:**
- Docker Desktop with Kubernetes enabled
- Istio installed
- `/etc/hosts` configured
- Age key at `~/.config/sops/age/keys.txt`

**Workflow:**
```bash
#!/usr/bin/env bash
set -euo pipefail

# Entry point: Local development deployment
# Usage: ./scripts/deploy-local.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "=== Deploying to Local Environment ==="

# 1. Validate Age key exists
if [[ ! -f ~/.config/sops/age/keys.txt ]]; then
  echo "ERROR: Age key not found at ~/.config/sops/age/keys.txt"
  echo "Run: age-keygen -o ~/.config/sops/age/keys.txt"
  exit 1
fi

# 2. Validate secrets file exists
if [[ ! -f secrets/local.secrets.yaml ]]; then
  echo "ERROR: secrets/local.secrets.yaml not found"
  echo "Run: ./scripts/generate-secrets.sh local"
  exit 1
fi

# 3. Validate secrets can be decrypted
echo "Validating secrets decryption..."
sops -d secrets/local.secrets.yaml > /dev/null || {
  echo "ERROR: Cannot decrypt secrets/local.secrets.yaml"
  echo "Check your Age key matches the encryption key"
  exit 1
}

# 4. Pre-deployment validation
echo "Running pre-deployment validation..."
./scripts/validate-secrets.sh local || exit 1

# 5. Deploy with Helmfile (helm-secrets auto-decrypts)
echo "Deploying to local Kubernetes..."
cd helm
helmfile -e local sync --skip-deps

# 6. Wait for deployments
echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=surrealdb -n activity-system --timeout=120s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=metabob-activity-api -n activity-system --timeout=120s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=minibob -n activity-system --timeout=120s

# 7. Verify deployment
echo "Verifying deployment health..."
curl -sf http://api.minibob.local/health || {
  echo "ERROR: Health check failed"
  kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=50
  exit 1
}

echo "✅ Local deployment complete!"
echo ""
echo "Access points:"
echo "  - Activity API: http://api.minibob.local"
echo "  - Dashboard: http://dashboard.minibob.local"
echo "  - SurrealDB: http://surql.metabob.local"
```

**Configuration Source:**
- Secrets: `secrets/local.secrets.yaml` (SOPS encrypted)
- Config: `environments/local.values.yaml` (plain YAML)
- Entry: `helmfiles/local.yaml.gotmpl`

---

### 2. Canary Deployment (`deploy-canary.sh`)

**Prerequisites:**
- CI/CD environment (GitHub Actions, GitLab CI, etc.)
- Age private key stored in CI secrets as `SOPS_AGE_KEY_CANARY`
- Kubernetes context configured for canary cluster

**Workflow:**
```bash
#!/usr/bin/env bash
set -euo pipefail

# Entry point: Canary environment deployment
# Usage: ./scripts/deploy-canary.sh
# CI/CD: Requires SOPS_AGE_KEY_CANARY environment variable

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "=== Deploying to Canary Environment ==="

# 1. Validate required environment variables
if [[ -z "${SOPS_AGE_KEY_CANARY:-}" ]]; then
  echo "ERROR: SOPS_AGE_KEY_CANARY environment variable not set"
  echo "This should be set in CI/CD secrets"
  exit 1
fi

# 2. Configure SOPS to use the canary key
export SOPS_AGE_KEY="$SOPS_AGE_KEY_CANARY"

# 3. Validate secrets file exists
if [[ ! -f secrets/canary.secrets.yaml ]]; then
  echo "ERROR: secrets/canary.secrets.yaml not found"
  exit 1
fi

# 4. Test decryption
echo "Validating secrets decryption..."
sops -d secrets/canary.secrets.yaml > /dev/null || {
  echo "ERROR: Cannot decrypt secrets/canary.secrets.yaml"
  echo "Check SOPS_AGE_KEY_CANARY matches the encryption key"
  exit 1
}

# 5. Pre-deployment validation
echo "Running pre-deployment validation..."
./scripts/validate-secrets.sh canary || exit 1

# 6. Deploy with Helmfile
echo "Deploying to canary cluster..."
cd helm
helmfile -e canary apply --skip-deps

# 7. Run smoke tests
echo "Running smoke tests..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=metabob-activity-api -n activity-system --timeout=300s

# Health check
CANARY_API_URL="${CANARY_API_URL:-https://api.canary.metabob.com}"
curl -sf "$CANARY_API_URL/health" || {
  echo "ERROR: Canary health check failed"
  kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=100
  exit 1
}

echo "✅ Canary deployment complete!"
echo "Monitor at: $CANARY_API_URL"
```

**Configuration Source:**
- Secrets: `secrets/canary.secrets.yaml` (SOPS encrypted)
- Config: `environments/canary.values.yaml` (plain YAML)
- Entry: `helmfiles/canary.yaml.gotmpl`
- Age Key: `$SOPS_AGE_KEY_CANARY` (CI/CD secret)

---

### 3. Production Deployment (`deploy-production.sh`)

**Prerequisites:**
- CI/CD environment with manual approval gate
- Age private key stored in CI secrets as `SOPS_AGE_KEY_PRODUCTION`
- Kubernetes context configured for production cluster
- Canary deployment successful

**Workflow:**
```bash
#!/usr/bin/env bash
set -euo pipefail

# Entry point: Production environment deployment
# Usage: ./scripts/deploy-production.sh
# CI/CD: Requires SOPS_AGE_KEY_PRODUCTION environment variable
# SECURITY: Should require manual approval in CI/CD pipeline

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "=== Deploying to PRODUCTION Environment ==="
echo ""
echo "⚠️  WARNING: This will deploy to PRODUCTION"
echo "⚠️  Ensure canary deployment is successful before proceeding"
echo ""

# 1. Manual confirmation (skip in CI/CD with auto-approval)
if [[ -z "${CI:-}" ]]; then
  read -p "Continue with production deployment? (yes/no): " confirm
  if [[ "$confirm" != "yes" ]]; then
    echo "Deployment cancelled"
    exit 0
  fi
fi

# 2. Validate required environment variables
if [[ -z "${SOPS_AGE_KEY_PRODUCTION:-}" ]]; then
  echo "ERROR: SOPS_AGE_KEY_PRODUCTION environment variable not set"
  exit 1
fi

# 3. Configure SOPS to use the production key
export SOPS_AGE_KEY="$SOPS_AGE_KEY_PRODUCTION"

# 4. Validate secrets file exists
if [[ ! -f secrets/production.secrets.yaml ]]; then
  echo "ERROR: secrets/production.secrets.yaml not found"
  exit 1
fi

# 5. Test decryption
echo "Validating secrets decryption..."
sops -d secrets/production.secrets.yaml > /dev/null || {
  echo "ERROR: Cannot decrypt secrets/production.secrets.yaml"
  exit 1
}

# 6. Pre-deployment validation (stricter for production)
echo "Running pre-deployment validation..."
./scripts/validate-secrets.sh production --strict || exit 1

# 7. Backup current state
echo "Creating pre-deployment backup..."
kubectl get all -n activity-system -o yaml > "backups/pre-deploy-$(date +%Y%m%d-%H%M%S).yaml"

# 8. Deploy with Helmfile (using atomic rollback)
echo "Deploying to production cluster..."
cd helm
helmfile -e production apply --skip-deps

# 9. Health check with retries
echo "Verifying production deployment..."
MAX_RETRIES=10
RETRY_DELAY=30

for i in $(seq 1 $MAX_RETRIES); do
  echo "Health check attempt $i/$MAX_RETRIES..."

  if curl -sf https://api.metabob.com/health > /dev/null; then
    echo "✅ Production deployment successful!"
    exit 0
  fi

  if [[ $i -lt $MAX_RETRIES ]]; then
    echo "Retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
  fi
done

echo "❌ ERROR: Production health check failed after $MAX_RETRIES attempts"
echo "Consider rolling back deployment"
kubectl logs -n activity-system -l app.kubernetes.io/name=metabob-activity-api --tail=200
exit 1
```

**Configuration Source:**
- Secrets: `secrets/production.secrets.yaml` (SOPS encrypted)
- Config: `environments/production.values.yaml` (plain YAML)
- Entry: `helmfiles/production.yaml.gotmpl`
- Age Key: `$SOPS_AGE_KEY_PRODUCTION` (CI/CD secret)

---

## Secrets Generation

### Generate Secrets Script (`generate-secrets.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Generate secrets file for specified environment
# Usage: ./scripts/generate-secrets.sh {local|canary|production}

ENV="${1:-}"

if [[ -z "$ENV" ]]; then
  echo "Usage: $0 {local|canary|production}"
  exit 1
fi

if [[ ! "$ENV" =~ ^(local|canary|production)$ ]]; then
  echo "ERROR: Environment must be local, canary, or production"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SECRETS_FILE="$REPO_ROOT/secrets/${ENV}.secrets.yaml"

# Generate secure random string
generate_password() {
  local length="${1:-32}"
  openssl rand -base64 $((length * 3 / 4)) | tr -d '\n' | cut -c1-$length
}

generate_api_key() {
  local prefix="${1:-mb}"
  local env="${2:-dev}"
  echo "${prefix}_${env}_$(openssl rand -hex 32)"
}

echo "=== Generating Secrets for $ENV Environment ==="

# Check if file already exists
if [[ -f "$SECRETS_FILE" ]]; then
  echo "WARNING: $SECRETS_FILE already exists"
  read -p "Overwrite? (yes/no): " confirm
  if [[ "$confirm" != "yes" ]]; then
    echo "Cancelled"
    exit 0
  fi
fi

# Generate secrets
SURREALDB_PASSWORD=$(generate_password 32)
MINIBOB_INSTANCE_API_KEY=$(generate_api_key "mb_inst" "$ENV")
IDENTITY_VESSEL_SECRET=$(generate_password 64)
ADMIN_PASSWORD=$(generate_password 24)
SERVICE_PASSWORD=$(generate_password 24)
SERVICE_API_KEY=$(generate_api_key "mb_svc" "$ENV")
DASHBOARD_SECRET=$(generate_password 32)

# Set environment-specific values
case "$ENV" in
  local)
    INSTANCE_ID="minibob-local-001"
    ORG_ID="metabob_internal"
    ORG_NAME="Metabob Internal"
    ADMIN_EMAIL="avi@metabob.com"
    SERVICE_EMAIL="service@metabob.local"
    GIT_EMAIL="minibob@metabob.local"
    ;;
  canary)
    INSTANCE_ID="minibob-canary-001"
    ORG_ID="metabob_canary"
    ORG_NAME="Metabob Canary"
    ADMIN_EMAIL="admin@metabob.canary"
    SERVICE_EMAIL="service@metabob.canary"
    GIT_EMAIL="minibob@metabob.canary"
    ;;
  production)
    INSTANCE_ID="minibob-prod-001"
    ORG_ID="metabob_production"
    ORG_NAME="Metabob Production"
    ADMIN_EMAIL="admin@metabob.com"
    SERVICE_EMAIL="service@metabob.com"
    GIT_EMAIL="minibob@metabob.com"
    ;;
esac

# Create secrets file
cat > "$SECRETS_FILE" <<EOF
# Environment: $ENV
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# IMPORTANT: Encrypt with SOPS before committing
#   sops -e -i secrets/${ENV}.secrets.yaml

# =============================================================================
# SURREALDB - Database Credentials
# =============================================================================
surrealdb:
  username: "root"
  password: "$SURREALDB_PASSWORD"
  url: "http://surrealdb.activity-system.svc.cluster.local:8000"
  namespace: "activity-system"
  database: "learning_loop"

# =============================================================================
# MINIBOB INSTANCE - Vessel Authentication
# =============================================================================
minibob:
  instanceId: "$INSTANCE_ID"
  instanceApiKey: "$MINIBOB_INSTANCE_API_KEY"
  anthropicApiKey: "sk-ant-REPLACE_WITH_ACTUAL_KEY"
  metabobApiKey: "REPLACE_WITH_ACTUAL_KEY"
  github:
    token: ""  # Optional - set if using git operations
    userName: "MiniBob Agent"
    userEmail: "$GIT_EMAIL"

# =============================================================================
# IDENTITY VESSEL - API Key & JWT Signing
# =============================================================================
identityVessel:
  apiKeySecret: "$IDENTITY_VESSEL_SECRET"

# =============================================================================
# INIT DATA - Bootstrap Credentials
# =============================================================================
initData:
  organization:
    id: "$ORG_ID"
    name: "$ORG_NAME"

  users:
    - email: "$ADMIN_EMAIL"
      name: "Admin User"
      password: "$ADMIN_PASSWORD"
      role: "admin"
      orgId: "$ORG_ID"

    - email: "$SERVICE_EMAIL"
      name: "Service Account"
      password: "$SERVICE_PASSWORD"
      role: "service"
      orgId: "$ORG_ID"
      apiKeys:
        - name: "${ENV}-service-key"
          key: "$SERVICE_API_KEY"
          scopes: ["read", "write", "admin"]

# =============================================================================
# INTERNAL DASHBOARD - Admin UI Authentication
# =============================================================================
internalDashboard:
  credentialId: "internal-dashboard-${ENV}"
  secret: "$DASHBOARD_SECRET"

# =============================================================================
# OPTIONAL SERVICES
# =============================================================================
llmProxy:
  enabled: false
  anthropicApiKey: ""

githubApp:
  enabled: false
  appId: ""
  privateKey: ""
  webhookSecret: ""
EOF

echo "✅ Generated $SECRETS_FILE"
echo ""
echo "NEXT STEPS:"
echo "1. Edit $SECRETS_FILE and replace REPLACE_WITH_ACTUAL_KEY placeholders"
echo "2. Encrypt the file: sops -e -i $SECRETS_FILE"
echo "3. Commit encrypted file to git"
echo ""
echo "Generated credentials (SAVE THESE SECURELY):"
echo "  Admin Email: $ADMIN_EMAIL"
echo "  Admin Password: $ADMIN_PASSWORD"
echo "  Service API Key: $SERVICE_API_KEY"
```

---

## Secrets Validation

### Validation Script (`validate-secrets.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Validate secrets file before deployment
# Usage: ./scripts/validate-secrets.sh {local|canary|production} [--strict]

ENV="${1:-}"
STRICT_MODE="${2:-}"

if [[ -z "$ENV" ]]; then
  echo "Usage: $0 {local|canary|production} [--strict]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SECRETS_FILE="$REPO_ROOT/secrets/${ENV}.secrets.yaml"

echo "=== Validating Secrets for $ENV Environment ==="

# 1. Check file exists
if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "❌ ERROR: $SECRETS_FILE not found"
  exit 1
fi

# 2. Check file is encrypted
if grep -q "sops:" "$SECRETS_FILE" && grep -q "mac:" "$SECRETS_FILE"; then
  echo "✅ File is SOPS encrypted"
else
  echo "❌ ERROR: File is NOT encrypted with SOPS"
  echo "Run: sops -e -i $SECRETS_FILE"
  exit 1
fi

# 3. Decrypt and validate structure
echo "Decrypting and validating structure..."
DECRYPTED=$(sops -d "$SECRETS_FILE") || {
  echo "❌ ERROR: Cannot decrypt secrets file"
  exit 1
}

# 4. Check required fields exist
REQUIRED_FIELDS=(
  ".surrealdb.password"
  ".minibob.instanceApiKey"
  ".identityVessel.apiKeySecret"
  ".initData.users[0].password"
)

for field in "${REQUIRED_FIELDS[@]}"; do
  VALUE=$(echo "$DECRYPTED" | yq eval "$field" -)

  if [[ -z "$VALUE" || "$VALUE" == "null" ]]; then
    echo "❌ ERROR: Required field $field is missing or empty"
    exit 1
  fi

  echo "✅ Field $field exists"
done

# 5. Check for dangerous placeholders
DANGEROUS_PATTERNS=(
  "changeme"
  "REPLACE_WITH"
  "CHANGE_ME"
  "test-api-key-123"
  "local-dev-123"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$DECRYPTED" | grep -qi "$pattern"; then
    echo "❌ ERROR: Found dangerous placeholder: $pattern"
    echo "Replace all placeholders with actual secure values"
    exit 1
  fi
done

echo "✅ No dangerous placeholders found"

# 6. Password strength validation (strict mode or production)
if [[ "$STRICT_MODE" == "--strict" || "$ENV" == "production" ]]; then
  echo "Running strict validation..."

  # Check password length (minimum 24 characters for production)
  DB_PASSWORD=$(echo "$DECRYPTED" | yq eval '.surrealdb.password' -)
  if [[ ${#DB_PASSWORD} -lt 24 ]]; then
    echo "❌ ERROR: Database password too short (minimum 24 characters for production)"
    exit 1
  fi

  # Check API key format
  INSTANCE_API_KEY=$(echo "$DECRYPTED" | yq eval '.minibob.instanceApiKey' -)
  if [[ ! "$INSTANCE_API_KEY" =~ ^mb_.*_[a-f0-9]{64}$ ]]; then
    echo "⚠️  WARNING: Instance API key doesn't match expected format"
  fi

  echo "✅ Strict validation passed"
fi

# 7. Environment-specific checks
case "$ENV" in
  production)
    # Ensure Anthropic API key is set for production
    ANTHROPIC_KEY=$(echo "$DECRYPTED" | yq eval '.minibob.anthropicApiKey' -)
    if [[ ! "$ANTHROPIC_KEY" =~ ^sk-ant- ]]; then
      echo "❌ ERROR: Production requires valid Anthropic API key"
      exit 1
    fi
    ;;
esac

echo ""
echo "✅ All validations passed for $ENV environment"
```

---

## Helmfile Integration

### Example: `helmfiles/local.yaml.gotmpl`

```yaml
environments:
  local:
    values:
      # Non-sensitive configuration
      - ../environments/local.values.yaml
      # Sensitive secrets (auto-decrypted by helm-secrets)
      - ../secrets/local.secrets.yaml

helmDefaults:
  atomic: false
  cleanupOnFail: true
  wait: true
  timeout: 600
  createNamespace: true

releases:
  # SurrealDB - Database
  - name: surrealdb
    namespace: activity-system
    chart: ../charts/surrealdb
    values:
      - auth:
          # Reference secrets from secrets/local.secrets.yaml
          username: {{ .Values.surrealdb.username | quote }}
          password: {{ .Values.surrealdb.password | quote }}
          existingSecret: ""  # Empty - create from values
      - initData:
          defaultOrg:
            id: {{ .Values.initData.organization.id | quote }}
            name: {{ .Values.initData.organization.name | quote }}
          minibob:
            instanceId: {{ .Values.minibob.instanceId | quote }}
            # API key injected as secret
      - database:
          namespace: {{ .Values.surrealdb.namespace | quote }}
          name: {{ .Values.surrealdb.database | quote }}

  # MiniBob Instance Credentials Secret
  # Created BEFORE MiniBob deployment
  - name: minibob-instance-credentials
    namespace: activity-system
    chart: ../charts/raw
    values:
      - resources:
          - apiVersion: v1
            kind: Secret
            metadata:
              name: minibob-instance-credentials
            type: Opaque
            stringData:
              api-key: {{ .Values.minibob.instanceApiKey | quote }}

  # Activity API
  - name: metabob-activity-api
    namespace: activity-system
    chart: ../charts/metabob-activity-api
    needs:
      - activity-system/surrealdb
    values:
      - config:
          surrealdb:
            url: {{ .Values.surrealdb.url | quote }}
            namespace: {{ .Values.surrealdb.namespace | quote }}
            database: {{ .Values.surrealdb.database | quote }}
            username: {{ .Values.surrealdb.username | quote }}
            password: {{ .Values.surrealdb.password | quote }}

  # MiniBob Deployment
  - name: minibob
    namespace: activity-system
    chart: ../charts/minibob
    needs:
      - activity-system/metabob-activity-api
      - activity-system/minibob-instance-credentials
    values:
      - instance:
          instanceId: {{ .Values.minibob.instanceId | quote }}
          secretName: "minibob-instance-credentials"
          secretKey: "api-key"
      - secrets:
          anthropicApiKey: {{ .Values.minibob.anthropicApiKey | quote }}
          metabobApiKey: {{ .Values.minibob.metabobApiKey | quote }}
          githubToken: {{ .Values.minibob.github.token | quote }}
          gitUserName: {{ .Values.minibob.github.userName | quote }}
          gitUserEmail: {{ .Values.minibob.github.userEmail | quote }}
      - env:
          surrealPass: {{ .Values.surrealdb.password | quote }}

  # Identity Vessel
  - name: identity-vessel
    namespace: activity-system
    chart: ../charts/identity-vessel
    values:
      - secrets:
          apiKeySecret: {{ .Values.identityVessel.apiKeySecret | quote }}

  # Internal Dashboard
  - name: metabob-internal-dashboard
    namespace: activity-system
    chart: ../charts/metabob-internal-dashboard
    values:
      - auth:
          credentialId: {{ .Values.internalDashboard.credentialId | quote }}
          secretValue: {{ .Values.internalDashboard.secret | b64enc | quote }}
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Canary

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy-canary:
    runs-on: ubuntu-latest
    environment: canary  # Requires approval

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install tools
        run: |
          # Install Age
          curl -LO https://github.com/FiloSottile/age/releases/download/v1.1.1/age-v1.1.1-linux-amd64.tar.gz
          tar xzf age-v1.1.1-linux-amd64.tar.gz
          sudo mv age/age /usr/local/bin/

          # Install SOPS
          curl -LO https://github.com/getsops/sops/releases/download/v3.8.1/sops-v3.8.1.linux.amd64
          sudo mv sops-v3.8.1.linux.amd64 /usr/local/bin/sops
          sudo chmod +x /usr/local/bin/sops

          # Install Helm
          curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

          # Install helm-secrets
          helm plugin install https://github.com/jkroepke/helm-secrets

          # Install Helmfile
          curl -LO https://github.com/helmfile/helmfile/releases/download/v0.159.0/helmfile_0.159.0_linux_amd64.tar.gz
          tar xzf helmfile_0.159.0_linux_amd64.tar.gz
          sudo mv helmfile /usr/local/bin/

      - name: Configure Kubernetes
        uses: azure/k8s-set-context@v3
        with:
          method: kubeconfig
          kubeconfig: ${{ secrets.KUBECONFIG_CANARY }}

      - name: Deploy to Canary
        env:
          SOPS_AGE_KEY_CANARY: ${{ secrets.SOPS_AGE_KEY_CANARY }}
        run: |
          cd repos/deployment
          ./scripts/deploy-canary.sh

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK }}
          payload: |
            {
              "text": "❌ Canary deployment failed: ${{ github.sha }}"
            }
```

---

## Security Considerations

### Age Key Management

**Local Development:**
- Personal Age key: `~/.config/sops/age/keys.txt`
- Never commit to git
- Backup securely (1Password, etc.)

**Canary/Production:**
- Store in CI/CD secrets (GitHub Secrets, GitLab CI Variables, etc.)
- Rotate annually
- Keep offline backup in secure vault

### Secrets Rotation

**When to Rotate:**
- Annually (scheduled)
- After security incident
- After team member departure (if they had access)
- After key exposure

**Rotation Procedure:**
1. Generate new secrets: `./scripts/generate-secrets.sh {env}`
2. Update secrets file with new values
3. Re-encrypt: `sops -e -i secrets/{env}.secrets.yaml`
4. Deploy: `./scripts/deploy-{env}.sh`
5. Verify deployment successful
6. Archive old secrets securely (for rollback)

### Access Control

**Who Has Access:**
- Local: Individual developers (their own Age key)
- Canary: CI/CD system + DevOps team
- Production: CI/CD system + Minimal human access

**Principle of Least Privilege:**
- Developers can decrypt local secrets only
- CI/CD can decrypt canary/production
- Production requires manual approval gate

---

## Deployment Checklist

### Initial Setup (One-Time)

- [ ] Install Age, SOPS, helm-secrets, Helmfile
- [ ] Generate Age keys for all environments
- [ ] Create `.sops.yaml` configuration
- [ ] Generate initial secrets files
- [ ] Encrypt secrets with SOPS
- [ ] Store Age private keys in CI/CD secrets
- [ ] Update Helmfiles to reference secrets
- [ ] Remove credential defaults from charts

### Per-Environment Deployment

**Local:**
- [ ] Age key exists at `~/.config/sops/age/keys.txt`
- [ ] Secrets file exists: `secrets/local.secrets.yaml`
- [ ] Secrets file is encrypted (check for `sops:` metadata)
- [ ] Can decrypt secrets: `sops -d secrets/local.secrets.yaml`
- [ ] Validation passes: `./scripts/validate-secrets.sh local`
- [ ] Deploy: `./scripts/deploy-local.sh`
- [ ] Health check passes

**Canary:**
- [ ] CI/CD secret `SOPS_AGE_KEY_CANARY` is set
- [ ] Secrets file exists: `secrets/canary.secrets.yaml`
- [ ] No placeholder values in secrets
- [ ] Validation passes: `./scripts/validate-secrets.sh canary --strict`
- [ ] Deploy: Trigger CI/CD pipeline
- [ ] Smoke tests pass
- [ ] Monitor for 24 hours

**Production:**
- [ ] Canary deployment successful for 24+ hours
- [ ] CI/CD secret `SOPS_AGE_KEY_PRODUCTION` is set
- [ ] Secrets file exists: `secrets/production.secrets.yaml`
- [ ] All API keys are production-grade
- [ ] Password complexity meets requirements (24+ chars)
- [ ] Validation passes: `./scripts/validate-secrets.sh production --strict`
- [ ] Manual approval obtained
- [ ] Deploy: Trigger production pipeline
- [ ] Health monitoring active
- [ ] Rollback plan ready

---

## Rollback Procedures

### Quick Rollback

```bash
# Helmfile rollback to previous release
helmfile -e {env} rollback

# Or specific release
helm rollback -n activity-system metabob-activity-api
```

### Secrets Rollback

If new secrets cause issues:

```bash
# 1. Revert secrets file to previous version
git checkout HEAD~1 secrets/production.secrets.yaml

# 2. Redeploy with old secrets
./scripts/deploy-production.sh

# 3. After fixing issue, create new secrets commit
```

---

## Summary

**One Source of Truth:**
- `secrets/{env}.secrets.yaml` contains ALL sensitive credentials per environment

**Entry Points:**
- `./scripts/deploy-local.sh` - Local development
- `./scripts/deploy-canary.sh` - Canary environment (CI/CD)
- `./scripts/deploy-production.sh` - Production (CI/CD with approval)

**Secrets Flow:**
```
Generate → Encrypt → Commit → CI/CD → Decrypt → Deploy
```

**Key Benefits:**
- ✅ Single file per environment (easy to manage)
- ✅ SOPS encryption (safe to commit)
- ✅ Clean deployments (no manual secret creation)
- ✅ Automated validation (prevent deployment with placeholders)
- ✅ Consistent across environments (same structure)
