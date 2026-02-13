#!/usr/bin/env python3
"""
Test create_activity_template MCP tool

Validates that the tool can create templates in the backend.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add metabob-cli to path
cli_path = Path(__file__).parent.parent / "repos" / "metabob-cli" / "src"
sys.path.insert(0, str(cli_path))

from metabob_cli.mcp.tools import create_activity_template_tool


async def test_create_template():
    """Test creating a simple template"""

    # Create a minimal test template
    template = {
        "name": "Test Template Creation",
        "description": "Minimal template to test MCP tool",
        "category": "test",
        "task_steps": [
            {
                "id": "test-step",
                "description": "Test step",
                "subagent": "general",
                "prompt": {
                    "template": "Print: Test successful",
                    "variables": [],
                    "max_tokens": 100,
                },
                "impulse_refs": [],
            }
        ],
        "variables": {},
        "context_requirements": [],
    }

    print("Testing create_activity_template tool...")
    print(f"Template: {template['name']}")
    print(f"Category: {template['category']}")
    print(f"Steps: {len(template['task_steps'])}")
    print()

    # Call the tool
    result_json = await create_activity_template_tool(
        template_json=json.dumps(template), created_by="test-script"
    )

    result = json.loads(result_json)

    print("Result:")
    print(json.dumps(result, indent=2))
    print()

    if result["status"] == "success":
        print(
            f"✅ SUCCESS: Template created with variant_id: {result.get('variant_id')}"
        )
        return True
    else:
        print(f"❌ FAILED: {result.get('message')}")
        return False


if __name__ == "__main__":
    success = asyncio.run(test_create_template())
    sys.exit(0 if success else 1)
