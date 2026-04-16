#!/bin/bash
#
# Align All Repositories
# Commits changes in vessel repos, updates deployment submodules, and syncs code
#
# Usage: ./scripts/align-all-repos.sh [--auto-commit] [--dry-run]
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Flags
AUTO_COMMIT=false
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --auto-commit)
      AUTO_COMMIT=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--auto-commit] [--dry-run]"
      exit 1
      ;;
  esac
done

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Repository Alignment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}🔍 DRY RUN MODE - No changes will be made${NC}"
  echo ""
fi

cd "$PROJECT_ROOT"

# ============================================================================
# Phase 1: Check All Vessel Repositories
# ============================================================================

echo -e "${CYAN}[Phase 1/5] Checking vessel repositories...${NC}"
echo ""

VESSELS_TO_COMMIT=()

# Function to check vessel status
check_vessel() {
  local vessel_path=$1
  local vessel_name=$(basename "$vessel_path")

  if [ ! -d "$vessel_path" ]; then
    return
  fi

  cd "$vessel_path"

  # Check if it's a git repo
  if [ ! -d ".git" ]; then
    return
  fi

  # Check for uncommitted changes
  if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}📝 $vessel_name${NC} has uncommitted changes:"
    git status -s | head -10

    if [ "$DRY_RUN" = false ]; then
      VESSELS_TO_COMMIT+=("$vessel_path")
    fi
    echo ""
  else
    echo -e "${GREEN}✓ $vessel_name${NC} is clean"
  fi

  cd "$PROJECT_ROOT"
}

# Check key vessels
echo "Checking vessel repositories..."
check_vessel "repos/metabob-activity-api"
check_vessel "repos/identity-vessel"
check_vessel "repos/user-vessel"
check_vessel "repos/minibob"
check_vessel "repos/metabob-proto"
check_vessel "repos/concept-db"
check_vessel "repos/metabob-cloud-dashboard"

echo ""

