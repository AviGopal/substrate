#!/usr/bin/env python3
"""
Create a system validation activity template
This activity will validate the entire activity system when executed
"""

import asyncio
import sys
import json

sys.path.insert(0, "repos/metabob-cli/src")

from metabob_cli.core.config import ConfigData
from metabob_cli.core.session_manager import SessionManager
import httpx


async def create_validation_activity():
    print("=" * 70)
    print("Creating System Validation Activity Template")
    print("=" * 70)
    print()

    config = ConfigData(
        base_url="http://localhost:8080",
        api_key="mb_devbob_test_simple_2026_v2",
        verify_ssl=False,
    )

    async with SessionManager(config) as sm:
        token = sm.file_state_manager.get_session_token()

        # Create activity template using V2 API with ProtoTaskStep schema
        template = {
            "name": "System Validation Activity",
            "description": "Validates the complete activity system through hierarchical task execution. Tests API endpoints, CLI integration, database persistence, and execution flow. Reports failures automatically.",
            "category": "infrastructure",
            "variables": {
                "test_scope": {
                    "type": "string",
                    "description": "Scope of validation: 'api', 'cli', 'database', 'full'",
                    "default": "full",
                }
            },
            "task_steps": [
                {
                    "id": "validate-api-endpoints",
                    "subagent": "general",
                    "description": "Validate V2 API Endpoints",
                    "dependencies": [],
                    "prompt": {
                        "template": "Validate V2 API Endpoints\n\nTest all V2 API endpoints and verify they return expected responses:\n\n1. Test POST /v2/session\n   - Verify session creation\n   - Confirm token in metadata.session_token\n   - Check session_id format\n\n2. Test GET /v2/activities/templates\n   - Search for templates\n   - Verify proto format response\n   - Confirm variant_id fields present\n\n3. Test POST /v2/activities/record/start\n   - Create test execution record\n   - Verify execution_id returned\n   - Check started_at timestamp\n\n4. Test POST /v2/activities/record/complete\n   - Update test execution record\n   - Verify completion recorded\n   - Check response format\n\nReport Results:\n- List each endpoint tested\n- Note any failures with error messages\n- Confirm proto compliance\n- Recommend fixes for any issues found\n\nTest scope: {{test_scope}}",
                        "max_tokens": 8000,
                        "compression_strategy": "filter",
                        "variables": ["test_scope"],
                    },
                    "validation": {
                        "required_files": [],
                        "required_patterns": [],
                        "forbidden_patterns": [],
                        "commands": [],
                    },
                    "retry": {
                        "max_attempts": 3,
                        "strategy": "simple",
                        "fallback_prompt": "",
                    },
                    "metrics": {
                        "success_rate": 0.0,
                        "avg_tokens": 0,
                        "avg_duration": 0,
                        "common_failures": [],
                    },
                    "impulse_refs": [],
                    "guidance": [],
                    "expected_actions": [],
                },
                {
                    "id": "validate-cli-integration",
                    "subagent": "general",
                    "description": "Validate CLI Integration",
                    "dependencies": ["validate-api-endpoints"],
                    "prompt": {
                        "template": "Validate CLI Integration\n\nTest metabob-cli methods with V2 API:\n\n1. Test search_activities()\n   - Call with query parameter\n   - Verify results returned\n   - Check result format\n\n2. Test get_activity(template_id)\n   - Retrieve template details\n   - Verify all fields present\n   - Check variables structure\n\n3. Test record_execution_start_external()\n   - Call with test data\n   - Verify API call succeeds\n   - Check execution_id returned\n\n4. Test record_execution_complete_external()\n   - Call with test metrics\n   - Verify completion recorded\n   - Check all fields persist\n\nReport Results:\n- List each method tested\n- Note any failures or exceptions\n- Confirm integration working\n- Recommend fixes for any issues\n\nTest scope: {{test_scope}}",
                        "max_tokens": 8000,
                        "compression_strategy": "filter",
                        "variables": ["test_scope"],
                    },
                    "validation": {
                        "required_files": [],
                        "required_patterns": [],
                        "forbidden_patterns": [],
                        "commands": [],
                    },
                    "retry": {
                        "max_attempts": 3,
                        "strategy": "simple",
                        "fallback_prompt": "",
                    },
                    "metrics": {
                        "success_rate": 0.0,
                        "avg_tokens": 0,
                        "avg_duration": 0,
                        "common_failures": [],
                    },
                    "impulse_refs": [],
                    "guidance": [],
                    "expected_actions": [],
                },
                {
                    "id": "validate-database-persistence",
                    "subagent": "general",
                    "description": "Validate Database Persistence",
                    "dependencies": ["validate-cli-integration"],
                    "prompt": {
                        "template": "Validate Database Persistence\n\nTest that execution data persists correctly:\n\n1. Create test execution via CLI\n   - Use unique execution_id\n   - Set known values (duration, cost, tokens)\n\n2. Wait for database sync (2-3 seconds)\n\n3. Query database directly\n   - SELECT from activity_executions\n   - WHERE execution_id = test_id\n\n4. Verify all fields:\n   - execution_id matches\n   - duration value correct\n   - success value correct\n   - total_cost value correct\n   - started_at timestamp present\n\nReport Results:\n- Confirm record created\n- Verify all field values\n- Note any mismatches\n- Check proto field structure\n\nTest scope: {{test_scope}}",
                        "max_tokens": 8000,
                        "compression_strategy": "filter",
                        "variables": ["test_scope"],
                    },
                    "validation": {
                        "required_files": [],
                        "required_patterns": [],
                        "forbidden_patterns": [],
                        "commands": [],
                    },
                    "retry": {
                        "max_attempts": 3,
                        "strategy": "simple",
                        "fallback_prompt": "",
                    },
                    "metrics": {
                        "success_rate": 0.0,
                        "avg_tokens": 0,
                        "avg_duration": 0,
                        "common_failures": [],
                    },
                    "impulse_refs": [],
                    "guidance": [],
                    "expected_actions": [],
                },
                {
                    "id": "validate-e2e-flow",
                    "subagent": "general",
                    "description": "Validate End-to-End Flow",
                    "dependencies": ["validate-database-persistence"],
                    "prompt": {
                        "template": "Validate End-to-End Flow\n\nExecute complete activity flow and verify:\n\n1. Search for a simple test activity\n2. Get its details\n3. Start execution with test variables\n4. Simulate step execution\n5. Complete execution with metrics\n6. Verify in database\n\nReport Results:\n- Describe complete flow executed\n- Note timing of each step\n- Confirm all data persisted\n- List any failures encountered\n- Verify automatic tracking worked\n\nTest scope: {{test_scope}}",
                        "max_tokens": 8000,
                        "compression_strategy": "filter",
                        "variables": ["test_scope"],
                    },
                    "validation": {
                        "required_files": [],
                        "required_patterns": [],
                        "forbidden_patterns": [],
                        "commands": [],
                    },
                    "retry": {
                        "max_attempts": 3,
                        "strategy": "simple",
                        "fallback_prompt": "",
                    },
                    "metrics": {
                        "success_rate": 0.0,
                        "avg_tokens": 0,
                        "avg_duration": 0,
                        "common_failures": [],
                    },
                    "impulse_refs": [],
                    "guidance": [],
                    "expected_actions": [],
                },
                {
                    "id": "report-validation-summary",
                    "subagent": "general",
                    "description": "Report Validation Summary",
                    "dependencies": ["validate-e2e-flow"],
                    "prompt": {
                        "template": "Report Validation Summary\n\nSummarize all validation results:\n\n1. API Validation Results\n   - Which endpoints passed/failed\n   - Any proto compliance issues\n\n2. CLI Integration Results\n   - Which methods worked\n   - Any integration issues\n\n3. Database Persistence Results\n   - Fields persisting correctly\n   - Any data loss\n\n4. End-to-End Flow Results\n   - Complete flow working\n   - Any failures in sequence\n\n5. Overall Assessment\n   - System status (operational/broken)\n   - Critical issues to fix\n   - Recommended next steps\n\n6. Learnings\n   - What worked well\n   - What needs improvement\n   - Patterns to apply elsewhere\n\nProvide actionable fixes for each issue found.",
                        "max_tokens": 8000,
                        "compression_strategy": "filter",
                        "variables": [],
                    },
                    "validation": {
                        "required_files": [],
                        "required_patterns": ["pass/fail for all components"],
                        "forbidden_patterns": [],
                        "commands": [],
                    },
                    "retry": {
                        "max_attempts": 3,
                        "strategy": "simple",
                        "fallback_prompt": "",
                    },
                    "metrics": {
                        "success_rate": 0.0,
                        "avg_tokens": 0,
                        "avg_duration": 0,
                        "common_failures": [],
                    },
                    "impulse_refs": [],
                    "guidance": [],
                    "expected_actions": [],
                },
            ],
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{config.base_url}/v2/activities/templates",
                headers={"Authorization": f"Bearer {token}"},
                json=template,
            )

            if response.status_code in [200, 201]:
                result = response.json()
                print("✅ System Validation Activity Created!")
                print(f"   Template ID: {result.get('variant_id')}")
                print(f"   Name: {result.get('name')}")
                print(f"   Tasks: {len(template['task_steps'])}")
                print()
                print("This activity can be executed with:")
                print(f"   activityId: {result.get('variant_id')}")
                print(f'   variables: {{ "test_scope": "full" }}')
                print()
                return result.get("variant_id")
            else:
                print(f"❌ Failed to create template: {response.status_code}")
                print(f"   Response: {response.text}")
                return None


result = asyncio.run(create_validation_activity())

if result:
    print("=" * 70)
    print("✅ SETUP COMPLETE")
    print()
    print("The system-validation activity is ready to execute.")
    print()
    print("To execute through OpenCode:")
    print("  1. Start OpenCode chat session")
    print(f"  2. Use command: Execute activity {result}")
    print("  3. Let the activity framework handle execution")
    print("  4. Review automatic failure reporting")
    print()
    print("=" * 70)
