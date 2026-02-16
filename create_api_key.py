#!/usr/bin/env python3
"""
Create API key in SurrealDB for backend integration.

This script registers the API key found in configuration files so that
metabob-cli and metabob-opencode can authenticate with the backend.
"""

import asyncio
import hashlib
import sys
from pathlib import Path
from uuid import uuid4

# Add backend to path
sys.path.insert(0, str(Path.cwd() / "repos" / "metabob-rpc-api"))

from server.config import Settings
from server.utils.surreal_client import SurrealDBClient


def _hash_api_key(api_key: str) -> str:
    """Hash API key using SHA-256 (matches backend implementation)."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


async def create_api_key():
    """Create API key in database."""
    print("🔧 Connecting to SurrealDB...")

    config = Settings(
        SURREAL_URL="ws://localhost:8000",
        SURREAL_USER="root",
        SURREAL_PASS="root",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="metabob",
    )

    db = SurrealDBClient(config)
    await db.connect()
    print("✅ Connected to database")

    # API key from configuration files
    api_key = "mb_TfdRc58VlhLzio5jebyESJnTplTiDHlAiQtPB0JdOrQ"
    key_hash = _hash_api_key(api_key)
    key_id = str(uuid4())

    print(f"🔑 Creating API key: {api_key[:30]}...")
    print(f"🔐 Key hash: {key_hash[:40]}...")

    try:
        # Create API key following backend schema (auth_db.py pattern)
        result = await db.query(
            f"""
            CREATE api_keys:`{key_id}` SET
                key_id = $key_id,
                org_id = $org_id,
                user_id = $user_id,
                key_hash = $key_hash,
                scopes = $scopes,
                is_active = true,
                revoked = false
        """,
            {
                "key_id": key_id,
                "org_id": "devbob",
                "user_id": "system",  # System-generated key
                "key_hash": key_hash,
                "scopes": ["admin:*", "analysis:read", "analysis:write"],  # Full access
            },
        )

        print(f"✅ API key created successfully!")
        print(f"   Raw Key: {api_key}")
        print(f"   Key ID: {key_id}")
        print(f"   Organization: devbob")
        print(f"   User: system")
        print(f"   Scopes: admin:*, analysis:read, analysis:write")
        print(f"   Status: active")

        # Verify it was created
        verify_result = await db.query(
            "SELECT * FROM api_keys WHERE key_hash = $key_hash", {"key_hash": key_hash}
        )

        if verify_result and verify_result[0].get("result"):
            print(f"✅ Verification: Key found in database (by hash)")
            records = verify_result[0].get("result", [])
            if records:
                record = records[0]
                print(f"   Record ID: {record.get('id')}")
                print(f"   Active: {record.get('is_active')}")
                print(f"   Scopes: {record.get('scopes')}")
        else:
            print(f"⚠️  Warning: Could not verify key creation")

    except Exception as e:
        print(f"❌ Error creating API key: {e}")
        raise
    finally:
        await db.disconnect()
        print("🔌 Disconnected from database")


if __name__ == "__main__":
    print("=" * 60)
    print("Backend Integration - API Key Creation")
    print("=" * 60)
    print()

    try:
        asyncio.run(create_api_key())
        print()
        print("=" * 60)
        print("✅ SUCCESS: API key is now registered in database")
        print("=" * 60)
        print()
        print("Next steps:")
        print("  1. Update metabob-cli configuration")
        print("  2. Update metabob-opencode configuration")
        print("  3. Test authentication with backend")

    except KeyboardInterrupt:
        print("\n⚠️  Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        sys.exit(1)
