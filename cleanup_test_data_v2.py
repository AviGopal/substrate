#!/usr/bin/env python3
"""Clean up test data."""
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
    
    # Delete test organizations and their related data (SurrealDB string contains)
    await db.query("DELETE FROM organizations WHERE org_id CONTAINS 'test-org'")
    await db.query("DELETE FROM users WHERE org_id CONTAINS 'test-org'")
    await db.query("DELETE FROM api_keys WHERE org_id CONTAINS 'test-org'")
    await db.query("DELETE FROM projects WHERE org_id CONTAINS 'test-org'")
    await db.query("DELETE FROM subscriptions WHERE org_id CONTAINS 'test-org'")
    
    print("✅ Test data cleaned up")

if __name__ == "__main__":
    asyncio.run(main())
