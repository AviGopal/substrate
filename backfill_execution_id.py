#!/usr/bin/env python3
"""Backfill execution_id for existing activity_executions records"""

import asyncio
import sys
import os
from datetime import datetime

# Add RPC API to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'repos/metabob-rpc-api'))

# Suppress JWT validation for migration script
os.environ['JWT_SECRET_KEY'] = 'x' * 64  # Use a dummy 64-char key
os.environ['ENVIRONMENT'] = 'development'  # Run in dev mode

from server.db.surrealdb_client import get_surreal_client


async def backfill_execution_ids():
    """Backfill execution_id for all records that don't have one"""
    
    print("Connecting to SurrealDB...")
    db = await get_surreal_client()
    
    print("\n=== Backfilling execution_id values ===\n")
    
    # Get all records without execution_id
    print("1. Fetching records without execution_id...")
    result = await db.query(
        "SELECT id, activity_id, started_at FROM activity_executions WHERE execution_id IS NONE OR execution_id IS NULL;"
    )
    
    records = result[0] if result and len(result) > 0 else []
    print(f"   Found {len(records)} records to backfill")
    
    if not records:
        print("   No records need backfilling!")
        return True
    
    # Update each record
    print("\n2. Updating records with generated execution_id...")
    updated_count = 0
    
    for record in records:
        record_id = record['id']
        activity_id = record['activity_id']
        started_at = record['started_at']
        
        # Parse timestamp
        if isinstance(started_at, str):
            dt = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
        else:
            dt = started_at
        
        timestamp = int(dt.timestamp())
        execution_id = f"exec_{activity_id}_{timestamp}"
        
        # Update the record
        update_result = await db.query(
            f"UPDATE {record_id} SET execution_id = $exec_id;",
            {"exec_id": execution_id}
        )
        
        updated_count += 1
        if updated_count % 10 == 0:
            print(f"   Updated {updated_count}/{len(records)} records...")
    
    print(f"   ✓ Updated {updated_count} records")
    
    # Verify all records now have execution_id
    print("\n3. Verifying backfill...")
    verify_result = await db.query(
        "SELECT COUNT() as count FROM activity_executions WHERE execution_id IS NONE OR execution_id IS NULL GROUP ALL;"
    )
    
    remaining = verify_result[0][0]['count'] if verify_result and len(verify_result) > 0 and len(verify_result[0]) > 0 else 0
    
    if remaining == 0:
        print(f"   ✓ All records have execution_id")
    else:
        print(f"   ✗ WARNING: {remaining} records still missing execution_id")
    
    print("\n=== Backfill Complete ===\n")
    return True


if __name__ == "__main__":
    asyncio.run(backfill_execution_ids())
