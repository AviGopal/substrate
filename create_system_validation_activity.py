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
        api_key="mb_test_devbob_2024",
        verify_ssl=False,
    )

    async with SessionManager(config) as sm:
        token = sm.file_state_manager.get_session_token()

        # Create activity template using V2 API
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
                        "template": """Validate V2 API Endpoints

Test all V2 API endpoints and verify they return expected responses:

1. Test POST /v2/session
   - Verify session creation
   - Confirm token in metadata.session_token
   - Check session_id format

2. Test GET /v2/activities/templates
   - Search for templates
   - Verify proto format response
   - Confirm variant_id fields present

3. Test POST /v2/activities/record/start
   - Create test execution record
   - Verify execution_id returned
   - Check started_at timestamp

4. Test POST /v2/activities/record/complete
   - Update test execution record
   - Verify completion recorded
   - Check response format

Report Results:
- List each endpoint tested
- Note any failures with error messages
- Confirm proto compliance
- Recommend fixes for any issues found

Test scope: {{test_scope}}
""",
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
                        "template": """Validate End-to-End Flow

Execute complete activity flow and verify:

1. Search for a simple test activity
2. Get its details
3. Start execution with test variables
4. Simulate step execution
5. Complete execution with metrics
6. Verify in database

Report Results:
- Describe complete flow executed
- Note timing of each step
- Confirm all data persisted
- List any failures encountered
- Verify automatic tracking worked

Test scope: {{test_scope}}
""",
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
                        "template": """Report Validation Summary

Summarize all validation results:

1. API Validation Results
   - Which endpoints passed/failed
   - Any proto compliance issues

2. CLI Integration Results
   - Which methods worked
   - Any integration issues

3. Database Persistence Results
   - Fields persisting correctly
   - Any data loss

4. End-to-End Flow Results
   - Complete flow working
   - Any failures in sequence

5. Overall Assessment
   - System status (operational/broken)
   - Critical issues to fix
   - Recommended next steps

6. Learnings
   - What worked well
   - What needs improvement
   - Patterns to apply elsewhere

Provide actionable fixes for each issue found.
""",
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
