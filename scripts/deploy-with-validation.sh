#!/bin/bash
set -euo pipefail

#############################################################################
# Simplified Deployment Script with Validation
# 
# Wraps repos/platform/metabob-apps/deploy.sh with standard workflow
# Designed to work with activity templates once backend is available
#
# Usage:
#   ./deploy-with-validation.sh [environment] [service] [options]
#
# Examples:
#   ./deploy-with-validation.sh default                    # Deploy all to default
#   ./deploy-with-validation.sh default metabob-rpc-api    # Deploy specific service
#   ./deploy-with-validation.sh default "" --migrate       # Deploy all with migrations
#############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$PROJECT_ROOT/repos/platform/metabob-apps"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_section() { echo -e "\n${YELLOW}=== $* ===${NC}\n"; }

# Parse arguments
ENVIRONMENT="${1:-default}"
SERVICE="${2:-}"
EXTRA_ARGS="${@:3}"

log_section "Deployment Workflow: $ENVIRONMENT"

# Step 1: Validate environment
log_info "Step 1: Validating environment..."
cd "$DEPLOY_DIR"
if ./scripts/validate-deployment.sh "$ENVIRONMENT"; then
    log_success "Environment validation passed"
else
    echo "Environment validation failed"
    exit 1
fi

# Step 2: Show deployment plan
log_section "Step 2: Deployment Plan"
log_info "Environment: $ENVIRONMENT"
log_info "Service: ${SERVICE:-ALL}"
log_info "K8s Context: $(kubectl config current-context)"
log_info "Namespace: metabob"
echo

# Step 3: Execute deployment
log_section "Step 3: Executing Deployment"
DEPLOY_CMD="./deploy.sh --environment $ENVIRONMENT --skip-diff"
if [[ -n "$SERVICE" ]]; then
    DEPLOY_CMD="$DEPLOY_CMD --service $SERVICE"
fi
DEPLOY_CMD="$DEPLOY_CMD $EXTRA_ARGS"

log_info "Running: $DEPLOY_CMD"
if eval "$DEPLOY_CMD"; then
    log_success "Deployment completed"
else
    echo "Deployment failed"
    exit 1
fi

# Step 4: Validate deployment health
log_section "Step 4: Validating Deployment Health"
sleep 5  # Give pods a moment to start

log_info "Checking pod status..."
kubectl get pods -n metabob

log_info "Waiting for pods to be ready (timeout: 300s)..."
if kubectl wait --for=condition=ready pod \
    -l app.kubernetes.io/instance=metabob \
    -n metabob \
    --timeout=300s 2>/dev/null || true; then
    log_success "Pods are ready"
else
    log_info "Some pods may still be starting..."
fi

# Step 5: Check application health
log_section "Step 5: Application Health Check"
log_info "Recent logs from metabob-rpc-api:"
kubectl logs -n metabob -l app=metabob-rpc-api --tail=10 2>/dev/null || log_info "No rpc-api logs yet"

# Step 6: Summary
log_section "Deployment Complete"
log_success "✅ Deployment workflow finished"
echo
log_info "Next steps:"
log_info "  - Monitor logs: kubectl logs -n metabob -l app=metabob-rpc-api --tail=50 -f"
log_info "  - Check status: kubectl get pods,svc -n metabob"
log_info "  - Run migrations: cd $DEPLOY_DIR && ./scripts/run-migrations.sh $ENVIRONMENT"

# Generate summary file
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
SUMMARY_FILE="$PROJECT_ROOT/DEPLOYMENT_SUMMARY_${ENVIRONMENT}_${SERVICE:-all}_${TIMESTAMP}.md"

cat > "$SUMMARY_FILE" << SUMMARY_EOF
# Deployment Summary

**Timestamp**: $(date -Iseconds)
**Environment**: $ENVIRONMENT
**Service**: ${SERVICE:-ALL}
**Git Commit**: $(git -C "$PROJECT_ROOT" rev-parse HEAD)
**K8s Context**: $(kubectl config current-context)

## Resources Deployed

\`\`\`
$(kubectl get deployments,pods,svc -n metabob 2>/dev/null || echo "Unable to fetch resources")
\`\`\`

## Health Status

\`\`\`
$(kubectl get pods -n metabob -o wide 2>/dev/null || echo "Unable to fetch pod status")
\`\`\`

## Post-Deployment Actions

- Monitor logs: \`kubectl logs -n metabob -l app=metabob-rpc-api --tail=50 -f\`
- Check resources: \`./scripts/monitor.sh\`
- Run migrations: \`cd repos/platform/metabob-apps && ./scripts/run-migrations.sh $ENVIRONMENT\`

## Rollback Instructions

If issues occur:
\`\`\`bash
cd repos/platform/metabob-apps
helmfile --environment $ENVIRONMENT rollback
\`\`\`
SUMMARY_EOF

log_success "Deployment summary saved: $SUMMARY_FILE"
