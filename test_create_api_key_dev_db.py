#!/usr/bin/env python3
"""Create API key in development database."""
import asyncio
import sys
sys.path.insert(0, "repos/metabob-rpc-api")

from server.utils.surreal_client import SurrealDBClient
from server.actions.auth_db import create_organization, create_user, get_organization
from server.config import settings

async def main():
    print("Connecting to SurrealDB (development database)...")
    conf = settings()
    conf.SURREAL_DATABASE = "development"  # Use development database
    db = SurrealDBClient(conf)
    await db.connect()
    
    print(f"Connected to: {conf.SURREAL_URL} / {conf.SURREAL_NAMESPACE} / {conf.SURREAL_DATABASE}")
    
    org_id = "test-org-v2-dev"
    try:
        org = await create_organization(db, name="Test Org V2 Dev", plan="free", org_id=org_id)
        print(f"✅ Organization created: {org.org_id}")
    except Exception as e:
        if "already exists" in str(e):
            org = await get_organization(db, org_id)
            print(f"✅ Found existing org: {org.org_id}")
        else:
            raise
    
    email = "v2-dev-test@example.com"
    try:
        user, raw_key = await create_user(
            db=db,
            org_id=org.org_id,
            email=email,
            password="secure_password_123",
            name="V2 Dev Test User",
            role="owner"
        )
        print(f"✅ User created: {user.user_id}")
        print(f"✅ API key: {raw_key}")
        
        print(f"\n" + "="*70)
        print(f"🎉 Test v2 session endpoint:")
        print(f"="*70)
        print(f"\ncurl -X POST http://localhost:8080/v2/session \\")
        print(f"  -H 'X-API-Key: {raw_key}' \\")
        print(f"  -H 'Content-Type: application/json' \\")
        print(f"  -d '{{\"project_id\":\"test-project\"}}'")
        print(f"\n" + "="*70)
        
    except Exception as e:
        if "already exists" in str(e):
            print(f"⚠️  User already exists: {email}")
        else:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
