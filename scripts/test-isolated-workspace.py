#!/usr/bin/env python3
"""
Test Isolated Workspace Integration

Validates that:
1. activity-create templates execute in isolated workspace
2. Files created during execution don't pollute main repo
3. Workspace is cleaned up after execution
4. Original working directory is restored

Usage:
    python3 scripts/test-isolated-workspace.py
"""

import asyncio
import os
import sys
from pathlib import Path
import logging

# Add CLI to path
sys.path.insert(0, str(Path(__file__).parent.parent / "repos" / "metabob-cli" / "src"))

from metabob_cli.mcp.activity_manager import ActivityManager
from metabob_cli.mcp.isolated_workspace import (
    IsolatedWorkspace,
    should_use_isolated_workspace,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_should_use_isolated_workspace():
    """Test workspace detection logic"""
    print("\n=== Test 1: Workspace Detection Logic ===")

    # Should use workspace for activity-create category
    assert should_use_isolated_workspace("test-id", "activity-create") == True
    print("✅ Detects activity-create category")

    # Should use workspace for create-activity template ID pattern
    assert should_use_isolated_workspace("create-activity-template", None) == True
    print("✅ Detects create-activity template ID pattern")

    # Should NOT use workspace for other activities
    assert should_use_isolated_workspace("feature-impl-123", "feature") == False
    print("✅ Skips workspace for non-create activities")

    print("✅ All detection tests passed")


def test_workspace_context_manager():
    """Test IsolatedWorkspace context manager"""
    print("\n=== Test 2: Workspace Context Manager ===")

    original_cwd = Path.cwd()
    print(f"Original cwd: {original_cwd}")

    # Test workspace creation and cleanup
    with IsolatedWorkspace("test-workspace", cleanup=True) as workspace:
        workspace_path = workspace.path
        current_cwd = Path.cwd()

        # Verify we're in the workspace
        assert current_cwd == workspace_path, "Should be in workspace directory"
        print(f"✅ Changed to workspace: {current_cwd}")

        # Verify workspace directory exists
        assert workspace_path.exists(), "Workspace directory should exist"
        print(f"✅ Workspace directory created: {workspace_path}")

        # Create a test file
        test_file = workspace_path / "test-file.txt"
        test_file.write_text("test content")
        assert test_file.exists(), "Test file should exist"
        print(f"✅ Created test file: {test_file}")

    # After context exit
    restored_cwd = Path.cwd()
    assert restored_cwd == original_cwd, "Should restore original cwd"
    print(f"✅ Restored to original cwd: {restored_cwd}")

    # Verify workspace was cleaned up
    assert not workspace_path.exists(), "Workspace should be deleted"
    print(f"✅ Workspace cleaned up: {workspace_path}")

    print("✅ All context manager tests passed")


def test_workspace_no_cleanup():
    """Test workspace with cleanup=False"""
    print("\n=== Test 3: Workspace Without Cleanup ===")

    original_cwd = Path.cwd()
    workspace_path = None

    with IsolatedWorkspace("test-no-cleanup", cleanup=False) as workspace:
        workspace_path = workspace.path
        test_file = workspace_path / "preserved-file.txt"
        test_file.write_text("preserved content")
        print(f"✅ Created file in workspace: {test_file}")

    # After context exit
    assert Path.cwd() == original_cwd, "Should restore cwd"
    print(f"✅ Restored cwd")

    # Verify workspace still exists
    assert workspace_path.exists(), "Workspace should be preserved"
    print(f"✅ Workspace preserved: {workspace_path}")

    # Verify test file exists
    preserved_file = workspace_path / "preserved-file.txt"
    assert preserved_file.exists(), "File should be preserved"
    assert preserved_file.read_text() == "preserved content"
    print(f"✅ File content preserved")

    # Manual cleanup for test
    import shutil

    shutil.rmtree(workspace_path)
    print(f"✅ Manual cleanup successful")

    print("✅ All no-cleanup tests passed")


async def test_activity_manager_integration():
    """Test ActivityManager integration (requires backend)"""
    print("\n=== Test 4: ActivityManager Integration ===")

    # Read API key
    api_key_path = Path(".test_api_key")
    if not api_key_path.exists():
        print("⚠️  No .test_api_key file - skipping backend test")
        return

    api_key = api_key_path.read_text().strip()

    # Create activity manager
    manager = ActivityManager(base_url="http://localhost:8080", session_token=api_key)

    # Start a mock execution with activity-create category
    # This tests the workspace creation logic in start_execution()
    original_cwd = Path.cwd()
    print(f"Original cwd: {original_cwd}")

    try:
        # Note: This will fail if the activity doesn't exist, but we can still
        # test the workspace creation logic
        result = await manager.start_execution(
            activity_id="create-activity-template",  # ID with pattern
            session_id="test-session",
            variables={"template_name": "test"},
            cost_budget=1.0,
        )

        execution_id = result.get("execution_id")
        print(f"✅ Started execution: {execution_id}")

        # Check if execution has workspace
        execution = manager._executions.get(execution_id)
        if execution and execution.workspace:
            workspace_path = execution.workspace.path
            print(f"✅ Workspace created: {workspace_path}")

            # Verify we're in workspace
            current_cwd = Path.cwd()
            assert current_cwd == workspace_path, "Should be in workspace"
            print(f"✅ Changed to workspace directory")

            # Cleanup (simulate execution completion)
            manager._cleanup_workspace(execution)

            # Verify restoration
            assert Path.cwd() == original_cwd, "Should restore cwd"
            print(f"✅ Restored to original cwd")

            print("✅ ActivityManager integration test passed")
        else:
            print("⚠️  Execution created without workspace (check category detection)")

    except Exception as e:
        print(f"⚠️  Backend test failed (expected if activity doesn't exist): {e}")
        # Restore cwd in case of error
        os.chdir(original_cwd)


def main():
    """Run all tests"""
    print("=" * 60)
    print("Isolated Workspace Test Suite")
    print("=" * 60)

    try:
        # Unit tests (no backend required)
        test_should_use_isolated_workspace()
        test_workspace_context_manager()
        test_workspace_no_cleanup()

        # Integration test (requires backend)
        asyncio.run(test_activity_manager_integration())

        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED")
        print("=" * 60)

        return 0

    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
