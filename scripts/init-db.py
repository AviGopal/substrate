#!/usr/bin/env python3
"""
Database Initialization Script

Initializes SurrealDB with:
1. Schema generated from metabob-proto protobuf definitions
2. Bootstrap activity templates

Environment:
    SURREAL_URL: SurrealDB URL (default: http://localhost:8000)
    SURREAL_USER: Username (default: root)
    SURREAL_PASS: Password (default: root)
    SURREAL_NAMESPACE: Namespace (default: metabob)
    SURREAL_DATABASE: Database (default: devbob)

The schema is generated from protobuf definitions in metabob-proto/proto/,
ensuring the database schema matches the canonical data models.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import httpx


def get_config():
    return {
        "url": os.getenv("SURREAL_URL", "http://localhost:8000"),
        "user": os.getenv("SURREAL_USER", "root"),
        "pass": os.getenv("SURREAL_PASS", "root"),
        "namespace": os.getenv("SURREAL_NAMESPACE", "metabob"),
        "database": os.getenv("SURREAL_DATABASE", "devbob"),
    }


def execute_query(client: httpx.Client, query: str, config: dict) -> list:
    """Execute a SurrealQL query."""
    response = client.post(
        f"{config['url']}/sql",
        content=query,
        auth=(config["user"], config["pass"]),
        headers={"Accept": "application/json", "Content-Type": "text/plain"},
    )
    if response.status_code != 200:
        print(
            f"Query failed: {response.status_code} - {response.text}", file=sys.stderr
        )
        return []
    return response.json()


def wait_for_db(config: dict, max_retries: int = 30) -> bool:
    """Wait for SurrealDB to be ready."""
    print(f"Waiting for SurrealDB at {config['url']}...")

    for i in range(max_retries):
        try:
            response = httpx.get(f"{config['url']}/health", timeout=5)
            if response.status_code == 200:
                print("SurrealDB is ready!")
                return True
        except Exception:
            pass

        time.sleep(1)
        if i % 5 == 0 and i > 0:
            print(f"  Still waiting... ({i}/{max_retries})")

    print("SurrealDB did not become ready in time", file=sys.stderr)
    return False


def generate_schema_from_proto(config: dict) -> str:
    """Generate SurrealDB schema from proto definitions."""
    # Find metabob-proto directory
    script_dir = Path(__file__).parent
    proto_dir = script_dir.parent / "repos" / "metabob-proto"

    # Also check Docker mount path
    if not proto_dir.exists():
        proto_dir = Path("/proto")

    if not proto_dir.exists():
        print("  Proto directory not found, using fallback schema", file=sys.stderr)
        return get_fallback_schema(config)

    generator_script = proto_dir / "scripts" / "generate_surreal_schema.py"

    if generator_script.exists():
        try:
            result = subprocess.run(
                [
                    sys.executable,
                    str(generator_script),
                    "--proto-dir",
                    str(proto_dir / "proto"),
                    "--namespace",
                    config["namespace"],
                    "--database",
                    config["database"],
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0 and result.stdout.strip():
                print("  Schema generated from proto definitions")
                return result.stdout
            else:
                print(f"  Generator warning: {result.stderr}", file=sys.stderr)
        except Exception as e:
            print(f"  Generator error: {e}", file=sys.stderr)

    return get_fallback_schema(config)


def get_fallback_schema(config: dict) -> str:
    """Fallback schema if proto generation fails."""
    ns = config["namespace"]
    db = config["database"]

    return f"""
USE NS {ns} DB {db};

-- =============================================================================
-- Fallback Schema - Use proto generation for canonical definitions
-- =============================================================================

