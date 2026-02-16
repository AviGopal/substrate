#!/usr/bin/env python3
"""
Check impulse data quality in SurrealDB after running activity execution.
Verifies if our fixes for impulse ID generation and token estimation are working.
"""

import asyncio
import sys
from datetime import datetime, timedelta

# Add repos/metabob-rpc-api to path to import SurrealDBClient
sys.path.insert(0, "repos/metabob-rpc-api")

from server.utils.surreal_client import SurrealDBClient


async def check_impulse_data():
    """Query database for recent impulse records and analyze quality."""

    # Connect to SurrealDB
    db = SurrealDBClient(
        url="http://localhost:8000",
        namespace="metabob",
        database="production",
        username="root",
        password="root",
    )

    try:
        await db.connect()
        print("✅ Connected to SurrealDB\n")

        # Query for recent impulse_effectiveness records (last 1 hour)
        cutoff = datetime.utcnow() - timedelta(hours=1)

        query = """
            SELECT * FROM impulse_effectiveness 
            WHERE created_at > $cutoff OR last_used > $cutoff
            ORDER BY last_used DESC 
            LIMIT 20
        """

        print(
            f"Querying impulse_effectiveness records since {cutoff.strftime('%Y-%m-%d %H:%M:%S')}...\n"
        )

        results = await db.query(query, {"cutoff": cutoff.isoformat()})

        if not results:
            print("⚠️  No recent impulse records found")
            print("   This means either:")
            print("   1. Activity execution didn't capture impulses")
            print("   2. Impulses weren't sent to backend")
            print("   3. Database query issue")
            return

        print(f"✅ Found {len(results)} recent impulse records\n")
        print("=" * 80)
        print("DATA QUALITY ANALYSIS")
        print("=" * 80)

        # Analyze data quality
        unknown_ids = 0
        zero_tokens = 0
        proper_ids = 0
        proper_tokens = 0

        for record in results:
            impulse_id = record.get("impulse_id", "")
            total_tokens = record.get("total_tokens", 0)

            # Check ID quality
            if impulse_id == "unknown" or not impulse_id:
                unknown_ids += 1
            else:
                proper_ids += 1

            # Check token quality
            if total_tokens == 0:
                zero_tokens += 1
            else:
                proper_tokens += 1

        total = len(results)

        print(f"\n📊 Impulse ID Quality:")
        print(f"   Proper IDs:  {proper_ids}/{total} ({proper_ids / total * 100:.1f}%)")
        print(
            f"   Unknown IDs: {unknown_ids}/{total} ({unknown_ids / total * 100:.1f}%)"
        )

        print(f"\n📊 Token Count Quality:")
        print(
            f"   Non-zero:    {proper_tokens}/{total} ({proper_tokens / total * 100:.1f}%)"
        )
        print(
            f"   Zero tokens: {zero_tokens}/{total} ({zero_tokens / total * 100:.1f}%)"
        )

        # Show samples
        print(f"\n📋 Sample Records (first 5):")
        print("-" * 80)

        for i, record in enumerate(results[:5], 1):
            print(f"\n{i}. Impulse ID: {record.get('impulse_id', 'N/A')}")
            print(f"   Total uses:   {record.get('total_uses', 0)}")
            print(f"   Total tokens: {record.get('total_tokens', 0)}")
            print(f"   Effectiveness: {record.get('effectiveness_rate', 0):.2f}")
            print(f"   Last used: {record.get('last_used', 'N/A')}")

        # Determine if fixes are working
        print("\n" + "=" * 80)
        print("VERDICT")
        print("=" * 80)

        if proper_ids > total * 0.9 and proper_tokens > total * 0.9:
            print("✅ FIXES WORKING - High quality impulse data!")
            print("   - >90% proper impulse IDs")
            print("   - >90% non-zero token counts")
        elif proper_ids > total * 0.5 or proper_tokens > total * 0.5:
            print("⚠️  PARTIAL SUCCESS - Some improvements but issues remain")
            print(f"   - {proper_ids / total * 100:.1f}% proper IDs (target: >90%)")
            print(
                f"   - {proper_tokens / total * 100:.1f}% non-zero tokens (target: >90%)"
            )
        else:
            print("❌ FIXES NOT APPLIED - Data quality still poor")
            print("   - Check if activity_manager.py fixes are active")
            print("   - Verify metabob-cli is reloaded")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
    finally:
        await db.close()


if __name__ == "__main__":
    asyncio.run(check_impulse_data())
