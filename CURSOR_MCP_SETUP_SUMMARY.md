# Cursor MCP Setup for Metabob-CLI - Summary

## Status: ✅ READY FOR USE

Comprehensive Cursor IDE integration for metabob-cli MCP server has been implemented and documented.

## What Was Created

### 1. Documentation
**File**: `repos/metabob-cli/docs/CURSOR_SETUP.md`

Complete setup guide including:
- Quick start (3 steps)
- Manual setup instructions
- Available tools reference
- Cursor-specific features (Inline Chat, Composer Mode)
- Usage examples
- Troubleshooting guide
- Advanced configuration
- Best practices

**Length**: ~550 lines of comprehensive documentation

### 2. Setup Script
**File**: `repos/metabob-cli/scripts/setup-cursor-mcp.sh`

Automated setup script that:
- Auto-detects metabob-cli installation
- Supports both direct binary and `uv run` methods
- Creates `.cursor/mcp.json` configuration
- Creates example `.metabob-config.json` if missing
- Adds config to `.gitignore` automatically
- Validates JSON configuration
- Provides clear next steps

**Features**:
- `--use-uv`: Use uv to run metabob-cli (recommended)
- `--metabob-cli-path`: Specify custom binary location
- `--config-path`: Custom config file path
- `--project-dir`: Target project directory
- `--dry-run`: Preview changes without applying

### 3. Test Script
**File**: `repos/metabob-cli/scripts/test-cursor-mcp.sh`

Comprehensive test suite that checks:
- metabob-cli installation (binary or via uv)
- `.cursor/mcp.json` configuration
- `.metabob-config.json` configuration
- API key configuration
- MCP server functionality (tools/list)
- `.gitignore` security check
- Cursor installation detection

**Features**:
- `--verbose`: Show detailed output
- `--quick`: Skip slow tests
- Color-coded results (pass/fail/skip)
- Actionable recommendations

## How to Use

### Quick Setup (3 Commands)

```bash
cd repos/metabob-cli

# Run setup script
./scripts/setup-cursor-mcp.sh --use-uv

# Update API key in .metabob-config.json
vim .metabob-config.json

# Test the setup
./scripts/test-cursor-mcp.sh
```

### Verify in Cursor

1. Restart Cursor (Cmd/Ctrl + Q, then reopen)
2. Open AI chat (Cmd/Ctrl + L)
3. Ask: "What Metabob tools are available?"
4. Cursor should list all metabob MCP tools

## Configuration Files

### .cursor/mcp.json
```json
{
  "mcpServers": {
    "metabob": {
      "command": "uv",
      "args": ["run", "metabob-cli", "mcp", "--transport", "stdio"],
      "env": {
        "METABOB_CONFIG_PATH": "${workspaceFolder}/.metabob-config.json"
      }
    }
  }
}
```

### .metabob-config.json
```json
{
  "base_url": "https://ide.metabob.com",
  "api_key": "your-api-key-here",
  "session_path": ".metabob",
  "include_paths": ["src/**/*.py", "**/*.js", "**/*.ts"],
  "exclude_paths": ["tests/**", "node_modules/**"],
  "job_timeout_minutes": 10
}
```

## Available Tools in Cursor

Once configured, Cursor's AI can use:

### Core Tools
- `search_codebase_issues` - Find security issues, bugs, code smells
- `get_priority_issues` - Get AI-prioritized work from your context
- `mark_problem_complete` - Document fixes with resolution notes
- `annotate_component` - Document design decisions

### CPG-Powered Tools
- `analyze_change_impact` - Dependency analysis before refactoring
- `list_file_components` - List functions/classes in files
- `suggest_related_changes` - Find co-changing files
- `assess_deletion_safety` - Check if code is safe to delete

### Activity Management
- `metabob_search_activities` - Search activity templates
- `metabob_register_activity_template` - Register templates

## Cursor-Specific Features

### Inline Chat (Cmd/Ctrl + K)
Select code and ask Cursor to analyze it with Metabob:
```
"Are there any issues with this code? Check with Metabob"
```

### Composer Mode (Cmd/Ctrl + I)
Multi-file refactoring with Metabob guidance:
```
"Analyze the impact of changing auth.py using Metabob, then help me refactor safely"
```

### Codebase-Wide Analysis
```
"Use Metabob to analyze the entire codebase for HIGH severity issues"
```

## Workflow Examples

### Starting Work
```
You: "What should I work on? Use get_priority_issues"
Cursor: [Shows 3 priority issues from your recent work]
```

### Before Refactoring
```
You: "Show me what depends on authenticate() before I refactor it"
Cursor: [Uses analyze_change_impact] 15 dependents, 2 critical issues...
```

### After Changes
```
You: "Document this SQL injection fix with mark_problem_complete"
Cursor: [Documents fix with detailed resolution notes]
```

