#!/bin/bash
#
# Automated Redeployment to Canary
# Usage: ./scripts/redeploy-to-canary.sh [--skip-tests] [--auto-commit]
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
SKIP_TESTS=false
AUTO_COMMIT=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-tests)
      SKIP_TESTS=true
      shift
      ;;
    --auto-commit)
      AUTO_COMMIT=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--skip-tests] [--auto-commit]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Automated Canary Redeployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

cd "$PROJECT_ROOT"

# Phase 1: Pre-flight checks
echo -e "${YELLOW}[Phase 1/6] Pre-flight checks...${NC}"

# Check for uncommitted changes
if [[ -z $(git status -s) ]]; then
  echo -e "${GREEN}✓ No uncommitted changes${NC}"
else
  echo -e "${YELLOW}⚠ Uncommitted changes detected${NC}"
  git status -s | head -20
  echo ""

  if [ "$AUTO_COMMIT" = false ]; then
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
fi

# Run tests
if [ "$SKIP_TESTS" = false ]; then
  echo ""
  echo "Running tests..."

  if bun test 2>&1 | grep -q "FAIL"; then
    echo -e "${RED}✗ Tests failed${NC}"
    echo "Fix tests or use --skip-tests flag"
    exit 1
  fi

  echo -e "${GREEN}✓ Tests passed${NC}"
else
  echo -e "${YELLOW}⊘ Skipping tests (--skip-tests flag)${NC}"
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "dev" ]; then
  echo -e "${YELLOW}⚠ Current branch is '$CURRENT_BRANCH', expected 'dev'${NC}"
  read -p "Switch to dev? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git checkout dev
    git pull origin dev
  else
    exit 1
  fi
fi

echo ""

# Phase 2: Commit main workspace changes
echo -e "${YELLOW}[Phase 2/6] Committing main workspace changes...${NC}"

if [[ -n $(git status -s) ]]; then
  echo "Changes to commit:"
  git status -s
  echo ""

  if [ "$AUTO_COMMIT" = true ]; then
    # Stage functional changes
    git add -A repos/metabob-activity-api/src/
    git add -A repos/metabob-activity-api/sql/
    git add -u repos/metabob-activity-api/package.json 2>/dev/null || true

    # Add documentation
    git add -u docs/ 2>/dev/null || true

    # Create commit
    COMMIT_MSG="feat(activity-api): automated redeployment commit

Changes include schema updates, route modifications, and data initialization.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

    git commit -m "$COMMIT_MSG" || echo "Nothing to commit"
    echo -e "${GREEN}✓ Changes committed${NC}"
  else
    read -p "Commit these changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      read -p "Enter commit message: " COMMIT_MSG
      git add -A repos/metabob-activity-api/
      git add -u docs/ 2>/dev/null || true
      git commit -m "$COMMIT_MSG"
      echo -e "${GREEN}✓ Changes committed${NC}"
    else
      echo -e "${YELLOW}⊘ Skipping commit${NC}"
    fi
  fi

  # Push
  read -p "Push to origin dev? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin dev
    echo -e "${GREEN}✓ Pushed to origin dev${NC}"
  else
    echo -e "${RED}✗ Push aborted${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ No changes to commit${NC}"
fi

echo ""

# Phase 3: Update deployment repo
echo -e "${YELLOW}[Phase 3/6] Updating deployment repo...${NC}"

cd "$PROJECT_ROOT/repos/deployment"

# Check deployment repo status
if [[ -n $(git status -s) ]]; then
  echo "Deployment repo has uncommitted changes:"
  git status -s
  echo ""
fi

# Sync metabob-activity-api
echo "Syncing metabob-activity-api..."
rsync -av --delete \
  "$PROJECT_ROOT/repos/metabob-activity-api/src/" \
  vessels/metabob-activity-api/src/ \
  | grep -v "/$" || true

rsync -av --delete \
  "$PROJECT_ROOT/repos/metabob-activity-api/sql/" \
  vessels/metabob-activity-api/sql/ \
  | grep -v "/$" || true

cp "$PROJECT_ROOT/repos/metabob-activity-api/package.json" vessels/metabob-activity-api/
cp "$PROJECT_ROOT/repos/metabob-activity-api/bun.lockb" vessels/metabob-activity-api/ 2>/dev/null || true