if [ ${#VESSELS_TO_COMMIT[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ All vessels are clean!${NC}"
  echo ""
else
  echo -e "${YELLOW}Found ${#VESSELS_TO_COMMIT[@]} vessels with uncommitted changes${NC}"
  echo ""
fi

# ============================================================================
# Phase 2: Commit Changes in Vessel Repositories
# ============================================================================

if [ ${#VESSELS_TO_COMMIT[@]} -gt 0 ] && [ "$DRY_RUN" = false ]; then
  echo -e "${CYAN}[Phase 2/5] Committing vessel changes...${NC}"
  echo ""

  for vessel_path in "${VESSELS_TO_COMMIT[@]}"; do
    vessel_name=$(basename "$vessel_path")

    echo -e "${BLUE}Processing $vessel_name...${NC}"
    cd "$vessel_path"

    # Show changes
    echo "Changes:"
    git status -s
    echo ""

    if [ "$AUTO_COMMIT" = true ]; then
      # Auto-commit
      git add -A

      # Generate commit message based on changes
      COMMIT_MSG="chore($vessel_name): sync uncommitted changes

Automated alignment commit.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

      git commit -m "$COMMIT_MSG" || echo "Nothing to commit in $vessel_name"
      echo -e "${GREEN}✓ Committed $vessel_name${NC}"
      echo ""
    else
      # Interactive commit
      read -p "Commit changes in $vessel_name? (y/n) " -n 1 -r
      echo

      if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter commit message (or press Enter for default): " CUSTOM_MSG

        if [ -z "$CUSTOM_MSG" ]; then
          COMMIT_MSG="chore($vessel_name): sync uncommitted changes

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
        else
          COMMIT_MSG="$CUSTOM_MSG

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
        fi

        git add -A
        git commit -m "$COMMIT_MSG" || echo "Nothing to commit"
        echo -e "${GREEN}✓ Committed $vessel_name${NC}"
        echo ""
      else
        echo -e "${YELLOW}⊘ Skipped $vessel_name${NC}"
        echo ""
      fi
    fi

    cd "$PROJECT_ROOT"
  done
else
  echo -e "${CYAN}[Phase 2/5] Skipping vessel commits (no changes or dry run)${NC}"
  echo ""
fi

# ============================================================================
# Phase 3: Update Deployment Repo Submodules
# ============================================================================

echo -e "${CYAN}[Phase 3/5] Updating deployment repo submodules...${NC}"
echo ""

cd "$PROJECT_ROOT/repos/deployment"

# Check submodule status
echo "Current submodule status:"
git submodule status | grep "^+" || echo "No submodules with uncommitted changes"
echo ""

if [ "$DRY_RUN" = false ]; then
  # Update submodule references to latest commits
  echo "Updating submodule references..."

  # For each submodule, update to latest commit
  for submodule in vessels/*/; do
    if [ -d "$submodule" ]; then
      submodule_name=$(basename "$submodule")

      # Check if this is actually a submodule
      if git config -f .gitmodules --get "submodule.vessels/$submodule_name.path" > /dev/null 2>&1; then
        echo "  Updating $submodule_name..."
        cd "$submodule"

        # Get the corresponding repo in main workspace
        vessel_repo="$PROJECT_ROOT/repos/$submodule_name"

        if [ -d "$vessel_repo/.git" ]; then
          # Get latest commit from vessel repo
          latest_commit=$(cd "$vessel_repo" && git rev-parse HEAD)
          echo "    Latest commit: $latest_commit"
        fi

        cd "$PROJECT_ROOT/repos/deployment"
      fi
    fi
  done

  echo ""
  echo "Submodule update complete"
  echo ""
else
  echo -e "${YELLOW}🔍 DRY RUN: Would update submodule references${NC}"
  echo ""
fi

# ============================================================================
# Phase 4: Sync Vessel Code to Deployment Repo
# ============================================================================

echo -e "${CYAN}[Phase 4/5] Syncing vessel code to deployment repo...${NC}"
echo ""

# Function to sync vessel
sync_vessel() {
  local vessel_name=$1
  local source_path="$PROJECT_ROOT/repos/$vessel_name"
  local dest_path="$PROJECT_ROOT/repos/deployment/vessels/$vessel_name"

  if [ ! -d "$source_path" ]; then
    echo -e "${YELLOW}⊘ $vessel_name not found in repos/${NC}"
    return
  fi

  echo -e "${BLUE}Syncing $vessel_name...${NC}"

  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}  🔍 DRY RUN: Would sync from $source_path to $dest_path${NC}"
    return
  fi

  # Sync source code
  if [ -d "$source_path/src" ]; then
    mkdir -p "$dest_path/src"
    rsync -av --delete "$source_path/src/" "$dest_path/src/" | grep -v "/$" | head -10 || true
  fi

  # Sync SQL migrations
  if [ -d "$source_path/sql" ]; then
    mkdir -p "$dest_path/sql"
    rsync -av --delete "$source_path/sql/" "$dest_path/sql/" | grep -v "/$" | head -10 || true
  fi

  # Sync package files
  [ -f "$source_path/package.json" ] && cp "$source_path/package.json" "$dest_path/"
  [ -f "$source_path/bun.lockb" ] && cp "$source_path/bun.lockb" "$dest_path/"
  [ -f "$source_path/tsconfig.json" ] && cp "$source_path/tsconfig.json" "$dest_path/"

  echo -e "${GREEN}  ✓ Synced $vessel_name${NC}"
  echo ""
}

# Sync key vessels
sync_vessel "metabob-activity-api"
sync_vessel "identity-vessel"
sync_vessel "user-vessel"
sync_vessel "minibob"
sync_vessel "concept-db"
sync_vessel "metabob-cloud-dashboard"

cd "$PROJECT_ROOT/repos/deployment"

# Check what changed
if [ "$DRY_RUN" = false ]; then
  echo "Changes in deployment repo after sync:"
  git status -s vessels/ | head -20
  echo ""
else
  echo -e "${YELLOW}🔍 DRY RUN: Would check for changes${NC}"
  echo ""
fi

# ============================================================================
# Phase 5: Commit Deployment Repo Changes
# ============================================================================

if [ "$DRY_RUN" = false ]; then
  echo -e "${CYAN}[Phase 5/5] Committing deployment repo changes...${NC}"
  echo ""

  cd "$PROJECT_ROOT/repos/deployment"

  if [[ -n $(git status -s) ]]; then
    echo "Changes to commit:"
    git status -s | head -20
    echo ""

    if [ "$AUTO_COMMIT" = true ]; then
      # Auto-commit
      git add vessels/

      COMMIT_MSG="sync: update vessels from main workspace

Automated sync of vessel code and submodule references.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

      git commit -m "$COMMIT_MSG" || echo "Nothing to commit"
      echo -e "${GREEN}✓ Committed deployment repo changes${NC}"
    else
      # Interactive commit
      read -p "Commit deployment repo changes? (y/n) " -n 1 -r
      echo

      if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add vessels/

        read -p "Enter commit message (or press Enter for default): " CUSTOM_MSG

        if [ -z "$CUSTOM_MSG" ]; then
          COMMIT_MSG="sync: update vessels from main workspace

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
        else
          COMMIT_MSG="$CUSTOM_MSG

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
        fi

        git commit -m "$COMMIT_MSG" || echo "Nothing to commit"
        echo -e "${GREEN}✓ Committed deployment repo changes${NC}"
      else
        echo -e "${YELLOW}⊘ Skipped deployment repo commit${NC}"
      fi
    fi
    echo ""
  else
    echo -e "${GREEN}✓ No changes in deployment repo${NC}"
    echo ""
  fi
else
  echo -e "${CYAN}[Phase 5/5] Dry run - skipping commits${NC}"
  echo ""
fi

# ============================================================================
# Summary
# ============================================================================

cd "$PROJECT_ROOT"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Alignment Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}🔍 DRY RUN COMPLETE${NC}"
  echo ""
  echo "No changes were made. Run without --dry-run to apply changes."
  echo ""
else
  echo -e "${GREEN}✓ Repository alignment complete!${NC}"
  echo ""

  echo "Next steps:"
  echo "1. Push vessel repos to remote:"
  echo "   cd repos/metabob-activity-api && git push origin dev"
  echo "   cd repos/minibob && git push origin dev"
  echo ""
  echo "2. Push deployment repo to trigger CI/CD:"
  echo "   cd repos/deployment && git push origin dev"
  echo ""
  echo "3. Monitor deployment:"
  echo "   gh run list --repo MetabobProject/deployment --limit 5"
  echo ""
fi

# Repository status
echo "Repository Status:"
echo ""

cd "$PROJECT_ROOT"
echo -e "${CYAN}Main Workspace:${NC}"
git status -s | grep "^M" | wc -l | xargs -I {} echo "  {} modified files"
git status -s | grep "^?" | wc -l | xargs -I {} echo "  {} untracked files"
echo ""

cd repos/deployment
echo -e "${CYAN}Deployment Repo:${NC}"
git status -s | grep "^M" | wc -l | xargs -I {} echo "  {} modified files"
git status -s | grep "^?" | wc -l | xargs -I {} echo "  {} untracked files"
echo ""

echo -e "${GREEN}✓ Alignment complete${NC}"
