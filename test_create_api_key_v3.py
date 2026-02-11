#!/usr/bin/env python3
"""
Test API key creation and validation.
"""
import asyncio
import sys
sys.path.insert(0, "repos/metabob-rpc-api")

from server.utils.surreal_client import SurrealDBClient
from server.actions.auth_db import create_organization, create_user, get_organization
from server.config import settings

async def main():
    print("Connecting to SurrealDB...")
    conf = settings()
    db = SurrealDBClient(conf)
    await db.connect()
    
    try:
        print("\n1. Creating organization...")
        org_id = "test-org-v2-session"
        try:
            org = await create_organization(
                db=db,
                name="Test Org For V2 Session",
                plan="free",
                org_id=org_id
            )
            print(f"✅ Organization created: {org.org_id}")
        except Exception as e:
            if "already exists" in str(e) or "Write succeeded but verification failed" in str(e):
                print(f"⚠️  Organization may already exist, fetching...")
                org = await get_organization(db, org_id)
                if org:
                    print(f"✅ Found existing organization: {org.org_id}")
                else:
                    print(f"❌ Cannot find organization after create attempt")
                    raise
            else:
                raise
        
        print("\n2. Creating user (with auto-provisioned API key)...")
        email = "session-test@example.com"
        try:
            user, raw_key = await create_user(
                db=db,
                org_id=org.org_id,
                email=email,
                password="test_password_secure_123",
                name="Session Test User",
                role="owner"
            )
            print(f"✅ User created: {user.user_id}")
            print(f"✅ API key auto-provisioned: {raw_key[:25]}...")
            
            # Test validation
            print("\n3. Validating API key...")
            from server.actions.auth_db import validate_api_key
            validated = await validate_api_key(db, raw_key)
            if validated:
                print(f"✅ API key validated successfully!")
                print(f"   - Key ID: {validated.key_id}")
                print(f"   - Org ID: {validated.org_id}")
                print(f"   - User ID: {validated.user_id}")
                print(f"   - Scopes: {', '.join(validated.scopes)}")
                print(f"\n" + "="*60)
                print(f"🎉 SUCCESS! Test v2 session endpoint with:")
                print(f"="*60)
                print(f"\ncurl -X POST http://localhost:8080/v2/session \\")
                print(f"  -H 'X-API-Key: {raw_key}' \\")
                print(f"  -H 'Content-Type: application/json' \\")
                print(f"  -d '{{\"project_id\":\"test-project\"}}'")
                print(f"\n" + "="*60)
            else:
                print(f"❌ API key validation failed - this is the bug we need to fix!")
                
        except Exception as e:
            error_msg = str(e)
            if "already exists" in error_msg:
                print(f"⚠️  User with email {email} already exists")
                print(f"💡 To retry, delete the user or use a different email")
            elif "Write succeeded but verification failed" in error_msg:
                print(f"❌ FOUND THE BUG: Data is created but verification query fails")
                print(f"   This is the issue we need to fix in auth_db.py")
            else:
                print(f"❌ User creation failed: {e}")
                import traceback
                traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())
