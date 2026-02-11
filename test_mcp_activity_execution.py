#!/usr/bin/env python3
"""
Reference Implementation: MCP Activity Execution

This script demonstrates the complete communication flow for executing an activity
via the Metabob CLI MCP server. It serves as a reference to identify where the
real OpenCode implementation might be failing.

Flow:
1. Start metabob-cli MCP server
2. Connect to it via stdio
3. Send search_activities request
4. Send activity execution request
5. Monitor responses
"""

import asyncio
import json
import os
import subprocess
import sys
from typing import Any, Dict


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text:^80}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 80}{Colors.RESET}\n")


def print_step(num: int, text: str):
    print(f"{Colors.BOLD}{Colors.CYAN}Step {num}: {text}{Colors.RESET}")


def print_success(text: str):
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")


def print_error(text: str):
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")


def print_info(text: str):
    print(f"{Colors.YELLOW}ℹ {text}{Colors.RESET}")


class MCPClient:
    """Simple MCP client using stdio transport"""

    def __init__(self):
        self.process = None
        self.request_id = 0

    async def start_server(self):
        """Start metabob-cli MCP server"""
        print_step(1, "Starting metabob-cli MCP server")

        env = os.environ.copy()
        env.update(
            {
                "METABOB_API_KEY": "test-api-key",
                "METABOB_API_URL": "http://localhost:8080",
                "METABOB_PROJECT_ID": "metabob-devbob",
                "METABOB_ORG_ID": "test-org",
            }
        )

        self.process = await asyncio.create_subprocess_exec(
            "metabob-cli",
            "mcp",
            "--transport",
            "stdio",
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )

        print_success("MCP server started")
        print_info(f"PID: {self.process.pid}")

        # Give it time to initialize
        await asyncio.sleep(2)

    async def send_request(self, method: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Send JSON-RPC request to MCP server"""
        self.request_id += 1

        request = {
            "jsonrpc": "2.0",
            "id": self.request_id,
            "method": method,
            "params": params,
        }

        request_json = json.dumps(request) + "\n"
        print_info(f"Sending: {method}")
        print(f"  Request: {json.dumps(request, indent=2)}")

        self.process.stdin.write(request_json.encode())
        await self.process.stdin.drain()

        # Read response
        response_line = await self.process.stdout.readline()
        if not response_line:
            print_error("No response from server")
            return {}

        response = json.loads(response_line.decode())
        print_success("Response received")
        print(f"  Response: {json.dumps(response, indent=2)[:500]}...")

        return response

    async def search_activities(
        self, query: str = "jiggle", limit: int = 5
    ) -> Dict[str, Any]:
        """Search for activities via MCP"""
        print_step(2, f"Searching for activities (query='{query}')")

        response = await self.send_request(
            "tools/call",
            {
                "name": "metabob_search_activities",
                "arguments": {"query": query, "limit": limit},
            },
        )

        return response

    async def execute_activity(
        self, activity_id: str, variables: Dict[str, Any], reason: str
    ) -> Dict[str, Any]:
        """Execute an activity via MCP"""
        print_step(3, f"Executing activity (id='{activity_id}')")

        response = await self.send_request(
            "tools/call",
            {
                "name": "metabob_activity",
                "arguments": {
                    "activity_id": activity_id,
                    "variables": json.dumps(variables),
                    "reason": reason,
                    "execution_id": f"test-{self.request_id}",
                },
            },
        )

        return response

    async def cleanup(self):
        """Stop the MCP server"""
        if self.process:
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()

            print_info("MCP server stopped")


async def test_mcp_activity_execution():
    """Test complete MCP activity execution flow"""

    print_header("Reference Implementation: MCP Activity Execution")
    print(
        "This demonstrates the correct communication flow for executing activities via MCP"
    )

    client = MCPClient()

    try:
        # Step 1: Start MCP server
        await client.start_server()

        # Step 2: Search for jiggle activity
        search_response = await client.search_activities(query="jiggle", limit=5)

        # Parse search results
        if "result" in search_response:
            result_str = (
                search_response["result"].get("content", [{}])[0].get("text", "{}")
            )
            result_data = (
                json.loads(result_str) if isinstance(result_str, str) else result_str
            )

            activities = result_data.get("activities", [])
            count = result_data.get("count", 0)

            print_success(f"Search returned {count} activities")

            if count > 0:
                # Show first activity
                activity = activities[0]
                activity_id = activity.get("variant_id", "unknown")
                activity_name = activity.get("variant_name", "Unknown")

                print_info(f"Found: {activity_name} ({activity_id})")

                # Step 3: Execute the activity
                print("\n")
                execution_response = await client.execute_activity(
                    activity_id=activity_id,
                    variables={"mode": "dryRun", "scope": "test docs only"},
                    reason="Testing MCP activity execution flow",
                )

                # Check execution result
                if "result" in execution_response:
                    print_success("Activity execution request accepted")
                    print(
                        f"  Full response: {json.dumps(execution_response, indent=2)}"
                    )

                    print_header("✅ SUCCESS!")
                    print("Complete communication flow verified:")
                    print("  1. ✓ MCP server started")
                    print("  2. ✓ Activity search succeeded")
                    print("  3. ✓ Activity execution succeeded")

                    return True
                else:
                    print_error("Activity execution failed")
                    print(f"  Response: {execution_response}")
                    return False
            else:
                print_error("No activities found in search")
                print_info("This means the session token issue still exists")
                return False
        else:
            print_error("Search request failed")
            print(f"  Response: {search_response}")
            return False

    except Exception as e:
        print_error(f"Test failed with exception: {e}")
        import traceback

        traceback.print_exc()
        return False

    finally:
        await client.cleanup()


async def main():
    """Main entry point"""
    result = await test_mcp_activity_execution()
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print_error("\nInterrupted by user")
        sys.exit(1)
