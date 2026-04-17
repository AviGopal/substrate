#!/usr/bin/env bash
set -euo pipefail

# Sandbox Environment Setup
# Creates a controlled workspace for collecting execution traces

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="${SCRIPT_DIR}/workspace"
LOG_DIR="${SCRIPT_DIR}/logs"

echo "Setting up MiniBob sandbox environment..."

# ============================================================================
# 1. Validate Prerequisites
# ============================================================================

echo "Checking prerequisites..."

if [ -z "${METABOB_API_KEY:-}" ]; then
  echo "ERROR: METABOB_API_KEY environment variable not set"
  exit 1
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: ANTHROPIC_API_KEY environment variable not set"
  exit 1
fi

if ! command -v git &> /dev/null; then
  echo "ERROR: git is not installed"
  exit 1
fi

if ! command -v bun &> /dev/null; then
  echo "ERROR: bun is not installed"
  exit 1
fi

echo "✓ Prerequisites validated"

# ============================================================================
# 2. Create Directory Structure
# ============================================================================

echo "Creating directory structure..."

mkdir -p "${WORKSPACE_DIR}"
mkdir -p "${LOG_DIR}"
mkdir -p "${SCRIPT_DIR}/reports"

echo "✓ Directory structure created"

# ============================================================================
# 3. Initialize Git Repository
# ============================================================================

echo "Initializing git repository..."

cd "${WORKSPACE_DIR}"

if [ ! -d .git ]; then
  git init
  git config user.name "MiniBob Sandbox"
  git config user.email "sandbox@metabob.local"

  # Create initial commit
  echo "# Sandbox Workspace" > README.md
  git add README.md
  git commit -m "Initial commit"

  echo "✓ Git repository initialized"
else
  echo "✓ Git repository already exists"
fi

# ============================================================================
# 4. Create Sample Files for Resolver Testing
# ============================================================================

echo "Creating sample files..."

# Create test directory structure
mkdir -p src/lib src/utils tests

# Sample TypeScript file
cat > src/lib/calculator.ts << 'EOF'
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Division by zero");
    }
    return a / b;
  }
}
EOF

# Sample utility file
cat > src/utils/validation.ts << 'EOF'
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s-()]+$/;
  return phoneRegex.test(phone);
}
EOF

# Sample test file
cat > tests/calculator.test.ts << 'EOF'
import { Calculator } from "../src/lib/calculator";

describe("Calculator", () => {
  let calc: Calculator;

  beforeEach(() => {
    calc = new Calculator();
  });

  it("should add two numbers", () => {
    expect(calc.add(2, 3)).toBe(5);
  });

  it("should subtract two numbers", () => {
    expect(calc.subtract(5, 3)).toBe(2);
  });
});
EOF

# Package.json
cat > package.json << 'EOF'
{
  "name": "sandbox-workspace",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "test": "echo 'No tests configured'"
  },
  "dependencies": {},
  "devDependencies": {}
}
EOF

# README
cat > README.md << 'EOF'
# Sandbox Workspace

This workspace is used for MiniBob sandbox testing and trace collection.

## Structure

- `src/` - Sample source code
- `tests/` - Sample test files
- `logs/` - Execution logs

## Purpose

This workspace provides a controlled environment for testing MiniBob's
unified execution path and collecting execution traces.
EOF

echo "✓ Sample files created"

# ============================================================================
# 5. Commit Sample Files
# ============================================================================

echo "Committing sample files..."

git add .
git commit -m "Add sample files for resolver testing"

echo "✓ Sample files committed"

# ============================================================================
# 6. Validate Configuration
# ============================================================================

echo "Validating sandbox configuration..."

CONFIG_FILE="${SCRIPT_DIR}/sandbox.config.json"

if [ ! -f "${CONFIG_FILE}" ]; then
  echo "ERROR: Configuration file not found: ${CONFIG_FILE}"
  exit 1
fi

# Validate JSON syntax
if ! bun run -e "JSON.parse(await Bun.file('${CONFIG_FILE}').text())" &> /dev/null; then
  echo "ERROR: Invalid JSON in configuration file"
  exit 1
fi

echo "✓ Configuration validated"

# ============================================================================
# 7. Test Backend Connectivity
# ============================================================================

echo "Testing backend connectivity..."

BACKEND_ENDPOINT="https://activity.metabob.com"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: ApiKey ${METABOB_API_KEY}" \
  "${BACKEND_ENDPOINT}/health")

if [ "${HTTP_STATUS}" != "200" ]; then
  echo "WARNING: Backend health check failed (HTTP ${HTTP_STATUS})"
  echo "Continuing anyway - backend may be temporarily unavailable"
else
  echo "✓ Backend connectivity verified"
fi

# ============================================================================
# 8. Create .gitignore
# ============================================================================

cat > "${WORKSPACE_DIR}/.gitignore" << 'EOF'
node_modules/
*.log
.env
.DS_Store
dist/
build/
EOF

# ============================================================================
# Summary
# ============================================================================

echo ""
echo "=========================================="
echo "Sandbox Environment Setup Complete"
echo "=========================================="
echo ""
echo "Workspace: ${WORKSPACE_DIR}"
echo "Logs:      ${LOG_DIR}"
echo "Config:    ${CONFIG_FILE}"
echo ""
echo "Next steps:"
echo "  1. Review validation tests: ${SCRIPT_DIR}/validation-tests.json"
echo "  2. Run validation suite:    bun run ${SCRIPT_DIR}/run-validation.ts"
echo "  3. View results:            cat ${SCRIPT_DIR}/reports/validation-report.json"
echo ""
