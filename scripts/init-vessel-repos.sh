#!/usr/bin/env bash
# Initialize and push vessel repositories to GitHub
#
# This script initializes git repositories for each vessel and pushes
# them to their respective GitHub remotes.
#
# Usage: ./scripts/init-vessel-repos.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if we're in the metabob-devbob root
if [ ! -d "repos" ]; then
  error "Must be run from metabob-devbob root directory"
  exit 1
fi

ROOT_DIR="$(pwd)"

# Vessel configurations
declare -A VESSELS=(
  ["minibob"]="git@github.com:AviGopal/minibob.git"
  ["metabob-activity-api"]="git@github.com:MetabobProject/metabob-activity-api.git"
  ["activity-dashboard"]="git@github.com:MetabobProject/activity-dashboard.git"
)

# Function to initialize and push a vessel repository
init_vessel() {
  local vessel_name=$1
  local remote_url=$2
  local vessel_dir="$ROOT_DIR/repos/$vessel_name"

  info "Processing vessel: $vessel_name"

  # Check if directory exists
  if [ ! -d "$vessel_dir" ]; then
    error "Directory not found: $vessel_dir"
    return 1
  fi

  cd "$vessel_dir"

  # Check if already a git repository
  if [ -d ".git" ]; then
    warn "Already a git repository, checking remote..."
    
    # Check if origin remote exists
    if git remote get-url origin &>/dev/null; then
      existing_remote=$(git remote get-url origin)
      if [ "$existing_remote" != "$remote_url" ]; then
        warn "Remote URL mismatch!"
        warn "  Existing: $existing_remote"
        warn "  Expected: $remote_url"
        read -p "Update remote? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
          git remote set-url origin "$remote_url"
          info "Remote URL updated"
        fi
      else
        info "Remote URL correct: $remote_url"
      fi
    else
      info "Adding remote: $remote_url"
      git remote add origin "$remote_url"
    fi
  else
    info "Initializing git repository..."
    git init
    git remote add origin "$remote_url"
  fi

  # Create .gitignore if it doesn't exist
  if [ ! -f ".gitignore" ]; then
    info "Creating .gitignore..."
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.bun/
bun.lockb

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.*
!.env.example

# Logs
*.log
*.log.*

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
.nyc_output/

# Temporary
tmp/
temp/
*.tmp
EOF
  fi

  # Check if there are changes to commit
  if [ -n "$(git status --porcelain)" ]; then
    info "Staging all files..."
    git add .

    # Create commit message based on vessel
    case $vessel_name in
      "minibob")
        commit_msg="Initial commit: MiniBob autonomous agent vessel

MiniBob is an autonomous agent vessel that executes activities,
manages its own lifecycle, and can develop itself using the
activity system framework."
        ;;
      "metabob-activity-api")
        commit_msg="Initial commit: TypeScript Activity System API

Activity API with Thompson Sampling learning loop, SurrealDB
backend, Redis caching, and full multi-tenant support."
        ;;
      "activity-dashboard")
        commit_msg="Initial commit: Activity Dashboard observability UI

Real-time dashboard for monitoring activity templates, executions,
learning loop metrics, and MiniBob cluster status."
        ;;
      *)
        commit_msg="Initial commit: $vessel_name"
        ;;
    esac

    info "Creating commit..."
    git commit -m "$commit_msg"
  else
    info "No changes to commit"
  fi

  # Ensure we're on main branch
  current_branch=$(git branch --show-current)
  if [ "$current_branch" != "main" ]; then
    if git show-ref --verify --quiet refs/heads/main; then
      info "Switching to main branch..."
      git checkout main
    else
      info "Renaming branch to main..."
      git branch -M main
    fi
  fi

  # Push to remote
  info "Pushing to remote: $remote_url"
  if git push -u origin main 2>&1 | grep -q "up-to-date"; then
    info "Remote is up-to-date"
  elif git push -u origin main 2>&1 | grep -q "rejected"; then
    warn "Push rejected (remote has changes)"
    warn "Run: cd $vessel_dir && git pull --rebase origin main"
    return 1
  else
    info "Pushed successfully"
  fi

  cd "$ROOT_DIR"
  info "✓ Vessel $vessel_name initialized\n"
}

# Main execution
info "========================================="
info "Vessel Repository Initialization"
info "========================================="
echo

# Check SSH access to GitHub
info "Checking GitHub SSH access..."
if ! ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
  error "GitHub SSH access failed"
  error "Ensure your SSH key is configured:"
  error "  ssh-add ~/.ssh/id_rsa"
  error "  ssh -T git@github.com"
  exit 1
fi
info "✓ GitHub SSH access confirmed\n"

# Process each vessel
failed_vessels=()
for vessel in "${!VESSELS[@]}"; do
  if ! init_vessel "$vessel" "${VESSELS[$vessel]}"; then
    failed_vessels+=("$vessel")
  fi
done

# Summary
echo
info "========================================="
info "Summary"
info "========================================="
if [ ${#failed_vessels[@]} -eq 0 ]; then
  info "✓ All vessels initialized successfully!"
  echo
  info "Next steps:"
  info "  1. Verify repos on GitHub"
  info "  2. Build Docker images: ./scripts/build-vessels.sh"
  info "  3. Deploy cluster: helmfile -f helm/helmfile-activity-dev.yaml -e dev apply"
else
  error "Failed vessels: ${failed_vessels[*]}"
  exit 1
fi
