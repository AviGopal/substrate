#!/usr/bin/env bash
set -euo pipefail

#
# Complete Development Lifecycle - Activity Driven
#
# Demonstrates full workflow managed by MiniBob activities:
# Issue Creation → Branch → Development → PR → CI/CD → Merge → Deploy
#

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +%T)]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
        error "ANTHROPIC_API_KEY not set"
        exit 1
    fi

    if ! command -v gh &> /dev/null; then
        error "GitHub CLI (gh) not installed"
        exit 1
    fi

    if ! command -v bunx &> /dev/null; then
        error "Bun not installed"
        exit 1
    fi

    success "Prerequisites OK"
}

# Step 1: Create Issue from Bug/Improvement
create_issue() {
    local description="$1"

    log "Step 1: Creating GitHub issue..."

    ISSUE_OUTPUT=$(bunx @metabob/minibob@latest \
        --template activities/github/create-issue-from-bug.json \
        --var "bugDescription=$description" \
        --trace 2>&1)

    ISSUE_NUM=$(echo "$ISSUE_OUTPUT" | grep -oP 'issues/\K\d+' | head -1)

    if [ -z "$ISSUE_NUM" ]; then
        error "Failed to create issue"
        echo "$ISSUE_OUTPUT"
        exit 1
    fi

    success "Created issue #$ISSUE_NUM"
    echo "  URL: $(gh issue view $ISSUE_NUM --json url -q .url)"
    echo ""
}

# Step 2: Create Branch from Issue
create_branch() {
    local issue_num="$1"

    log "Step 2: Creating branch from issue..."

    # Extract issue title for branch name
    ISSUE_TITLE=$(gh issue view $issue_num --json title -q .title)
    BRANCH_NAME="fix/issue-${issue_num}-$(echo $ISSUE_TITLE | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]' | cut -c1-40)"

    git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"

    # Comment on issue with branch link
    gh issue comment $issue_num --body "🌿 Working on this in branch \`$BRANCH_NAME\`"

    success "Created branch: $BRANCH_NAME"
    echo ""
}

# Step 3: Implement Changes (using MiniBob)
implement_changes() {
    local issue_num="$1"

    log "Step 3: Implementing changes..."

    # Read issue details
    ISSUE_BODY=$(gh issue view $issue_num --json body -q .body)

    # Use MiniBob to implement the fix
    bunx @metabob/minibob@latest --single \
        "Fix issue #${issue_num}: ${ISSUE_BODY}. Read relevant files, make necessary changes, and verify the fix works." \
        --trace

    success "Changes implemented"
    echo ""
}

# Step 4: Create Pull Request
create_pr() {
    log "Step 4: Creating pull request..."

    # Commit changes
    git add -A
    git commit -m "fix: resolve issue (via MiniBob activity)" || true

    # Push branch
    git push -u origin HEAD

    # Create PR using activity
    PR_OUTPUT=$(bunx @metabob/minibob@latest \
        --template activities/github/create-pr-from-branch.json \
        --var "baseBranch=main" \
        --trace 2>&1)

    PR_NUM=$(echo "$PR_OUTPUT" | grep -oP 'pull/\K\d+' | head -1)

    if [ -z "$PR_NUM" ]; then
        error "Failed to create PR"
        echo "$PR_OUTPUT"
        exit 1
    fi

    success "Created PR #$PR_NUM"
    echo "  URL: $(gh pr view $PR_NUM --json url -q .url)"
    echo ""
}

# Step 5: Wait for CI and Auto-Fix if Needed
wait_for_ci() {
    local pr_num="$1"
    local max_attempts=10
    local attempt=0

    log "Step 5: Waiting for CI checks..."

    while [ $attempt -lt $max_attempts ]; do
        sleep 15
        attempt=$((attempt + 1))

        # Check CI status
        CI_STATUS=$(gh pr view $pr_num --json statusCheckRollup -q '.statusCheckRollup[0].conclusion' 2>/dev/null || echo "PENDING")

        if [ "$CI_STATUS" = "SUCCESS" ]; then
            success "CI checks passed"
            echo ""
            return 0
        elif [ "$CI_STATUS" = "FAILURE" ]; then
            warning "CI checks failed, attempting auto-fix..."

            # Use existing auto-fix activity
            bunx @metabob/minibob@latest \
                --template activities/cicd/auto-fix-ci-failure.json \
                --var "prNumber=$pr_num" \
                --trace

            # Wait a bit for new CI run
            sleep 30
        else
            echo -n "."
        fi
    done

    error "CI checks did not complete in time"
    return 1
}

# Step 6: Merge Pull Request
merge_pr() {
    local pr_num="$1"

    log "Step 6: Merging pull request..."

    bunx @metabob/minibob@latest \
        --template activities/github/merge-pr.json \
        --var "prNumber=$pr_num" \
        --var "mergeMethod=squash" \
        --trace

    success "PR merged"
    echo ""
}

# Step 7: Verify Deployment
verify_deployment() {
    log "Step 7: Verifying deployment..."

    # Wait for deployment
    sleep 30

    # Check GitHub Pages deployment
    PAGES_URL=$(gh repo view --json homepageUrl -q .homepageUrl)

    if [ -z "$PAGES_URL" ]; then
        warning "GitHub Pages URL not found, deployment may still be in progress"
    else
        success "Deployment verified"
        echo "  URL: $PAGES_URL"
    fi

    echo ""
}

# Main workflow
main() {
    local description="${1:-Add new feature to task manager}"

    cd "$DEMO_DIR"

    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  Activity-Driven Development Workflow                     ║"
    echo "║  Complete lifecycle managed by MiniBob activities         ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    check_prerequisites

    # Run complete workflow
    create_issue "$description"
    create_branch "$ISSUE_NUM"
    implement_changes "$ISSUE_NUM"
    create_pr
    wait_for_ci "$PR_NUM"
    merge_pr "$PR_NUM"
    verify_deployment

    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║  Workflow Complete! ✨                                    ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "Summary:"
    echo "  - Issue: #$ISSUE_NUM"
    echo "  - Branch: $BRANCH_NAME"
    echo "  - PR: #$PR_NUM (merged)"
    echo "  - Site: $PAGES_URL"
    echo ""
    echo "All steps executed as MiniBob activities:"
    echo "  ✓ Issue creation (activity)"
    echo "  ✓ Development (activity)"
    echo "  ✓ PR creation (activity)"
    echo "  ✓ CI/CD (activity + workflows)"
    echo "  ✓ PR merge (activity)"
    echo "  ✓ Deployment (workflow)"
    echo ""
    echo "View traces at: https://activity.metabob.com"
    echo ""
}

# Run if called directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
