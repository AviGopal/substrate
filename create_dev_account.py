#!/usr/bin/env python3
"""Create a development account with API key."""

import asyncio
import sys

sys.path.insert(0, "/opt/app")

from server.actions.auth_db import provision_organization, create_api_key
from server.utils.surreal_client import SurrealDBClient


async def main():
    """Create dev org, user, and API key."""

    # Create database client
    db = SurrealDBClient()
    await db.connect()

    print("Creating development organization...")

    try:
        org_data, user_data = await provision_organization(
            db=db,
            name="Exp Repo Dev",
            admin_email="dev@example.com",
            admin_password="devpassword123",
            plan="free",
        )

        print(f"✅ Organization: {org_data.org_id}")
        print(f"✅ User: {user_data.user_id}")

        org_id = org_data.org_id
        user_id = user_data.user_id

    except Exception as e:
        print(f"⚠️  Org exists, using exp-repo: {e}")
        org_id = "exp-repo"
        user_id = "dev-user"

    print("\nCreating API key...")
    try:
        api_key, _ = await create_api_key(
            db=db, user_id=user_id, org_id=org_id, scopes=["read", "write", "admin"]
        )

        print(f"\n{'=' * 60}")
        print(f"✅ DEV ACCOUNT READY")
        print(f"{'=' * 60}")
        print(f"Organization: {org_id}")
        print(f"User: {user_id}")
        print(f"API Key: {api_key}")
        print(f"{'=' * 60}")
        print(f"\nTest:")
        print(f"  curl -H 'X-API-Key: {api_key}' \\")
        print(f"    http://localhost:8080/v2/activities/templates")
        print(f"\nExport:")
        print(f"  export METABOB_API_KEY='{api_key}'")
        print(f"{'=' * 60}\n")

        with open("/tmp/dev_api_key.txt", "w") as f:
            f.write(api_key)
        print("Saved to: /tmp/dev_api_key.txt\n")

        await db.close()
        return api_key

    except Exception as e:
        print(f"❌ Failed: {e}")
        import traceback

        traceback.print_exc()
        await db.close()


if __name__ == "__main__":
    asyncio.run(main())
