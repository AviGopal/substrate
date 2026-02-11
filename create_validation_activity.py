import sys
sys.path.insert(0, 'repos/metabob-cli/src')

from metabob_cli.core.config import ConfigData
from metabob_cli.core.session_manager import SessionManager
from metabob_cli.mcp.activity_manager import ActivityManager
import asyncio
import json

async def create_activity():
    config = ConfigData(
        base_url='http://localhost:8080',
        api_key='mb_Y99iQNMiycAlpkQamp0dhnU_t5e0ds0mkwDrU7g9bxs',
        verify_ssl=False
    )
    
    async with SessionManager(config) as sm:
        token = sm.file_state_manager.get_session_token()
        am = ActivityManager(base_url=config.base_url, session_token=token)
        
        # Create an activity template for system validation
        template = {
            "name": "Activity System Validation",
            "description": "Validates the complete activity system: API, CLI, database persistence, and execution flow",
            "category": "infrastructure",
            "variables": {
                "test_scope": {
                    "type": "string",
                    "description": "Scope of validation: 'full', 'api', 'cli', 'database'",
                    "default": "full"
                }
            },
            "task_steps": [
                {
                    "index": 0,
                    "description": "Validate V2 API endpoints are responding",
                    "agent_prompt": "Test all V2 API endpoints: /v2/session, /v2/activities/templates, /v2/activities/record/start, /v2/activities/record/complete. Verify each returns expected response format."
                },
                {
                    "index": 1,
                    "description": "Validate CLI integration with V2 API",
                    "agent_prompt": "Test CLI methods: search_activities(), get_activity(), record_execution_start_external(), record_execution_complete_external(). Verify each method works correctly."
                },
                {
                    "index": 2,
                    "description": "Validate database persistence",
                    "agent_prompt": "Create test execution record, verify it's written to database with correct values. Query database to confirm persistence."
                },
                {
                    "index": 3,
                    "description": "Validate end-to-end flow",
                    "agent_prompt": "Execute complete flow: search → get details → start execution → complete execution → verify in database. Report any failures."
                },
                {
                    "index": 4,
                    "description": "Report validation results",
                    "agent_prompt": "Summarize validation results: what passed, what failed, what needs fixing. Include specific error messages and failure patterns."
                }
            ],
            "validation": {
                "type": "output_check",
                "criteria": "All validation steps must pass"
            }
        }
        
        client = await am._get_client()
        response = await client.post("/v2/activities/templates", json=template)
        
        if response.status_code in [200, 201]:
            result = response.json()
            print("✅ Activity template created successfully!")
            print(f"   Template ID: {result.get('variant_id')}")
            print(f"   Name: {result.get('name')}")
            return result.get('variant_id')
        else:
            print(f"❌ Failed to create template: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
        
        await am.close()

result = asyncio.run(create_activity())
if result:
    print(f"\nUse this activity with: activity_id='{result}'")
