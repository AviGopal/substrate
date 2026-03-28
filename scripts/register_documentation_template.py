#!/usr/bin/env python3
"""
Direct template registration script using backend functions.
Registers the organize-documentation-v1 template.
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
from server.models.activity_recommendation import Activity


async def register_template():
    """Register the organize-documentation template"""

    template_data = {
        "activity_id": "organize-documentation-v1",
        "variant_name": "v1-baseline",
        "name": "Organize Documentation and Create Codebase State Snapshot",
        "description": "Clean up session documentation, archive historical files, and create stateless representation of current codebase functionality with in-flight changes",
        "category": "infrastructure",
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
        "prompt_strategy": "handlebars",
        "created_by": "devbob-cli",
        "is_bootstrap": False,
        "evolution_type": "original",
        "tasks": [],  # Required by database schema (legacy field)
    }

    # Connect to SurrealDB using Settings config (Docker credentials)
    config = Settings(
        SURREAL_URL="ws://localhost:8000",
        SURREAL_USER="root",
        SURREAL_PASS="root",
        SURREAL_NAMESPACE="metabob",
        SURREAL_DATABASE="production",
    )
    db = SurrealDBClient(config)

    try:
        print("✅ Connected to SurrealDB")

        # Create variant
        variant = await create_variant(db, template_data, auto_hash=True)
        print(f"✅ Template registered successfully!")
        print(f"   ID: {variant.variant_id}")
        print(f"   Variant Name: {variant.variant_name}")
        print(f"   Activity ID: {variant.activity_id}")
        print(f"   Description: {variant.description}")
        print(f"   Tasks: {len(variant.task_steps)}")

        return variant

    except Exception as e:
        print(f"❌ Registration failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
    finally:
        await db.disconnect()


if __name__ == "__main__":
    asyncio.run(register_template())
