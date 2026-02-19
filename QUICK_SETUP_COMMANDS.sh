#!/bin/bash
#
# Quick Setup Commands for concept-commerce-mvp-optimized
#
# Copy and paste these commands into your terminal to set up
# metabob-cli MCP for Claude Code in the concept-commerce project
#

echo "Setting up Metabob MCP for concept-commerce-mvp-optimized..."
echo ""

# Navigate to project
cd ~/documents/scratch/concept-commerce-mvp-optimized

# Remove existing configuration (if any)
echo "Removing existing configuration..."
claude mcp remove metabob --scope local 2>/dev/null || true

# Add metabob with correct config path
echo "Adding metabob MCP server..."
claude mcp add \
  -e METABOB_CONFIG_PATH="$HOME/documents/scratch/concept-commerce-mvp-optimized/.metabob/config.json" \
  --scope local \
  metabob -- /home/avi/.pyenv/shims/metabob-cli mcp --transport stdio

# Verify
echo ""
echo "Verifying configuration..."
claude mcp list

echo ""
echo "✓ Setup complete!"
echo ""
echo "Test with:"
echo "  cd ~/documents/scratch/concept-commerce-mvp-optimized"
echo "  claude 'What Metabob tools are available?'"
echo ""
