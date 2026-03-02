#!/bin/bash
# Create Portable Template Package
# Bundles core templates for distribution with metabob-cli

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +%T)]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }

log "Creating Portable Template Package"
echo

# Configuration
PACKAGE_DIR="./metabob-cli-templates"
BUILTIN_DIR="$PACKAGE_DIR/builtin"
VERSION="1.0.0"

# Create package structure
log "Creating package structure..."
mkdir -p "$BUILTIN_DIR"
mkdir -p "$PACKAGE_DIR/registry"
mkdir -p "$PACKAGE_DIR/cache"

# Core templates to bundle (must exist for system to function)
CORE_TEMPLATES=(
  "add-feature-complete"
  "fix-bug-complete"
  "refactor-with-tests"
  "create-activity-template"
  "trace-data-flow-single-feature"
  "add-comprehensive-logging"
  "commit-organized-changes"
)

# Copy core templates
log "Bundling core templates..."
BUNDLED=0
MISSING=0

for template in "${CORE_TEMPLATES[@]}"; do
  if [ -f "templates/${template}.json" ]; then
    cp "templates/${template}.json" "$BUILTIN_DIR/"
    success "$template"
    BUNDLED=$((BUNDLED + 1))
  else
    warn "Missing: $template (skipping)"
    MISSING=$((MISSING + 1))
  fi
done

echo
log "Template bundling complete: $BUNDLED bundled, $MISSING missing"

# Create manifest
log "Creating package manifest..."
cat > "$PACKAGE_DIR/manifest.json" << EOF
{
  "name": "metabob-core-templates",
  "version": "$VERSION",
  "description": "Core activity templates bundled with metabob-cli",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "templates": {
    "builtin": [
$(ls "$BUILTIN_DIR"/*.json 2>/dev/null | sed 's|.*/\(.*\)\.json|      "\1"|' | paste -sd, -)
    ]
  },
  "directories": {
    "builtin": "builtin/",
    "registry": "registry/",
    "cache": "cache/"
  },
  "usage": {
    "install": "Copy to ~/.local/share/metabob/templates/",
    "cli": "metabob-cli init"
  }
}
EOF

success "Manifest created"

# Create README
log "Creating package README..."
cat > "$PACKAGE_DIR/README.md" << 'EOF'
# Metabob Core Templates

**Version:** 1.0.0  
**Purpose:** Portable template package for metabob-cli

## Contents

### Builtin Templates

Core templates bundled with every metabob-cli installation:

- **add-feature-complete** - Add new feature with tests and commit
- **fix-bug-complete** - Fix bug with root cause analysis and tests
- **refactor-with-tests** - Refactor code with safety checks
- **create-activity-template** - Create new activity templates
- **trace-data-flow-single-feature** - Generate comprehensive data flow documentation
- **add-comprehensive-logging** - Add logging to codebase
- **commit-organized-changes** - Create organized git commits

### Registry Templates

Downloaded from Metabob backend (requires network):
- Use `metabob-cli templates pull` to download
- Cached in `registry/` directory

## Installation

### Automatic (Recommended)

```bash
metabob-cli init
```

### Manual

```bash
# Copy to user template directory
mkdir -p ~/.local/share/metabob/templates/
cp -r builtin/ ~/.local/share/metabob/templates/
```

## Usage

### List Available Templates

```bash
metabob-cli templates list
```

### Execute Template

```bash
metabob-cli exec activity \
  --template add-feature-complete \
  --vars '{"featureName": "user-auth", "files": ["src/auth.ts"]}'
```

### Pull Additional Templates

```bash
metabob-cli templates pull
```

## Directory Structure

```
~/.local/share/metabob/templates/
├── builtin/              # Bundled templates (offline)
│   ├── add-feature-complete.json
│   ├── fix-bug-complete.json
│   └── ...
├── registry/             # Downloaded templates
│   └── (pulled from backend)
└── cache/                # Template execution cache
```

## Template Resolution Order

1. **User override:** `~/.local/share/metabob/templates/user/{template-id}.json`
2. **Registry:** `~/.local/share/metabob/templates/registry/{template-id}.json`
3. **Builtin:** `~/.local/share/metabob/templates/builtin/{template-id}.json`

## Offline Mode

Builtin templates work without network connection. Registry templates require initial pull but are cached locally.

## Version Compatibility

- **metabob-cli:** >= 1.0.0
- **OpenCode:** >= 0.9.0
- **Template Format:** ActivityTemplate.Schema v2

## Support

- Documentation: https://docs.metabob.com/templates
- Issues: https://github.com/metabob/cli/issues
- CLI Help: `metabob-cli templates --help`
EOF

success "README created"

# Create installation script
log "Creating installation script..."
cat > "$PACKAGE_DIR/install.sh" << 'INSTALL_EOF'
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
INSTALL_EOF

chmod +x "$PACKAGE_DIR/install.sh"
success "Installation script created"

# Create uninstall script
cat > "$PACKAGE_DIR/uninstall.sh" << 'UNINSTALL_EOF'
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
UNINSTALL_EOF

chmod +x "$PACKAGE_DIR/uninstall.sh"

# Create archive
log "Creating archive..."
tar -czf "metabob-core-templates-${VERSION}.tar.gz" -C "$PACKAGE_DIR/.." "$(basename "$PACKAGE_DIR")"
success "Archive created: metabob-core-templates-${VERSION}.tar.gz"

# Summary
echo
log "Package Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Package:  $PACKAGE_DIR"
echo "Templates: $BUNDLED bundled"
echo "Archive:  metabob-core-templates-${VERSION}.tar.gz"
echo "Version:  $VERSION"
echo
echo "Distribution:"
echo "  1. Include in metabob-cli releases"
echo "  2. Extract to: ~/.local/share/metabob/templates/"
echo "  3. Or run: ./install.sh"
echo
success "Portable template package ready for distribution"