-- Activity Variants table
DEFINE TABLE IF NOT EXISTS activity_variants SCHEMAFULL;
DEFINE FIELD variant_id ON activity_variants TYPE string;
DEFINE FIELD activity_id ON activity_variants TYPE string;
DEFINE FIELD variant_name ON activity_variants TYPE string;
DEFINE FIELD description ON activity_variants TYPE string;
DEFINE FIELD version ON activity_variants TYPE int DEFAULT 1;
DEFINE FIELD genealogy ON activity_variants TYPE object DEFAULT {{}};
DEFINE FIELD task_steps ON activity_variants TYPE array DEFAULT [];
DEFINE FIELD variables ON activity_variants TYPE object DEFAULT {{}};
DEFINE FIELD prompt_strategy ON activity_variants TYPE string DEFAULT 'guided';
DEFINE FIELD context_budget_tokens ON activity_variants TYPE int DEFAULT 10000;
DEFINE FIELD expected_duration_ms ON activity_variants TYPE int DEFAULT 0;
DEFINE FIELD expected_cost ON activity_variants TYPE float DEFAULT 0.0;
DEFINE FIELD expected_quality_score ON activity_variants TYPE float DEFAULT 0.5;
DEFINE FIELD status ON activity_variants TYPE string DEFAULT 'testing';
DEFINE FIELD created_at ON activity_variants TYPE datetime DEFAULT time::now();
DEFINE INDEX variant_id_idx ON activity_variants FIELDS variant_id UNIQUE;
DEFINE INDEX activity_id_idx ON activity_variants FIELDS activity_id;

-- Consumer Profiles table
DEFINE TABLE IF NOT EXISTS consumer_profiles SCHEMAFULL;
DEFINE FIELD consumer_id ON consumer_profiles TYPE string;
DEFINE FIELD org_id ON consumer_profiles TYPE string DEFAULT '';
DEFINE FIELD project_id ON consumer_profiles TYPE string DEFAULT '';
DEFINE FIELD primary_language ON consumer_profiles TYPE string DEFAULT 'unknown';
DEFINE FIELD primary_framework ON consumer_profiles TYPE option<string>;
DEFINE FIELD tech_stack ON consumer_profiles TYPE array DEFAULT [];
DEFINE FIELD selection_history ON consumer_profiles TYPE object DEFAULT {{}};
DEFINE FIELD success_rate_by_category ON consumer_profiles TYPE object DEFAULT {{}};
DEFINE FIELD prefers_speed ON consumer_profiles TYPE float DEFAULT 0.5;
DEFINE FIELD prefers_cost ON consumer_profiles TYPE float DEFAULT 0.5;
DEFINE FIELD prefers_quality ON consumer_profiles TYPE float DEFAULT 0.5;
DEFINE FIELD total_impressions ON consumer_profiles TYPE int DEFAULT 0;
DEFINE FIELD total_selections ON consumer_profiles TYPE int DEFAULT 0;
DEFINE FIELD total_successes ON consumer_profiles TYPE int DEFAULT 0;
DEFINE FIELD overall_ctr ON consumer_profiles TYPE float DEFAULT 0.0;
DEFINE FIELD overall_conversion_rate ON consumer_profiles TYPE float DEFAULT 0.0;
DEFINE FIELD created_at ON consumer_profiles TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON consumer_profiles TYPE datetime DEFAULT time::now();
DEFINE INDEX consumer_id_idx ON consumer_profiles FIELDS consumer_id UNIQUE;

-- Activity Impressions table
DEFINE TABLE IF NOT EXISTS activity_impressions SCHEMAFULL;
DEFINE FIELD impression_id ON activity_impressions TYPE string;
DEFINE FIELD consumer_id ON activity_impressions TYPE string;
DEFINE FIELD session_id ON activity_impressions TYPE string;
DEFINE FIELD variant_id ON activity_impressions TYPE string;
DEFINE FIELD activity_id ON activity_impressions TYPE string;
DEFINE FIELD intent ON activity_impressions TYPE string DEFAULT '';
DEFINE FIELD rank ON activity_impressions TYPE int DEFAULT 0;
DEFINE FIELD total_shown ON activity_impressions TYPE int DEFAULT 0;
DEFINE FIELD predicted_ctr ON activity_impressions TYPE float DEFAULT 0.0;
DEFINE FIELD predicted_conversion ON activity_impressions TYPE float DEFAULT 0.0;
DEFINE FIELD expected_value ON activity_impressions TYPE float DEFAULT 0.0;
DEFINE FIELD experiment_id ON activity_impressions TYPE option<string>;
DEFINE FIELD treatment_group ON activity_impressions TYPE option<string>;
DEFINE FIELD was_selected ON activity_impressions TYPE bool DEFAULT false;
DEFINE FIELD selection_time_ms ON activity_impressions TYPE option<int>;
DEFINE FIELD shown_at ON activity_impressions TYPE datetime DEFAULT time::now();
DEFINE FIELD selected_at ON activity_impressions TYPE option<datetime>;
DEFINE INDEX impression_id_idx ON activity_impressions FIELDS impression_id UNIQUE;
DEFINE INDEX consumer_variant_idx ON activity_impressions FIELDS consumer_id, variant_id;

