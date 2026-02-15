#!/usr/bin/env python3
"""Test if tasks array stores data but impulses_used doesn't."""

import asyncio
import json
from surrealdb import Surreal


async def main():
    db = Surreal("ws://localhost:8000/rpc")
    await db.connect()
    await db.signin({"user": "root", "pass": "root"})
    await db.use("metabob", "metabob")

    try:
        print("=" * 60)
        print("Testing array storage in activity_executions")
        print("=" * 60)

        # Query recent executions
        result = await db.query("""
            SELECT execution_id, 
                   array::len(tasks) as task_count, 
                   array::len(impulses_used) as impulse_count,
                   tasks,
                   impulses_used
            FROM activity_executions 
            ORDER BY created_at DESC 
            LIMIT 3
        """)

        if result and len(result) > 0:
            executions = result[0]["result"]
            print(f"\nFound {len(executions)} recent executions:\n")

            for exec_data in executions:
                exec_id = exec_data.get("execution_id", "unknown")
                task_count = exec_data.get("task_count", 0)
                impulse_count = exec_data.get("impulse_count", 0)

                print(f"Execution: {exec_id}")
                print(f"  Tasks count: {task_count}")
                print(f"  Impulses count: {impulse_count}")

                # Show sample data if available
                tasks = exec_data.get("tasks", [])
                impulses = exec_data.get("impulses_used", [])

                if tasks:
                    print(
                        f"  ✅ Tasks array has data (first task has {len(tasks[0])} keys)"
                    )
                else:
                    print(f"  ⚠️  Tasks array is EMPTY")

                if impulses:
                    print(
                        f"  ✅ Impulses array has data: {json.dumps(impulses[:1], indent=2)}"
                    )
                else:
                    print(f"  ❌ Impulses array is EMPTY")

                print()
        else:
            print("No executions found")

        # Now test creating a new record with impulses
        print("=" * 60)
        print("Testing direct CREATE with impulses_used")
        print("=" * 60)

        test_impulses = [
            {
                "impulse_id": "test-impulse-1",
                "content_hash": "hash123",
                "tokens_used": 100,
                "was_useful": True,
            },
            {
                "impulse_id": "test-impulse-2",
                "content_hash": "hash456",
                "tokens_used": 200,
                "was_useful": False,
            },
        ]

        print(f"\nCreating test execution with {len(test_impulses)} impulses...")

        create_result = await db.query(
            """
            CREATE activity_executions CONTENT {
                execution_id: "test_impulse_array_001",
                activity_id: "TEST-ACTIVITY",
                variant_id: "test-v1",
                org_id: "test-org",
                project_id: "test-project",
                user_id: "test-user",
                project_hash: "hash",
                timestamp: time::now(),
                duration: 1000,
                success: true,
                total_cost: 0.01,
                total_tokens: {input: 100, output: 50},
                quality_scores: {},
                correctness_score: 0.9,
                tasks: [
                    {task_id: "task1", status: "completed"}
                ],
                environment: {},
                patterns: {},
                metabob: {},
                impulses_used: $impulses
            }
        """,
            {"impulses": test_impulses},
        )

        print("Create result:", json.dumps(create_result, indent=2, default=str))

        # Query back the created record
        print("\n" + "=" * 60)
        print("Querying back the test execution")
        print("=" * 60)

        query_result = await db.query("""
            SELECT execution_id, 
                   array::len(tasks) as task_count,
                   array::len(impulses_used) as impulse_count,
                   impulses_used
            FROM activity_executions 
            WHERE execution_id = "test_impulse_array_001"
        """)

        if query_result and len(query_result) > 0:
            record = query_result[0]["result"][0] if query_result[0]["result"] else None
            if record:
                print(f"\n✓ Record found:")
                print(f"  Tasks count: {record.get('task_count')}")
                print(f"  Impulses count: {record.get('impulse_count')}")
                print(
                    f"  Impulses data: {json.dumps(record.get('impulses_used'), indent=2)}"
                )

                if record.get("impulse_count") == 0:
                    print(
                        "\n❌ BUG CONFIRMED: impulses_used array is EMPTY despite being provided!"
                    )
                elif record.get("impulse_count") == len(test_impulses):
                    print(
                        f"\n✅ SUCCESS: All {len(test_impulses)} impulses stored correctly!"
                    )
                else:
                    print(
                        f"\n⚠️  PARTIAL: Expected {len(test_impulses)} but got {record.get('impulse_count')}"
                    )
            else:
                print("❌ Record not found after creation!")

        # Cleanup
        await db.query(
            'DELETE activity_executions WHERE execution_id = "test_impulse_array_001"'
        )
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
