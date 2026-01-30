#!/bin/bash
# Direct validation of three repositories for double-blind architecture

echo "════════════════════════════════════════════════════════════════"
echo "DOUBLE-BLIND ARCHITECTURE VALIDATION"
echo "Direct Assessment (Phase 1)"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Create validation output directory
mkdir -p validation-results
cd validation-results

echo "Validating three repositories:"
echo "  - repos/metabob-cli"
echo "  - repos/metabob-opencode"
echo "  - repos/metabob-rpc-api"
echo ""

# ============================================================================
# METABOB-CLI VALIDATION
# ============================================================================
echo "─────────────────────────────────────────────────────────────────"
echo "1. metabob-cli MCP Sidecar"
echo "─────────────────────────────────────────────────────────────────"
echo ""

cd ../repos/metabob-cli

echo "Checking MCP tool implementations..."
echo ""

# Check for MCP tool files
echo "MCP Tools Found:"
find . -name "*mcp*" -o -name "*tool*" | grep -v node_modules | grep -v ".git" | head -10

echo ""
echo "Searching for prohibited fields in MCP responses..."

# Search for scoring/confidence in code
if rg -q "similarity.*score|confidence|relevance" src/ 2>/dev/null; then
    echo "⚠️  WARNING: Found similarity scores or confidence values"
    rg "similarity.*score|confidence|relevance" src/ -n | head -5
else
    echo "✅ No similarity scores found"
fi

echo ""

