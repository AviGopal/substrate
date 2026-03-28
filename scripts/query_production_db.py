#!/usr/bin/env python3
"""
Query production SurrealDB directly to check templates and setup.
Uses the same pattern as server/utils/surreal_client.py
"""

import sys
import asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

# Add repos/metabob-rpc-api to path to import server modules
sys.path.insert(0, str(Path(__file__).parent.parent / "repos/metabob-rpc-api"))

from surrealdb import Surreal

_executor = ThreadPoolExecutor(max_workers=2)


async def query_database():
    """Query the production database for templates and organizations"""

    # Production credentials
    url = "ws://localhost:8000"
    user = "metabob-admin"
    password = "production-password-change-me"
    namespace = "production"
    database = "production"

    print(f"🔌 Connecting to SurrealDB at {url}")
    print(f"   Namespace: {namespace}, Database: {database}\n")

    try:
        loop = asyncio.get_event_loop()

        # Initialize client
        db = await loop.run_in_executor(_executor, Surreal, url)

        # Sign in
        await loop.run_in_executor(
            _executor, db.signin, {"user": user, "pass": password}
        )

        # Use namespace and database
        await loop.run_in_executor(_executor, db.use, namespace, database)

        print("✅ Connected to SurrealDB\n")

        # Query activity templates
        print("=" * 70)
        print("ACTIVITY TEMPLATES")
        print("=" * 70)

        result = await loop.run_in_executor(
            _executor,
            db.query,
            "SELECT id, name, version, category, is_bootstrap, status FROM activity_template ORDER BY is_bootstrap DESC, name",
        )

        if result and len(result) > 0 and "result" in result[0]:
            templates = result[0]["result"]
            print(f"\n📊 Found {len(templates)} templates:\n")

            bootstrap_templates = [t for t in templates if t.get("is_bootstrap", False)]
            other_templates = [t for t in templates if not t.get("is_bootstrap", False)]

            if bootstrap_templates:
                print(f"\n🔵 Bootstrap Templates ({len(bootstrap_templates)}):\n")
                for tmpl in bootstrap_templates:
                    status = tmpl.get("status", "N/A")
                    print(
                        f"   {tmpl.get('name', 'N/A'):45s} v{tmpl.get('version', '?'):5s} {tmpl.get('category', 'N/A'):20s} [{status}]"
                    )

            if other_templates:
                print(f"\n⚪ Other Templates ({len(other_templates)}):\n")
                for tmpl in other_templates:
                    status = tmpl.get("status", "N/A")
                    print(
                        f"   {tmpl.get('name', 'N/A'):45s} v{tmpl.get('version', '?'):5s} {tmpl.get('category', 'N/A'):20s} [{status}]"
                    )
        else:
            print("⚠️  No templates found!")

        # Query organizations
        print("\n" + "=" * 70)
        print("ORGANIZATIONS")
        print("=" * 70)

        result = await loop.run_in_executor(
            _executor, db.query, "SELECT id, name FROM organization ORDER BY name"
        )

        if result and len(result) > 0 and "result" in result[0]:
            orgs = result[0]["result"]
            print(f"\n📊 Found {len(orgs)} organizations:\n")

            for org in orgs:
                org_id = org.get("id", "N/A")
                org_name = org.get("name", "N/A")
                print(f"   🏢 {org_name:40s} ({org_id})")

                # Query projects for this org
                proj_result = await loop.run_in_executor(
                    _executor,
                    db.query,
                    f"SELECT id, name, is_default FROM project WHERE organization = {org_id} ORDER BY is_default DESC, name",
                )

                if proj_result and len(proj_result) > 0 and "result" in proj_result[0]:
                    projects = proj_result[0]["result"]
                    for proj in projects:
                        is_default = proj.get("is_default", False)
                        marker = "⭐" if is_default else "  "
                        print(
                            f"      {marker} 📁 {proj.get('name', 'N/A'):35s} ({proj.get('id', 'N/A')})"
                        )
        else:
            print("⚠️  No organizations found!")

        # Check template inheritance
        print("\n" + "=" * 70)
        print("TEMPLATE INHERITANCE SETUP")
        print("=" * 70)

        result = await loop.run_in_executor(
            _executor,
            db.query,
            """
            SELECT 
                project,
                activity_template,
                inherited_from,
                is_enabled
            FROM project_activity_template 
            ORDER BY project 
            LIMIT 20
            """,
        )

        if result and len(result) > 0 and "result" in result[0]:
            relationships = result[0]["result"]
            print(
                f"\n📊 Found {len(relationships)} template-project relationships (showing first 20):\n"
            )

            for rel in relationships:
                inherited = rel.get("inherited_from")
                enabled = rel.get("is_enabled", True)
                status_icon = "✅" if enabled else "❌"

                if inherited:
                    print(
                        f"   {status_icon} 🔗 Project {rel.get('project')} → Template {rel.get('activity_template')} (inherited from {inherited})"
                    )
                else:
                    print(
                        f"   {status_icon} 📌 Project {rel.get('project')} → Template {rel.get('activity_template')} (direct)"
                    )
        else:
            print("⚠️  No template inheritance relationships found!")
            print("   This means templates haven't been assigned to projects yet.")

        print("\n" + "=" * 70)
        print("SUMMARY")
        print("=" * 70)

        # Check bootstrap templates in repo
        bootstrap_path = (
            Path(__file__).parent.parent / "repos/metabob-proto/activities/bootstrap"
        )
        if bootstrap_path.exists():
            bootstrap_files = list(bootstrap_path.glob("*.json"))
            print(f"\n📂 Bootstrap templates in repo: {len(bootstrap_files)}")

        # Get template count from DB
        result = await loop.run_in_executor(
            _executor,
            db.query,
            "SELECT count() as count FROM activity_template WHERE is_bootstrap = true GROUP ALL",
        )

        if result and len(result) > 0 and "result" in result[0] and result[0]["result"]:
            db_count = result[0]["result"][0].get("count", 0)
            print(f"💾 Bootstrap templates in database: {db_count}")

            if len(bootstrap_files) != db_count:
                print(f"\n⚠️  MISMATCH DETECTED!")
                print(f"   Repository has {len(bootstrap_files)} templates")
                print(f"   Database has {db_count} templates")
                print(
                    f"   You may need to run: python scripts/register-bootstrap-templates.py"
                )
            else:
                print(f"\n✅ Bootstrap templates are in sync!")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(query_database()))
