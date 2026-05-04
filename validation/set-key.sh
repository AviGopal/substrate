#!/usr/bin/env bash
# Outputs the ANTHROPIC_API_KEY export statement. Source this file.
# Usage: source validation/set-key.sh
CONFIG_FILE="$HOME/.metabob/config.json"
ANTHROPIC_API_KEY=$(jq -r '.providers.anthropic.apiKey' "$CONFIG_FILE")
export ANTHROPIC_API_KEY
echo "ANTHROPIC_API_KEY exported (length=${#ANTHROPIC_API_KEY})"
