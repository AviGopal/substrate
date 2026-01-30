#!/bin/bash
# Complete validation loop for double-blind architecture compliance

set -e

echo "════════════════════════════════════════════════════════════════"
echo "DOUBLE-BLIND ARCHITECTURE VALIDATION LOOP"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "This will:"
echo "  1. Run validation across metabob-cli, metabob-opencode, metabob-rpc-api"
echo "  2. Generate implementation activities for missing pieces"
echo "  3. Execute generated activities (with lockstep commits)"
echo "  4. Re-validate to verify fixes"
echo "  5. Confirm validation detected improvements"
echo ""
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

# Step 1: Run initial validation
echo ""
echo "─────────────────────────────────────────────────────────────────"
echo "STEP 1: Initial Validation"
echo "─────────────────────────────────────────────────────────────────"
echo ""

# We'll use the validate-create-verify-loop meta-activity which orchestrates everything
echo "Executing: validate-create-verify-loop"
echo ""
echo "Variables:"
echo "  - validation_activity_id: validate-double-blind-architecture"
echo "  - target_system: double-blind-learning-system"
echo "  - validation_command: Run validation tasks manually"
echo ""

# For now, let's run the validation activity directly first
echo "Running initial validation..."
echo ""
echo "This would execute:"
echo "  opencode activity run validate-double-blind-architecture"
echo ""
echo "Which validates:"
echo "  - metabob-cli MCP tools (pure CPG, no scores)"
echo "  - metabob-opencode RPC integration (minimal data)"
echo "  - metabob-rpc-api endpoints (Thompson Sampling, Celery)"
echo "  - Cross-repo integration"
echo ""

