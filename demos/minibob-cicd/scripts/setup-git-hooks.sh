#!/bin/bash

# Setup Git Hooks for Autonomous Quality Gates
# Creates pre-commit hook that validates specification compliance

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Setting up Git hooks for autonomous quality gates...${NC}"
echo ""

# Check if we're in a git repository
if [ ! -d "$PROJECT_DIR/.git" ]; then
    echo -e "${YELLOW}Not a git repository. Creating .git/hooks directory anyway...${NC}"
    mkdir -p "$PROJECT_DIR/.git/hooks"
fi

# Create pre-commit hook
echo "Creating pre-commit hook..."

cat > "$PROJECT_DIR/.git/hooks/pre-commit" << 'EOF'
#!/bin/bash

# Pre-commit Quality Gate
# Validates specification compliance before allowing commit

set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Autonomous Quality Gate - Pre-Commit Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$STAGED_FILES" ]; then
    echo "No TypeScript/JavaScript files staged, skipping validation"
    exit 0
fi

echo "Validating staged files:"
echo "$STAGED_FILES" | sed 's/^/  - /'
echo ""

# Convert to comma-separated list
FILES_CSV=$(echo "$STAGED_FILES" | tr '\n' ',' | sed 's/,$//')

# Run validation activity
echo "Executing validation activity..."

TEMP_RESULT=$(mktemp)

if minibob --single "Execute validate-specification-enforcement \
  on files [$FILES_CSV] \
  with require_100_percent_compliance true \
  and output_path $TEMP_RESULT" 2>&1; then

    echo ""
    echo "✓ Quality gate PASSED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    exit 0
else
    echo ""
    echo "✗ Quality gate FAILED"
    echo ""
    echo "Your changes do not meet specification compliance requirements."
    echo "Please fix the issues before committing."
    echo ""
    echo "To see details, check the validation report."
    echo "To bypass (not recommended): git commit --no-verify"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    exit 1
fi
EOF

chmod +x "$PROJECT_DIR/.git/hooks/pre-commit"

echo -e "${GREEN}✓ Pre-commit hook created${NC}"
echo ""

# Create commit-msg hook for consistent message format
echo "Creating commit-msg hook..."

cat > "$PROJECT_DIR/.git/hooks/commit-msg" << 'EOF'
#!/bin/bash

# Commit Message Format Validation
# Ensures conventional commit format

COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Pattern: type(scope): subject
PATTERN="^(feat|fix|docs|style|refactor|test|chore)(\([a-z-]+\))?: .{10,}"

if ! echo "$COMMIT_MSG" | grep -qE "$PATTERN"; then
    echo ""
    echo "✗ Invalid commit message format"
    echo ""
    echo "Expected format: type(scope): subject"
    echo ""
    echo "Types: feat, fix, docs, style, refactor, test, chore"
    echo "Example: feat(activity-api): add Thompson Sampling decay"
    echo ""
    exit 1
fi

exit 0
EOF

chmod +x "$PROJECT_DIR/.git/hooks/commit-msg"

echo -e "${GREEN}✓ Commit-msg hook created${NC}"
echo ""

# Create pre-push hook (optional - runs full quality loop)
echo "Creating pre-push hook (full quality loop)..."

cat > "$PROJECT_DIR/.git/hooks/pre-push" << 'EOF'
#!/bin/bash

# Pre-push Quality Check
# Runs full autonomous quality loop before pushing

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Autonomous Quality Loop - Pre-Push Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Running full quality loop on all modified files..."
echo ""

# Get all modified files in current branch
CHANGED_FILES=$(git diff --name-only origin/$(git rev-parse --abbrev-ref HEAD)..HEAD | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$CHANGED_FILES" ]; then
    echo "No changes to validate"
    exit 0
fi

FILES_CSV=$(echo "$CHANGED_FILES" | tr '\n' ',' | sed 's/,$//')

if minibob --single "Execute autonomous-code-quality-loop \
  on repository . \
  with target_files [$FILES_CSV] \
  and patterns ['error-handling', 'parameter-validation'] \
  and max_iterations 1"; then

    echo ""
    echo "✓ Pre-push quality check PASSED"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    exit 0
else
    echo ""
    echo "✗ Pre-push quality check FAILED"
    echo ""
    echo "To bypass (not recommended): git push --no-verify"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    exit 1
fi
EOF

chmod +x "$PROJECT_DIR/.git/hooks/pre-push"

echo -e "${GREEN}✓ Pre-push hook created${NC}"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Git hooks installed successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Installed hooks:"
echo "  ✓ pre-commit   - Validates specification compliance"
echo "  ✓ commit-msg   - Enforces conventional commit format"
echo "  ✓ pre-push     - Runs full quality loop"
echo ""
echo "To bypass hooks (not recommended):"
echo "  git commit --no-verify"
echo "  git push --no-verify"
echo ""
echo "To disable a hook:"
echo "  rm .git/hooks/<hook-name>"
echo ""
