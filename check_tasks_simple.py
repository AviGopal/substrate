#!/usr/bin/env python3
import asyncio
import sys
sys.path.insert(0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api")

from server.utils.surreal_client import SurrealDBClient

async def check():
    db = SurrealDBClient()
    await db.connect()
    await db.use("metabob", "metabob")
    
    result = await db.query(
        "SELECT execution_id, tasks FROM activity_executions WHERE execution_id = $exec_id",
        {"exec_id": "test_exec_phase1_tier1"}
    )
    
    print(f"Query result: {result}")
    
    if result and len(result) > 0:
        for record in result:
            print(f"\nExecution ID: {record.get('execution_id')}")
            tasks = record.get('tasks', [])
            print(f"Tasks count: {len(tasks)}")
            if tasks:
                for task in tasks:
                    print(f"  - Task {task.get('task_index')}: {task.get('task_name')} ({task.get('status')})")
            else:
                print("  (No tasks found)")
    else:
        print("No execution record found")
    
    await db.close()

asyncio.run(check())
