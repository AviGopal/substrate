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
