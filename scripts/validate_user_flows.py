#!/usr/bin/env python3
"""
User Flow Validation Script

This script validates end-to-end user flows by:
1. Simulating actual user requests
2. Tracing execution through components
3. Validating data at each step
4. Reporting compatibility issues
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

sys.path.append(".")
from simple_reliable_delegation import SimpleReliableDelegator


class UserFlowValidator:
    """Validate user flows end-to-end."""

    def __init__(self):
        self.delegator = SimpleReliableDelegator()
        self.validation_results = {}

    async def validate_parameter_server_flow(self) -> Dict[str, Any]:
        """Validate the parameter server submission and retrieval flow."""

        print("\n🔍 Validating Parameter Server Flow")
        print("=" * 60)
        print(
            "Flow: CLI submits metrics -> API stores -> API retrieves recommendations"
        )

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Validate parameter server user flow",
            prompt="""
Validate the complete parameter server user flow in repos/metabob-rpc-api:

USER FLOW TO VALIDATE:
1. CLI submits activity execution metrics
2. API receives and validates the metrics
3. API stores metrics in database
4. API aggregates metrics for recommendations
5. CLI requests recommendations
6. API returns recommendations based on stored metrics

FOR EACH STEP, CHECK:

Step 1: Metrics Submission (POST /api/parameter-server/outcomes)
- Route: server/routes/parameter_server.py
- Handler: server/actions/parameter_server.py -> submit_activity_outcome()
- Input: CLIExecutionMetrics from server/models/parameter_server.py
- Validate: Does the route accept the correct schema?
- Validate: Does the handler process all fields?
- Validate: Are there any type mismatches?

Step 2: Storage
- Check: Does the handler correctly store to database?
- Check: Are there any database model mismatches?
- Check: Is error handling present?

Step 3: Aggregation
- Check: Is there logic to aggregate metrics per activity?
- Check: Does ActivityPerformanceSummary match stored data?

Step 4: Recommendations (POST /api/parameter-server/recommendations)  
- Route: server/routes/parameter_server.py
- Handler: server/actions/parameter_server.py -> get_activity_recommendations()
- Input: RecommendationRequest from server/models/parameter_server.py
- Output: RecommendationResponse from server/models/parameter_server.py
- Validate: Do schemas match handler expectations?

REPORT FOR EACH STEP:
✅ Valid: [what works correctly]
⚠️  Warning: [potential issues]
❌ Error: [broken/missing functionality]

Use metabob_list_file_components to explore the handler implementations.
Use metabob_search_codebase_issues to find type errors.
            """,
            timeout=300,
        )

        self.validation_results["parameter_server_flow"] = {
            "timestamp": datetime.now().isoformat(),
            "success": result.success,
            "duration": result.duration,
            "message": result.message,
        }

        return result

    async def validate_activity_execution_flow(self) -> Dict[str, Any]:
        """Validate activity template execution flow."""

        print("\n🔍 Validating Activity Execution Flow")
        print("=" * 60)
        print("Flow: Request activity -> Validate -> Execute -> Store results")

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Validate activity execution flow",
            prompt="""
Validate the activity execution user flow in repos/metabob-rpc-api:

USER FLOW TO VALIDATE:
1. Client requests activity execution
2. API validates request and activity template
3. API executes activity tasks
4. API stores execution results
5. API returns execution status and results

FOR EACH STEP:

Step 1: Activity Execution Request (POST /api/activities/execute)
- Route: server/routes/activities.py
- Handler: server/actions/activities.py -> execute_activity()
- Input: {activity_id, variables, options}
- Validate: Is the input schema properly defined?
- Validate: Is there proper validation of required fields?

Step 2: Template Retrieval
- Check: How are templates fetched? (database/file system)
- Check: Is there validation that template exists?
- Check: Is there validation of template structure?

Step 3: Variable Substitution
- Check: Are template variables properly substituted?
- Check: Is there validation for required variables?
- Check: Are there type checks for variables?

Step 4: Task Execution
- Check: How are tasks executed? (subprocess/direct call)
- Check: Is there timeout handling?
- Check: Is there error handling per task?

Step 5: Result Storage and Response
- Check: Are results properly structured?
- Check: Is execution state tracked correctly?
- Check: Are metrics collected?

CRITICAL VALIDATION POINTS:
- Authentication/authorization at entry
- Input validation before processing
- Error handling at each step
- Response schema consistency

Use metabob_list_file_components('repos/metabob-rpc-api/server/routes/activities.py')
Use metabob_list_file_components('repos/metabob-rpc-api/server/actions/activities.py')
            """,
            timeout=300,
        )

        self.validation_results["activity_execution_flow"] = {
            "timestamp": datetime.now().isoformat(),
            "success": result.success,
            "duration": result.duration,
            "message": result.message,
        }

        return result

    async def validate_cli_to_api_integration(self) -> Dict[str, Any]:
        """Validate CLI to API integration points."""

        print("\n🔍 Validating CLI to API Integration")
        print("=" * 60)
        print("Flow: CLI makes API calls -> API processes -> CLI receives response")

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Validate CLI to API integration",
            prompt="""
Validate how metabob-cli integrates with metabob-rpc-api:

FIND API CALLS IN CLI:
1. Search repos/metabob-cli/src/ for HTTP client usage
2. Identify all API endpoints called by CLI
3. For each API call, document:
   - Endpoint: [method + path]
   - Request body: [schema/structure]
   - Expected response: [schema/structure]
   - Error handling: [how errors are handled]

VALIDATE EACH INTEGRATION POINT:

Example: Activity submission
- CLI side: What data does CLI send?
- API side: What does the endpoint expect?
- Match: Do they align?

