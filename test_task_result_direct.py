#!/usr/bin/env python3
"""Direct test of task result endpoint"""
import asyncio
import httpx
import sys

async def test():
    # Use SurrealDB directly to check
    from surrealdb import Surreal
    
    db = Surreal("ws://localhost:8000")
    await db.connect()
    await db.signin({"username": "root", "password": "root"})
    await db.use("metabob", "metabob")
    
    # Query the execution
    result = await db.query(
        "SELECT * FROM activity_executions WHERE execution_id = $exec_id",
        {"exec_id": "test_exec_phase1_tier1"}
    )
    
    if result and len(result) > 0 and len(result[0]["result"]) > 0:
        exec_record = result[0]["result"][0]
        print(f"Execution ID: {exec_record.get('execution_id')}")
        print(f"Tasks count: {len(exec_record.get('tasks', []))}")
        print(f"Tasks: {exec_record.get('tasks', [])}")
    else:
        print("No execution found")
    
    await db.close()

asyncio.run(test())
