#!/usr/bin/env python3
"""Test SurrealDB array updates - all methods."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "repos" / "metabob-rpc-api"))
from server.utils.surreal_client import SurrealDBClient
from server.config import Settings

async def test():
    config = Settings(
        SURREAL_URL="ws://localhost:8000",
        SURREAL_USER="root",
        SURREAL_PASS="root",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="production",
    )
    
    db = SurrealDBClient(config)
    await db.connect()
    
    exec_id = "array_test_feb15"
    
    print("=" * 70)
    print("SurrealDB Array Update Test - All Methods")
    print("=" * 70)
    
    # Clean up
    print("\nCleaning up old test records...")
    await db.query(f"DELETE activity_executions WHERE execution_id = '{exec_id}'")
    
    # Create record
    print("\n1. Creating record with empty tasks array...")
    await db.query("""
        CREATE activity_executions CONTENT {
            execution_id: $exec_id,
            activity_id: 'test', variant_id: 'test', org_id: 'test',
            project_id: 'test', user_id: 'test', project_hash: 'test',
            timestamp: time::unix(time::now()), duration: 0, success: false,
            total_cost: 0.0, total_tokens: {}, quality_scores: {},
            tasks: [], environment: {}, patterns: [], metabob: {}
        }
    """, {"exec_id": exec_id})
    
    result = await db.query(f"SELECT tasks FROM activity_executions WHERE execution_id = '{exec_id}'")
    tasks = result[0]['tasks'] if result else []
    print(f"   ✓ Created. Initial tasks: {tasks} (count: {len(tasks)})")
    
    # Test 1: += operator
    print("\n2. Testing += operator...")
    task = {"id": "t1", "name": "Task 1", "status": "completed"}
    await db.query("""
        UPDATE activity_executions 
        SET tasks += $task
        WHERE execution_id = $exec_id
    """, {"task": task, "exec_id": exec_id})
    
    result = await db.query(f"SELECT tasks FROM activity_executions WHERE execution_id = '{exec_id}'")
    tasks = result[0]['tasks'] if result else []
    print(f"   Result: {tasks}")
    print(f"   Count: {len(tasks)}")
    print(f"   {'✓ SUCCESS' if len(tasks) > 0 else '✗ FAILED - Array still empty!'}")
    
    # Test 2: array::append
    print("\n3. Testing array::append...")
    task2 = {"id": "t2", "name": "Task 2", "status": "completed"}
    await db.query("""
        UPDATE activity_executions 
        SET tasks = array::append(tasks, $task)
        WHERE execution_id = $exec_id
    """, {"task": task2, "exec_id": exec_id})
    
    result = await db.query(f"SELECT tasks FROM activity_executions WHERE execution_id = '{exec_id}'")
    tasks = result[0]['tasks'] if result else []
    print(f"   Result: {tasks}")
    print(f"   Count: {len(tasks)}")
    expected = 2 if len(tasks) > 0 else 1  # If test 1 worked, expect 2, else expect 1
    print(f"   {'✓ SUCCESS' if len(tasks) >= expected else '✗ FAILED'}")
    
    # Test 3: array::push
    print("\n4. Testing array::push (current backend approach)...")
    task3 = {"id": "t3", "name": "Task 3", "status": "completed"}
    await db.query("""
        UPDATE activity_executions 
        SET tasks = array::push(tasks, $task)
        WHERE execution_id = $exec_id
    """, {"task": task3, "exec_id": exec_id})
    
    result = await db.query(f"SELECT tasks FROM activity_executions WHERE execution_id = '{exec_id}'")
    tasks = result[0]['tasks'] if result else []
    print(f"   Result: {tasks}")
    print(f"   Count: {len(tasks)}")
    print(f"   {'✓ SUCCESS' if len(tasks) >= 3 else '✗ FAILED'}")
    
    # Test 4: array::concat
    print("\n5. Testing array::concat...")
    task4 = {"id": "t4", "name": "Task 4", "status": "completed"}
    await db.query("""
        UPDATE activity_executions 
        SET tasks = array::concat(tasks, [$task])
        WHERE execution_id = $exec_id
    """, {"task": task4, "exec_id": exec_id})
    
    result = await db.query(f"SELECT tasks FROM activity_executions WHERE execution_id = '{exec_id}'")
    tasks = result[0]['tasks'] if result else []
    print(f"   Result: {tasks}")
    print(f"   Count: {len(tasks)}")
    print(f"   {'✓ SUCCESS' if len(tasks) >= 4 else '✗ FAILED'}")
    
    # Final verification
    print("\n" + "=" * 70)
    print("FINAL STATE")
    print("=" * 70)
    result = await db.query(f"SELECT * FROM activity_executions WHERE execution_id = '{exec_id}'")
    if result:
        record = result[0]
        print(f"Execution ID: {record.get('execution_id')}")
        print(f"Tasks count: {len(record.get('tasks', []))}")
        print(f"Tasks: {record.get('tasks')}")
    
    # Clean up
    print("\nCleaning up...")
    await db.query(f"DELETE activity_executions WHERE execution_id = '{exec_id}'")
    
    print("\n✓ Test complete!")

asyncio.run(test())
