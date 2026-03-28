#!/usr/bin/env python3
"""
Check SurrealDB for activity templates and verify bootstrap setup.
"""

import os
import json
from pathlib import Path
from surrealdb import Surreal


def main():
    # Database connection details
    db_url = os.environ.get("SURREAL_URL", "ws://localhost:8000")
    db_user = os.environ.get("SURREAL_USER", "metabob-admin")
    db_pass = os.environ.get("SURREAL_PASS", "production-password-change-me")
    db_ns = os.environ.get("SURREAL_NS", "production")
    db_name = os.environ.get("SURREAL_DB", "production")

    print(f"🔌 Connecting to SurrealDB at {db_url}")
    print(f"   Namespace: {db_ns}, Database: {db_name}\n")

    try:
        async with Surreal(db_url) as db:
            await db.signin({"user": db_user, "pass": db_pass})
            await db.use(db_ns, db_name)

            print("✅ Connected to SurrealDB\n")

            # Check activity templates
            print("=" * 60)
            print("ACTIVITY TEMPLATES")
            print("=" * 60)

            templates = await db.query(
                "SELECT id, name, version, category, is_bootstrap FROM activity_template ORDER BY name"
            )

            if templates and len(templates) > 0 and len(templates[0]["result"]) > 0:
                template_list = templates[0]["result"]
                print(f"\n📊 Found {len(template_list)} templates in database:\n")

                bootstrap_count = 0
                non_bootstrap_count = 0

                for tmpl in template_list:
                    is_bootstrap = tmpl.get("is_bootstrap", False)
                    if is_bootstrap:
                        bootstrap_count += 1
                        marker = "🔵"
                    else:
                        non_bootstrap_count += 1
                        marker = "⚪"

                    print(
                        f"{marker} {tmpl.get('name', 'N/A'):40s} v{tmpl.get('version', 'N/A'):5s} {tmpl.get('category', 'N/A'):20s} {tmpl.get('id', 'N/A')}"
                    )

                print(f"\n📈 Summary:")
                print(f"   Bootstrap templates: {bootstrap_count}")
                print(f"   Non-bootstrap templates: {non_bootstrap_count}")
                print(f"   Total: {len(template_list)}")
            else:
                print("⚠️  No templates found in database!")

            # Check organizations
            print("\n" + "=" * 60)
            print("ORGANIZATIONS")
            print("=" * 60)

            orgs = await db.query(
                "SELECT id, name, created_at FROM organization ORDER BY created_at DESC"
            )

            if orgs and len(orgs) > 0 and len(orgs[0]["result"]) > 0:
                org_list = orgs[0]["result"]
                print(f"\n📊 Found {len(org_list)} organizations:\n")

                for org in org_list:
                    print(f"🏢 {org.get('name', 'N/A'):40s} {org.get('id', 'N/A')}")
            else:
                print("⚠️  No organizations found in database!")

            # Check projects
            print("\n" + "=" * 60)
            print("PROJECTS")
            print("=" * 60)

            projects = await db.query(
                "SELECT id, name, organization, is_default FROM project ORDER BY organization, is_default DESC, name"
            )

            if projects and len(projects) > 0 and len(projects[0]["result"]) > 0:
                project_list = projects[0]["result"]
                print(f"\n📊 Found {len(project_list)} projects:\n")

                for proj in project_list:
                    is_default = proj.get("is_default", False)
                    marker = "⭐" if is_default else "📁"
                    org_id = proj.get("organization", "N/A")

                    print(
                        f"{marker} {proj.get('name', 'N/A'):40s} org: {org_id} {proj.get('id', 'N/A')}"
                    )
            else:
                print("⚠️  No projects found in database!")

            # Check project_activity_template relationships
            print("\n" + "=" * 60)
            print("PROJECT TEMPLATE INHERITANCE")
            print("=" * 60)

            proj_templates = await db.query("""
                SELECT 
                    project,
                    activity_template,
                    inherited_from,
                    is_enabled
                FROM project_activity_template 
                ORDER BY project
            """)

            if (
                proj_templates
                and len(proj_templates) > 0
                and len(proj_templates[0]["result"]) > 0
            ):
                rel_list = proj_templates[0]["result"]
                print(f"\n📊 Found {len(rel_list)} project-template relationships:\n")

                inherited_count = 0
                direct_count = 0

                for rel in rel_list:
                    inherited_from = rel.get("inherited_from")
                    is_enabled = rel.get("is_enabled", True)

                    if inherited_from:
                        inherited_count += 1
                        marker = "🔗"
                        inheritance = f"← inherited from {inherited_from}"
                    else:
                        direct_count += 1
                        marker = "📌"
                        inheritance = "direct"

                    status = "✅" if is_enabled else "❌"

                    print(
                        f"{marker} {status} Project: {rel.get('project', 'N/A')} → Template: {rel.get('activity_template', 'N/A')} ({inheritance})"
                    )

                print(f"\n📈 Summary:")
                print(f"   Inherited relationships: {inherited_count}")
                print(f"   Direct relationships: {direct_count}")
                print(f"   Total: {len(rel_list)}")
            else:
                print("⚠️  No project-template relationships found!")

            print("\n" + "=" * 60)
            print("BOOTSTRAP STATUS")
            print("=" * 60)

            # Count bootstrap templates in repo
            bootstrap_path = (
                Path(__file__).parent.parent
                / "repos/metabob-proto/activities/bootstrap"
            )
            if bootstrap_path.exists():
                bootstrap_files = list(bootstrap_path.glob("*.json"))
                print(f"\n📂 Bootstrap templates in repo: {len(bootstrap_files)}")

                if templates and len(templates) > 0 and len(templates[0]["result"]) > 0:
                    db_bootstrap = [
                        t
                        for t in templates[0]["result"]
                        if t.get("is_bootstrap", False)
                    ]
                    print(f"💾 Bootstrap templates in database: {len(db_bootstrap)}")

                    if len(bootstrap_files) != len(db_bootstrap):
                        print(
                            f"\n⚠️  MISMATCH: {len(bootstrap_files)} files vs {len(db_bootstrap)} in DB"
                        )
                        print("   Some templates may not be registered!")
                    else:
                        print(
                            f"\n✅ All {len(bootstrap_files)} bootstrap templates are registered!"
                        )

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
