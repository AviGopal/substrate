#!/usr/bin/env python3
"""Test API key validation directly."""
import asyncio
import sys
sys.path.insert(0, "repos/metabob-rpc-api")

from server.utils.surreal_client import SurrealDBClient
from server.actions.auth_db import validate_api_key
from server.config import settings

async def main():
    api_key = "mb_6NpBdVH4yySQPVI9g2CpeEM4QO1kJVZyd0Motd8ElVI"
    
    print(f"Testing API key: {api_key[:25]}...")
    
    conf = settings()
    db = SurrealDBClient(conf)
    await db.connect()
    
    result = await validate_api_key(db, api_key)
    
    if result:
        print(f"✅ Valid!")
        print(f"   Org: {result.org_id}")
        print(f"   User: {result.user_id}")
        print(f"   Scopes: {result.scopes}")
    else:
        print(f"❌ Invalid or expired")
        
        # Try to find if key exists
        from server.actions.auth_db import _hash_api_key
        key_hash = _hash_api_key(api_key)
        check = await db.query(
            "SELECT * FROM api_keys WHERE key_hash = $key_hash LIMIT 1",
            {"key_hash": key_hash}
        )
        if check:
            print(f"   Key found in DB: {check[0]}")
        else:
            print(f"   Key NOT found in DB")

if __name__ == "__main__":
    asyncio.run(main())
