#!/usr/bin/env python3
"""
Create a test API key in SurrealDB for v2 endpoint testing.
"""

import hashlib
import os
import requests
from datetime import datetime, timedelta

SURREALDB_URL = os.getenv("SURREALDB_URL", "http://localhost:8000")
SURREALDB_USER = os.getenv("SURREALDB_USER", "root")
SURREALDB_PASS = os.getenv("SURREALDB_PASS", "root")
SURREALDB_NS = os.getenv("SURREALDB_NS", "test")
SURREALDB_DB = os.getenv("SURREALDB_DB", "test")

# Test API key (plaintext)
TEST_API_KEY = "test-api-key"
TEST_USER_ID = "test-user"
TEST_ORG_ID = "test-org-v2"


def create_test_api_key():
    """Create test API key in database using HTTP API"""

    try:
        # Sign in to get auth token
        signin_url = f"{SURREALDB_URL}/signin"
        signin_response = requests.post(
            signin_url,
            json={"user": SURREALDB_USER, "pass": SURREALDB_PASS},
            headers={"Accept": "application/json"},
        )
        signin_response.raise_for_status()
        auth_token = signin_response.json().get("token")

        if not auth_token:
            print("✗ Failed to get auth token")
            return

        # Set up headers for authenticated requests
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {auth_token}",
            "NS": SURREALDB_NS,
            "DB": SURREALDB_DB,
        }

        # Hash the API key
        key_hash = hashlib.sha256(TEST_API_KEY.encode()).hexdigest()

        # Create API key record
        now = datetime.utcnow()
        expires_at = now + timedelta(days=365)  # 1 year

        api_key_data = {
            "key_hash": key_hash,
            "user_id": TEST_USER_ID,
            "org_id": TEST_ORG_ID,
            "name": "Test API Key",
            "is_active": True,
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "last_used_at": None,
        }

        # Insert the API key using SQL endpoint
        sql_url = f"{SURREALDB_URL}/sql"

        # Create API key
        create_key_query = f"CREATE api_key CONTENT {api_key_data}"
        response = requests.post(sql_url, data=create_key_query, headers=headers)
        response.raise_for_status()
        result = response.json()

        print(f"✓ Created test API key:")
        print(f"  Plaintext key: {TEST_API_KEY}")
        print(f"  Key hash: {key_hash}")
        print(f"  User ID: {TEST_USER_ID}")
        print(f"  Org ID: {TEST_ORG_ID}")
        print(f"  Result: {result}")

        # Create user record if it doesn't exist
        user_data = {
            "email": "test@example.com",
            "org_id": TEST_ORG_ID,
            "created_at": now.isoformat(),
        }
        create_user_query = f"CREATE user:{TEST_USER_ID} CONTENT {user_data}"
        try:
            response = requests.post(sql_url, data=create_user_query, headers=headers)
            print(f"✓ Created test user: {response.json()}")
        except Exception as e:
            print(f"ℹ User may already exist: {e}")

        # Create org record if it doesn't exist
        org_data = {
            "name": "Test Organization",
            "created_at": now.isoformat(),
        }
        create_org_query = f"CREATE org:{TEST_ORG_ID} CONTENT {org_data}"
        try:
            response = requests.post(sql_url, data=create_org_query, headers=headers)
            print(f"✓ Created test org: {response.json()}")
        except Exception as e:
            print(f"ℹ Org may already exist: {e}")

        print("\n✓ Test API key setup complete!")
        print(f"\nUse this in tests:")
        print(f'  export METABOB_API_KEY="{TEST_API_KEY}"')

    except Exception as e:
        print(f"✗ Failed to create test API key: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    create_test_api_key()
