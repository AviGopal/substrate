# DevBob Quick Reference

**Updated:** January 31, 2026  
**Status:** ✅ Multi-mode support added

## Quick Start

```bash
# Start container (quick mode - single devbob-opencode container)
./devbob start

# Check status
./devbob status

# Test ACP connectivity
./devbob test

# View logs
./devbob logs devbob-opencode

# Open shell
./devbob shell

# Launch TUI
./devbob tui
```

## Modes

| Mode | Command | Description |
|------|---------|-------------|
| **quick** (default) | `./devbob start` | Single devbob-opencode container (fast, minimal) |
| **full** | `export DEVBOB_MODE=full && ./devbob start` | Complete stack with backend services |
| **dev** | `export DEVBOB_MODE=dev && ./devbob start` | Development mode with hot-reload |

## Common Commands

```bash
./devbob mode               # Show current configuration
./devbob start              # Start containers
./devbob stop               # Stop containers
./devbob restart            # Restart containers
./devbob status             # Show container status
./devbob logs [container]   # Follow logs
./devbob shell [container]  # Open shell
./devbob tui [container]    # Launch TUI
./devbob test [port]        # Test ACP connectivity
./devbob task "message"     # Send task via ACP
./devbob help               # Show full help
```

## Current Setup (Quick Mode)

- **Container:** devbob-opencode
- **Port:** 3004 (ACP server)
- **Status:** Running and healthy
- **OpenCode Version:** 0.0.0-fix/mcp-activity-integration-202601302228
- **Turn Lifecycle Hooks:** 5/5 registered
- **Restart Count:** 0 (fresh start)

## Documentation

- Full guide: `./devbob help`
- Container verification: `DEVBOB_REBUILT_VERIFICATION.md`
- Investigation: `DEVBOB_CONTAINER_INVESTIGATION_FINAL.md`
