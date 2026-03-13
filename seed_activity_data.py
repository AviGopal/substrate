#!/usr/bin/env python3
"""
Seed SurrealDB with activity execution data to simulate CLI→RPC→DB flow.
This data would normally be created by metabob-cli via metabob-rpc-api.
"""

import requests
import json
from datetime import datetime, timedelta
import uuid


def create_test_data():
    """Create comprehensive test data for dashboard validation."""

    now = datetime.utcnow()

    # Create a project
    project_sql = """
    CREATE projects:test_project CONTENT {
        project_id: 'proj_test_001',
        org_id: 'org_test_001',
        name: 'Test Project',
        git_root_hash: 'abc123def456',
        repository_url: 'https://github.com/test/repo',
        branch: 'main',
        settings: {},
        stats: {
            total_sessions: 0,
            total_activities: 0,
            total_problems_found: 0,
            total_problems_fixed: 0
        },
        created_at: time::now(),
        updated_at: time::now()
    };
    """

    # Create a session
    session_id = f"sess_{uuid.uuid4().hex[:16]}"
    session_sql = f"""
    CREATE sessions:{session_id} CONTENT {{
        session_id: '{session_id}',
        project_id: 'proj_test_001',
        user_id: 'user_test_001',
        org_id: 'org_test_001',
        start_time: time::now(),
        end_time: NONE,
        total_activities: 3,
        successful_activities: 2,
        failed_activities: 1,
        total_cost_usd: 0.0234,
        metadata: {{}},
        created_at: time::now(),
        updated_at: time::now()
    }};
    """

    # Create activity templates
    templates_sql = """
    CREATE activity_templates:add_feature CONTENT {
        template_id: 'add-feature-complete',
        org_id: 'org_test_001',
        name: 'Add Feature Complete',
        description: 'Complete feature implementation with tests',
        category: 'feature',
        version: '1.0.0',
        success_count: 15,
        failure_count: 2,
        total_executions: 17,
        avg_duration_ms: 45000,
        avg_cost_usd: 0.0123,
        last_used_at: time::now(),
        created_at: time::now(),
        updated_at: time::now()
    };
    
    CREATE activity_templates:fix_bug CONTENT {
        template_id: 'fix-bug-complete',
        org_id: 'org_test_001',
        name: 'Fix Bug Complete',
        description: 'Bug fix with root cause analysis',
        category: 'bugfix',
        version: '1.0.0',
        success_count: 22,
        failure_count: 1,
        total_executions: 23,
        avg_duration_ms: 32000,
        avg_cost_usd: 0.0089,
        last_used_at: time::now(),
        created_at: time::now(),
        updated_at: time::now()
    };
    
    CREATE activity_templates:refactor CONTENT {
        template_id: 'refactor-with-tests',
        org_id: 'org_test_001',
        name: 'Refactor with Tests',
        description: 'Code refactoring with test coverage',
        category: 'refactor',
        version: '1.0.0',
        success_count: 8,
        failure_count: 3,
        total_executions: 11,
        avg_duration_ms: 52000,
        avg_cost_usd: 0.0156,
        last_used_at: time::now(),
        created_at: time::now(),
        updated_at: time::now()
    };
    """

    # Create activity executions (what CLI would create via RPC API)
    exec1_id = f"exec_{uuid.uuid4().hex[:16]}"
    exec2_id = f"exec_{uuid.uuid4().hex[:16]}"
    exec3_id = f"exec_{uuid.uuid4().hex[:16]}"

    executions_sql = f"""
    CREATE activity_executions:{exec1_id} CONTENT {{
        execution_id: '{exec1_id}',
        activity_id: 'act_{uuid.uuid4().hex[:12]}',
        session_id: '{session_id}',
        org_id: 'org_test_001',
        user_id: 'user_test_001',
        project_id: 'proj_test_001',
        template_id: 'add-feature-complete',
        template_name: 'Add Feature Complete',
        status: 'completed',
        start_time: time::now() - 2h,
        end_time: time::now() - 1h45m,
        duration_ms: 45234,
        cost_usd: 0.0123,
        token_usage: {{
            input: 12500,
            output: 3200,
            cache: 8900
        }},
        tasks_completed: 5,
        tasks_failed: 0,
        metadata: {{
            feature_name: 'User Authentication',
            files_modified: ['src/auth.ts', 'tests/auth.test.ts']
        }},
        created_at: time::now() - 2h,
        updated_at: time::now() - 1h45m
    }};
    
    CREATE activity_executions:{exec2_id} CONTENT {{
        execution_id: '{exec2_id}',
        activity_id: 'act_{uuid.uuid4().hex[:12]}',
        session_id: '{session_id}',
        org_id: 'org_test_001',
        user_id: 'user_test_001',
        project_id: 'proj_test_001',
        template_id: 'fix-bug-complete',
        template_name: 'Fix Bug Complete',
        status: 'completed',
        start_time: time::now() - 1h30m,
        end_time: time::now() - 1h,
        duration_ms: 32156,
        cost_usd: 0.0089,
        token_usage: {{
            input: 9800,
            output: 2400,
            cache: 6500
        }},
        tasks_completed: 4,
        tasks_failed: 0,
        metadata: {{
            bug_description: 'Null pointer in login flow',
            files_modified: ['src/login.ts']
        }},
        created_at: time::now() - 1h30m,
        updated_at: time::now() - 1h
    }};
    
    CREATE activity_executions:{exec3_id} CONTENT {{
        execution_id: '{exec3_id}',
        activity_id: 'act_{uuid.uuid4().hex[:12]}',
        session_id: '{session_id}',
        org_id: 'org_test_001',
        user_id: 'user_test_001',
        project_id: 'proj_test_001',
        template_id: 'refactor-with-tests',
        template_name: 'Refactor with Tests',
        status: 'failed',
        start_time: time::now() - 45m,
        end_time: time::now() - 30m,
        duration_ms: 15234,
        cost_usd: 0.0022,
        token_usage: {{
            input: 3200,
            output: 800,
            cache: 2100
        }},
        tasks_completed: 2,
        tasks_failed: 1,
        metadata: {{
            error: 'Test suite failed',
            files_modified: ['src/utils.ts']
        }},
        created_at: time::now() - 45m,
        updated_at: time::now() - 30m
    }};
    """

    # Create template optimizations (learning data)
    optimizations_sql = """
    CREATE template_optimizations:opt1 CONTENT {
        optimization_id: 'opt_001',
        template_id: 'add-feature-complete',
        org_id: 'org_test_001',
        variant_id: 'default',
        optimization_type: 'thompson_sampling',
        success_rate: 0.882,
        avg_reward: 0.75,
        samples: 17,
        last_updated: time::now(),
        metadata: {
            alpha: 16,
            beta: 3
        },
        created_at: time::now(),
        updated_at: time::now()
    };
    
    CREATE template_optimizations:opt2 CONTENT {
        optimization_id: 'opt_002',
        template_id: 'fix-bug-complete',
        org_id: 'org_test_001',
        variant_id: 'default',
        optimization_type: 'thompson_sampling',
        success_rate: 0.957,
        avg_reward: 0.88,
        samples: 23,
        last_updated: time::now(),
        metadata: {
            alpha: 23,
            beta: 2
        },
        created_at: time::now(),
        updated_at: time::now()
    };
    """

    # Combine all SQL
    full_sql = (
        project_sql + session_sql + templates_sql + executions_sql + optimizations_sql
    )

    return full_sql


def execute_sql(sql):
    """Execute SQL against SurrealDB via HTTP API."""
    resp = requests.post(
        "http://surrealdb:8000/sql",
        headers={
            "Surreal-NS": "metabob",
            "Surreal-DB": "metabob",
            "Authorization": "Basic cm9vdDpyb290",
            "Accept": "application/json",
        },
        data=sql,
    )
    return resp


if __name__ == "__main__":
    print("Generating test data SQL...")
    sql = create_test_data()

    print("Executing SQL against SurrealDB...")
    resp = execute_sql(sql)

    print(f"Status: {resp.status_code}")
    results = resp.json()

    success_count = sum(1 for r in results if r.get("status") == "OK")
    total_count = len(results)

    print(f"Results: {success_count}/{total_count} successful")

    for i, r in enumerate(results, 1):
        if r.get("status") != "OK":
            print(f"  Error in statement {i}: {r}")
        else:
            result_data = r.get("result", [])
            if result_data:
                print(
                    f"  Statement {i}: Created {len(result_data) if isinstance(result_data, list) else 1} record(s)"
                )
