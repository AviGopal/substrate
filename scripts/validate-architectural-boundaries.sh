#!/usr/bin/env bash
# Validate Architectural Boundaries in metabob-opencode
#
# This script validates that metabob-opencode maintains clean architectural boundaries:
# 1. NO docker-exec in framework code (use Transport abstraction)
# 2. NO SurrealDB in framework code (use VesselRegistry interface)
# 3. NO direct fetch() to RPC API (use CLI MCP tools)
#
# Exit codes:
#   0 - All boundaries enforced
#   1 - One or more violations found

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPENCODE_ROOT="$REPO_ROOT/repos/metabob-opencode"

echo "=================================================="
echo "Architectural Boundary Validation"
echo "=================================================="
echo ""

VIOLATIONS=0

# ==============================================================================
# Boundary 1: NO docker-exec in framework code
# ==============================================================================

echo "Checking Boundary 1: NO docker-exec in framework code..."
cd "$OPENCODE_ROOT"

DOCKER_VIOLATIONS=$(rg "docker.*exec|spawn.*docker" packages/opencode/src/ -n --type-add 'ts:*.ts' --type ts | grep -v "// " | grep -v "/\*" | wc -l || true)

if [ "$DOCKER_VIOLATIONS" -gt 0 ]; then
  echo -e "${RED}❌ FAIL: Found $DOCKER_VIOLATIONS docker-exec references in framework${NC}"
  rg "docker.*exec|spawn.*docker" packages/opencode/src/ -n --type-add 'ts:*.ts' --type ts | head -10
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo -e "${GREEN}✅ PASS: No docker-exec in framework${NC}"
fi
echo ""

# ==============================================================================
# Boundary 2: NO SurrealDB in framework code (except comments)
# ==============================================================================

echo "Checking Boundary 2: NO SurrealDB in framework code..."

# Check for SurrealDB imports or usage (excluding comments)
SURREAL_IMPORTS=$(rg "import.*surrealdb|new Surreal\(\)" packages/opencode/src/ --type-add 'ts:*.ts' --type ts | wc -l || true)

if [ "$SURREAL_IMPORTS" -gt 0 ]; then
  echo -e "${RED}❌ FAIL: Found $SURREAL_IMPORTS SurrealDB imports/usage in framework${NC}"
  rg "import.*surrealdb|new Surreal\(\)" packages/opencode/src/ --type-add 'ts:*.ts' --type ts
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo -e "${GREEN}✅ PASS: No SurrealDB imports in framework${NC}"
fi

# Check for registerVesselInSurrealDB function (old violation)
SURREAL_FUNCTION=$(rg "registerVesselInSurrealDB" packages/opencode/src/ --type-add 'ts:*.ts' --type ts | grep -v "// " | wc -l || true)

if [ "$SURREAL_FUNCTION" -gt 0 ]; then
  echo -e "${RED}❌ FAIL: Found registerVesselInSurrealDB function (should be registerVesselInRegistry)${NC}"
  rg "registerVesselInSurrealDB" packages/opencode/src/ --type-add 'ts:*.ts' --type ts
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo -e "${GREEN}✅ PASS: No registerVesselInSurrealDB function${NC}"
fi
echo ""

# ==============================================================================
# Boundary 3: NO direct fetch() to RPC API
# ==============================================================================

echo "Checking Boundary 3: NO direct fetch() to RPC API endpoints..."

# Check for direct fetch calls to API endpoints
API_FETCH=$(rg "fetch.*\/api\/vessels|fetch.*\/api\/activities|fetch.*\/api\/templates" packages/opencode/src/ --type-add 'ts:*.ts' --type ts | wc -l || true)

