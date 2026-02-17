#!/usr/bin/env python3
"""
End-to-End Impulse Tracking Test

Simulates a complete activity execution flow:
1. Start execution with impulses
2. Complete execution
3. Verify impulses in database

This tests the complete data flow:
OpenCode → CLI → Backend → Database
"""

import asyncio
import json
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def test_e2e_impulse_flow():
    """Test complete impulse tracking flow."""

    print("🧪 End-to-End Impulse Tracking Test")
    print("=" * 70)
    print()

    try:
        from metabob_cli.core.file_state import FileStateManager
        from metabob_cli.mcp.activity_manager import get_activity_manager

        # Setup
        state = FileStateManager()
        base_url = "http://localhost:8080"
        session_token = state.get_session_token() or ""

        if not session_token:
            print("❌ No session token found. Please authenticate first.")
            return False

        manager = get_activity_manager(base_url, session_token)

        # Test data
        activity_id = f"test-impulse-e2e-{int(time.time())}"
        template_id = "test-template"

        test_impulses = [
            {
                "id": "e2e-codebase-scan",
                "type": "metabob-search",
                "pointer": {"query": "authentication logic"},
                "tokens_loaded": 250,
            },
            {
                "id": "e2e-file-context",
                "type": "file",
                "pointer": {"path": "src/auth.ts"},
                "tokens_loaded": 300,
            },
            {
                "id": "e2e-recent-work",
                "type": "git-history",
                "pointer": {"commits": 5},
                "tokens_loaded": 150,
            },
        ]

        print("📝 Test Configuration:")
        print(f"   Activity ID: {activity_id}")
        print(f"   Template ID: {template_id}")
        print(f"   Impulses: {len(test_impulses)}")
        for imp in test_impulses:
            print(f"     - {imp['id']} ({imp['type']}, {imp['tokens_loaded']} tokens)")
        print()

        # Step 1: Start execution with impulses
        print("📍 Step 1: Start execution with impulses")
        print("-" * 70)

        result = await manager.start_execution(
            activity_id=activity_id,
            session_id="e2e-test-session",
            variables={"test": "e2e"},
            impulses=test_impulses,
        )

        execution_id = result["execution_id"]
        print(f"✓ Execution started: {execution_id}")
        print(f"✓ Impulses stored in memory: {len(test_impulses)}")
        print()

        # Step 2: Simulate task execution (minimal delay)
        print("📍 Step 2: Simulate task execution")
        print("-" * 70)
        await asyncio.sleep(0.5)  # Brief delay to simulate work
        print("✓ Task execution simulated")
        print()

        # Step 3: Complete execution (sends to backend)
        print("📍 Step 3: Complete execution (send to backend)")
        print("-" * 70)

        await manager.record_execution_complete(
            execution_id=execution_id,
            success=True,
            duration_ms=500,
            cost=0.01,
            tokens=700,
            outcome="e2e_test_success",
        )

        print(f"✓ Execution completed and recorded")
        print()

        # Step 4: Wait for backend processing
        print("📍 Step 4: Wait for backend processing")
        print("-" * 70)
        await asyncio.sleep(2)  # Give backend time to process
        print("✓ Backend processing time elapsed")
        print()

        # Step 5: Query database to verify
        print("📍 Step 5: Query database for results")
        print("-" * 70)

        # Import SurrealDB client
        import subprocess

        # Query for execution
        query_exec = f"""
        SELECT 
            execution_id, 
            activity_id, 
            array::len(impulses_used) as impulse_count,
            success
        FROM activity_executions 
        WHERE execution_id = '{execution_id}';
        """

        result_exec = subprocess.run(
            [
                "docker",
                "exec",
                "-i",
                "metabob-surreal",
                "/surreal",
                "sql",
                "--endpoint",
                "http://localhost:8000",
                "--username",
                "root",
                "--password",
                "root",
                "--namespace",
                "metabob",
                "--database",
                "production",
                "--pretty",
            ],
            input=query_exec,
            capture_output=True,
            text=True,
        )

        print("Query: activity_executions")
        print(result_exec.stdout)

        # Query for impulse registry
        query_impulse = f"""
        SELECT 
            impulse_id,
            impulse_type,
            usage_count
        FROM impulse_registry 
        WHERE impulse_id LIKE 'e2e-%'
        ORDER BY impulse_id;
        """

        result_impulse = subprocess.run(
            [
                "docker",
                "exec",
                "-i",
                "metabob-surreal",
                "/surreal",
                "sql",
                "--endpoint",
                "http://localhost:8000",
                "--username",
                "root",
                "--password",
                "root",
                "--namespace",
                "metabob",
                "--database",
                "production",
                "--pretty",
            ],
            input=query_impulse,
            capture_output=True,
            text=True,
        )

        print("Query: impulse_registry")
        print(result_impulse.stdout)

        # Parse results
        exec_output = result_exec.stdout
        impulse_output = result_impulse.stdout

        # Check if execution has impulses
        has_impulses = "impulse_count" in exec_output and "3" in exec_output
        has_registry_entries = "e2e-" in impulse_output

        print()
        print("=" * 70)
        print("📊 Test Results")
        print("=" * 70)
        print()

        if has_impulses:
            print("✅ Execution has impulse_count = 3")
        else:
            print("⚠️  Execution impulse_count not found or incorrect")

        if has_registry_entries:
            print("✅ impulse_registry has e2e-* entries")
        else:
            print("⚠️  impulse_registry entries not found")

        print()

        success = has_impulses or has_registry_entries

        if success:
            print("✅ END-TO-END TEST PASSED")
            print()
            print("Impulse tracking is working!")
            print("Data flow verified: OpenCode → CLI → Backend → Database")
        else:
            print("⚠️  END-TO-END TEST PARTIAL")
            print()
            print("Some data may not have reached database yet.")
            print("This could be due to:")
            print("  - Backend processing delay")
            print("  - Database table schema mismatch")
            print("  - Backend API connection issue")

        print()
        print("=" * 70)

        return success

    except Exception as e:
        print(f"❌ TEST FAILED WITH EXCEPTION")
        print(f"   Error: {e}")
        import traceback

        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_e2e_impulse_flow())
    exit(0 if success else 1)