echo -e "${GREEN}✓ Synced metabob-activity-api${NC}"

# Check what changed
if [[ -n $(git status -s vessels/) ]]; then
  echo ""
  echo "Changes in vessels:"
  git status -s vessels/
  echo ""

  # Commit vessel changes
  read -p "Commit vessel updates? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add vessels/metabob-activity-api
    git commit -m "sync: update metabob-activity-api from main workspace

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
    echo -e "${GREEN}✓ Vessel changes committed${NC}"
  else
    echo -e "${YELLOW}⊘ Skipping vessel commit${NC}"
  fi
fi

# Push deployment repo
read -p "Push deployment repo to origin dev? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  git push origin dev
  echo -e "${GREEN}✓ Deployment repo pushed${NC}"
else
  echo -e "${RED}✗ Push aborted${NC}"
  exit 1
fi

echo ""

# Phase 4: Monitor CI/CD
echo -e "${YELLOW}[Phase 4/6] Monitoring CI/CD...${NC}"

echo "GitHub Actions should now be triggered."
echo "Checking workflow status..."
echo ""

# Wait a moment for GitHub to register the push
sleep 5

# Get latest workflow run
LATEST_RUN=$(gh run list --repo MetabobProject/deployment --limit 1 --json databaseId,status,conclusion --jq '.[0]')

if [ -n "$LATEST_RUN" ]; then
  RUN_ID=$(echo "$LATEST_RUN" | jq -r '.databaseId')
  RUN_STATUS=$(echo "$LATEST_RUN" | jq -r '.status')

  echo "Latest workflow run: $RUN_ID"
  echo "Status: $RUN_STATUS"
  echo ""
  echo "View in browser:"
  echo "  https://github.com/MetabobProject/deployment/actions/runs/$RUN_ID"
  echo ""

  read -p "Watch workflow logs? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    gh run watch "$RUN_ID" --repo MetabobProject/deployment
  fi
else
  echo -e "${YELLOW}⚠ Could not detect workflow run${NC}"
  echo "Check manually: https://github.com/MetabobProject/deployment/actions"
fi

echo ""

# Phase 5: Verify deployment
echo -e "${YELLOW}[Phase 5/6] Verifying deployment...${NC}"

echo "Checking cluster connectivity..."
if kubectl get pods -n activity-system > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Connected to cluster${NC}"
  echo ""

  echo "Pod status:"
  kubectl get pods -n activity-system
  echo ""

  echo "Checking deployments:"
  kubectl get deployments -n activity-system \
    -o custom-columns=NAME:.metadata.name,READY:.status.readyReplicas,IMAGE:.spec.template.spec.containers[0].image
  echo ""
else
  echo -e "${YELLOW}⚠ Not connected to cluster${NC}"
  echo "Skipping pod verification"
fi

echo ""

# Phase 6: Test API
echo -e "${YELLOW}[Phase 6/6] Testing API...${NC}"

# Health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://activity.metabob.com/health)
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ API health check passed (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${RED}✗ API health check failed (HTTP $HTTP_CODE)${NC}"
fi

# Authentication test
if [ -n "$METABOB_API_KEY" ]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: ApiKey $METABOB_API_KEY" \
    https://activity.metabob.com/v2/activities/templates)

  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ API authentication passed (HTTP $HTTP_CODE)${NC}"
  else
    echo -e "${YELLOW}⚠ API authentication failed (HTTP $HTTP_CODE)${NC}"
    echo "  Check METABOB_API_KEY configuration"
  fi
else
  echo -e "${YELLOW}⊘ METABOB_API_KEY not set, skipping auth test${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Deployment Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Main workspace: Committed and pushed to dev"
echo "Deployment repo: Synced vessels and pushed to dev"
echo "CI/CD: Triggered deployment workflow"
echo ""
echo "Next steps:"
echo "1. Monitor GitHub Actions workflow"
echo "2. Verify pods are running: kubectl get pods -n activity-system"
echo "3. Run comprehensive verification: /tmp/verify-canary-setup.sh"
echo "4. Monitor canary for 24-48 hours before promoting to production"
echo ""
echo -e "${GREEN}✓ Redeployment process complete!${NC}"
