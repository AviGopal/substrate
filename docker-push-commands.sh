#!/bin/bash
# Docker Push and Helmfile Update Commands - February 16, 2026
# Execute these commands in order

set -e  # Exit on error

echo "========================================"
echo "Docker Push and Helmfile Update Script"
echo "========================================"
echo

# Configuration
NEW_API_VERSION="0.16.13"
NEW_WORKER_VERSION="0.16.1"
NEW_DASHBOARD_VERSION="2.2.2"
DOCKER_ORG="metabobapp"

# Step 1: Build and Push metabob-rpc-api
echo "Step 1: Building and pushing metabob-rpc-api..."
cd ~/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api

echo "  Building server image..."
docker compose build server

echo "  Pushing server image..."
docker compose push server

# Optional: Tag with specific version
echo "  Tagging with version ${NEW_API_VERSION}..."
docker tag ${DOCKER_ORG}/metabob-rpc-api:0.16.12 ${DOCKER_ORG}/metabob-rpc-api:${NEW_API_VERSION}
docker tag ${DOCKER_ORG}/metabob-rpc-api:0.16.12 ${DOCKER_ORG}/metabob-rpc-api:latest

echo "  Pushing versioned tags..."
docker push ${DOCKER_ORG}/metabob-rpc-api:${NEW_API_VERSION}
docker push ${DOCKER_ORG}/metabob-rpc-api:latest

# Step 2: Build and Push metabob-dashboard
echo
echo "Step 2: Building and pushing metabob-dashboard..."
cd ~/documents/work/exp-repo/metabob-devbob/repos/metabob-dashboard

echo "  Building dashboard image..."
docker compose build dashboard

echo "  Pushing dashboard image..."
docker compose push dashboard

# Optional: Tag with specific version
echo "  Tagging with version ${NEW_DASHBOARD_VERSION}..."
docker tag ${DOCKER_ORG}/metabob-dashboard:2.2.1 ${DOCKER_ORG}/metabob-dashboard:${NEW_DASHBOARD_VERSION}
docker tag ${DOCKER_ORG}/metabob-dashboard:2.2.1 ${DOCKER_ORG}/metabob-dashboard:latest

echo "  Pushing versioned tags..."
docker push ${DOCKER_ORG}/metabob-dashboard:${NEW_DASHBOARD_VERSION}
docker push ${DOCKER_ORG}/metabob-dashboard:latest

# Step 3: Verify pushed images
echo
echo "Step 3: Verifying pushed images..."
echo "  Pulling images to verify..."
docker pull ${DOCKER_ORG}/metabob-rpc-api:${NEW_API_VERSION}
docker pull ${DOCKER_ORG}/metabob-dashboard:${NEW_DASHBOARD_VERSION}

echo
echo "  Local images:"
docker images | grep ${DOCKER_ORG}

# Step 4: Update Helm values files
echo
echo "Step 4: Updating Helm values files..."
cd ~/documents/work/platform/metabob-apps/charts

# Backup current values
echo "  Creating backups..."
cp metabob-rpc-api/values.yaml metabob-rpc-api/values.yaml.bak.$(date +%Y%m%d-%H%M%S)
cp metabob-dashboard/values.yaml metabob-dashboard/values.yaml.bak.$(date +%Y%m%d-%H%M%S)

# Update metabob-rpc-api values
echo "  Updating metabob-rpc-api image tag..."
sed -i.bak "s/tag: \"0\.16\.12\"/tag: \"${NEW_API_VERSION}\"/" metabob-rpc-api/values.yaml
# sed -i.bak "s/tag: \"0\.16\.0\"/tag: \"${NEW_WORKER_VERSION}\"/" metabob-rpc-api/values.yaml  # Uncomment if worker changed

# Update metabob-dashboard values
echo "  Updating metabob-dashboard image tag..."
sed -i.bak "s/tag: \"2\.2\.1\"/tag: \"${NEW_DASHBOARD_VERSION}\"/" metabob-dashboard/values.yaml

# Verify changes
echo
echo "  Verifying Helm values changes:"
echo "  metabob-rpc-api:"
grep -A 2 "repository: metabobapp" metabob-rpc-api/values.yaml | head -3
echo
echo "  metabob-dashboard:"
grep -A 2 "repository: metabobapp" metabob-dashboard/values.yaml | head -3

# Step 5: Run Helmfile diff
echo
echo "Step 5: Running Helmfile diff for production..."
cd ~/documents/work/platform/environments

DIFF_OUTPUT="/tmp/helmfile-production-diff-$(date +%Y%m%d-%H%M%S).txt"
echo "  Saving diff to: ${DIFF_OUTPUT}"
helmfile -e production diff | tee ${DIFF_OUTPUT}

echo
echo "========================================"
echo "Execution Complete!"
echo "========================================"
echo
echo "Next Steps:"
echo "  1. Review diff output: cat ${DIFF_OUTPUT}"
echo "  2. If changes look good, apply with: helmfile -e production apply --interactive"
echo "  3. Monitor deployment: kubectl get pods -n metabob-production -w"
echo
echo "Rollback if needed:"
echo "  cd ~/documents/work/platform/metabob-apps/charts"
echo "  cp metabob-rpc-api/values.yaml.bak.* metabob-rpc-api/values.yaml"
echo "  cp metabob-dashboard/values.yaml.bak.* metabob-dashboard/values.yaml"
echo "  cd ~/documents/work/platform/environments"
echo "  helmfile -e production apply"
echo
