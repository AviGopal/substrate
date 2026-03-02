#!/bin/bash
# Metabob Core Templates - Installation Script

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[Install]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }

log "Installing Metabob Core Templates"

# Determine installation directory
if [ -n "$METABOB_TEMPLATES_DIR" ]; then
  INSTALL_DIR="$METABOB_TEMPLATES_DIR"
else
  INSTALL_DIR="$HOME/.local/share/metabob/templates"
fi

log "Installation directory: $INSTALL_DIR"

# Create directories
mkdir -p "$INSTALL_DIR/builtin"
mkdir -p "$INSTALL_DIR/registry"
mkdir -p "$INSTALL_DIR/cache"

# Copy builtin templates
log "Copying builtin templates..."
cp -r builtin/* "$INSTALL_DIR/builtin/" 2>/dev/null || {
  echo "Error: builtin/ directory not found"
  exit 1
}

# Count templates
TEMPLATE_COUNT=$(ls "$INSTALL_DIR/builtin"/*.json 2>/dev/null | wc -l)

success "Installed $TEMPLATE_COUNT builtin templates"

# Create config if not exists
CONFIG_FILE="$HOME/.config/metabob/cli.json"
if [ ! -f "$CONFIG_FILE" ]; then
  log "Creating config file: $CONFIG_FILE"
  mkdir -p "$(dirname "$CONFIG_FILE")"
  cat > "$CONFIG_FILE" << EOF
{
  "templates": {
    "dir": "$INSTALL_DIR",
    "autoUpdate": true
  },
  "registry": {
    "url": "https://api.metabob.com",
    "cacheTTL": 3600
  }
}
EOF
  success "Config created"
fi

echo
log "Installation complete!"
echo
echo "Next steps:"
echo "  1. Verify: metabob-cli templates list"
echo "  2. Pull registry: metabob-cli templates pull (optional)"
echo "  3. Execute: metabob-cli exec activity --template add-feature-complete"