-- Variant Performance Metrics table
DEFINE TABLE IF NOT EXISTS variant_performance_metrics SCHEMAFULL;
DEFINE FIELD variant_id ON variant_performance_metrics TYPE string;
DEFINE FIELD activity_id ON variant_performance_metrics TYPE string DEFAULT '';
DEFINE FIELD total_impressions ON variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD total_selections ON variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD total_conversions ON variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD total_successes ON variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD total_failures ON variant_performance_metrics TYPE int DEFAULT 0;
DEFINE FIELD avg_duration_ms ON variant_performance_metrics TYPE float DEFAULT 0.0;
DEFINE FIELD avg_cost ON variant_performance_metrics TYPE float DEFAULT 0.0;
DEFINE FIELD avg_quality_score ON variant_performance_metrics TYPE float DEFAULT 0.0;
DEFINE FIELD conversion_rate ON variant_performance_metrics TYPE float DEFAULT 0.0;
DEFINE FIELD expected_value ON variant_performance_metrics TYPE float DEFAULT 0.0;
DEFINE FIELD thompson_alpha ON variant_performance_metrics TYPE float DEFAULT 1.0;
DEFINE FIELD thompson_beta ON variant_performance_metrics TYPE float DEFAULT 1.0;
DEFINE FIELD last_updated ON variant_performance_metrics TYPE datetime DEFAULT time::now();
DEFINE INDEX variant_metrics_idx ON variant_performance_metrics FIELDS variant_id UNIQUE;

