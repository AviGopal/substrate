#!/usr/bin/env python3
"""
Test 3: OpenCode Activity Tool Integration Test

This test verifies that OpenCode's activity tool wrapper properly integrates with
the Metabob MCP server. This is the full end-to-end integration test.

Expected: Unknown (this is what we're debugging)
Purpose: Identify if activity tool properly routes to Metabob MCP
"""

import json
import os


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}\n")


def print_success(text: str):
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")


def print_error(text: str):
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")


def print_info(text: str):
    print(f"{Colors.YELLOW}ℹ {text}{Colors.RESET}")


def test_activity_tool_integration():
    """Test OpenCode's activity tool integration"""

    print_header("TEST 3: OpenCode Activity Tool Integration")
    print("Testing: Full OpenCode → MCP → Backend flow")
    print("This is the COMPLETE integration test\n")

    # Step 1: Check OpenCode configuration
    print("Step 1: Checking OpenCode configuration...")
    config_path = (
        "/home/avi/documents/work/exp-repo/metabob-devbob/.opencode/opencode.json"
    )

    try:
        with open(config_path) as f:
            config = json.load(f)

        print_success("OpenCode config loaded")

        # Check MCP configuration
        if "mcp" in config and "metabob" in config["mcp"]:
            mcp_config = config["mcp"]["metabob"]
            print_success("Metabob MCP configuration found")
            print_info(f"  Type: {mcp_config.get('type')}")
            print_info(f"  Enabled: {mcp_config.get('enabled')}")
            print_info(f"  Command: {mcp_config.get('command')}")

            # Check environment
            env = mcp_config.get("environment", {})
            if env.get("METABOB_API_KEY"):
                print_success("API key configured")
            else:
                print_error("API key not configured")
                return False
        else:
            print_error("Metabob MCP not configured in OpenCode")
            return False

    except FileNotFoundError:
        print_error(f"OpenCode config not found: {config_path}")
        return False
    except Exception as e:
        print_error(f"Failed to load config: {e}")
        return False

    # Step 2: Check if MCP server is running
    print("\nStep 2: Checking if MCP server is running...")
    import subprocess

    try:
        result = subprocess.run(["ps", "aux"], capture_output=True, text=True)

        if "metabob-cli mcp" in result.stdout:
            print_success("MCP server is running")
            # Extract PID
            for line in result.stdout.split("\n"):
                if "metabob-cli mcp" in line and "grep" not in line:
                    parts = line.split()
                    pid = parts[1]
                    print_info(f"  PID: {pid}")
                    break
        else:
            print_error("MCP server is NOT running")
            print_info("Start with: metabob-cli mcp --transport stdio")
            return False

    except Exception as e:
        print_error(f"Failed to check MCP server: {e}")
        return False

    # Step 3: Check activity tool availability
    print("\nStep 3: Checking activity tool availability...")
    print_info("This test CANNOT directly invoke OpenCode's activity tool")
    print_info("The activity tool is only available within OpenCode sessions")
    print_info("")
    print_info("To complete this test, you must:")
    print_info("  1. Be in an OpenCode session")
    print_info(
        "  2. Try: activity({activityId: 'refactor-251a3ca8', variables: {mode: 'dryRun'}, reason: 'test'})"
    )
    print_info("  3. Observe the result")
    print_info("")
    print_info("Expected behaviors:")
    print_info("  ✓ If working: Activity starts executing")
    print_info("  ✗ If broken: 'Unknown error' or 'Activity not found'")

    # Step 4: Diagnostic checks
    print("\nStep 4: Diagnostic checks...")

    # Check if activity tool might be looking in the wrong place
    print_info("Checking potential routing issues...")

    # Check if there's a local activities directory that might be checked first
    local_activities = os.path.expanduser("~/.metabob/activities")
    if os.path.exists(local_activities):
        print_info(f"Local activities directory exists: {local_activities}")
        local_templates = os.listdir(local_activities)
        print_info(f"  Contains {len(local_templates)} templates")

        if any("jiggle" in t.lower() for t in local_templates):
            print_success("Jiggle template found in local directory")
        else:
            print_info("Jiggle template NOT in local directory")
            print_info("  → Activity tool may not check MCP if local dir is used")
    else:
        print_info("No local activities directory")

    # Check if there's an activities cache
    activities_cache = os.path.expanduser("~/.metabob-state/state/activities.json")
    if os.path.exists(activities_cache):
        print_info(f"Activities cache exists: {activities_cache}")
        try:
            with open(activities_cache) as f:
                cache = json.load(f)
            print_info(f"  Cache contains {len(cache)} entries")
        except:
            print_info("  Cache exists but couldn't be parsed")
    else:
        print_info("No activities cache found")

    print_header("TEST 3 RESULT: ⚠️  MANUAL VERIFICATION REQUIRED")
    print("Conclusion: Cannot programmatically test OpenCode activity tool")
    print("Configuration checks:")
    print("  ✓ OpenCode MCP config exists")
    print("  ✓ API key configured")
    print("  ✓ MCP server running")
    print("")
    print("Manual test required:")
    print("  → Run activity tool in OpenCode session")
    print("  → Observe if it can execute refactor-251a3ca8")
    print("")
    print("If activity tool fails, likely causes:")
    print("  1. Activity tool doesn't query MCP for templates")
    print("  2. Activity tool doesn't know refactor-251a3ca8 is a Metabob activity")
    print("  3. Activity tool has separate execution path from MCP")

    return True  # Configuration checks passed, manual verification needed


if __name__ == "__main__":
    try:
        result = test_activity_tool_integration()
        exit(0 if result else 1)
    except Exception as e:
        print_error(f"Test failed: {e}")
        import traceback

        traceback.print_exc()
        exit(1)
