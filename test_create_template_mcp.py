#!/usr/bin/env python3
"""
Test create_activity_template MCP tool via direct Python call
"""

import asyncio
import json
import sys
from pathlib import Path

# Add repos to path
sys.path.insert(0, str(Path(__file__).parent / "repos" / "metabob-cli" / "src"))

from metabob_cli.mcp.tools import create_activity_template_tool


async def main():
    print("=" * 60)
    print("Testing create_activity_template MCP Tool")
    print("=" * 60)
    print()

    # Create minimal test template
    template = {
        "name": "MCP Tool Test Template",
        "description": "Minimal template to validate MCP tool works",
        "category": "test",
        "task_steps": [
            {
                "id": "test-step-1",
                "description": "Print test message",
                "subagent": "general",
                "prompt": {
                    "template": "Print: MCP tool test successful!",
                    "variables": [],
                    "max_tokens": 100,
                },
                "impulse_refs": [],
            }
        ],
        "variables": {},
        "context_requirements": [],
    }

    print("Template to create:")
    print(f"  Name: {template['name']}")
    print(f"  Category: {template['category']}")
    print(f"  Steps: {len(template['task_steps'])}")
    print()

    print("Calling create_activity_template_tool...")
    print()

    try:
        result_json = await create_activity_template_tool(
            template_json=json.dumps(template, indent=2), created_by="mcp-tool-test"
        )

        result = json.loads(result_json)

        print("Result:")
        print(json.dumps(result, indent=2))
        print()

        if result.get("status") == "success":
            print("✅ SUCCESS!")
            print(f"   Variant ID: {result.get('variant_id')}")
            print(f"   Message: {result.get('message')}")
            return 0
        else:
            print("❌ FAILED!")
            print(f"   Error: {result.get('message')}")
            return 1

    except Exception as e:
        print(f"❌ EXCEPTION: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
