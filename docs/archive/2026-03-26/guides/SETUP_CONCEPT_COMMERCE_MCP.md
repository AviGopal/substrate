# Setup Metabob MCP for concept-commerce-mvp-optimized

This guide will help you configure metabob-cli as an MCP server for Claude Code in your `concept-commerce-mvp-optimized` project.

## Quick Setup (Run These Commands)

### Option 1: Using the Automated Script

```bash
cd ~/documents/work/exp-repo/metabob-devbob/repos/metabob-cli

./scripts/setup-project-mcp.sh \
  ~/documents/scratch/concept-commerce-mvp-optimized \
  .metabob/config.json
```

### Option 2: Manual Setup

```bash
# 1. Navigate to your project
cd ~/documents/scratch/concept-commerce-mvp-optimized

# 2. Remove existing metabob configuration (if any)
claude mcp remove metabob --scope local

# 3. Add metabob with correct config path
claude mcp add \
  -e METABOB_CONFIG_PATH="$HOME/documents/scratch/concept-commerce-mvp-optimized/.metabob/config.json" \
  --scope local \
  metabob -- /home/avi/.pyenv/shims/metabob-cli mcp --transport stdio

# 4. Verify configuration
claude mcp list
```

Expected output:
```
metabob: /home/avi/.pyenv/shims/metabob-cli mcp --transport stdio - ✓ Connected
  Environment:
    METABOB_CONFIG_PATH=/home/avi/documents/scratch/concept-commerce-mvp-optimized/.metabob/config.json
  Scope: local
```

## Verification

### Test 1: Check MCP Server

```bash
cd ~/documents/scratch/concept-commerce-mvp-optimized
claude mcp list
```

Should show metabob server connected.

### Test 2: Test Claude Communication

```bash
cd ~/documents/scratch/concept-commerce-mvp-optimized
claude --print "Just respond with 'Ready'"
```

Should get a response from Claude.

### Test 3: Test Metabob Tools

```bash
cd ~/documents/scratch/concept-commerce-mvp-optimized
claude "List the Metabob tools available"
```

Should list tools like:
- search_codebase_issues
- get_priority_issues
- mark_problem_complete
- annotate_component
- analyze_change_impact
- list_file_components
- etc.

## Usage Examples

Once configured, you can use Metabob with Claude Code:

### Find Issues

```bash
cd ~/documents/scratch/concept-commerce-mvp-optimized
claude "Use Metabob to search for security issues in the backend"
```

### Get Priority Issues

```bash
claude "Use get_priority_issues to show me what I should work on"
```

### Before Refactoring

```bash
claude "I want to refactor the auth.py file. Use analyze_change_impact to show me dependencies"
```

### Document Changes

```bash
claude "I just fixed a bug in payment.py. Use mark_problem_complete to document it"
```

## Configuration Details

### Current Config Location

```
~/documents/scratch/concept-commerce-mvp-optimized/.metabob/config.json
```

### Config Contents

The config should contain:
```json
{
  "base_url": "https://ide.metabob.com",
  "include_paths": [
    "frontend/",
    "backend/"
  ],
  "exclude_paths": [
    "node_modules/**",
    "dist/**",
    "build/**",
    ...
  ],
  ...
}
```

### Scope: Local

The configuration uses `--scope local`, which means:
- Configuration is specific to `~/documents/scratch/concept-commerce-mvp-optimized`
- Other projects are not affected
- Config is stored in `.claude.json` in the project directory

## Troubleshooting

### Issue: "MCP server not responding"

**Solution:**
```bash
# Check metabob-cli is working
metabob-cli --version

# Test MCP server directly
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | metabob-cli mcp --transport stdio
```

### Issue: "No analysis results"

**Solution:**
1. Verify config file exists:
   ```bash
   cat ~/.metabob/config.json
   ```

2. Check if API key is set (config should have base_url)

3. Let metabob analyze the code (takes 1-5 minutes first time)

### Issue: "Configuration not persisting"

**Solution:**
Make sure you're in the project directory when configuring:
```bash
cd ~/documents/scratch/concept-commerce-mvp-optimized
claude mcp remove metabob --scope local
# Then add again with full command
```

### Issue: Environment variable not being used

**Solution:**
Check the configured environment:
```bash
cd ~/documents/scratch/concept-commerce-mvp-optimized
claude mcp list
```

Look for:
```
Environment:
  METABOB_CONFIG_PATH=/home/avi/documents/scratch/concept-commerce-mvp-optimized/.metabob/config.json
```

If missing, reconfigure with the manual setup commands above.

## What the Setup Does

1. **Configures Claude Code** to start metabob-cli as a subprocess when needed
2. **Sets environment variable** `METABOB_CONFIG_PATH` to point to your project's config
3. **Uses local scope** so configuration only applies to this project
4. **Enables all Metabob tools** for use with Claude Code

## Next Steps

After setup:

1. **Test it out:**
   ```bash
   cd ~/documents/scratch/concept-commerce-mvp-optimized
   claude "What can Metabob help me with?"
   ```

2. **Use for analysis:**
   ```bash
   claude "Search for code quality issues in the backend using Metabob"
   ```

3. **Integrate into workflow:**
   - Use `get_priority_issues` to find what to work on
   - Use `analyze_change_impact` before refactoring
   - Use `mark_problem_complete` and `annotate_component` after fixes

## Files Created

- `.claude.json` (in project root) - Local Claude configuration
- No changes to your code or existing configs

## Reverting

To remove the configuration:

```bash
cd ~/documents/scratch/concept-commerce-mvp-optimized
claude mcp remove metabob --scope local
```

This will remove the metabob MCP server from this project only.

---

## Quick Reference Commands

```bash
# Setup
cd ~/documents/work/exp-repo/metabob-devbob/repos/metabob-cli
./scripts/setup-project-mcp.sh ~/documents/scratch/concept-commerce-mvp-optimized .metabob/config.json

# Verify
cd ~/documents/scratch/concept-commerce-mvp-optimized
claude mcp list

# Use
claude "Search for security issues using Metabob"

# Remove
claude mcp remove metabob --scope local
```

---

**Status**: Ready to configure ✅  
**Config File**: Exists at `.metabob/config.json` ✅  
**Claude Code**: Installed ✅  
**Metabob CLI**: Installed at `/home/avi/.pyenv/shims/metabob-cli` ✅  

Just run the commands above to complete the setup!
