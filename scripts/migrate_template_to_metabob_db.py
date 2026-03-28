#!/usr/bin/env python3
"""
Migrate organize-documentation-v1 template from production to metabob database.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "repos/metabob-rpc-api"))

from server.config import Settings
from server.utils.surreal_client import SurrealDBClient


async def migrate_template():
    """Copy template from production to metabob database"""

    activity_id = "organize-documentation-v1"

    # Connect to production database
    config_prod = Settings(
        SURREAL_URL="ws://localhost:8000",
        SURREAL_USER="root",
        SURREAL_PASS="root",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="production",
    )

    # Connect to metabob database
    config_metabob = Settings(
        SURREAL_URL="ws://localhost:8000",
        SURREAL_USER="root",
        SURREAL_PASS="root",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="metabob",
    )

    db_prod = SurrealDBClient(config_prod)
    db_metabob = SurrealDBClient(config_metabob)

    await db_prod.connect()
    await db_metabob.connect()

    try:
        print("✅ Connected to both databases")

        # Export from production
        print(f"\n📤 Exporting from production database...")

        activity_results = await db_prod.query(
            "SELECT * FROM activities WHERE activity_id = $aid", {"aid": activity_id}
        )

        variant_results = await db_prod.query(
            "SELECT * FROM activity_variants WHERE activity_id = $aid",
            {"aid": activity_id},
        )

        if not activity_results:
            print(f"❌ Activity not found in production: {activity_id}")
            return

        if not variant_results:
            print(f"❌ Variant not found in production: {activity_id}")
            return

        activity_data = activity_results[0]
        variant_data = variant_results[0]

        # Remove SurrealDB metadata fields
        for data in [activity_data, variant_data]:
            data.pop("id", None)
            data.pop("created_at", None)
            data.pop("updated_at", None)

        print(f"   Activity: {activity_data['name']}")
        print(f"   Variant: {variant_data['variant_id']}")

        # Import to metabob
        print(f"\n📥 Importing to metabob database...")

        # Check if already exists
        existing_activity = await db_metabob.query(
            "SELECT * FROM activities WHERE activity_id = $aid LIMIT 1",
            {"aid": activity_id},
        )

        if existing_activity:
            print(f"   ℹ️  Activity already exists, updating...")
            await db_metabob.update(existing_activity[0]["id"], activity_data)
        else:
            await db_metabob.create("activities", activity_data)
            print(f"   ✅ Activity created")

        existing_variant = await db_metabob.query(
            "SELECT * FROM activity_variants WHERE variant_id = $vid LIMIT 1",
            {"vid": variant_data["variant_id"]},
        )

        if existing_variant:
            print(f"   ℹ️  Variant already exists, updating...")
            await db_metabob.update(existing_variant[0]["id"], variant_data)
        else:
            await db_metabob.create("activity_variants", variant_data)
            print(f"   ✅ Variant created")

        # Verify
        print(f"\n🔍 Verifying migration...")

        verify_activity = await db_metabob.query(
            "SELECT activity_id, category, variant_id FROM activities WHERE activity_id = $aid",
            {"aid": activity_id},
        )

        verify_variant = await db_metabob.query(
            "SELECT variant_id, activity_id, status FROM activity_variants WHERE variant_id = $vid",
            {"vid": variant_data["variant_id"]},
        )

        if verify_activity and verify_variant:
            print(f"✅ Migration successful!")
            print(f"\n   Activity: {verify_activity[0]}")
            print(f"   Variant: {verify_variant[0]}")
        else:
            print(f"❌ Verification failed")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        await db_prod.disconnect()
        await db_metabob.disconnect()
        print("\n✅ Disconnected from databases")


if __name__ == "__main__":
    asyncio.run(migrate_template())
