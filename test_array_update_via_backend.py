#!/usr/bin/env python3
"""
Test SurrealDB array updates using backend's SurrealDBClient.

This avoids the complexity of wrapping sync client manually.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "repos" / "metabob-rpc-api"))

from server.utils.surreal_client import SurrealDBClient
from server.config import Settings


async def test_array_updates():
    """Test various methods to update arrays in SurrealDB."""

    # Create client with correct config
    config = Settings(
        SURREAL_URL="ws://localhost:8000",
        SURREAL_USER="root",
        SURREAL_PASS="root",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="production",
    )

    db = SurrealDBClient(config)
    await db.connect()

    print("=" * 80)
    print("SurrealDB Array Update Testing (via Backend Client)")
    print("=" * 80)

    test_exec_id = "test_array_update_experiment"

    # Clean up any existing test record
    print("\n0. Cleaning up any existing test record...")
    await db.query(f"DELETE activity_executions WHERE execution_id = '{test_exec_id}'")

    # Create a fresh record with empty tasks array
    print("\n1. Creating fresh record with empty tasks array...")
    create_result = await db.query(
        """
        CREATE activity_executions CONTENT {
            execution_id: $exec_id,
            activity_id: 'test-activity',
            variant_id: 'test-variant',
            org_id: 'test-org',
            project_id: 'test-project',
            user_id: 'test-user',
            project_hash: 'test-hash',
            session_id: 'test-session',
            timestamp: time::unix(time::now()),
            duration: 0,
            success: false,
            total_cost: 0.0,
            total_tokens: { input: 0, output: 0 },
            quality_scores: {},
            tasks: [],
            environment: {},
            patterns: [],
            metabob: {}
        }
    """,
        {"exec_id": test_exec_id},
    )
    print(f"   Created: {create_result}")

    # Verify initial state
    initial = await db.query(
        f"SELECT tasks FROM activity_executions WHERE execution_id = '{test_exec_id}'"
    )
    print(f"   Initial tasks: {initial}")

    # Test 1: += operator (SurrealDB append syntax)
    print("\n2. Testing += operator...")
    task1 = {"task_id": "task1", "name": "Test Task 1", "status": "completed"}
    update1 = await db.query(
        """
        UPDATE activity_executions 
        SET tasks += $task
        WHERE execution_id = $exec_id
        RETURN tasks
    """,
        {"task": task1, "exec_id": test_exec_id},
    )
    print(f"   Result: {update1}")

    verify1 = await db.query(
        f"SELECT tasks FROM activity_executions WHERE execution_id = '{test_exec_id}'"
    )
    print(f"   Verified tasks: {verify1}")
    task_count = 0
    if verify1 and len(verify1) > 0 and len(verify1[0]) > 0:
        task_count = len(verify1[0][0].get("tasks", []))
    print(
        f"   ✓ SUCCESS (count: {task_count})"
        if task_count > 0
        else f"   ✗ FAILED (count: {task_count})"
    )

    # Test 2: array::append function
    print("\n3. Testing array::append function...")
    task2 = {"task_id": "task2", "name": "Test Task 2", "status": "completed"}
    update2 = await db.query(
        """
        UPDATE activity_executions 
        SET tasks = array::append(tasks, $task)
        WHERE execution_id = $exec_id
        RETURN tasks
    """,
        {"task": task2, "exec_id": test_exec_id},
    )
    print(f"   Result: {update2}")

    verify2 = await db.query(
        f"SELECT tasks FROM activity_executions WHERE execution_id = '{test_exec_id}'"
    )
    print(f"   Verified tasks: {verify2}")
    task_count = (
        len(verify2[0][0].get("tasks", [])) if verify2 and len(verify2[0]) > 0 else 0
    )
    print(
        f"   ✓ SUCCESS (count: {task_count})"
        if task_count > 1
        else f"   ✗ FAILED (count: {task_count})"
    )

    # Test 3: array::push function (current approach)
    print("\n4. Testing array::push function...")
    task3 = {"task_id": "task3", "name": "Test Task 3", "status": "completed"}
    update3 = await db.query(
        """
        UPDATE activity_executions 
        SET tasks = array::push(tasks, $task)
        WHERE execution_id = $exec_id
        RETURN tasks
    """,
        {"task": task3, "exec_id": test_exec_id},
    )
    print(f"   Result: {update3}")

    verify3 = await db.query(
        f"SELECT tasks FROM activity_executions WHERE execution_id = '{test_exec_id}'"
    )
    print(f"   Verified tasks: {verify3}")
    task_count = (
        len(verify3[0][0].get("tasks", [])) if verify3 and len(verify3[0]) > 0 else 0
    )
    print(
        f"   ✓ SUCCESS (count: {task_count})"
        if task_count > 2
        else f"   ✗ FAILED (count: {task_count})"
    )

    # Test 4: Direct array concatenation
    print("\n5. Testing direct array concatenation...")
    task4 = {"task_id": "task4", "name": "Test Task 4", "status": "completed"}
    update4 = await db.query(
        """
        UPDATE activity_executions 
        SET tasks = array::concat(tasks, [$task])
        WHERE execution_id = $exec_id
        RETURN tasks
    """,
        {"task": task4, "exec_id": test_exec_id},
    )
    print(f"   Result: {update4}")

    verify4 = await db.query(
        f"SELECT tasks FROM activity_executions WHERE execution_id = '{test_exec_id}'"
    )
    print(f"   Verified tasks: {verify4}")
    task_count = (
        len(verify4[0][0].get("tasks", [])) if verify4 and len(verify4[0]) > 0 else 0
    )
    print(
        f"   ✓ SUCCESS (count: {task_count})"
        if task_count > 3
        else f"   ✗ FAILED (count: {task_count})"
    )

    # Test 5: RETURN AFTER syntax
    print("\n6. Testing UPDATE with RETURN AFTER...")
    task5 = {"task_id": "task5", "name": "Test Task 5", "status": "completed"}
    update5 = await db.query(
        """
        UPDATE activity_executions 
        SET tasks = array::push(tasks, $task)
        WHERE execution_id = $exec_id
        RETURN AFTER tasks
    """,
        {"task": task5, "exec_id": test_exec_id},
    )
    print(f"   Result: {update5}")

    verify5 = await db.query(
        f"SELECT tasks FROM activity_executions WHERE execution_id = '{test_exec_id}'"
    )
    print(f"   Verified tasks: {verify5}")
    task_count = (
        len(verify5[0][0].get("tasks", [])) if verify5 and len(verify5[0]) > 0 else 0
    )
    print(
        f"   ✓ SUCCESS (count: {task_count})"
        if task_count > 4
        else f"   ✗ FAILED (count: {task_count})"
    )

    # Final state
    print("\n" + "=" * 80)
    print("FINAL STATE")
    print("=" * 80)
    final = await db.query(
        f"SELECT * FROM activity_executions WHERE execution_id = '{test_exec_id}'"
    )
    if final and len(final) > 0 and len(final[0]) > 0:
        record = final[0][0]
        print(f"Record ID: {record.get('id')}")
        print(f"Execution ID: {record.get('execution_id')}")
        print(f"Tasks count: {len(record.get('tasks', []))}")
        print(f"Tasks: {record.get('tasks')}")
    else:
        print("No record found!")

    # Cleanup
    print("\nCleaning up test record...")
    await db.query(f"DELETE activity_executions WHERE execution_id = '{test_exec_id}'")

    await db.close()


if __name__ == "__main__":
    asyncio.run(test_array_updates())
