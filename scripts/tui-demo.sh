#!/bin/bash
# =============================================================================
# DevBob TUI Demo Script
# =============================================================================
# Demonstrates the DevBob TUI functionality
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_demo() { echo -e "${CYAN}[DEMO]${NC} $1"; }

clear
cat << "EOF"
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                 DevBob TUI Demonstration                  ║
║                                                           ║
║            Terminal User Interface Access                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

This demo shows how to use the DevBob TUI feature:

EOF

cd "$PROJECT_ROOT"

# Demo 1: Show TUI command in help
log_demo "1. TUI Command in DevBob CLI"
echo ""
./devbob help | grep -A 3 -B 3 "tui"
echo ""

# Demo 2: Show container status
log_demo "2. Container Status Check"
echo ""
if ./devbob status | grep -q "healthy"; then
    log_success "DevBob container is healthy and ready"
else
    log_info "Starting DevBob container..."
    ./devbob start devbob-opencode
    sleep 5
fi
echo ""

# Demo 3: Show what happens when you run TUI command
log_demo "3. TUI Command Preview"
echo ""
log_info "When you run './devbob tui', you'll see:"
echo ""
cat << "TUI_PREVIEW"
🤖 Starting preconfigured DevBob agent...
📋 This will open the OpenCode Terminal User Interface
💡 Use Ctrl+C to exit when done

💡 Quick Tips:
   • Type commands or questions naturally
   • Use 'activity' to run structured workflows
   • Use 'run <message>' for quick tasks
   • Press Ctrl+C to exit back to host
   • All changes auto-commit and push (if configured)

╔═══════════════════════════════════════════════════════════╗
║                    🚀 DevBob Agent                        ║
╚═══════════════════════════════════════════════════════════╝

📂 Working in: /workspace
🔗 Repository: git@github.com:your-org/repo.git
🌿 Branch: feat/your-feature
✅ Status: Working directory clean

Environment:
• API Key: ✅ Configured
• Metabob: ⚠️  Disabled (standalone mode)

Starting OpenCode TUI...
────────────────────────────────────────────────────────────

[OpenCode TUI Interface Starts Here]
TUI_PREVIEW
echo ""

# Demo 4: Show actual environment info
log_demo "4. Current DevBob Environment"
echo ""
docker exec devbob-opencode bash -c '
echo "📂 Working directory: $(pwd)"
echo "🔗 Repository: $(git remote get-url origin 2>/dev/null)"  
echo "🌿 Branch: $(git branch --show-current 2>/dev/null)"
echo "📝 Files: $(find . -maxdepth 2 -type f | wc -l) files"
echo "📁 Directories: $(find . -maxdepth 1 -type d | wc -l) directories"
echo "💾 Disk usage: $(du -sh . | cut -f1)"
'
echo ""

# Demo 5: Usage examples
log_demo "5. How to Use DevBob TUI"
echo ""
cat << "USAGE"
After launching the TUI with './devbob tui', you can:

✨ Natural Language Tasks:
   > "Add unit tests for the authentication module"
   > "Refactor the user service to use dependency injection"
   > "Fix any TypeScript errors in the codebase"

🔧 Activity Workflows:
   > activity
   > run add-feature-complete --feature="user dashboard"

🚀 Quick Commands:  
   > run "Add logging to the payment service"
   > help
   > exit

📋 File Operations:
   All file changes are automatically tracked in git
   Commits are created with descriptive messages
   Push happens on container exit (if configured)

USAGE

# Demo 6: Alternative access methods
log_demo "6. Alternative Access Methods"
echo ""
echo "Besides TUI, you can also access DevBob via:"
echo ""
echo "🖥️  Shell Access:"
echo "   ./devbob shell devbob-opencode"
echo "   (Direct bash shell in container)"
echo ""
echo "🌐 HTTP API (when working):"
echo "   curl -X POST http://localhost:3004/acp/sessions \\"
echo "     -d '{\"prompt\":\"your task\"}'"
echo ""
echo "📁 Direct File Access:"
echo "   docker exec devbob-opencode ls /workspace"
echo "   (View/edit files directly)"
echo ""

# Demo 7: Ready to launch
log_demo "7. Ready to Launch!"
echo ""
echo "To start using DevBob TUI right now:"
echo ""
echo "  cd /home/avi/documents/work/exp-repo/metabob-devbob"
echo "  ./devbob tui"
echo ""
log_success "DevBob TUI is ready for interactive use!"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "🎯 Next Steps:"
echo "   1. Run: ./devbob tui"
echo "   2. Try: 'Add a simple test file'"
echo "   3. Watch: Git auto-commit and push"
echo "   4. Exit: Ctrl+C to return to host"
echo "════════════════════════════════════════════════════════════"