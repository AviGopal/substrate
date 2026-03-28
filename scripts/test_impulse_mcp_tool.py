#!/usr/bin/env python3
"""
Test the activity/start MCP tool.

Verifies that:
1. MCP tool is registered
2. It accepts the correct parameters
3. It can create an execution with impulses
"""

import asyncio
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_activity_start_tool():
    """Test the activity/start MCP tool."""

    print("🧪 Testing activity/start MCP Tool\n")
    print("=" * 60)

    try:
        # Import the tool
        from metabob_cli.mcp.activity_tools import activity_start

        print("✓ MCP tool imported successfully")
        print(f"  Function: {activity_start.__name__}")
        print(f"  Signature: {activity_start.__annotations__}")
        print()

        # Create test impulses
        test_impulses = [
            {
                "id": "test-impulse-1",
                "type": "file",
                "pointer": {"path": "test.ts"},
                "tokens_loaded": 100,
            },
            {
                "id": "test-impulse-2",
                "type": "memo",
                "pointer": {"content": "Test memo content"},
                "tokens_loaded": 50,
            },
        ]

        print("📝 Test Data:")
        print(f"  Activity ID: test-activity-123")
        print(f"  Template ID: test-template")
        print(f"  Impulses: {len(test_impulses)}")
        print()

        # Call the tool
        print("🔧 Calling activity/start tool...")
        result = await activity_start(
            activity_id="test-activity-123",
            template_id="test-template",
            session_id="test-session",
            variables={"test": "value"},
            impulses=test_impulses,
            variant_id=None,
        )

        print()
        print("📊 Result:")
        print(json.dumps(result, indent=2))
        print()

        # Verify result
        if result.get("status") == "success":
            print("✅ TEST PASSED")
            print(f"   Execution ID: {result.get('execution_id')}")
            print(f"   Impulses Tracked: {result.get('impulses_tracked')}")

            if result.get("impulses_tracked") == 2:
                print("   ✓ Correct number of impulses tracked")
            else:
                print(
                    f"   ⚠️  Expected 2 impulses, got {result.get('impulses_tracked')}"
                )
        else:
            print("❌ TEST FAILED")
            print(f"   Status: {result.get('status')}")
            print(f"   Error: {result.get('error')}")

    except Exception as e:
        print(f"❌ TEST FAILED WITH EXCEPTION")
        print(f"   Error: {e}")
        import traceback

        traceback.print_exc()
        return False

    print()
    print("=" * 60)
    return result.get("status") == "success"


if __name__ == "__main__":
    success = asyncio.run(test_activity_start_tool())
    exit(0 if success else 1)
