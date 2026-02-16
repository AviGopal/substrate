#!/usr/bin/env python3
"""
Comprehensive database initialization script.
Creates database, tables, and indexes for the complete learning loop system.
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(
    0, "/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-rpc-api"
)

from server.utils.surreal_client import SurrealDBClient
from server.config import settings


async def init_complete_schema():
    """Initialize complete database schema including impulse tables."""

    s = settings()
    print(f"Connecting to {s.SURREAL_URL}...")
    print(f"Namespace: {s.SURREAL_NAMESPACE}, Database: {s.SURREAL_DATABASE}")

    db = SurrealDBClient(s)
    await db.connect()
    print("✅ Connected\n")

    # Ensure namespace and database exist
    print("Creating namespace and database...")
    await db.query(f"USE NS {s.SURREAL_NAMESPACE};")
    await db.query(f"USE DB {s.SURREAL_DATABASE};")
    print("✅ Namespace and database ready\n")

    # ================================================================
    # PHASE 1: Activity System Tables
    # ================================================================
    print("=== Phase 1: Activity System Tables ===")

    print("Creating activities table...")
    await db.query("""
        DEFINE TABLE IF NOT EXISTS activities SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS activity_id ON activities TYPE string;
        DEFINE FIELD IF NOT EXISTS name ON activities TYPE string;
        DEFINE FIELD IF NOT EXISTS description ON activities TYPE string;
        DEFINE FIELD IF NOT EXISTS category ON activities TYPE string;
        DEFINE FIELD IF NOT EXISTS tags ON activities TYPE array<string>;
        DEFINE FIELD IF NOT EXISTS created_at ON activities TYPE datetime DEFAULT time::now();
        DEFINE INDEX IF NOT EXISTS activity_id_idx ON activities FIELDS activity_id UNIQUE;
    """)
    print("✅ activities table created")

    print("Creating activity_variants table...")
    await db.query("""
        DEFINE TABLE IF NOT EXISTS activity_variants SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS variant_id ON activities TYPE string;
        DEFINE FIELD IF NOT EXISTS activity_id ON activity_variants TYPE string;
        DEFINE FIELD IF NOT EXISTS version ON activity_variants TYPE int;
        DEFINE FIELD IF NOT EXISTS tasks ON activity_variants TYPE array;
        DEFINE FIELD IF NOT EXISTS context_requirements ON activity_variants TYPE array DEFAULT [];
        DEFINE FIELD IF NOT EXISTS created_at ON activity_variants TYPE datetime DEFAULT time::now();
        DEFINE INDEX IF NOT EXISTS variant_id_idx ON activity_variants FIELDS variant_id UNIQUE;
    """)
    print("✅ activity_variants table created")

    print("Creating activity_execution table...")
    await db.query("""
        DEFINE TABLE IF NOT EXISTS activity_execution SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS execution_id ON activity_execution TYPE string;
        DEFINE FIELD IF NOT EXISTS variant_id ON activity_execution TYPE string;
        DEFINE FIELD IF NOT EXISTS project_id ON activity_execution TYPE string;
        DEFINE FIELD IF NOT EXISTS session_id ON activity_execution TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS status ON activity_execution TYPE string DEFAULT 'pending';
        DEFINE FIELD IF NOT EXISTS success ON activity_execution TYPE option<bool>;
        DEFINE FIELD IF NOT EXISTS duration_ms ON activity_execution TYPE option<int>;
        DEFINE FIELD IF NOT EXISTS cost ON activity_execution TYPE option<float>;
        DEFINE FIELD IF NOT EXISTS impulses_used ON activity_execution TYPE array DEFAULT [];
        DEFINE FIELD IF NOT EXISTS created_at ON activity_execution TYPE datetime DEFAULT time::now();
        DEFINE FIELD IF NOT EXISTS completed_at ON activity_execution TYPE option<datetime>;
        DEFINE INDEX IF NOT EXISTS execution_id_idx ON activity_execution FIELDS execution_id UNIQUE;
        DEFINE INDEX IF NOT EXISTS project_idx ON activity_execution FIELDS project_id;
        DEFINE INDEX IF NOT EXISTS session_idx ON activity_execution FIELDS session_id;
    """)
    print("✅ activity_execution table created")

    # ================================================================
    # PHASE 2: Learning Loop Tables (MISSING!)
    # ================================================================
    print("\n=== Phase 2: Learning Loop Tables ===")

    print("Creating impulse_effectiveness table...")
    await db.query("""
        DEFINE TABLE IF NOT EXISTS impulse_effectiveness SCHEMALESS;
    """)
    print("✅ impulse_effectiveness table created (schemaless)")

    print("Creating impulse_provenance table...")
    await db.query("""
        DEFINE TABLE IF NOT EXISTS impulse_provenance SCHEMALESS;
    """)
    print("✅ impulse_provenance table created (schemaless)")

    print("Creating component_changes table...")
    await db.query("""
        DEFINE TABLE IF NOT EXISTS component_changes SCHEMALESS;
    """)
    print("✅ component_changes table created (schemaless)")

    # ================================================================
    # PHASE 3: Verify Tables Exist
    # ================================================================
    print("\n=== Verification ===")
    result = await db.query("INFO FOR DB;")
    if result and len(result) > 0:
        tables_dict = result[0].get("result", {}).get("tb", {})
        all_tables = sorted(list(tables_dict.keys()))
        print(f"✅ Total tables: {len(all_tables)}")
        for table in all_tables:
            print(f"   - {table}")

    print("\n✅ Database initialization complete!")


if __name__ == "__main__":
    asyncio.run(init_complete_schema())
