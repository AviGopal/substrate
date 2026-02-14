#!/usr/bin/env python3
"""
Test MCP Tool Signature Verification

Verifies that the metabob_record_session_start tool has the correct signature
matching what OpenCode sends.
"""

import subprocess
import json
import sys


def test_mcp_tool_signature():
    """Test that MCP tool accepts the correct parameters"""
    print("=" * 60)
    print("MCP Tool Signature Verification")
    print("=" * 60)
    print()

    # Expected signature after our changes
    expected_params = [
        "session_id",
        "agent_id",
        "goal",
        "agent_version",
        "context",
        "started_at",
    ]

    print("Expected parameters:")
    for param in expected_params:
        print(f"  - {param}")
    print()

    # Try to inspect the tool using MCP list-tools
    print("Inspecting MCP tools...")

    # Check if we can find the tool definition
    try:
        # The tool should be defined in the CLI code
        import sys

        sys.path.insert(
            0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src"
        )

        from metabob_cli.mcp import tools as mcp_tools_module

        # Find the function
        if hasattr(mcp_tools_module, "metabob_record_session_start"):
            import inspect

            func = mcp_tools_module.metabob_record_session_start
            sig = inspect.signature(func)

            print(f"✅ Found tool: metabob_record_session_start")
            print(f"Signature: {sig}")
            print()

            # Check parameters
            params = list(sig.parameters.keys())
            print(f"Actual parameters ({len(params)}):")
            for param in params:
                print(f"  - {param}")
            print()

            # Verify all expected params are present
            missing = [p for p in expected_params if p not in params]
            extra = [p for p in params if p not in expected_params]

            if missing:
                print(f"❌ FAIL: Missing parameters: {missing}")
                return False

            if extra:
                print(f"⚠️  Extra parameters (OK if optional): {extra}")

            print("✅ PASS: Tool signature matches expected parameters")
            return True
        else:
            print("❌ ERROR: Tool not found in module")
            return False

    except Exception as e:
        print(f"❌ ERROR: Failed to inspect tool: {e}")
        import traceback

        traceback.print_exc()
        return False


def test_agent_execution_tools_signature():
    """Test that AgentExecutionTools.record_session_start has correct signature"""
    print()
    print("=" * 60)
    print("AgentExecutionTools Signature Verification")
    print("=" * 60)
    print()

    expected_params = [
        "self",
        "session_id",
        "agent_id",
        "goal",
        "agent_version",
        "context",
        "started_at",
    ]

    try:
        import sys

        sys.path.insert(
            0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src"
        )

        from metabob_cli.mcp.agent_execution_tools import AgentExecutionTools

        # Find the method
        import inspect

        method = AgentExecutionTools.record_session_start
        sig = inspect.signature(method)

        print(f"✅ Found method: AgentExecutionTools.record_session_start")
        print(f"Signature: {sig}")
        print()

        # Check parameters
        params = list(sig.parameters.keys())
        print(f"Actual parameters ({len(params)}):")
        for param in params:
            print(f"  - {param}")
        print()

        # Verify all expected params are present
        missing = [p for p in expected_params if p not in params]
        extra = [p for p in params if p not in expected_params]

        if missing:
            print(f"❌ FAIL: Missing parameters: {missing}")
            return False

        if extra:
            print(f"⚠️  Extra parameters: {extra}")

        print("✅ PASS: Method signature matches expected parameters")
        return True

    except Exception as e:
        print(f"❌ ERROR: Failed to inspect method: {e}")
        import traceback

        traceback.print_exc()
        return False


def main():
    """Run all signature tests"""
    results = []

    # Test MCP tool signature
    result1 = test_mcp_tool_signature()
    results.append(("MCP Tool", result1))

    # Test AgentExecutionTools signature
    result2 = test_agent_execution_tools_signature()
    results.append(("AgentExecutionTools", result2))

    # Summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{name}: {status}")

    passed = sum(1 for _, r in results if r)
    total = len(results)

    print()
    if passed == total:
        print(f"✅ ALL TESTS PASSED ({passed}/{total})")
        return 0
    else:
        print(f"❌ SOME TESTS FAILED ({passed}/{total})")
        return 1


if __name__ == "__main__":
    sys.exit(main())
