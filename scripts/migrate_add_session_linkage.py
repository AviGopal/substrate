#!/usr/bin/env python3
"""
Migration: Add session_id linkage to activity_executions table.

This migration adds the following fields to support session-activity linkage:
- session_id: Links execution to OpenCode session for context analysis
- impulses_used: Array of impulse IDs that were active during execution
- component_changes: Array of components modified during execution

Phase 2: Learning Loop - Data Collection
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# Use surrealdb directly for migration
try:
    from surrealdb import Surreal
except ImportError:
    print("ERROR: surrealdb package not installed. Run: pip install surrealdb")
    sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_config():
    """Get SurrealDB configuration from environment."""
    # Try .env.devbob first
    env_file = Path(__file__).parent.parent / ".env.devbob"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key, value)

    # Get config with fallbacks
    url = os.getenv("SURREAL_URL", "ws://localhost:8000")
    user = os.getenv("SURREAL_USER", "root")
    password = os.getenv("SURREAL_PASS", "root")
    namespace = os.getenv("SURREAL_NAMESPACE", "metabob")
    database = os.getenv("SURREAL_DATABASE", "devbob")

    return {
        "url": url,
        "user": user,
        "password": password,
        "namespace": namespace,
        "database": database,
    }


async def migrate_add_session_linkage() -> None:
    """
    Add session linkage fields to activity_executions table.

    Fields added:
    - session_id: option<string> - Links to OpenCode session
    - impulses_used: array - Impulse IDs active during execution
    - component_changes: array - Components modified during execution
    """
    config = get_config()
    logger.info("Starting migration: add_session_linkage")
    logger.info(f"Connecting to {config['url']} as {config['user']}")
    logger.info(
        f"Using namespace: {config['namespace']}, database: {config['database']}"
    )

    db = None
    try:
        # Connect to SurrealDB
        db = Surreal(config["url"])

        # Sign in
        db.signin({"username": config["user"], "password": config["password"]})
        logger.info("✓ Signed in successfully")

        # Select namespace and database
        db.use(config["namespace"], config["database"])
        logger.info(f"✓ Using {config['namespace']}.{config['database']}")

        # Add session_id field
        result = db.query(
            "DEFINE FIELD session_id ON activity_executions TYPE option<string>;"
        )
        logger.info(f"✓ Added session_id field: {result}")

        # Add index for session_id
        result = db.query(
            "DEFINE INDEX session_id_idx ON activity_executions FIELDS session_id;"
        )
        logger.info(f"✓ Added session_id index: {result}")

        # Add impulses_used field
        result = db.query(
            "DEFINE FIELD impulses_used ON activity_executions TYPE array DEFAULT [];"
        )
        logger.info(f"✓ Added impulses_used field: {result}")

        # Add component_changes field
        result = db.query(
            "DEFINE FIELD component_changes ON activity_executions TYPE array DEFAULT [];"
        )
        logger.info(f"✓ Added component_changes field: {result}")

        logger.info("✅ Migration completed successfully!")

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        raise
    finally:
        if db:
            try:
                db.close()
                logger.info("✓ Closed connection")
            except:
                pass


async def main():
    """Main entry point."""
    try:
        await migrate_add_session_linkage()
        logger.info("Migration complete!")
        return 0

    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
