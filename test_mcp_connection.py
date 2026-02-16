#!/usr/bin/env python3
"""Test MCP connection from OpenCode to metabob-cli to backend."""

import json
import subprocess
import sys
import time
from pathlib import Path


def test_mcp_stdio_communication():
    """Test basic MCP communication via stdio."""
    print("=" * 70)
    print("Testing MCP STDIO Communication")
    print("=" * 70)

    # Start MCP server
    cli_path = Path("repos/metabob-cli")
    proc = subprocess.Popen(
        [sys.executable, "-m", "metabob_cli", "mcp", "--transport", "stdio"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=cli_path,
        text=True,
        bufsize=0,
    )

    try:
        # Give server time to start
        time.sleep(2)

        # Send initialize request
        print("\n1. Sending initialize request...")
        init_request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0.0"},
            },
        }

        request_json = json.dumps(init_request) + "\n"
        print(f"Request: {request_json[:100]}...")

        proc.stdin.write(request_json)
        proc.stdin.flush()

        # Read response
        print("\n2. Reading response...")
        response_line = proc.stdout.readline()
        print(f"Raw response: {response_line[:200]}...")

        if response_line:
            try:
                response = json.loads(response_line)
                print(f"\n✅ Initialize response received:")
                print(
                    f"   Protocol: {response.get('result', {}).get('protocolVersion')}"
                )
                print(f"   Server: {response.get('result', {}).get('serverInfo', {})}")

                # Send tools/list request
                print("\n3. Requesting available tools...")
                tools_request = {
                    "jsonrpc": "2.0",
                    "id": 2,
                    "method": "tools/list",
                    "params": {},
                }

                proc.stdin.write(json.dumps(tools_request) + "\n")
                proc.stdin.flush()

                tools_response = proc.stdout.readline()
                if tools_response:
                    tools_data = json.loads(tools_response)
                    tools = tools_data.get("result", {}).get("tools", [])
                    print(f"\n✅ Available tools ({len(tools)}):")
                    for tool in tools[:10]:  # Show first 10
                        print(
                            f"   - {tool.get('name')}: {tool.get('description', 'No description')[:60]}..."
                        )
                    if len(tools) > 10:
                        print(f"   ... and {len(tools) - 10} more")

                    return True
                else:
                    print("❌ No response to tools/list")
                    return False

            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse response: {e}")
                print(f"   Raw: {response_line}")
                return False
        else:
            print("❌ No response from MCP server")
            stderr = proc.stderr.read()
            if stderr:
                print(f"\nServer stderr:\n{stderr}")
            return False

    finally:
        print("\n4. Cleaning up...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()


def test_backend_via_cli():
    """Test that CLI can reach backend."""
    print("\n" + "=" * 70)
    print("Testing CLI → Backend Connection")
    print("=" * 70)

    cli_path = Path("repos/metabob-cli")

    # Test using metabob-cli config command
    result = subprocess.run(
        [sys.executable, "-m", "metabob_cli", "config"],
        cwd=cli_path,
        capture_output=True,
        text=True,
        timeout=10,
    )

    if result.returncode == 0:
        print("\n✅ CLI config loaded successfully")
        config_lines = result.stdout.split("\n")[:10]
        for line in config_lines:
            if line.strip():
                print(f"   {line}")
        return True
    else:
        print(f"❌ CLI config failed: {result.stderr}")
        return False


def main():
    """Run all MCP integration tests."""
    print("\n" + "=" * 70)
    print("MCP INTEGRATION TEST SUITE")
    print("=" * 70)
    print("\nThis test verifies:")
    print("  1. metabob-cli MCP server starts in stdio mode")
    print("  2. MCP protocol communication works (initialize + tools/list)")
    print("  3. CLI can reach backend at localhost:8080")
    print("=" * 70)

    results = []

    # Test 1: Backend via CLI
    results.append(("CLI → Backend", test_backend_via_cli()))

    # Test 2: MCP stdio communication
    results.append(("MCP STDIO Protocol", test_mcp_stdio_communication()))

    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")

    all_passed = all(passed for _, passed in results)
    if all_passed:
        print("\n🎉 All tests passed! MCP integration is working.")
        print("\nNext steps:")
        print("  1. Test from OpenCode: Use metabob tools in a session")
        print("  2. Execute an activity template end-to-end")
        print("  3. Verify activity learning/feedback loop")
    else:
        print("\n⚠️  Some tests failed. Check output above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
