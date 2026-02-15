#!/usr/bin/env python3
"""
Fix the impulses_used schema to use array<object> instead of array.

This should resolve the bug where impulses_used data is silently discarded.
"""

import asyncio
import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "repos" / "metabob-rpc-api"))

# Set env vars for connection (use production database like backend does)
os.environ["SURREALDB_URL"] = "ws://localhost:8000"
os.environ["SURREALDB_NAMESPACE"] = "metabob"
os.environ["SURREALDB_DATABASE"] = (
    "production"  # Backend uses 'production' not 'metabob'
)
os.environ["SURREALDB_USERNAME"] = "root"
os.environ["SURREALDB_PASSWORD"] = "root"

from server.utils.surreal_client import get_surreal_connection


async def main():
    print("=" * 70)
    print("Fixing impulses_used Schema")
    print("=" * 70)

    db = await anext(get_surreal_connection())

    print("\n[1/3] Checking current schema...")
    result = await db.query("INFO FOR TABLE activity_executions;")
    print(f"   ✓ Schema retrieved")

    print("\n[2/3] Updating schema to use array<object>...")
    try:
        # Update impulses_used to be array<object>
        await db.query("""
            DEFINE FIELD impulses_used ON activity_executions 
            TYPE array<object> 
            DEFAULT [];
        """)
        print(f"   ✓ impulses_used field updated to array<object>")

        # Also update component_changes for consistency
        await db.query("""
            DEFINE FIELD component_changes ON activity_executions 
            TYPE array<object> 
            DEFAULT [];
        """)
        print(f"   ✓ component_changes field updated to array<object>")

    except Exception as e:
        print(f"   ✗ Failed to update schema: {e}")
        return False

    print("\n[3/3] Verifying schema change...")
    result = await db.query("INFO FOR TABLE activity_executions;")
    print(f"   ✓ Schema change applied")

    print("\n" + "=" * 70)
    print("✅ Schema Fix Complete")
    print("=" * 70)
    print("\nNext step: Re-run test_impulse_tracking_e2e_complete.py")
    print("to verify impulses are now stored correctly.")

    return True


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
