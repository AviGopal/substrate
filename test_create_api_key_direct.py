#!/usr/bin/env python3
"""
Direct test to create API key and check verification.
"""
import asyncio
import sys
sys.path.insert(0, "repos/metabob-rpc-api")

from server.utils.surreal_client import SurrealDBClient
from server.actions.auth_db import create_organization, create_user
from server.config import settings

async def main():
    print("Connecting to SurrealDB...")
    conf = settings()
    db = SurrealDBClient(
        host=conf.SURREAL_HOST,
        port=conf.SURREAL_PORT,
        namespace=conf.SURREAL_NAMESPACE,
        database=conf.SURREAL_DATABASE,
        username=conf.SURREAL_USERNAME,
        password=conf.SURREAL_PASSWORD,
    )
    await db.connect()
    
    try:
        print("\n1. Creating organization...")
        try:
            org = await create_organization(
                db=db,
                name="Test Org V2",
                plan="free",
                org_id="test-org-v2-2"
            )
            print(f"✅ Organization created: {org.org_id}")
        except Exception as e:
            if "already exists" in str(e):
                print(f"⚠️  Organization already exists, continuing...")
                # Fetch existing org
                from server.actions.auth_db import get_organization
                org = await get_organization(db, "test-org-v2-2")
            else:
                raise
        
        print("\n2. Creating user (with auto-provisioned API key)...")
        try:
            user, raw_key = await create_user(
                db=db,
                org_id=org.org_id,
                email="test2@example.com",
                password="test_password_123",
                name="Test User 2",
                role="owner"
            )
            print(f"✅ User created: {user.user_id}")
            print(f"✅ API key created: {raw_key[:20]}...")
            
            # Test the API key validation
            print("\n3. Validating API key...")
            from server.actions.auth_db import validate_api_key
            validated = await validate_api_key(db, raw_key)
            if validated:
                print(f"✅ API key validated successfully!")
                print(f"   - Key ID: {validated.key_id}")
                print(f"   - Org ID: {validated.org_id}")
                print(f"   - User ID: {validated.user_id}")
                print(f"   - Scopes: {validated.scopes}")
                print(f"\n📋 You can test v2 session with:")
                print(f"   curl -X POST http://localhost:8080/v2/session \\")
                print(f"     -H 'X-API-Key: {raw_key}' \\")
                print(f"     -d '{{\"project_id\":\"test\"}}'")
            else:
                print(f"❌ API key validation failed!")
                
        except Exception as e:
            if "already exists" in str(e):
                print(f"⚠️  User already exists")
            else:
                print(f"❌ User creation failed: {e}")
                import traceback
                traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())
