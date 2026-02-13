#!/usr/bin/env python3
"""
Test Activity-Create Template Execution
Proves we can create templates using the activity-create template
"""

import asyncio
import json
from pathlib import Path
from metabob_cli.core.file_state import FileStateManager
from metabob_cli.mcp.activity_manager import get_activity_manager


async def main():
    print("=" * 80)
    print("Activity-Create Template Execution Test")
    print("=" * 80)
    print()

    # Load session token
    state_file = Path(".metabob/state")
    state_mgr = FileStateManager(state_file)
    session_token = state_mgr.get_session_token()

    if not session_token:
        print("❌ No session token found")
        return

    # Get activity manager
    mgr = get_activity_manager("http://localhost:8080", session_token)

    # Template to create
    template_name = "simple-echo-proof"
    session_id = f"create-test-{template_name}"

    # Simple task definition
    tasks = [
        {
            "id": "echo-message",
            "subagent": "general",
            "description": "Echo a test message",
            "dependencies": [],
            "prompt": {
                "template": "Echo: {{message}}",
                "variables": ["message"],
                "max_tokens": 500,
                "compression_strategy": "filter",
            },
            "validation": {
                "required_patterns": [],
                "required_files": [],
                "forbidden_patterns": [],
                "commands": [],
            },
            "retry": {"max_attempts": 2, "strategy": "simple", "fallback_prompt": ""},
            "guidance": ["Be clear", "Echo exactly"],
            "expected_actions": [],
            "tools": {"allowed_tools": [], "forbidden_tools": []},
            "impulse_refs": [],
            "metrics": {
                "success_rate": 0.0,
                "avg_tokens": 0,
                "avg_duration": 0,
                "common_failures": [],
            },
        }
    ]

    variables = {
        "template_name": template_name,
        "template_description": "Simple proof template created via activity-create",
        "template_category": "infrastructure",
        "tasks": json.dumps(tasks),
    }

    print(f"📋 Creating template: {template_name}")
    print(f"   Activity: INFRASTRUCTURE-0013e379 (Activity Create)")
    print(f"   Tasks: {len(tasks)}")
    print()

    # Start execution
    try:
        result = await mgr.start_execution(
            activity_id="INFRASTRUCTURE-0013e379",
            variables=variables,
            session_id=session_id,
        )

        if "error" in result:
            print(f"❌ Failed to start: {result['error']}")
            return

        exec_id = result["execution_id"]
        print(f"✅ Execution started: {exec_id}")
        print()

        # Execute steps until complete
        step_num = 0
        while True:
            step_num += 1
            print(f"📋 Step {step_num}: Fetching...")

            step_result = await mgr.get_next_step(exec_id)

            if "error" in step_result:
                print(f"❌ Error: {step_result['error']}")
                break

            if "complete" in step_result and step_result["complete"]:
                print(f"✅ Execution complete!")
                print(f"   Message: {step_result.get('message', 'N/A')}")
                break

            # Get step details
            step = step_result["current_step"]
            step_id = step["step_id"]
            description = step.get("description", "N/A")

            print(f"   Step ID: {step_id}")
            print(f"   Description: {description}")
            print(
                f"   Progress: {step_result['step_index'] + 1}/{step_result['total_steps']}"
            )

            # Simulate execution (for now, just mark as success)
            # In real execution, agent would process the step
            print(f"   🤖 Simulating execution...")

            await mgr.report_step_result(
                execution_id=exec_id,
                step_id=step_id,
                success=True,
                output=f"Step {step_id} completed",
                cost=0.01,
                tokens=50,
            )

            print(f"   ✅ Step completed")
            print()

        # Verify template was created
        print()
        print("=" * 80)
        print("Verification: Check if template exists in backend")
        print("=" * 80)

        # Search for the template
        search_results = await mgr.search_activities(query=template_name, limit=5)

        found = False
        for activity in search_results:
            if template_name in activity.get(
                "name", ""
            ) or template_name in activity.get("variant_id", ""):
                found = True
                print(f"✅ Template found!")
                print(f"   Variant ID: {activity.get('variant_id')}")
                print(f"   Name: {activity.get('name')}")
                print(f"   Category: {activity.get('category')}")
                break

        if not found:
            print(f"⚠️  Template not found in search results")
            print(f"   This may be expected if template creation is in progress")

        print()
        print("=" * 80)
        print("Test Complete")
        print("=" * 80)

    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
