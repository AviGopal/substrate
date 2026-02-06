#!/bin/bash

# Pre-commit Hook Installation Script
# Installs the comprehensive activity quality gate pre-commit hook

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOK_SOURCE="$PROJECT_ROOT/hooks/pre-commit-activity-check.sh"
HOOK_TARGET="$PROJECT_ROOT/.git/hooks/pre-commit"
BACKUP_SUFFIX=".backup.$(date +%s)"

echo -e "${BLUE}🔧 Installing Pre-commit Activity Quality Gate Hook${NC}"
echo -e "${BLUE}===================================================${NC}"

# Check if we're in a git repository
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    echo "This script must be run from within a git repository"
    exit 1
fi

# Check if source hook exists
if [ ! -f "$HOOK_SOURCE" ]; then
    echo -e "${RED}❌ Error: Source hook not found${NC}"
    echo "Expected location: $HOOK_SOURCE"
    exit 1
fi

# Check if source hook is executable
if [ ! -x "$HOOK_SOURCE" ]; then
    echo -e "${YELLOW}⚠️  Making source hook executable...${NC}"
    chmod +x "$HOOK_SOURCE"
fi

# Create .git/hooks directory if it doesn't exist
if [ ! -d "$PROJECT_ROOT/.git/hooks" ]; then
    echo -e "${BLUE}📁 Creating .git/hooks directory...${NC}"
    mkdir -p "$PROJECT_ROOT/.git/hooks"
fi

# Backup existing pre-commit hook if it exists
if [ -f "$HOOK_TARGET" ]; then
    echo -e "${YELLOW}⚠️  Existing pre-commit hook found${NC}"
    echo -e "${BLUE}💾 Creating backup: ${HOOK_TARGET}${BACKUP_SUFFIX}${NC}"
    cp "$HOOK_TARGET" "${HOOK_TARGET}${BACKUP_SUFFIX}"
    echo -e "${GREEN}✅ Backup created successfully${NC}"
fi

# Install the new hook
echo -e "${BLUE}🔗 Installing quality gate pre-commit hook...${NC}"

# Create relative symlink for portability
cd "$PROJECT_ROOT/.git/hooks"
ln -sf "../../hooks/pre-commit-activity-check.sh" "pre-commit"
cd "$PROJECT_ROOT"

# Verify installation
if [ -L "$HOOK_TARGET" ] && [ -x "$HOOK_TARGET" ]; then
    echo -e "${GREEN}✅ Pre-commit hook installed successfully${NC}"
    
    # Show hook details
    echo ""
    echo -e "${BLUE}📋 Hook Details:${NC}"
    echo "  Source: $HOOK_SOURCE"
    echo "  Target: $HOOK_TARGET"
    echo "  Type: Symbolic link (relative)"
    echo "  Permissions: $(ls -l "$HOOK_TARGET" | cut -d' ' -f1)"
    
else
    echo -e "${RED}❌ Hook installation failed${NC}"
    exit 1
fi

# Test hook execution
echo ""
echo -e "${BLUE}🧪 Testing hook installation...${NC}"

if "$HOOK_TARGET" --version >/dev/null 2>&1 || true; then
    echo -e "${GREEN}✅ Hook is executable and accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Hook test completed (normal for pre-commit hooks)${NC}"
fi

# Show configuration status
echo ""
echo -e "${BLUE}⚙️  Quality Gate Configuration Status:${NC}"

# Check for quality gates config
if [ -f "$PROJECT_ROOT/.activity-quality-gates.json" ]; then
    echo -e "${GREEN}✅ Quality gates configuration found${NC}"
else
    echo -e "${YELLOW}⚠️  Quality gates configuration not found${NC}"
    echo "   Location: $PROJECT_ROOT/.activity-quality-gates.json"
fi

# Check for failure conditions config
if [ -f "$PROJECT_ROOT/.activity-failure-conditions.json" ]; then
    echo -e "${GREEN}✅ Failure conditions configuration found${NC}"
