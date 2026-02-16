#!/usr/bin/env python3
"""
Automated script to retrieve/create production API key from Metabob backend.

Usage:
    # Interactive (prompts for credentials):
    python get_production_api_key.py

    # With environment variables:
    export METABOB_EMAIL="your-email@example.com"
    export METABOB_PASSWORD="your-password"
    python get_production_api_key.py

    # Or provide directly:
    python get_production_api_key.py --email user@example.com --password yourpass
"""

import argparse
import json
import os
import sys
from getpass import getpass

import requests


def login(email: str, password: str, base_url: str = "https://ide.metabob.com") -> dict:
    """Login to Metabob and get session token."""
    print(f"🔐 Logging in to {base_url}...")

    response = requests.post(
        f"{base_url}/login", json={"email": email, "password": password}, timeout=30
    )

    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(f"Response: {response.text}")
        sys.exit(1)

    data = response.json()
    print(f"✓ Logged in as {data.get('user', {}).get('email', email)}")

    return data


def get_organization_id(session_token: str, base_url: str) -> str:
    """Get first organization ID for the user."""
    print("📋 Fetching organizations...")

    headers = {"Authorization": f"Bearer {session_token}"}
    response = requests.get(f"{base_url}/orgs", headers=headers, timeout=30)

    if response.status_code != 200:
        print(f"❌ Failed to fetch organizations: {response.status_code}")
        sys.exit(1)

    orgs = response.json()
    if not orgs:
        print("❌ No organizations found for user")
        sys.exit(1)

    org_id = orgs[0]["id"]
    org_name = orgs[0].get("name", "Unknown")
    print(f"✓ Using organization: {org_name} ({org_id})")

    return org_id


def list_api_keys(session_token: str, org_id: str, base_url: str) -> list:
    """List existing API keys for organization."""
    print("🔑 Checking existing API keys...")

    headers = {"Authorization": f"Bearer {session_token}"}
    response = requests.get(
        f"{base_url}/orgs/{org_id}/api-keys", headers=headers, timeout=30
    )

    if response.status_code != 200:
        print(f"⚠️  Could not list API keys: {response.status_code}")
        return []

    keys = response.json()
    if keys:
        print(f"✓ Found {len(keys)} existing API key(s)")
        for key in keys:
            status = "active" if key.get("is_active") else "revoked"
            print(f"  - {key.get('name')} ({status})")
    else:
        print("  No existing keys found")

    return keys


def create_api_key(session_token: str, org_id: str, name: str, base_url: str) -> str:
    """Create a new API key."""
    print(f"🔧 Creating new API key: {name}...")

    headers = {"Authorization": f"Bearer {session_token}"}
    response = requests.post(
        f"{base_url}/orgs/{org_id}/api-keys",
        headers=headers,
        json={
            "name": name,
            "scopes": ["read", "write", "admin"],
            "expires_at": None,  # No expiration
        },
        timeout=30,
    )

    if response.status_code not in (200, 201):
        print(f"❌ Failed to create API key: {response.status_code}")
        print(f"Response: {response.text}")
        sys.exit(1)

    data = response.json()
    api_key = data.get("key") or data.get("api_key")

    if not api_key:
        print("❌ API key not found in response")
        print(f"Response: {json.dumps(data, indent=2)}")
        sys.exit(1)

    print(f"✓ API key created successfully!")
    return api_key


def save_api_key(api_key: str, filename: str = ".metabob_production_api_key"):
    """Save API key to file."""
    filepath = os.path.join(os.getcwd(), filename)
    with open(filepath, "w") as f:
        f.write(api_key)

    print(f"💾 API key saved to: {filepath}")
    print(f"⚠️  Keep this file secure! Add to .gitignore if not already there.")


def main():
    parser = argparse.ArgumentParser(
        description="Get production API key from Metabob backend"
    )
    parser.add_argument("--email", help="Email address (or set METABOB_EMAIL env var)")
    parser.add_argument("--password", help="Password (or set METABOB_PASSWORD env var)")
    parser.add_argument(
        "--base-url",
        default="https://ide.metabob.com",
        help="Backend base URL (default: https://ide.metabob.com)",
    )
    parser.add_argument(
        "--key-name",
        default="devbob-local-dev",
        help="Name for the API key (default: devbob-local-dev)",
    )
    parser.add_argument(
        "--list-only",
        action="store_true",
        help="Only list existing keys, don't create new one",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Save API key to .metabob_production_api_key file",
    )

    args = parser.parse_args()

    # Get credentials
    email = args.email or os.getenv("METABOB_EMAIL")
    password = args.password or os.getenv("METABOB_PASSWORD")

    if not email:
        email = input("Email: ")

    if not password:
        password = getpass("Password: ")

    if not email or not password:
        print("❌ Email and password are required")
        sys.exit(1)

    # Login
    login_data = login(email, password, args.base_url)
    session_token = login_data.get("session_token") or login_data.get("token")

    if not session_token:
        print("❌ No session token in login response")
        sys.exit(1)

    # Get organization
    org_id = get_organization_id(session_token, args.base_url)

    # List existing keys
    existing_keys = list_api_keys(session_token, org_id, args.base_url)

    if args.list_only:
        print("\n✅ Done (list-only mode)")
        return

    # Check if key with same name already exists
    existing_key = next(
        (
            k
            for k in existing_keys
            if k.get("name") == args.key_name and k.get("is_active")
        ),
        None,
    )

    if existing_key:
        print(f"\n⚠️  Active API key '{args.key_name}' already exists!")
        print(f"   Key ID: {existing_key.get('id')}")
        print(f"   Created: {existing_key.get('created_at')}")
        print("\n   Note: The raw key is not stored and cannot be retrieved.")
        print("   Options:")
        print("   1. Create a new key with a different name (--key-name)")
        print("   2. Revoke the existing key and create a new one")
        print("   3. Use the dashboard UI to view/create keys")
        sys.exit(0)

    # Create new API key
    api_key = create_api_key(session_token, org_id, args.key_name, args.base_url)

    # Display result
    print("\n" + "=" * 70)
    print("🎉 SUCCESS! Your production API key:")
    print("=" * 70)
    print(f"\n{api_key}\n")
    print("=" * 70)
    print("⚠️  IMPORTANT: Save this key now! It will not be shown again.")
    print("=" * 70)

    # Save to file if requested
    if args.save:
        save_api_key(api_key)

    # Next steps
    print("\n📋 Next steps:")
    print("   1. Copy the API key above")
    print(f"   2. Run: python migrate_to_production_backend.py {api_key}")
    print("   3. Verify configs are updated")
    print("   4. Test connection: cd repos/metabob-cli && metabob-cli config verify")
    print("\n✅ Done!")


if __name__ == "__main__":
    main()
