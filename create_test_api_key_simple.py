#!/usr/bin/env python3
"""Simple script to create a test API key using httpx directly"""

import httpx
import asyncio
import hashlib
import secrets
import time


async def create_api_key():
    """Create API key by directly inserting into SurrealDB"""

    surreal_url = "http://localhost:8000"

    # Generate a simple API key
    raw_key = f"mb_test_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

    org_id = "test-org"
    user_id = "test-user"
    key_id = f"apikey:{secrets.token_urlsafe(8)}"

    print(f"Creating API key: {raw_key}")
    print(f"Organization: {org_id}")
    print(f"User: {user_id}")

    async with httpx.AsyncClient() as client:
        # Authenticate to SurrealDB
        auth_response = await client.post(
            f"{surreal_url}/signin",
            json={
                "user": "root",
                "pass": "root",
            },
        )

        if auth_response.status_code != 200:
            print(f"Auth failed: {auth_response.text}")
            return None

        token = auth_response.json().get("token")

        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "NS": "metabob",
            "DB": "devbob",
        }

        # Create organization if not exists
        org_query = f"""
        CREATE organization:{org_id} SET
            org_id = '{org_id}',
            name = 'Test Organization',
            plan = 'free',
            created_at = time::now(),
            updated_at = time::now();
        """

        await client.post(f"{surreal_url}/sql", headers=headers, data=org_query)

        # Create user if not exists
        user_query = f"""
        CREATE user:{user_id} SET
            user_id = '{user_id}',
            org_id = '{org_id}',
            email = 'test@test.com',
            name = 'Test User',
            role = 'owner',
            created_at = time::now();
        """

        await client.post(f"{surreal_url}/sql", headers=headers, data=user_query)

        # Create API key
        key_query = f"""
        CREATE {key_id} SET
            key_id = '{key_id}',
            org_id = '{org_id}',
            user_id = '{user_id}',
            name = 'Test API Key',
            key_hash = '{key_hash}',
            scopes = ['read', 'write'],
            status = 'active',
            created_at = time::now(),
            last_used_at = time::now();
        """

        key_response = await client.post(
            f"{surreal_url}/sql", headers=headers, data=key_query
        )

        if key_response.status_code == 200:
            print(f"\n✅ API key created successfully!")
            print(f"\nAPI Key: {raw_key}")
            print(f"Org ID: {org_id}")
            print(f"User ID: {user_id}")
            print(f"\nTest with:")
            print(f'curl -H "X-API-Key: {raw_key}" http://localhost:8080/v2/session')
            return raw_key
        else:
            print(f"❌ Failed to create API key: {key_response.text}")
            return None


if __name__ == "__main__":
    asyncio.run(create_api_key())