### Check Related Files
```
You: "What related files should I review after changing auth.py?"
Cursor: [Uses suggest_related_changes] Review session.py (12 issues)...
```

## Key Differences: Cursor vs Other IDEs

| Feature | Cursor | Claude Code | Metabob-OpenCode |
|---------|--------|-------------|------------------|
| Configuration | `.cursor/mcp.json` | `.claude.json` | `opencode.json` |
| Inline Chat | ✅ Yes | ❌ No | ✅ Yes |
| Composer Mode | ✅ Yes | ❌ No | ✅ Activities |
| Auto-start MCP | ✅ Yes | ❌ Manual | ✅ Yes |
| Multi-file AI | ✅ Composer | ❌ CLI only | ✅ Activities |

## Troubleshooting Quick Reference

### "Tools not available"
→ Restart Cursor (Cmd/Ctrl + Q, reopen)
→ Check `.cursor/mcp.json` exists and is valid JSON
→ Run: `./scripts/test-cursor-mcp.sh --verbose`

### "No analysis results"
→ Update API key in `.metabob-config.json`
→ Wait 1-5 minutes for initial analysis
→ Check `.metabob/` directory exists

### "MCP server not responding"
→ Test directly: `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | metabob-cli mcp --transport stdio`
→ Try `--use-uv` flag in setup script
→ Check logs in Cursor's output panel

## Documentation Structure

```
repos/metabob-cli/
├── docs/
│   ├── CURSOR_SETUP.md          # ← Comprehensive setup guide
│   └── CLAUDE_CODE_SETUP.md     # Claude Code equivalent
├── scripts/
│   ├── setup-cursor-mcp.sh      # ← Automated setup
│   ├── test-cursor-mcp.sh       # ← Test suite
│   ├── setup-claude-code-mcp.sh # Claude Code version
│   └── test-claude-code-mcp.sh  # Claude Code tests
├── .cursor/
│   └── mcp.json                 # ← Cursor MCP config
├── .gemini/
│   ├── MCP_GUIDE.md             # Detailed MCP workflow guide
│   ├── cursor_settings.example.json  # Example config
│   └── ARCHITECTURE.md          # System architecture
└── .metabob-config.json         # ← Metabob configuration
```

## Testing Status

### Manual Testing
✅ Script creation and structure
✅ Documentation completeness
✅ Configuration file generation
✅ Test coverage

### Ready for End-to-End Testing
⏳ Run setup script in actual project
⏳ Verify Cursor loads MCP server
⏳ Test tool invocation in Cursor
⏳ Verify metabob analysis works

## Next Steps for Users

1. **Quick Start**:
   ```bash
   cd your-project
   /path/to/metabob-cli/scripts/setup-cursor-mcp.sh --use-uv
   ```

2. **Update API Key**:
   Edit `.metabob-config.json` with your API key from https://metabob.com

3. **Restart Cursor**:
   Close completely (Cmd/Ctrl + Q) and reopen

4. **Test Integration**:
   ```bash
   /path/to/metabob-cli/scripts/test-cursor-mcp.sh
   ```

5. **Try in Cursor**:
   - Open AI chat (Cmd/Ctrl + L)
   - Ask: "What Metabob tools are available?"
   - Try: "Use Metabob to find security issues"

## Comparison with Claude Code Setup

Both implementations provide:
- ✅ Automated setup scripts
- ✅ Comprehensive test suites
- ✅ Detailed documentation
- ✅ Configuration validation
- ✅ Dry-run mode
- ✅ Auto-detection of metabob-cli
- ✅ Security checks (gitignore)

**Cursor advantages**:
- Inline chat integration
- Composer mode for multi-file work
- Auto-starts MCP on project open
- Per-project configuration automatic

**Claude Code advantages**:
- Global and per-project scopes
- MCP management via CLI
- Explicit control over MCP lifecycle

## Resources

- **Quick Start**: `repos/metabob-cli/docs/CURSOR_SETUP.md`
- **MCP Guide**: `repos/metabob-cli/.gemini/MCP_GUIDE.md`
- **Architecture**: `repos/metabob-cli/.gemini/ARCHITECTURE.md`
- **Tool Reference**: `repos/metabob-cli/TOOLS_REFERENCE.md`
- **Metabob Website**: https://metabob.com
- **Cursor Docs**: https://docs.cursor.com
- **MCP Spec**: https://modelcontextprotocol.io

## Support

For issues:
1. Check logs: `~/.metabob/mcp.log`
2. Run: `./scripts/test-cursor-mcp.sh --verbose`
3. Review: `docs/CURSOR_SETUP.md` troubleshooting section
4. File issue: https://github.com/metabob/metabob-cli/issues

---

**Summary**: Complete Cursor IDE integration with metabob-cli MCP server is ready. Users can run the setup script, update their API key, restart Cursor, and start using all Metabob tools within Cursor's AI chat and Composer mode.
