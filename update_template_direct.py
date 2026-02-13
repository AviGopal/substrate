#!/usr/bin/env python3
"""
Update activity-create template directly in SurrealDB
"""

import asyncio
import httpx


async def main():
    # SurrealDB connection
    base_url = "http://localhost:8000"

    # Template update - simplified prompt for task 4
    update_query = """
    UPDATE activity_templates
    SET 
        impulse_refs = [
            {
                id: "activity-template-schema",
                type: "schema",
                pointer: {
                    type: "memo",
                    content: "Activity template structure:\\n\\n{\\n  \\"name\\": \\"Template Name\\",\\n  \\"category\\": \\"test|feature|bugfix|refactor\\",\\n  \\"task_steps\\": [{...}]\\n}"
                },
                description: "Activity template schema",
                priority: "high",
                budget: 3000
            }
        ],
        task_steps[3].prompt.template = "Create activity template JSON.\\n\\nIMPORTANT: After generating JSON, call createActivityTemplate(template) to persist.\\n\\nExample:\\nconst t = {name: '{{template_name}}', category: '{{template_category}}', tasks: [...]}\\nawait createActivityTemplate(t)",
        task_steps[3].impulse_refs = ["activity-template-schema"]
    WHERE variant_id = "INFRASTRUCTURE-0013e379"
    """

    print("Updating activity-create template...")
    print()

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/sql",
            auth=("root", "root"),
            headers={"NS": "metabob", "DB": "metabob", "Accept": "application/json"},
            content=update_query,
        )

        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:500]}")

        if response.status_code == 200:
            print()
            print("✅ Template updated successfully!")
            print()
            print("Verifying...")

            # Verify
            verify_query = "SELECT impulse_refs, task_steps[3] FROM activity_templates WHERE variant_id = 'INFRASTRUCTURE-0013e379'"
            verify_response = await client.post(
                f"{base_url}/sql",
                auth=("root", "root"),
                headers={
                    "NS": "metabob",
                    "DB": "metabob",
                    "Accept": "application/json",
                },
                content=verify_query,
            )

            print(f"Verification: {verify_response.text[:300]}")
        else:
            print("❌ Update failed")


if __name__ == "__main__":
    asyncio.run(main())
