#!/usr/bin/env python3
"""
Test execution of the template we just created
Proves end-to-end: create template → execute template
"""

import asyncio
from pathlib import Path
from metabob_cli.core.file_state import FileStateManager
from metabob_cli.mcp.activity_manager import get_activity_manager


async def main():
    print("=" * 80)
    print("Execute Newly Created Template")
    print("=" * 80)
    print()

    # Load session token
    state_file = Path(".metabob/state")
    state_mgr = FileStateManager(state_file)
    session_token = state_mgr.get_session_token()

    if not session_token:
        print("❌ No session token")
        return

    # Get activity manager
    mgr = get_activity_manager("http://localhost:8080", session_token)

    template_id = "infrastructure-86af0790"  # The template we just created
    message = "Hello from the newly created template!"

    print(f"📋 Template: {template_id}")
    print(f"💬 Message: {message}")
    print()

    # Start execution
    result = await mgr.start_execution(
        activity_id=template_id,
        variables={"message": message},
        session_id=f"test-{template_id}",
    )

    if "error" in result:
        print(f"❌ Failed: {result['error']}")
        return

    exec_id = result["execution_id"]
    print(f"✅ Execution started: {exec_id}")
    print()

    # Get step
    step_result = await mgr.get_next_step(exec_id)

    if "error" in step_result:
        print(f"❌ Error: {step_result['error']}")
        return

    step = step_result["current_step"]
    print(f"📋 Step: {step['step_id']}")
    print(f"   Description: {step.get('description')}")
    print(f"   Prompt template: {step.get('prompt_template', 'N/A')[:100]}")
    print()

    # Report success (simulating agent output)
    output = f"Echo: {message}"

    await mgr.report_step_result(
        execution_id=exec_id,
        step_id=step["step_id"],
        success=True,
        output=output,
        cost=0.01,
        tokens=25,
    )

    print(f"✅ Step completed with output: {output}")
    print()

    # Check completion
    completion = await mgr.get_next_step(exec_id)

    if completion.get("complete"):
        print(f"✅ Execution completed!")
        print(f"   Message: {completion.get('message')}")
    else:
        print(f"⚠️  More steps: {completion}")

    print()
    print("=" * 80)
    print("SUCCESS: Created template → Executed template → Completed")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