if [ "$API_FETCH" -gt 0 ]; then
  echo -e "${RED}❌ FAIL: Found $API_FETCH direct fetch() calls to RPC API${NC}"
  rg "fetch.*\/api\/vessels|fetch.*\/api\/activities|fetch.*\/api\/templates" packages/opencode/src/ -n --type-add 'ts:*.ts' --type ts
  echo -e "${YELLOW}💡 TIP: Use CLI MCP tools instead (vessel_register, vessel_get_config, etc.)${NC}"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo -e "${GREEN}✅ PASS: No direct fetch() to RPC API${NC}"
fi

# Check for hardcoded backend URLs in fetch calls
BACKEND_URL_FETCH=$(rg "fetch.*backend_url|fetch.*METABOB_API" packages/opencode/src/ --type-add 'ts:*.ts' --type ts | wc -l || true)

if [ "$BACKEND_URL_FETCH" -gt 0 ]; then
  echo -e "${RED}❌ FAIL: Found $BACKEND_URL_FETCH hardcoded backend URLs in fetch() calls${NC}"
  rg "fetch.*backend_url|fetch.*METABOB_API" packages/opencode/src/ -n --type-add 'ts:*.ts' --type ts
  VIOLATIONS=$((VIOLATIONS + 1))
else
  echo -e "${GREEN}✅ PASS: No hardcoded backend URLs in fetch()${NC}"
fi
echo ""

# ==============================================================================
# Positive Validation: MCP tools ARE used
# ==============================================================================

echo "Checking positive validation: MCP tools are used..."

MCP_USAGE=$(rg "MCP\.clients|callTool.*vessel_register|callTool.*metabob_" packages/opencode/src/ --type-add 'ts:*.ts' --type ts | wc -l || true)

if [ "$MCP_USAGE" -gt 0 ]; then
  echo -e "${GREEN}✅ PASS: MCP tools are used ($MCP_USAGE references)${NC}"
else
  echo -e "${YELLOW}⚠️  WARNING: No MCP tool usage detected${NC}"
fi
echo ""

# ==============================================================================
# VesselRegistry interface validation
# ==============================================================================

echo "Checking VesselRegistry interface abstraction..."

VESSEL_REGISTRY_EXISTS=$([ -f "packages/opencode/src/vessel/registry.ts" ] && echo "1" || echo "0")

if [ "$VESSEL_REGISTRY_EXISTS" == "1" ]; then
  echo -e "${GREEN}✅ PASS: VesselRegistry interface exists${NC}"
  
  # Check that it's actually used
  REGISTRY_USAGE=$(rg "import.*VesselRegistry|: VesselRegistry" packages/opencode/src/ --type-add 'ts:*.ts' --type ts | wc -l || true)
  
  if [ "$REGISTRY_USAGE" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS: VesselRegistry interface is used ($REGISTRY_USAGE references)${NC}"
  else
    echo -e "${YELLOW}⚠️  WARNING: VesselRegistry interface exists but not used${NC}"
  fi
else
  echo -e "${RED}❌ FAIL: VesselRegistry interface not found${NC}"
  VIOLATIONS=$((VIOLATIONS + 1))
fi
echo ""

# ==============================================================================
# Summary
# ==============================================================================

echo "=================================================="
echo "Summary"
echo "=================================================="

if [ $VIOLATIONS -eq 0 ]; then
  echo -e "${GREEN}✅ ALL BOUNDARIES ENFORCED${NC}"
  echo ""
  echo "Clean architecture maintained:"
  echo "  ✅ No docker-exec in framework"
  echo "  ✅ No SurrealDB in framework"
  echo "  ✅ No direct fetch() to RPC API"
  echo "  ✅ VesselRegistry abstraction in place"
  echo "  ✅ MCP tools are used"
  echo ""
  exit 0
else
  echo -e "${RED}❌ VIOLATIONS FOUND: $VIOLATIONS boundary violations${NC}"
  echo ""
  echo "Action required:"
  echo "  1. Review violations above"
  echo "  2. Refactor code to use abstractions"
  echo "  3. See docs/architectural-boundaries/ for guidance"
  echo ""
  exit 1
fi
