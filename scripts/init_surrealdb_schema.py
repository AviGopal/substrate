#!/usr/bin/env python3
"""
Initialize SurrealDB schema for activity learning loop.

This script can be run directly in the API container to set up the database schema.
"""

import sys
from pathlib import Path


def main():
    print("🔧 SurrealDB Schema Initializer")
    print("=" * 50)

    # Import SurrealDB client
    try:
        from server.db.surrealdb_client import get_surreal_client

        print("✅ Imported SurrealDB client")
    except ImportError as e:
        print(f"❌ Error: Could not import SurrealDB client: {e}")
        return 1

    # Find schema file
    schema_paths = [
        Path("/src/app/initialize-surrealdb-schema.sql"),
        Path("./initialize-surrealdb-schema.sql"),
        Path("../initialize-surrealdb-schema.sql"),
    ]

    schema_file = None
    for path in schema_paths:
        if path.exists():
            schema_file = path
            break

    if schema_file is None:
        print(f"❌ Error: Could not find schema file")
        print(f"   Searched:")
        for path in schema_paths:
            print(f"   - {path}")
        return 1

    print(f"📋 Using schema file: {schema_file}")

    # Read schema
    try:
        schema_sql = schema_file.read_text()
        print(f"✅ Read schema ({len(schema_sql)} bytes)")
    except Exception as e:
        print(f"❌ Error reading schema: {e}")
        return 1

    # Connect to SurrealDB
    print("\n🔌 Connecting to SurrealDB...")
    try:
        db = get_surreal_client()
        print("✅ Connected successfully")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        import traceback

        traceback.print_exc()
        return 1

    # Execute schema
    print("\n⚙️  Executing schema SQL...")
    try:
        result = db.query(schema_sql)
        print(f"✅ Schema executed (result type: {type(result)})")

        if result:
            print(f"   Result length: {len(result)}")
    except Exception as e:
        print(f"❌ Schema execution failed: {e}")
        import traceback

        traceback.print_exc()
        return 1

    # Verify tables
    print("\n📊 Verifying tables...")
    try:
        info_result = db.query("INFO FOR DB;")

        # Handle different return formats
        tables = {}
        if isinstance(info_result, dict):
            # Direct dict response (newer surrealdb client)
            tables = info_result.get("tables", {})
        elif isinstance(info_result, list) and len(info_result) > 0:
            # List response (older format)
            first = info_result[0]
            if isinstance(first, dict):
                tables = first.get("result", {}).get("tables", {})

        if tables:
            print(f"✅ Found {len(tables)} tables:")

            expected_tables = [
                "activity_execution",
                "template_metrics",
                "failure_patterns",
                "task_execution",
                "activity_content",
            ]

            for table in expected_tables:
                if table in tables:
                    print(f"   ✅ {table}")
                else:
                    print(f"   ⚠️  {table} (missing)")
        else:
            print("⚠️  No tables found - trying alternative verification...")
            # Try counting records instead
            expected_tables = [
                "activity_execution",
                "template_metrics",
                "failure_patterns",
                "task_execution",
                "activity_content",
            ]

            for table in expected_tables:
                try:
                    count_result = db.query(f"SELECT count() FROM {table} GROUP ALL;")
                    print(f"   ✅ {table} (accessible)")
                except Exception as e:
                    print(f"   ❌ {table} ({str(e)[:50]})")
    except Exception as e:
        print(f"⚠️  Verification failed: {e}")
        import traceback

        traceback.print_exc()

    print("\n" + "=" * 50)
    print("🎉 Schema initialization complete!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
