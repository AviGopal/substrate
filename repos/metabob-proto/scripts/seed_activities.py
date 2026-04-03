#!/usr/bin/env python3
"""
DEPRECATED: This script seeds the legacy `activity_variants` table.

As of 2026-04, the system now uses paradigm tables (activity, impulse, execution, vessel).

Use instead:
    repos/deployment/vessels/metabob-activity-api/sql/seed-paradigm-templates.ts

This script is kept for reference only and will be removed in a future cleanup.

---

Legacy documentation:

Seed bootstrap activity templates into SurrealDB.

This script loads activity templates from metabob-proto/activities/bootstrap
into the configured SurrealDB instance.

Usage:
    python seed_activities.py [--db-url URL] [--namespace NS] [--database DB]

Environment variables:
    SURREAL_URL: SurrealDB URL (default: http://localhost:8000)
    SURREAL_USER: SurrealDB username (default: root)
    SURREAL_PASS: SurrealDB password (default: root)
    SURREAL_NS: Namespace (default: metabob)
    SURREAL_DB: Database (default: devbob)
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx


def load_activity_templates(bootstrap_dir: Path) -> list[dict]:
    """Load all activity templates from the bootstrap directory."""
    templates = []
    for json_file in bootstrap_dir.glob("*.json"):
        try:
            with open(json_file) as f:
                template = json.load(f)
                template["_source_file"] = json_file.name
                templates.append(template)
                print(f"  Loaded: {json_file.name}")
        except json.JSONDecodeError as e:
            print(f"  Error parsing {json_file.name}: {e}", file=sys.stderr)
        except Exception as e:
            print(f"  Error loading {json_file.name}: {e}", file=sys.stderr)
    return templates


def seed_activities(
    templates: list[dict],
    db_url: str,
    namespace: str,
    database: str,
    username: str,
    password: str,
    force: bool = False,
) -> tuple[int, int]:
    """Seed activities into SurrealDB. Returns (created, skipped) counts."""
    created = 0
    skipped = 0
    
    headers = {"Accept": "application/json", "Content-Type": "text/plain"}
    
    with httpx.Client(base_url=db_url, auth=(username, password), headers=headers) as client:
        for template in templates:
            variant_id = template.get("variant_id")
            source_file = template.pop("_source_file", "unknown")
            
            # Check if exists
            check_query = f"USE NS {namespace} DB {database}; SELECT * FROM activity_variants WHERE variant_id = '{variant_id}' LIMIT 1;"
            response = client.post("/sql", content=check_query)
            
            if response.status_code != 200:
                print(f"  Error checking {variant_id}: {response.text}", file=sys.stderr)
                continue
            
            results = response.json()
            exists = len(results) > 1 and len(results[1].get("result", [])) > 0
            
            if exists and not force:
                print(f"  Skipped: {variant_id} (already exists)")
                skipped += 1
                continue
            
            # Prepare template with timestamp
            template["created_at"] = datetime.now(timezone.utc).isoformat()
            
            # Build CREATE or UPDATE query
            if exists and force:
                # Update existing
                set_clauses = []
                for key, value in template.items():
                    if key in ("variant_id",):
                        continue
                    if isinstance(value, str):
                        set_clauses.append(f'{key} = "{value}"')
                    elif isinstance(value, (list, dict)):
                        set_clauses.append(f"{key} = {json.dumps(value)}")
                    elif isinstance(value, bool):
                        set_clauses.append(f"{key} = {str(value).lower()}")
                    else:
                        set_clauses.append(f"{key} = {value}")
                
                query = f"USE NS {namespace} DB {database}; UPDATE activity_variants SET {', '.join(set_clauses)} WHERE variant_id = '{variant_id}';"
            else:
                # Create new
                set_clauses = []
                for key, value in template.items():
                    if isinstance(value, str):
                        set_clauses.append(f'{key} = "{value}"')
                    elif isinstance(value, (list, dict)):
                        set_clauses.append(f"{key} = {json.dumps(value)}")
                    elif isinstance(value, bool):
                        set_clauses.append(f"{key} = {str(value).lower()}")
                    else:
                        set_clauses.append(f"{key} = {value}")
                
                query = f"USE NS {namespace} DB {database}; CREATE activity_variants SET {', '.join(set_clauses)};"
            
            response = client.post("/sql", content=query)
            
            if response.status_code == 200:
                result = response.json()
                if len(result) > 1 and result[1].get("status") == "OK":
                    action = "Updated" if (exists and force) else "Created"
                    print(f"  {action}: {variant_id}")
                    created += 1
                else:
                    print(f"  Error with {variant_id}: {result}", file=sys.stderr)
            else:
                print(f"  Error creating {variant_id}: {response.text}", file=sys.stderr)
    
    return created, skipped


def main():
    parser = argparse.ArgumentParser(description="Seed activity templates from metabob-proto")
    parser.add_argument("--db-url", default=os.getenv("SURREAL_URL", "http://localhost:8000"))
    parser.add_argument("--namespace", default=os.getenv("SURREAL_NS", "metabob"))
    parser.add_argument("--database", default=os.getenv("SURREAL_DB", "devbob"))
    parser.add_argument("--username", default=os.getenv("SURREAL_USER", "root"))
    parser.add_argument("--password", default=os.getenv("SURREAL_PASS", "root"))
    parser.add_argument("--force", action="store_true", help="Update existing activities")
    parser.add_argument("--bootstrap-only", action="store_true", help="Seed only bootstrap templates")
    parser.add_argument("--templates-only", action="store_true", help="Seed only built-in templates")
    args = parser.parse_args()
    
    script_dir = Path(__file__).parent
    all_templates = []
    
    # Load bootstrap templates (foundational activities)
    if not args.templates_only:
        bootstrap_dir = script_dir.parent / "activities" / "bootstrap"
        if bootstrap_dir.exists():
            print(f"Loading bootstrap templates from: {bootstrap_dir}")
            bootstrap_templates = load_activity_templates(bootstrap_dir)
            all_templates.extend(bootstrap_templates)
            print(f"  Loaded {len(bootstrap_templates)} bootstrap templates")
        else:
            print(f"  Bootstrap directory not found: {bootstrap_dir}")
    
    # Load built-in templates (complete templates with all features)
    if not args.bootstrap_only:
        templates_dir = script_dir.parent / "activities" / "templates"
        if templates_dir.exists():
            print(f"Loading built-in templates from: {templates_dir}")
            builtin_templates = load_activity_templates(templates_dir)
            all_templates.extend(builtin_templates)
            print(f"  Loaded {len(builtin_templates)} built-in templates")
        else:
            print(f"  Templates directory not found: {templates_dir}")
    
    if not all_templates:
        print("No templates found!", file=sys.stderr)
        sys.exit(1)
    
    print(f"\nSeeding {len(all_templates)} activities to {args.db_url}")
    print(f"  Namespace: {args.namespace}")
    print(f"  Database: {args.database}")
    print()
    
    created, skipped = seed_activities(
        all_templates,
        args.db_url,
        args.namespace,
        args.database,
        args.username,
        args.password,
        args.force,
    )
    
    print(f"\nComplete: {created} created, {skipped} skipped")


if __name__ == "__main__":
    main()
