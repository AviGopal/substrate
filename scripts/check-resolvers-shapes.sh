#!/usr/bin/env bash
#
# Check MiniBob Resolvers and Shapes
# Shows available resolvers, shapes, and validators
#

set -e

WORKSPACE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MINIBOB_DIR="$WORKSPACE_ROOT/repos/minibob"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  MiniBob Resolvers & Shapes"
echo "=========================================="
echo ""

cd "$MINIBOB_DIR"

# Check available resolvers
echo -e "${BLUE}1. Available Resolvers${NC}"
echo ""
echo "Checking src/resolvers/ directory..."
echo ""

for resolver in src/resolvers/*.ts; do
  filename=$(basename "$resolver" .ts)
  if [[ "$filename" != "index" && "$filename" != "base" && "$filename" != "README" ]]; then
    echo "  ✓ $filename"

    # Extract purpose from file header if available
    purpose=$(head -20 "$resolver" | grep -A 2 "Purpose:" | tail -1 | sed 's/^[ *]*//' || echo "")
    if [ -n "$purpose" ]; then
      echo "    $purpose"
    fi
  fi
done

echo ""

# Check shape definitions
echo -e "${BLUE}2. Canonical Shapes${NC}"
echo ""
echo "Extracting from shape-resolver.ts..."
echo ""

# Input shapes
echo "Input Shapes (what activities consume):"
grep -A 1 "// .*patterns" src/shape-resolver.ts | grep "shapes.add" | \
  sed 's/.*shapes.add("\([^"]*\)".*/  - \1/' | sort -u | head -15

echo ""

# Output shapes (from outcome-to-shape.ts)
echo "Output Shapes (what activities produce):"
grep "shapes:.*\[" src/outcome-to-shape.ts | \
  sed 's/.*shapes: \["\([^"]*\)".*/  - \1/' | sort -u | head -15

echo ""

# Check validators
echo -e "${BLUE}3. Built-in Validators${NC}"
echo ""
echo "Checking src/validators/validators/ directory..."
echo ""

for validator in src/validators/validators/*.ts; do
  filename=$(basename "$validator" .ts)

  # Count validator functions in file
  count=$(grep -c "Validator.*async" "$validator" 2>/dev/null || echo "0")

  echo "  ✓ $filename ($count validator$([ "$count" != "1" ] && echo "s" || echo ""))"
done

echo ""

# Check environment capabilities
echo -e "${BLUE}4. Environment Capabilities${NC}"
echo ""

# Check for Docker
if command -v docker &> /dev/null; then
  echo "  ✓ Docker available (sandbox support)"
  docker_version=$(docker --version | cut -d' ' -f3 | tr -d ',')
  echo "    Version: $docker_version"
else
  echo "  ✗ Docker not available (no sandbox support)"
fi

# Check for LLM API key
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "  ✓ LLM Resolver available (ANTHROPIC_API_KEY set)"
else
  echo "  ⚠ LLM Resolver disabled (no ANTHROPIC_API_KEY)"
fi

# Check for Git
if command -v git &> /dev/null; then
  echo "  ✓ Git Resolver available"
else
  echo "  ✗ Git Resolver unavailable"
fi

# Check for Bun
if command -v bun &> /dev/null; then
  echo "  ✓ Bun available (test/build validators)"
  bun_version=$(bun --version)
  echo "    Version: $bun_version"
else
  echo "  ⚠ Bun not available (some validators may fail)"
fi

echo ""

# Check activity templates with shapes
echo -e "${BLUE}5. Template Shape Usage${NC}"
echo ""

# Query backend for templates with shape metadata
BACKEND_URL="${ACTIVITY_API_ENDPOINT:-https://activity.metabob.com}"

echo "Querying backend for template shapes..."
echo ""

templates_with_shapes=$(curl -s "$BACKEND_URL/v2/activities/templates?limit=100" 2>/dev/null | \
  jq -r '.templates[] | select(.input_shapes != null or .output_shapes != null) |
    "\(.id)\n  Input: \(.input_shapes // [] | join(", "))\n  Output: \(.output_shapes // [] | join(", "))"' 2>/dev/null || echo "")

if [ -n "$templates_with_shapes" ]; then
  echo "$templates_with_shapes" | head -30
  echo ""
  total=$(echo "$templates_with_shapes" | grep -c "Input:" || echo "0")
  echo "  Total templates with shapes: $total"
else
  echo "  No templates with shape metadata found"
  echo "  (Shapes are optional metadata for better activity matching)"
fi

echo ""

# Summary
echo "=========================================="
echo "  Summary"
echo "=========================================="
echo ""

echo "Resolvers:"
resolver_count=$(ls -1 src/resolvers/*.ts | grep -v "index.ts\|base.ts\|README.md" | wc -l)
echo "  - $resolver_count resolver implementations"
echo ""

echo "Shapes:"
echo "  - Input shapes for activity selection"
echo "  - Output shapes for validation"
echo "  - Shape inference from goals"
echo ""

echo "Validators:"
validator_count=$(ls -1 src/validators/validators/*.ts 2>/dev/null | wc -l)
echo "  - $validator_count validator types"
echo "  - Deterministic validation"
echo "  - Early exit optimization"
echo ""

echo "Capabilities:"
[ -n "$(command -v docker)" ] && echo "  ✓ Sandbox execution (Docker)" || echo "  ✗ No sandbox support"
[ -n "$ANTHROPIC_API_KEY" ] && echo "  ✓ LLM reasoning" || echo "  ✗ LLM disabled"
[ -n "$(command -v git)" ] && echo "  ✓ Git operations" || echo "  ✗ No git"
[ -n "$(command -v bun)" ] && echo "  ✓ Build/test validation" || echo "  ⚠ Limited validation"
echo ""

echo "Next steps:"
echo "  1. Review: MINIBOB_RESOLVERS_SHAPES_SANDBOX.md"
echo "  2. Check: bun test (run validator tests)"
echo "  3. Explore: repos/minibob/src/resolvers/"
echo "  4. Create: Custom validators or resolvers"
echo ""