-- Sessions table
DEFINE TABLE IF NOT EXISTS sessions SCHEMAFULL;
DEFINE FIELD session_id ON sessions TYPE string;
DEFINE FIELD session_type ON sessions TYPE string DEFAULT 'anonymous';
DEFINE FIELD consumer_id ON sessions TYPE string DEFAULT '';
DEFINE FIELD org_id ON sessions TYPE string DEFAULT '';
DEFINE FIELD project_id ON sessions TYPE string DEFAULT '';
DEFINE FIELD metadata ON sessions TYPE object DEFAULT {{}};
DEFINE FIELD created_at ON sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD expires_at ON sessions TYPE datetime;
DEFINE FIELD last_activity ON sessions TYPE datetime DEFAULT time::now();
DEFINE INDEX session_id_idx ON sessions FIELDS session_id UNIQUE;
"""


def init_schema(client: httpx.Client, config: dict):
    """Initialize database schema from proto definitions."""
    print(f"Initializing schema for {config['namespace']}.{config['database']}...")

    schema = generate_schema_from_proto(config)
    results = execute_query(client, schema, config)

    success_count = sum(1 for r in results if r.get("status") == "OK")
    print(f"  Schema initialized: {success_count} statements executed")

    return success_count > 0


def seed_bootstrap_activities(client: httpx.Client, config: dict):
    """Seed bootstrap activities and built-in templates from metabob-proto."""
    ns = config["namespace"]
    db = config["database"]

    # Look for metabob-proto
    script_dir = Path(__file__).parent
    proto_dir = script_dir.parent / "repos" / "metabob-proto"

    # Also check Docker mount path
    if not proto_dir.exists():
        proto_dir = Path("/proto")

    if not proto_dir.exists():
        print("  metabob-proto not found, skipping seed")
        return 0

    total_created = 0

    # Seed bootstrap activities (foundational)
    bootstrap_dir = proto_dir / "activities" / "bootstrap"
    if bootstrap_dir.exists():
        print(f"Seeding bootstrap activities from {bootstrap_dir}...")

    created = 0
    skipped = 0

    for json_file in bootstrap_dir.glob("*.json"):
        try:
            with open(json_file) as f:
                template = json.load(f)

            variant_id = template.get("variant_id", "")
            if not variant_id:
                continue

            # Check if exists
            check_query = f"USE NS {ns} DB {db}; SELECT variant_id FROM activity_variants WHERE variant_id = '{variant_id}' LIMIT 1;"
            results = execute_query(client, check_query, config)

            if len(results) > 1 and results[1].get("result"):
                print(f"  Skipped: {variant_id} (exists)")
                skipped += 1
                continue

            # Convert to genealogy format if needed
            genealogy = {
                "content_hash": template.get("content_hash", ""),
                "parent_hash": template.get("parent_hash"),
                "lineage": template.get("lineage", []),
                "evolution_type": template.get("evolution_type", "root"),
                "evolution_note": template.get("evolution_note", ""),
            }

            # Build CREATE query
            fields = []
            for key, value in template.items():
                # Skip genealogy fields - they go in the genealogy object
                if key in (
                    "content_hash",
                    "parent_hash",
                    "lineage",
                    "evolution_type",
                    "evolution_note",
                ):
                    continue

                if value is None:
                    fields.append(f"{key} = NULL")
                elif isinstance(value, str):
                    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
                    fields.append(f'{key} = "{escaped}"')
                elif isinstance(value, bool):
                    fields.append(f"{key} = {str(value).lower()}")
                elif isinstance(value, (int, float)):
                    fields.append(f"{key} = {value}")
                elif isinstance(value, (list, dict)):
                    # FIX: Properly escape JSON string for SQL
                    escaped_json = (
                        json.dumps(value).replace("\\", "\\\\").replace('"', '\\"')
                    )
                    fields.append(f'{key} = "{escaped_json}"')

            # Add genealogy object (also needs proper escaping)
            escaped_genealogy = (
                json.dumps(genealogy).replace("\\", "\\\\").replace('"', '\\"')
            )
            fields.append(f'genealogy = "{escaped_genealogy}"')

            create_query = f"USE NS {ns} DB {db}; CREATE activity_variants SET {', '.join(fields)};"
            results = execute_query(client, create_query, config)

            if len(results) > 1 and results[1].get("status") == "OK":
                print(f"  Created: {variant_id}")
                created += 1
            else:
                print(f"  Failed: {variant_id}", file=sys.stderr)

        except Exception as e:
            print(f"  Error with {json_file.name}: {e}", file=sys.stderr)

        print(f"  Bootstrap seed complete: {created} created, {skipped} skipped")
        total_created += created
    else:
        print(f"  Bootstrap directory not found: {bootstrap_dir}")

    # Seed built-in templates (complete templates)
    templates_dir = proto_dir / "activities" / "templates"
    if templates_dir.exists():
        print(f"\nSeeding built-in templates from {templates_dir}...")

        template_created = 0
        template_skipped = 0

        for json_file in templates_dir.glob("*.json"):
            try:
                with open(json_file) as f:
                    template = json.load(f)

                # Generate variant_id if not present
                activity_id = template.get("id") or template.get(
                    "name", ""
                ).lower().replace(" ", "-")
                if not activity_id:
                    continue

                # Use activity_id as variant_id for built-in templates
                variant_id = f"{activity_id}-builtin"

                # Check if exists
                check_query = f"USE NS {ns} DB {db}; SELECT variant_id FROM activity_variants WHERE variant_id = '{variant_id}' LIMIT 1;"
                results = execute_query(client, check_query, config)

                if len(results) > 1 and results[1].get("result"):
                    print(f"  Skipped: {variant_id} (exists)")
                    template_skipped += 1
                    continue

                # Build CREATE query with proper fields
                create_data = {
                    "variant_id": variant_id,
                    "activity_id": activity_id,
                    "variant_name": template.get("name", ""),
                    "description": template.get("description", ""),
                    "task_steps": template.get("tasks", []),
                    "variables": template.get("variables", {}),
                    "status": "testing",
                    "evolution_note": f"Seeded from proto: {json_file.name}",
                    "evolution_type": "root",
                    "genealogy": {},
                }

                fields = []
                for key, value in create_data.items():
                    if isinstance(value, str):
                        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
                        fields.append(f'{key} = "{escaped}"')
                    elif isinstance(value, (list, dict)):
                        # FIX: Properly escape JSON string for SQL
                        escaped_json = (
                            json.dumps(value).replace("\\", "\\\\").replace('"', '\\"')
                        )
                        fields.append(f'{key} = "{escaped_json}"')
                    else:
                        fields.append(f"{key} = {value}")

                create_query = f"USE NS {ns} DB {db}; CREATE activity_variants SET {', '.join(fields)};"
                results = execute_query(client, create_query, config)

                if len(results) > 1 and results[1].get("status") == "OK":
                    print(f"  Created: {variant_id}")
                    template_created += 1
                else:
                    print(f"  Failed: {variant_id}", file=sys.stderr)

            except Exception as e:
                print(f"  Error with {json_file.name}: {e}", file=sys.stderr)

        print(
            f"  Built-in templates seed complete: {template_created} created, {template_skipped} skipped"
        )
        total_created += template_created
    else:
        print(f"  Templates directory not found: {templates_dir}")

    print(f"\n  Total seed complete: {total_created} created")
    return total_created


def verify_db(client: httpx.Client, config: dict):
    """Verify database state."""
    ns = config["namespace"]
    db = config["database"]

    print("Verifying database state...")

    # Count activity variants
    query = f"USE NS {ns} DB {db}; SELECT count() FROM activity_variants GROUP ALL;"
    results = execute_query(client, query, config)

    count = 0
    if len(results) > 1 and results[1].get("result"):
        result = results[1]["result"]
        if isinstance(result, list) and len(result) > 0:
            count = result[0].get("count", 0)

    print(f"  Activity variants: {count}")

    # List active variants
    query = f"USE NS {ns} DB {db}; SELECT variant_id, activity_id, status FROM activity_variants WHERE status = 'active' LIMIT 10;"
    results = execute_query(client, query, config)

    if len(results) > 1 and results[1].get("result"):
        active = results[1]["result"]
        print(f"  Active variants: {len(active)}")
        for v in active[:5]:
            print(f"    - {v.get('variant_id')}: {v.get('activity_id')}")

    return count > 0


def main():
    config = get_config()

    print("=" * 60)
    print("Database Initialization")
    print("=" * 60)
    print(f"URL: {config['url']}")
    print(f"Namespace: {config['namespace']}")
    print(f"Database: {config['database']}")
    print(f"Schema Source: metabob-proto/proto/")
    print()

    if not wait_for_db(config):
        sys.exit(1)

    with httpx.Client(timeout=30) as client:
        # Initialize schema from proto definitions
        if not init_schema(client, config):
            print("Schema initialization failed", file=sys.stderr)
            sys.exit(1)

        # Seed bootstrap activities
        seed_bootstrap_activities(client, config)

        # Verify
        if not verify_db(client, config):
            print("Database verification failed", file=sys.stderr)
            sys.exit(1)

    print()
    print("=" * 60)
    print("Database initialization complete!")
    print("=" * 60)
    print()
    print(f"Surrealist UI: http://localhost:8001")
    print(f"  Connection: ws://localhost:8000")
    print(f"  Namespace: {config['namespace']}")
    print(f"  Database: {config['database']}")
    print(f"  Auth: {config['user']} / {config['pass']}")


if __name__ == "__main__":
    main()
