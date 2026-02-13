#!/usr/bin/env python3
"""
Create a test session for local activity execution testing.

This script:
1. Registers a test user
2. Creates a session token
3. Stores the token for metabob-cli to use
"""

import httpx
import json
import sys
from pathlib import Path

BACKEND_URL = "http://localhost:8080"


def create_test_session():
    """Create test user and session"""

    # Test user credentials
    test_email = "test@example.com"
    test_password = "testpass123"

    print("Creating test session...")
    print(f"Backend: {BACKEND_URL}")
    print(f"User: {test_email}")

    try:
        # Try to register user (might already exist)
        print("\n1. Attempting to register user...")
        register_response = httpx.post(
            f"{BACKEND_URL}/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "name": "Test User",  # Combined name field
            },
            timeout=10.0,
        )

        if register_response.status_code == 201:
            print("✅ User registered successfully")
            data = register_response.json()
            token = data.get("session_token") or data.get("token")
        elif register_response.status_code == 409:
            print("ℹ️  User already exists, logging in...")
            # User exists, try login
            login_response = httpx.post(
                f"{BACKEND_URL}/auth/login",
                json={
                    "email": test_email,
                    "password": test_password,
                },
                timeout=10.0,
            )

            if login_response.status_code == 200:
                print("✅ Logged in successfully")
                data = login_response.json()
                token = data.get("session_token") or data.get("token")
            else:
                print(f"❌ Login failed: {login_response.status_code}")
                print(f"Response: {login_response.text}")
                return None
        else:
            print(f"❌ Registration failed: {register_response.status_code}")
            print(f"Response: {register_response.text}")
            return None

        if not token:
            print("❌ No token in response")
            print(f"Response data: {json.dumps(data, indent=2)}")
            return None

        print(f"\n✅ Got session token: {token[:20]}...")

        # Verify token works
        print("\n2. Verifying token...")
        verify_response = httpx.get(
            f"{BACKEND_URL}/v2/activities/templates?limit=1",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )

        if verify_response.status_code == 200:
            print("✅ Token verified - can access templates")
        else:
            print(f"⚠️  Token verification failed: {verify_response.status_code}")
            print(f"Response: {verify_response.text}")

        # Store token in metabob config
        print("\n3. Storing token in ~/.metabob/config.json...")
        config_path = Path.home() / ".metabob" / "config.json"

        if config_path.exists():
            with open(config_path, "r") as f:
                config = json.load(f)
        else:
            config = {}

        config["session_token"] = token
        config["api_key"] = token  # Also store as api_key for compatibility

        with open(config_path, "w") as f:
            json.dump(config, f, indent=2)

        print(f"✅ Token stored in {config_path}")

        return token

    except httpx.ConnectError:
        print(f"❌ Could not connect to backend at {BACKEND_URL}")
        print("   Make sure the backend is running: docker ps | grep api-server")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
        return None


if __name__ == "__main__":
    token = create_test_session()
    if token:
        print("\n" + "=" * 60)
        print("✅ SUCCESS! Session token created and stored.")
        print("=" * 60)
        print("\nYou can now run activity execution tests:")
        print("  cd repos/metabob-cli && python3 debug_activity.py")
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("❌ FAILED to create session token")
        print("=" * 60)
        sys.exit(1)
