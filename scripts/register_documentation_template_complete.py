#!/usr/bin/env python3
"""
Complete template registration script using backend functions.
Registers both the activity and variant for organize-documentation-v1.
"""

import asyncio
import sys
import json
from pathlib import Path

# Add backend to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "repos/metabob-rpc-api"))

from server.config import Settings
from server.actions.activity_variants import create_variant
from server.utils.surreal_client import SurrealDBClient


async def register_complete_template():
    """Register both activity and variant for organize-documentation template"""

    activity_id = "organize-documentation-v1"
    variant_id = f"{activity_id}-b81ea152"  # Deterministic variant ID

    # Activity record (high-level, with category)
    activity_data = {
        "activity_id": activity_id,
        "variant_id": variant_id,  # REQUIRED: Links to primary variant
        "name": "Organize Documentation and Create Codebase State Snapshot",
        "description": "Clean up session documentation, archive historical files, and create stateless representation of current codebase functionality with in-flight changes",
        "category": "infrastructure",
        "tags": ["documentation", "cleanup", "snapshot", "organization"],
        "org_id": "default",
        "project_id": "metabob-devbob",
        "primary_language": "typescript",
        "framework": None,
        "tech_stack": ["typescript", "node", "markdown"],
        "intent_keywords": [
            "organize",
            "documentation",
            "archive",
            "snapshot",
            "cleanup",
        ],
        "intent_patterns": [
            "organize.*documentation",
            "clean.*up.*docs",
            "archive.*session",
            "codebase.*snapshot",
        ],
        "source": "manual",
        "is_composed": False,
        "composed_activity_ids": [],
        "avg_tokens": {"input": 0, "output": 0, "total": 0},  # Required field
    }

    # Variant record (specific implementation)
    variant_data = {
        "activity_id": activity_id,
        "variant_name": "v1-baseline",
        "description": "Clean up session documentation, archive historical files, and create stateless representation of current codebase functionality with in-flight changes",
        "variables": {
            "target_directory": {
                "type": "string",
                "required": False,
                "default": ".",
                "description": "Directory to analyze (defaults to repository root)",
            }
        },
        "task_steps": [
            {
                "id": "analyze-documentation",
                "subagent": "general",
                "description": "Analyze existing documentation files and categorize them by type and status",
                "dependencies": [],
                "prompt": {
                    "template": "Analyze all markdown documentation files in the repository root and categorize them.\n\n{{#if target_directory}}\n**Target Directory**: {{target_directory}}\n{{else}}\n**Target Directory**: Repository root (.)\n{{/if}}\n\nFind all `.md` files and categorize them into:\n- Session Documentation (Archive)\n- Reference Documentation (Keep & Update)\n- Analysis Documentation (Archive or Integrate)\n- Project Status (Consolidate)\n- Testing & Validation (Archive or Keep)\n\nCreate DOCUMENTATION_ANALYSIS.md with categorization and recommendations.",
                    "variables": ["target_directory"],
                },
                "context_rules": {"max_tokens": 16000},
                "validation": {"required_files": ["DOCUMENTATION_ANALYSIS.md"]},
                "retry": {"max_attempts": 2, "strategy": "simple"},
            },
            {
                "id": "archive-historical-docs",
                "subagent": "general",
                "description": "Move session documentation and completed work reports to archive directory",
                "dependencies": ["analyze-documentation"],
                "prompt": {
                    "template": "Archive historical documentation based on DOCUMENTATION_ANALYSIS.md recommendations.\n\nCreate archive structure and move session documentation to .archive/sessions/YYYY-MM-DD/.\n\nCreate ARCHIVE_REPORT.md documenting what was moved.",
                    "variables": [],
                },
                "context_rules": {"max_tokens": 14000},
                "validation": {
                    "required_files": [".archive/README.md", "ARCHIVE_REPORT.md"]
                },
                "retry": {"max_attempts": 2, "strategy": "simple"},
            },
            {
                "id": "create-codebase-state-snapshot",
                "subagent": "general",
                "description": "Create stateless representation of current codebase functionality and capabilities",
                "dependencies": ["archive-historical-docs"],
                "prompt": {
                    "template": "Create a comprehensive, stateless snapshot of current codebase functionality.\n\nDocument:\n- Repository structure\n- Core capabilities\n- In-flight changes\n- Activity templates\n- Integration architecture\n\nCreate CODEBASE_STATE.md.",
                    "variables": [],
                },
                "context_rules": {"max_tokens": 20000},
                "validation": {"required_files": ["CODEBASE_STATE.md"]},
                "retry": {"max_attempts": 2, "strategy": "simple"},
            },
            {
                "id": "update-reference-documentation",
                "subagent": "general",
                "description": "Update or consolidate reference documentation to align with current codebase state",
                "dependencies": ["create-codebase-state-snapshot"],
                "prompt": {
                    "template": "Update reference documentation based on codebase state analysis.\n\nUpdate guides, quick starts, and reference docs to match current state.\n\nCreate DOCUMENTATION_INDEX.md and DOCUMENTATION_UPDATE_REPORT.md.",
                    "variables": [],
                },
                "context_rules": {"max_tokens": 16000},
                "validation": {
                    "required_files": [
                        "DOCUMENTATION_INDEX.md",
                        "DOCUMENTATION_UPDATE_REPORT.md",
                    ]
                },
                "retry": {"max_attempts": 2, "strategy": "simple"},
            },
        ],
        "tasks": [],  # Legacy field (required by schema)
        "context_budget_tokens": 10000,
        "prompt_strategy": "handlebars",
    }

    config = Settings(
        SURREAL_URL="ws://localhost:8000",
        SURREAL_USER="root",
        SURREAL_PASS="root",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="production",
    )

    db = SurrealDBClient(config)
    await db.connect()

    try:
        print("✅ Connected to SurrealDB")

        # Check if activity exists
        existing_activity = await db.query(
            "SELECT * FROM activities WHERE activity_id = $aid LIMIT 1",
            {"aid": activity_id},
        )

        if existing_activity:
            print(f"ℹ️  Activity already exists: {activity_id}")
        else:
            # Create activity
            activity_result = await db.create("activities", activity_data)
            print(f"✅ Activity created: {activity_id}")
            print(f"   Name: {activity_data['name']}")
            print(f"   Category: {activity_data['category']}")

        # Check if variant exists
        existing_variant = await db.query(
            "SELECT * FROM activity_variants WHERE activity_id = $aid LIMIT 1",
            {"aid": activity_id},
        )

        if existing_variant:
            print(f"ℹ️  Variant already exists for {activity_id}")
            print(f"   Variant ID: {existing_variant[0].get('variant_id')}")
            print(f"   Variant Name: {existing_variant[0].get('variant_name')}")
        else:
            # Create variant
            variant = await create_variant(db, variant_data, auto_hash=True)
            print(f"✅ Variant registered successfully!")
            print(f"   ID: {variant.variant_id}")
            print(f"   Variant Name: {variant.variant_name}")
            print(f"   Activity ID: {variant.activity_id}")
            print(f"   Description: {variant.description}")
            print(f"   Tasks: {len(variant.task_steps)}")

        print("\n🎉 Registration complete!")
        print(f"\nTo use this template:")
        print(f"  search_activities({{ query: 'organize documentation' }})")
        print(
            f"  activity({{ activityId: '{activity_id}', variables: {{}}, reason: '...' }})"
        )

    except Exception as e:
        print(f"❌ Registration failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        await db.disconnect()
        print("\n✅ Disconnected from SurrealDB")


if __name__ == "__main__":
    asyncio.run(register_complete_template())
