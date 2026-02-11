#!/usr/bin/env python3
"""
Test script to create organization, user, and API key.
This will help us debug the verification issue.
"""
import asyncio
import sys
sys.path.insert(0, "repos/metabob-rpc-api")

from server.utils.surreal_client import get_surreal_connection
from server.actions.auth_db import create_organization, create_user, create_api_key
from server.config import settings

async def main():
    print("Connecting to SurrealDB...")
    db = await get_surreal_connection()
    
    print("\n1. Creating organization...")
    try:
        org = await create_organization(
            db=db,
            name="Test Org",
            plan="free",
            org_id="test-org-v2-1"
        )
        print(f"✅ Organization created: {org.org_id}")
    except Exception as e:
        print(f"❌ Organization creation failed: {e}")
        return
    
    print("\n2. Creating user...")
    try:
        user, raw_key = await create_user(
            db=db,
            org_id=org.org_id,
            email="test@example.com",
            password="test_password_123",
            name="Test User",
            role="owner"
        )
        print(f"✅ User created: {user.user_id}")
        print(f"✅ API key created: {raw_key}")
        
        # Test the API key validation
        print("\n3. Validating API key...")
        from server.actions.auth_db import validate_api_key
        validated = await validate_api_key(db, raw_key)
        if validated:
            print(f"✅ API key validated successfully")
            print(f"   - Key ID: {validated.key_id}")
            print(f"   - Org ID: {validated.org_id}")
            print(f"   - User ID: {validated.user_id}")
            print(f"   - Scopes: {validated.scopes}")
        else:
            print(f"❌ API key validation failed!")
            
    except Exception as e:
        print(f"❌ User creation failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
