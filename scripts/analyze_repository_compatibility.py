#!/usr/bin/env python3
"""
Repository Compatibility Analysis

This script analyzes the metabob repositories to:
1. Map user flows and component execution sequences
2. Validate data schemas and API contracts
3. Check cross-repository integration points
4. Generate compatibility reports with actionable recommendations
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

sys.path.append(".")
from simple_reliable_delegation import SimpleReliableDelegator


class RepositoryCompatibilityAnalyzer:
    """Analyze repository compatibility using reliable delegation."""

    def __init__(self, output_dir: str = "."):
        self.delegator = SimpleReliableDelegator()
        self.output_dir = Path(output_dir)
        self.analysis_results = {}

    async def analyze_rpc_api_endpoints(self) -> Dict[str, Any]:
        """Analyze metabob-rpc-api endpoints and data flows."""

        print("🔍 Analyzing metabob-rpc-api endpoints...")
        print("=" * 60)

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Analyze metabob-rpc-api API endpoints",
            prompt="""
Analyze the repos/metabob-rpc-api repository API structure:

1. List all API endpoints in server/routes/ directory
2. For PRIORITY endpoints (activity management, parameter_server, template_repository):
   - Map endpoint to handler function
   - Document input schema (what data is expected)
   - Document output schema (what data is returned)
   - Check authentication requirements

3. For each endpoint, create a structured entry:
   ```
   Endpoint: POST /api/activities/execute
   File: server/routes/activities.py
   Handler: execute_activity in server/actions/activities.py
   Input: {activity_id, variables, options}
   Output: {execution_id, status, result}
   Auth: Required (JWT token)
   ```

