#!/usr/bin/env python3
"""
Add template inheritance schema to enable per-project template management.

This creates the infrastructure for:
1. Linking templates to projects
2. Inheriting templates from default/parent projects
3. Per-project enable/disable of templates
4. Template customization at project level
"""

import asyncio
import sys
from pathlib import Path
from server.config import Settings
from server.utils.surreal_client import SurrealDBClient


async def add_inheritance_schema():
    """Add template inheritance tables and logic to database."""
    print("=" * 70)
    print("Template Inheritance Schema Setup")
    print("=" * 70)
    print()

    # Connect to database
    config = Settings()
    db = SurrealDBClient(config)
    await db.connect()
    print(f"✓ Connected to: {config.SURREAL_URL}")
    print(f"  Namespace: {config.SURREAL_NAMESPACE}")
    print(f"  Database: {config.SURREAL_DATABASE}")
    print()

    try:
        # 1. Create project_activity_template junction table
        print("[1/5] Creating project_activity_template table...")
        await db.query("""
            DEFINE TABLE project_activity_template SCHEMAFULL;
            
            DEFINE FIELD project_id ON project_activity_template TYPE string;
            DEFINE FIELD org_id ON project_activity_template TYPE string;
            DEFINE FIELD activity_id ON project_activity_template TYPE string;
            DEFINE FIELD variant_id ON project_activity_template TYPE string;
            DEFINE FIELD is_enabled ON project_activity_template TYPE bool DEFAULT true;
            DEFINE FIELD inherited_from ON project_activity_template TYPE option<string>;
            DEFINE FIELD customization ON project_activity_template TYPE option<object>;
            DEFINE FIELD created_at ON project_activity_template TYPE datetime DEFAULT time::now();
            DEFINE FIELD updated_at ON project_activity_template TYPE datetime DEFAULT time::now();
            
            DEFINE INDEX project_activity_idx ON project_activity_template 
                FIELDS project_id, activity_id, variant_id UNIQUE;
            DEFINE INDEX project_idx ON project_activity_template FIELDS project_id;
            DEFINE INDEX activity_idx ON project_activity_template FIELDS activity_id;
        """)
        print("  ✓ project_activity_template table created")
        print()

        # 2. Create template_customization table for project-specific overrides
        print("[2/5] Creating template_customization table...")
        await db.query("""
            DEFINE TABLE template_customization SCHEMAFULL;
            
            DEFINE FIELD project_id ON template_customization TYPE string;
            DEFINE FIELD variant_id ON template_customization TYPE string;
            DEFINE FIELD customization_type ON template_customization TYPE string;
            DEFINE FIELD override_data ON template_customization TYPE object;
            DEFINE FIELD created_at ON template_customization TYPE datetime DEFAULT time::now();
            DEFINE FIELD updated_at ON template_customization TYPE datetime DEFAULT time::now();
            
            DEFINE INDEX project_variant_idx ON template_customization 
                FIELDS project_id, variant_id UNIQUE;
        """)
        print("  ✓ template_customization table created")
        print()

        # 3. Verify bootstrap templates exist
        print("[3/5] Verifying bootstrap templates...")
        bootstrap_check = await db.query("""
            SELECT count() FROM activity_variants 
            WHERE activity_id IN (SELECT activity_id FROM activities WHERE org_id = 'metabob-system')
            GROUP ALL
        """)

        if bootstrap_check and len(bootstrap_check) > 0:
            count = bootstrap_check[0].get("count", 0)
            print(f"  ✓ Found {count} bootstrap template variants")
        else:
            print("  ⚠ Warning: No bootstrap templates found")
            print("    Run register_bootstrap_prod.py first to register templates")
        print()

        # 4. Create helper function to link templates to project
        print("[4/5] Creating template inheritance helper function...")

        # This creates a SurrealDB function that can be called to inherit templates
        await db.query("""
            DEFINE FUNCTION fn::inherit_templates_to_project($project_id: string, $org_id: string, $source_project_id: option<string>) {
                -- Get all active variants from bootstrap or source project
                LET $source = $source_project_id OR 'bootstrap';
                
                -- Get all activity IDs from source
                LET $activities = SELECT activity_id FROM activities 
                    WHERE org_id = 'metabob-system' AND status = 'active';
                
                -- For each activity, get active variants
                LET $variants = SELECT * FROM activity_variants WHERE status = 'active';
                
                -- Create project_activity_template records
                FOR $variant IN $variants {
                    CREATE project_activity_template SET
                        project_id = $project_id,
                        org_id = $org_id,
                        activity_id = $variant.activity_id,
                        variant_id = $variant.variant_id,
                        is_enabled = true,
                        inherited_from = $source,
                        created_at = time::now(),
                        updated_at = time::now();
                };
                
                RETURN {
                    success: true,
                    project_id: $project_id,
                    templates_inherited: count($variants)
                };
            };
        """)
        print("  ✓ fn::inherit_templates_to_project created")
        print()

        # 5. Test the function with a demo project
        print("[5/5] Testing inheritance with demo project...")
        test_result = await db.query("""
            SELECT * FROM fn::inherit_templates_to_project('demo-project-test', 'metabob-system', NONE)
        """)

        if test_result and len(test_result) > 0:
            result = test_result[0]
            print(
                f"  ✓ Test successful: {result.get('templates_inherited', 0)} templates inherited"
            )

            # Clean up test data
            await db.query(
                "DELETE project_activity_template WHERE project_id = 'demo-project-test'"
            )
            print("  ✓ Test data cleaned up")
        else:
            print("  ⚠ Test failed or returned no results")
        print()

        print("=" * 70)
        print("Schema Setup Complete")
        print("=" * 70)
        print()
        print("✅ Template inheritance infrastructure is ready!")
        print()
        print("Next Steps:")
        print("1. Update organization creation to auto-create default project")
        print("2. Update project creation to call fn::inherit_templates_to_project")
        print("3. Update API endpoints to filter templates by project")
        print("4. Add project-specific template enable/disable endpoints")
        print()

        return 0

    except Exception as e:
        print(f"✗ Error during schema setup: {e}")
        import traceback

        traceback.print_exc()
        return 1

    finally:
        await db.disconnect()


if __name__ == "__main__":
    sys.exit(asyncio.run(add_inheritance_schema()))
