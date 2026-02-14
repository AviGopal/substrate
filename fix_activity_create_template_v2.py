#!/usr/bin/env python3
"""
Fix the Activity Create template by updating the create-template task
to explicitly call the create_activity_template MCP tool.

Uses httpx to call the backend API directly since SurrealDB Python client is problematic.
"""

import asyncio
import httpx
import json

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


async def fix_template_via_surreal_http():
    """Update the template via SurrealDB HTTP API"""

    print("Connecting to SurrealDB HTTP API...")

    async with httpx.AsyncClient() as client:
        # Authenticate
        auth_resp = await client.post(
            "http://localhost:8000/signin", json={"user": "root", "pass": "root"}
        )

        if auth_resp.status_code != 200:
            print(f"❌ Authentication failed: {auth_resp.status_code}")
            return False

        token = auth_resp.text.strip('"')
        headers = {
            "Authorization": f"Bearer {token}",
            "NS": "metabob",
            "DB": "production",
            "Accept": "application/json",
        }

        # Fetch the template
        print("Fetching current template...")
        query = "SELECT * FROM activity_template WHERE id = 'INFRASTRUCTURE-0013e379'"

        select_resp = await client.post(
            "http://localhost:8000/sql", headers=headers, data=query
        )

        if select_resp.status_code != 200:
            print(f"❌ Query failed: {select_resp.status_code}")
            print(select_resp.text)
            return False

        results = select_resp.json()
        if not results or not results[0].get("result"):
            print("❌ Template not found")
            return False

        template = results[0]["result"][0]
        print(f"✓ Found template: {template.get('variant_name', 'N/A')}")
        print(f"  Tasks: {len(template.get('tasks', []))}")

        # Update the create-template task
        tasks = template.get("tasks", [])
        updated = False

        for i, task in enumerate(tasks):
            if task.get("id") == "create-template":
                print(f"\n✓ Found create-template task (index {i})")
                print(f"  Current prompt length: {len(task.get('prompt', ''))} chars")

                tasks[i] = {
                    "id": "create-template",
                    "description": "Create and persist the activity template to the backend",
                    "prompt": FIXED_CREATE_TEMPLATE_PROMPT,
                }

                print(f"  New prompt length: {len(FIXED_CREATE_TEMPLATE_PROMPT)} chars")
                updated = True
                break

        if not updated:
            print("❌ create-template task not found")
            return False

        # Update the template
        print("\nUpdating template in database...")
        update_query = f"UPDATE {template['id']} SET tasks = {json.dumps(tasks)}"

        update_resp = await client.post(
            "http://localhost:8000/sql", headers=headers, data=update_query
        )

        if update_resp.status_code != 200:
            print(f"❌ Update failed: {update_resp.status_code}")
            print(update_resp.text)
            return False

        print("✓ Template updated successfully!")

        # Verify
        print("\nVerifying update...")
        verify_resp = await client.post(
            "http://localhost:8000/sql", headers=headers, data=query
        )

        if verify_resp.status_code == 200:
            verify_results = verify_resp.json()
            if verify_results and verify_results[0].get("result"):
                new_template = verify_results[0]["result"][0]
                for task in new_template.get("tasks", []):
                    if task.get("id") == "create-template":
                        if "create_activity_template MCP tool" in task.get(
                            "prompt", ""
                        ):
                            print("✓ Verification successful!")
                            return True

        print("❌ Verification failed")
        return False


async def main():
    try:
        success = await fix_template_via_surreal_http()
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
