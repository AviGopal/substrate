#!/usr/bin/env python3
"""Apply migration 009: Add execution_id field to activity_executions"""

import asyncio
import sys
import os

# Add RPC API to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'repos/metabob-rpc-api'))

from server.db.surrealdb_client import get_surreal_client


async def apply_migration():
    """Apply migration 009 to add execution_id field"""
    
    print("Connecting to SurrealDB...")
    db = await get_surreal_client()
    
    print("\n=== Applying Migration 009: Add execution_id field ===\n")
    
    # Step 1: Define execution_id field
    print("1. Defining execution_id field on activity_executions table...")
    result1 = await db.query(
        "DEFINE FIELD execution_id ON activity_executions TYPE string ASSERT $value != NONE;"
    )
    print(f"   Result: {result1}")
    
    # Step 2: Create unique index
    print("\n2. Creating unique index on execution_id...")
    result2 = await db.query(
        "DEFINE INDEX execution_id_idx ON activity_executions FIELDS execution_id UNIQUE;"
    )
    print(f"   Result: {result2}")
    
    # Step 3: Verify the field definition
    print("\n3. Verifying field definition...")
    result3 = await db.query(
        "INFO FOR TABLE activity_executions;"
    )
    print(f"   Table info: {result3}")
    
    print("\n=== Migration 009 Applied Successfully ===\n")
    print("Next step: Run backfill query to populate execution_id for existing records")
    
    return True


if __name__ == "__main__":
    asyncio.run(apply_migration())
