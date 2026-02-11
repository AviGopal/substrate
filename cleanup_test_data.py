#!/usr/bin/env python3
"""Clean up test data from previous runs."""
import asyncio
import sys
sys.path.insert(0, "repos/metabob-rpc-api")

from server.utils.surreal_client import SurrealDBClient
from server.config import settings

async def main():
    conf = settings()
    db = SurrealDBClient(conf)
    await db.connect()
    
    print("Cleaning up test data...")
    
    # Delete test organizations and their related data
    await db.query("DELETE FROM organizations WHERE org_id LIKE 'test-org-%'")
    await db.query("DELETE FROM users WHERE org_id LIKE 'test-org-%'")
    await db.query("DELETE FROM api_keys WHERE org_id LIKE 'test-org-%'")
    await db.query("DELETE FROM projects WHERE org_id LIKE 'test-org-%'")
    
    print("✅ Test data cleaned up")

if __name__ == "__main__":
    asyncio.run(main())