Example: Metrics submission  
- CLI side: How does CLI collect and send metrics?
- API side: Does /api/parameter-server/outcomes match?
- Match: Is CLIExecutionMetrics compatible?

CRITICAL CHECKS:
- Schema compatibility (request/response)
- Authentication method (API key, JWT, etc.)
- Error response handling
- Timeout configuration
- Retry logic

For each integration point, report:
Source: [cli file]
Target: [api endpoint]
Request Schema: [structure]
Response Schema: [structure]
Status: ✅ compatible | ⚠️  warning | ❌ incompatible
Issue: [description if not compatible]

Use grep or search to find HTTP calls in CLI codebase.
            """,
            timeout=300,
        )

        self.validation_results["cli_to_api_integration"] = {
            "timestamp": datetime.now().isoformat(),
            "success": result.success,
            "duration": result.duration,
            "message": result.message,
        }

        return result

    async def validate_data_consistency(self) -> Dict[str, Any]:
        """Validate data schema consistency across components."""

        print("\n🔍 Validating Data Schema Consistency")
        print("=" * 60)
        print(
            "Checking: Models match routes, routes match handlers, types are consistent"
        )

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Validate data schema consistency",
            prompt="""
Validate data schema consistency in repos/metabob-rpc-api:

CHECK SCHEMA CONSISTENCY FOR PARAMETER SERVER:

1. Models (server/models/parameter_server.py):
   - CLIExecutionMetrics
   - ActivityPerformanceSummary
   - RecommendationRequest
   - RecommendationResponse
   - List all fields and types

2. Routes (server/routes/parameter_server.py):
   - What schemas do endpoints expect?
   - What schemas do endpoints return?
   - Do they match model definitions?

3. Actions (server/actions/parameter_server.py):
   - What types do handlers accept?
   - What types do handlers return?
   - Do they match route expectations?

VALIDATE:
- Field names match across layers
- Field types are consistent
- Required vs optional fields align
- Nested object structures match
- List/array types are compatible

COMMON ISSUES TO CHECK:
- camelCase vs snake_case mismatches
- Optional fields treated as required
- Missing fields in one layer
- Type incompatibilities (str vs int, etc.)
- Date/datetime format inconsistencies

For each schema, report:
Schema: [name]
Layers: [models/routes/actions]
Consistency: ✅ consistent | ⚠️  minor issues | ❌ major issues
Issues: [list of mismatches]

Use metabob_search_codebase_issues to find type mismatches.
            """,
            timeout=240,
        )

        self.validation_results["data_consistency"] = {
            "timestamp": datetime.now().isoformat(),
            "success": result.success,
            "duration": result.duration,
            "message": result.message,
        }

        return result

    async def generate_validation_report(self):
        """Generate comprehensive validation report."""

        print("\n📝 Generating Validation Report")
        print("=" * 60)

        # Save detailed results
        report_file = "user_flow_validation_report.json"
        with open(report_file, "w") as f:
            json.dump(
                {
                    "validation_date": datetime.now().isoformat(),
                    "flows_validated": list(self.validation_results.keys()),
                    "results": self.validation_results,
                },
                f,
                indent=2,
            )

        print(f"✅ Detailed report saved to: {report_file}")

        # Generate summary
        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Generate validation summary",
            prompt=f"""
Based on the user flow validation results, create an actionable summary:

Validation Results:
{json.dumps(self.validation_results, indent=2)}

Create a summary with:

1. EXECUTIVE SUMMARY (2-3 sentences)
   Overall validation status and key findings

2. CRITICAL ISSUES (🔴 Must Fix Immediately)
   - Broken functionality
   - Schema incompatibilities
   - Missing implementations
   Include: What's broken, where, and how to fix

3. WARNINGS (🟡 Should Fix Soon)
   - Potential issues
   - Missing validations
   - Inconsistencies
   Include: What could cause problems and recommended fixes

4. VALIDATED FLOWS (✅ Working Correctly)
   - What user flows are working
   - What components are solid
   - What data schemas are consistent

5. PRIORITIZED ACTION ITEMS
   Priority 1 (Immediate - blocks users):
   Priority 2 (Important - degrades experience):
   Priority 3 (Nice to have - improvements):

For each action item include:
- What needs to be done
- Where to make changes
- Estimated effort (hours)
- Code example if applicable

Save to: user_flow_validation_summary.md
            """,
            timeout=180,
        )

        print("✅ Summary generated")
        return result

    async def run_full_validation(self):
        """Run complete user flow validation."""

        print("🚀 STARTING USER FLOW VALIDATION")
        print("=" * 60)

        try:
            # Validate all flows
            await self.validate_parameter_server_flow()
            await self.validate_activity_execution_flow()
            await self.validate_cli_to_api_integration()
            await self.validate_data_consistency()
            await self.generate_validation_report()

            print()
            print("✅ VALIDATION COMPLETE")
            print("=" * 60)
            print(f"📊 Flows validated: {len(self.validation_results)}")
            print(f"📄 Reports generated:")
            print(f"   - user_flow_validation_report.json (detailed)")
            print(f"   - user_flow_validation_summary.md (actionable)")
            print()
            print("🎯 Next Steps:")
            print("   1. Review validation summary for critical issues")
            print("   2. Fix any broken flows")
            print("   3. Address schema incompatibilities")
            print("   4. Test end-to-end after fixes")

        except Exception as e:
            print(f"❌ Validation failed: {e}")
            import traceback

            traceback.print_exc()


async def main():
    """Main entry point."""
    validator = UserFlowValidator()
    await validator.run_full_validation()


if __name__ == "__main__":
    asyncio.run(main())
