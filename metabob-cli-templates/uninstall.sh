#!/bin/bash
# Metabob Core Templates - Uninstall Script

set -e

TEMPLATE_DIR="${METABOB_TEMPLATES_DIR:-$HOME/.local/share/metabob/templates}"

echo "This will remove: $TEMPLATE_DIR"
read -p "Continue? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  rm -rf "$TEMPLATE_DIR"
  echo "✓ Templates removed"
else
  echo "Cancelled"
fi
