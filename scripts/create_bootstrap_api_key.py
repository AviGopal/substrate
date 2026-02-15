#!/usr/bin/env python3
"""
Create a bootstrap API key directly in the database.
This bypasses the auth system to create an initial key for development.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


async def main():
    # Import after adding to path
    from surrealdb import Surreal

    # Connect to database
    db = Surreal("ws://localhost:8000/rpc")

    try:
        await db.connect()
        await db.use("metabob", "metabob")

        # API key details (generated in previous command)
        api_key = "mb_nH7j21NRXWRaqWyHq4ntSuwiRxARrhFnsR2J7i7vb-E"
        key_hash = "54bea5bbf121c6a22a56e024280ec99972ee43c1830543f98a7324c30d76b043"
        expires_at = "2027-02-14T11:36:42.554929Z"

        print("Inserting API key into database...")

        # Insert using direct query
        result = await db.query(
            """
            CREATE api_keys SET
                key_hash = $key_hash,
                key_id = $key_id,
                org_id = $org_id,
                user_id = $user_id,
                scopes = $scopes,
                expires_at = time::parse($expires_at),
                created_at = time::now(),
                last_used_at = NONE,
                is_active = true,
                description = $description
        """,
            {
                "key_hash": key_hash,
                "key_id": "key_dev_bootstrap",
                "org_id": "org:dev",
                "user_id": "user:dev",
                "scopes": ["read", "write", "admin"],
                "expires_at": expires_at,
                "description": "Bootstrap development API key",
            },
        )

        print("✅ API key created successfully!")
        print(f"\nAPI Key: {api_key}")
        print(f"Key ID: key_dev_bootstrap")
        print(f"Expires: {expires_at}")
        print(f"\nAdd this to your .metabob/config.json:")
        print(f'  "api_key": "{api_key}"')

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
