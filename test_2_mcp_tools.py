#!/usr/bin/env python3
"""
Test 2: MCP Server Tool Exposure Test

This test verifies that the Metabob MCP server properly exposes the activity tools
and that they can be called via the MCP protocol.

Expected: Should work if MCP is properly configured
Purpose: Verify MCP layer works independently
"""

import asyncio
import json
import os
import sys


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


async def test_mcp_tools():
    """Test MCP server tools directly"""

    print_header("TEST 2: MCP Server Tool Exposure")
    print("Testing: MCP Server Tools")
    print("Bypassing: OpenCode activity tool wrapper\n")

    # Set environment for MCP
    os.environ["METABOB_API_KEY"] = "test-api-key"
    os.environ["METABOB_API_URL"] = "http://localhost:8080"
    os.environ["METABOB_PROJECT_ID"] = "metabob-devbob"

    try:
        # Try to import MCP tools
        print("Step 1: Importing MCP tools...")
        try:
            from metabob_cli.mcp.tools import (
                search_activities_tool,
                start_activity_execution_tool,
            )
            from metabob_cli.mcp.server import _ensure_session

            print_success("MCP tools imported successfully")
        except ImportError as e:
            print_error(f"Failed to import MCP tools: {e}")
            print_info("Trying alternative import path...")
            try:
                sys.path.insert(
                    0,
                    "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src",
                )
                from metabob_cli.mcp.tools import (
                    search_activities_tool,
                    start_activity_execution_tool,
                )
                from metabob_cli.mcp.server import _ensure_session

                print_success("MCP tools imported from alternate path")
            except ImportError as e2:
                print_error(f"Alternate import also failed: {e2}")
                return False

        # Step 1.5: Create session (mimics MCP server startup)
        print("\nStep 1.5: Creating session (as MCP server would)...")
        await _ensure_session()
        print_success("Session created successfully")

        # Step 2: Test search_activities tool
        print("\nStep 2: Testing search_activities_tool...")
        try:
            result = await search_activities_tool(query="jiggle", limit=5)

            print_success("search_activities_tool executed")
            print_info(f"Result type: {type(result)}")

            # Parse result (usually JSON string)
            if isinstance(result, str):
                data = json.loads(result)
                # Tool returns "activities" not "templates"
                activities = (
                    data.get("activities", []) if isinstance(data, dict) else []
                )

                jiggle_found = any(
                    "jiggle" in t.get("name", "").lower() for t in activities
                )

                if jiggle_found:
                    print_success("Jiggle template found via MCP tool")
                    for t in activities:
                        if "jiggle" in t.get("name", "").lower():
                            print_info(f"  Template: {t.get('name')}")
                            print_info(f"  ID: {t.get('id')}")
                else:
                    print_error("Jiggle template NOT found via MCP tool")
                    print_info(f"Found {len(activities)} activities total")
                    return False
            else:
                print_info(f"Raw result: {result}")

        except Exception as e:
            print_error(f"search_activities_tool failed: {e}")
            import traceback

            traceback.print_exc()
            return False

        # Step 3: Test start_activity_execution_tool
        print("\nStep 3: Testing start_activity_execution_tool...")
        try:
            result = await start_activity_execution_tool(
                activity_id="refactor-251a3ca8",
                session_id="test-session-id",
                variables=json.dumps({"mode": "dryRun"}),
                cost_budget=1.0,
            )
            print_success("start_activity_execution_tool executed")
            print_info(f"Result: {result[:200]}...")

        except Exception as e:
            print_error(f"Activity execution tool failed: {e}")
            import traceback

            traceback.print_exc()
            return False

        print_header("TEST 2 RESULT: ✅ PASS")
        print("Conclusion: MCP server tools work correctly")
        print("Components verified:")
        print("  ✓ MCP tools can be imported")
        print("  ✓ search_activities_tool finds jiggle")
        print("  ✓ Activity execution tool exists and runs")

        return True

    except Exception as e:
        print_error(f"Test failed with exception: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    try:
        result = asyncio.run(test_mcp_tools())
        exit(0 if result else 1)
    except Exception as e:
        print_error(f"Test failed: {e}")
        import traceback

        traceback.print_exc()
        exit(1)