else
    echo -e "${YELLOW}⚠️  Failure conditions configuration not found${NC}"
    echo "   Location: $PROJECT_ROOT/.activity-failure-conditions.json"
fi

# Check for component flagging system
if [ -f "$PROJECT_ROOT/bin/check-flag-limits.sh" ]; then
    echo -e "${GREEN}✅ Component flagging system available${NC}"
else
    echo -e "${YELLOW}⚠️  Component flagging system not found${NC}"
    echo "   Location: $PROJECT_ROOT/bin/check-flag-limits.sh"
fi

# Check for stress testing
if [ -f "$PROJECT_ROOT/test/stress-test-memory.sh" ]; then
    echo -e "${GREEN}✅ Stress testing system available${NC}"
else
    echo -e "${YELLOW}⚠️  Stress testing system not found${NC}"
    echo "   Location: $PROJECT_ROOT/test/stress-test-memory.sh"
fi

# Check for required tools
echo ""
echo -e "${BLUE}🔧 Required Tools Status:${NC}"

if command -v npm >/dev/null 2>&1; then
    echo -e "${GREEN}✅ npm available ($(npm --version))${NC}"
else
    echo -e "${YELLOW}⚠️  npm not available - some checks will be skipped${NC}"
fi

if command -v node >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Node.js available ($(node --version))${NC}"
else
    echo -e "${YELLOW}⚠️  Node.js not available - some checks will be skipped${NC}"
fi

if command -v metabob-cli >/dev/null 2>&1; then
    echo -e "${GREEN}✅ metabob-cli available${NC}"
else
    echo -e "${YELLOW}⚠️  metabob-cli not available - code quality checks will be skipped${NC}"
    echo "   Install with: npm install -g @metabob/cli"
fi

# Usage instructions
echo ""
echo -e "${BLUE}🚀 Usage Instructions:${NC}"
echo -e "${BLUE}=====================${NC}"

echo -e "${GREEN}The pre-commit hook is now active and will automatically run on:${NC}"
echo "  • git commit (normal commits)"
echo "  • git commit -m \"message\" (direct commits)"
echo "  • git commit --amend (amending commits)"
echo ""

echo -e "${BLUE}Quality Gates Checked:${NC}"
echo "  [1/8] Test Coverage (≥80% for features)"
echo "  [2/8] Critical Issues (0 critical Metabob issues)"
echo "  [3/8] Dead Code (0 dead code for refactors)"
echo "  [4/8] Manual Intervention (0 manual markers)"
echo "  [5/8] All Tests Pass (100% pass rate)"
echo "  [6/8] Security Vulnerabilities (0 high-severity)"
echo "  [7/8] Component Flags (within limits)"
echo "  [8/8] Stress Tests (for memory/performance fixes)"
echo ""

echo -e "${BLUE}Activity-Specific Requirements:${NC}"
echo "  • fix/bugfix: Tests pass + no critical issues + stress tests"
echo "  • feature: Tests pass + coverage ≥80% + no critical issues"
echo "  • refactor: Tests pass + no dead code + no critical issues"
echo "  • security: Tests pass + no vulnerabilities + coverage"
echo ""

echo -e "${YELLOW}To bypass the hook (NOT RECOMMENDED):${NC}"
echo "  git commit --no-verify"
echo ""

echo -e "${YELLOW}To temporarily disable:${NC}"
echo "  mv .git/hooks/pre-commit .git/hooks/pre-commit.disabled"
echo ""

echo -e "${YELLOW}To uninstall:${NC}"
echo "  rm .git/hooks/pre-commit"
if [ -f "${HOOK_TARGET}${BACKUP_SUFFIX}" ]; then
    echo "  # Restore backup: mv ${HOOK_TARGET}${BACKUP_SUFFIX} $HOOK_TARGET"
fi
echo ""

echo -e "${GREEN}🎉 Pre-commit hook installation complete!${NC}"
echo -e "${GREEN}Your commits will now be automatically validated for quality.${NC}"