Focus on:
- /api/activities/* (activity management)
- /api/parameter-server/* (our new parameter server)
- /api/templates/* (template repository)
- /api/metrics/* (metrics collection)

Use metabob_list_file_components('repos/metabob-rpc-api/server/routes/activities.py')
Use metabob_list_file_components('repos/metabob-rpc-api/server/routes/parameter_server.py')

Save findings to a structured format.
            """,
            timeout=240,
        )

        analysis = {
            "timestamp": datetime.now().isoformat(),
            "repository": "metabob-rpc-api",
            "success": result.success,
            "message": result.message,
            "duration": result.duration,
        }

        self.analysis_results["rpc_api_endpoints"] = analysis
        return analysis

    async def trace_activity_execution_flow(self) -> Dict[str, Any]:
        """Trace the complete execution flow for activity management."""

        print("\n🔍 Tracing activity execution flow...")
        print("=" * 60)

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Trace activity execution sequence",
            prompt="""
Trace the complete execution flow for activity management in metabob-rpc-api:

Starting from: POST /api/activities/execute

1. Follow the execution path:
   Route -> Action Handler -> Models -> Database/Storage -> Response

2. For each step, document:
   - Component: [file + function/class name]
   - Input: [data structure received]
   - Processing: [what it does]
   - Output: [data structure produced]
   - Side effects: [database writes, external calls, etc.]

3. Identify all data transformations:
   - Request JSON -> Pydantic model
   - Pydantic model -> Database record
   - Database record -> Response JSON

4. Check for validation at each step:
   - Input validation (Pydantic schemas)
   - Business logic validation
   - Authorization checks

5. Map error handling:
   - What errors can occur at each step
   - How errors are handled
   - What error responses are returned

Use metabob_suggest_related_changes to find related components.
Use metabob_list_file_components to explore each file in the execution path.

Create a flow diagram showing the complete sequence.
            """,
            timeout=300,
        )

        analysis = {
            "timestamp": datetime.now().isoformat(),
            "flow": "activity_execution",
            "success": result.success,
            "message": result.message,
            "duration": result.duration,
        }

        self.analysis_results["activity_execution_flow"] = analysis
        return analysis

    async def validate_parameter_server_integration(self) -> Dict[str, Any]:
        """Validate parameter server implementation and integration."""

        print("\n🔍 Validating parameter server integration...")
        print("=" * 60)

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Validate parameter server integration",
            prompt="""
Validate the parameter server implementation in metabob-rpc-api:

1. Check if parameter_server.py files exist and are properly imported:
   - server/routes/parameter_server.py
   - server/actions/parameter_server.py
   - server/models/parameter_server.py

2. Validate data schemas:
   - ActivityOutcome model structure
   - RecommendationRequest/Response schemas
   - Metric storage models
   - Are they consistent across routes/actions/models?

3. Check integration points:
   - Is parameter_server registered in server/routes/__init__.py?
   - Are the routes properly mounted in server/app.py?
   - Do handlers use correct database models?

4. Validate API contracts:
   - Do request schemas match what handlers expect?
   - Do response schemas match what's returned?
   - Are error responses consistent?

5. Identify issues:
   - Missing imports
   - Schema mismatches
   - Incomplete implementations
   - Missing error handling

Use metabob_search_codebase_issues to find type errors and validation issues.

Report findings as:
✅ Valid: [what works]
⚠️  Warning: [potential issues]
❌ Error: [broken/missing]
            """,
            timeout=240,
        )

        analysis = {
            "timestamp": datetime.now().isoformat(),
            "component": "parameter_server",
            "success": result.success,
            "message": result.message,
            "duration": result.duration,
        }

        self.analysis_results["parameter_server_validation"] = analysis
        return analysis

    async def check_cross_repository_contracts(self) -> Dict[str, Any]:
        """Check API contracts between CLI, OpenCode, and RPC API."""

        print("\n🔍 Checking cross-repository API contracts...")
        print("=" * 60)

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Check cross-repository API contracts",
            prompt="""
Analyze how metabob-cli and metabob-opencode interact with metabob-rpc-api:

1. Find all API calls from CLI to RPC API:
   - Search repos/metabob-cli for HTTP requests to RPC API
   - Document: endpoint, method, request body, expected response
   - Check if these match what RPC API actually provides

2. Find all API calls from OpenCode to RPC API:
   - Search repos/metabob-opencode for HTTP/RPC calls to API
   - Document the same information

3. Validate contract compatibility:
   - Do request schemas match on both sides?
   - Are response schemas compatible?
   - Is authentication handled consistently?

4. Check version compatibility:
   - Are there API version headers?
   - Are deprecated endpoints still in use?
   - Are new features properly versioned?

5. Identify integration risks:
   - Missing error handling on client side
   - Schema mismatches
   - Authentication issues
   - Timeout/retry logic gaps

For each integration point, report:
Source: [repo/file] -> Target: [api endpoint]
Contract: [request/response schemas]
Status: ✅ valid | ⚠️  warning | ❌ broken
Issue: [description if not valid]

Use grep/search to find HTTP client calls in CLI and OpenCode repos.
            """,
            timeout=300,
        )

        analysis = {
            "timestamp": datetime.now().isoformat(),
            "scope": "cross_repository",
            "success": result.success,
            "message": result.message,
            "duration": result.duration,
        }

        self.analysis_results["cross_repository_contracts"] = analysis
        return analysis

    async def generate_compatibility_report(self) -> Dict[str, Any]:
        """Generate comprehensive compatibility report."""

        print("\n📝 Generating compatibility report...")
        print("=" * 60)

        # Summarize all findings
        summary = {
            "analysis_date": datetime.now().isoformat(),
            "repositories_analyzed": [
                "metabob-rpc-api",
                "metabob-cli",
                "metabob-opencode",
            ],
            "analyses_completed": list(self.analysis_results.keys()),
            "results": self.analysis_results,
        }

        # Save report
        report_file = self.output_dir / "repository_compatibility_report.json"
        with open(report_file, "w") as f:
            json.dump(summary, f, indent=2)

        print(f"✅ Report saved to: {report_file}")

        # Create summary
        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Create compatibility summary",
            prompt=f"""
Based on the compatibility analysis results, create an executive summary:

Analysis Results:
{json.dumps(self.analysis_results, indent=2)}

Create a summary with:

1. **Executive Summary** (2-3 sentences)
   - Overall compatibility status
   - Major findings

2. **Critical Issues** (🔴 Must fix)
   - Breaking incompatibilities
   - Missing implementations
   - Schema mismatches

3. **Warnings** (🟡 Should fix)
   - Potential issues
   - Deprecated usage
   - Missing validations

4. **Recommendations** (🟢 Nice to have)
   - Improvements
   - Best practices
   - Documentation updates

5. **Action Items** (prioritized)
   - What needs to be fixed first
   - Estimated effort for each
   - Suggested approach

Save the summary to: repository_compatibility_summary.md
            """,
            timeout=180,
        )

        return {
            "report_file": str(report_file),
            "summary_generated": result.success,
            "timestamp": datetime.now().isoformat(),
        }

    async def run_full_analysis(self):
        """Run complete compatibility analysis."""

        print("🚀 STARTING REPOSITORY COMPATIBILITY ANALYSIS")
        print("=" * 60)
        print()

        try:
            # Run all analyses
            await self.analyze_rpc_api_endpoints()
            await self.trace_activity_execution_flow()
            await self.validate_parameter_server_integration()
            await self.check_cross_repository_contracts()
            report = await self.generate_compatibility_report()

            print()
            print("✅ ANALYSIS COMPLETE")
            print("=" * 60)
            print(f"📊 Analyses completed: {len(self.analysis_results)}")
            print(f"📄 Report saved: {report['report_file']}")
            print()
            print("🎯 Next Steps:")
            print("   1. Review repository_compatibility_report.json")
            print("   2. Review repository_compatibility_summary.md")
            print("   3. Address critical issues first")
            print("   4. Implement recommendations")

            return report

        except Exception as e:
            print(f"❌ Analysis failed: {e}")
            import traceback

            traceback.print_exc()
            return None


async def main():
    """Main entry point."""
    analyzer = RepositoryCompatibilityAnalyzer()
    await analyzer.run_full_analysis()


if __name__ == "__main__":
    asyncio.run(main())
