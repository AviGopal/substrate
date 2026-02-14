#!/usr/bin/env python3
"""
Fix the Activity Create template by updating the create-template task
to explicitly call the create_activity_template MCP tool.
"""

import asyncio
import json
from surrealdb import Surreal

FIXED_CREATE_TEMPLATE_PROMPT = """You are creating a new activity template and must persist it to the backend.

**CRITICAL**: You MUST call the create_activity_template MCP tool to save the template. Simply generating JSON is NOT enough.

## Steps:

1. **Generate Template JSON** based on the analysis from previous steps:
   - name: Clear, descriptive name for the template
   - description: What the template does and when to use it
   - category: One of (FEATURE, BUGFIX, REFACTOR, INFRASTRUCTURE, TEST, DOCS)
   - tasks: Array of task objects, each with:
     * id: Unique kebab-case identifier
     * description: What this task accomplishes
     * prompt: Detailed instructions for the agent executing this task
   - contextRequirements: [] (optional array of context needs)
   - integration: {} (optional validation/integration settings)

2. **Call create_activity_template MCP Tool**:
   
   Use the create_activity_template tool with these parameters:
   - name: <template name from step 1>
   - description: <template description from step 1>
   - category: <category from step 1>
   - tasks: <JSON.stringify(tasks array from step 1)>
   - context_requirements: "[]" (or JSON string if needed)
   - validation: "{}" (or JSON string if needed)
   
   Example:
   ```
   create_activity_template(
     name="My New Template",
     description="Does something useful",
     category="FEATURE",
     tasks='[{"id":"step1","description":"Do thing","prompt":"..."}]',
     context_requirements="[]",
     validation="{}"
   )
   ```

3. **Verify Persistence**:
   - Check the MCP tool response for status: "success"
   - Extract the template_id from the response
   - Call get_activity_template with the template_id to verify it exists

4. **Return Result**:
   - Return the template_id and confirmation message
   - Include the template name for reference
   - Report success to the user

## Common Mistakes to Avoid:

❌ DON'T just generate JSON and mark task complete
❌ DON'T skip calling the MCP tool  
❌ DON'T assume the template auto-saves
❌ DON'T forget to verify the response
✅ DO explicitly call create_activity_template MCP tool
✅ DO check the response status is "success"
✅ DO verify the template exists with get_activity_template
✅ DO return the template_id to the caller

## Success Criteria:

- Template JSON generated following the schema
- create_activity_template MCP tool called successfully
- Response contains status="success" and a template_id
- Verification confirms template exists in backend
- template_id returned to user"""


async def fix_template():
    """Update the INFRASTRUCTURE-0013e379 template in SurrealDB"""

    print("Connecting to SurrealDB...")
    async with Surreal("ws://localhost:8000/rpc") as db:
        await db.signin({"user": "local", "pass": "testing"})
        await db.use("metabob", "production")
        return await _do_fix(db)


async def _do_fix(db):
    """Perform the actual fix with an active connection"""
    print("Fetching current template...")
    result = await db.query(
        "SELECT * FROM activity_template WHERE id = $id",
        {"id": "INFRASTRUCTURE-0013e379"},
    )

    if not result or not result[0].get("result"):
        print("❌ Template INFRASTRUCTURE-0013e379 not found in database")
        return False

    template = result[0]["result"][0]
    print(f"✓ Found template: {template.get('variant_name', 'N/A')}")
    print(f"  Tasks: {len(template.get('tasks', []))}")

    # Find and update the create-template task
    tasks = template.get("tasks", [])
    updated = False

    for i, task in enumerate(tasks):
        if task.get("id") == "create-template":
            print(f"\n✓ Found create-template task (index {i})")
            print(f"  Current prompt length: {len(task.get('prompt', ''))} chars")

            # Update the task
            tasks[i] = {
                "id": "create-template",
                "description": "Create and persist the activity template to the backend",
                "prompt": FIXED_CREATE_TEMPLATE_PROMPT,
            }

            print(f"  New prompt length: {len(FIXED_CREATE_TEMPLATE_PROMPT)} chars")
            updated = True
            break

    if not updated:
        print("❌ create-template task not found in template")
        return False

    # Update the template in the database
    print("\nUpdating template in database...")
    update_result = await db.query(
        "UPDATE $id SET tasks = $tasks", {"id": template["id"], "tasks": tasks}
    )

    print("✓ Template updated successfully!")

    # Verify the update
    print("\nVerifying update...")
    verify_result = await db.query(
        "SELECT tasks FROM activity_template WHERE id = $id",
        {"id": "INFRASTRUCTURE-0013e379"},
    )

    if verify_result and verify_result[0].get("result"):
        new_template = verify_result[0]["result"][0]
        for task in new_template.get("tasks", []):
            if task.get("id") == "create-template":
                if "create_activity_template MCP tool" in task.get("prompt", ""):
                    print("✓ Verification successful - MCP tool call is in the prompt")
                    return True
                else:
                    print("❌ Verification failed - MCP tool call not found in prompt")
                    return False

    print("❌ Verification failed - could not read back template")
    return False


async def main():
    try:
        success = await fix_template()
        if success:
            print("\n" + "=" * 60)
            print("SUCCESS: Activity Create template has been fixed!")
            print("=" * 60)
            print("\nThe create-template task now includes explicit instructions to:")
            print("  1. Generate template JSON")
            print("  2. Call create_activity_template MCP tool")
            print("  3. Verify persistence succeeded")
            print("  4. Return template_id")
            print("\nYou can now test it with:")
            print("  activity INFRASTRUCTURE-0013e379 variables={...}")
            return 0
        else:
            print("\n❌ FAILED: Could not update template")
            return 1
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
