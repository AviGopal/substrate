#!/usr/bin/env python3
"""
Fix Activity Registration - Proper Database Serialization

This script properly registers activity templates by using the existing
metabob-cli register-template command for each bootstrap template.

This ensures:
1. Proper JSON serialization (task_steps arrays populated)
2. Uses existing infrastructure (no custom SQL)
3. Follows the reuse principle
"""

import json
import subprocess
import sys
from pathlib import Path


def main():
    print("=" * 70)
    print(" Fix Activity Registration - Use Existing Infrastructure")
    print("=" * 70)
    print()

    # Find bootstrap templates
    bootstrap_dir = Path("repos/metabob-proto/activities/bootstrap")

    if not bootstrap_dir.exists():
        print(f"❌ Bootstrap directory not found: {bootstrap_dir}")
        return 1

    templates = list(bootstrap_dir.glob("*.json"))

    if not templates:
        print(f"❌ No templates found in {bootstrap_dir}")
        return 1

    print(f"📂 Found {len(templates)} bootstrap templates:")
    for t in templates:
        print(f"   - {t.name}")
    print()

    # Register each template using metabob-cli
    print("🔄 Registering templates using metabob-cli register-template...")
    print()

    success_count = 0
    skip_count = 0
    error_count = 0

    for template_path in templates:
        template_name = template_path.stem

        # Read template to get variant_id
        with open(template_path) as f:
            template_data = json.load(f)
            variant_id = template_data.get("variant_id", "unknown")

        print(f"📝 Registering: {template_name} ({variant_id})")

        try:
            result = subprocess.run(
                [
                    "python",
                    "-m",
                    "metabob_cli",
                    "register-template",
                    str(template_path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                print(f"   ✅ Success: {variant_id}")
                success_count += 1
            elif "already exists" in result.stderr.lower():
                print(f"   ⏭️  Already registered: {variant_id}")
                skip_count += 1
            else:
                print(f"   ❌ Error: {result.stderr[:100]}")
                error_count += 1

        except subprocess.TimeoutExpired:
            print(f"   ❌ Timeout registering {template_name}")
            error_count += 1
        except Exception as e:
            print(f"   ❌ Error: {e}")
            error_count += 1

        print()

    # Summary
    print("=" * 70)
    print(" Registration Summary")
    print("=" * 70)
    print(f"  ✅ Successfully registered: {success_count}")
    print(f"  ⏭️  Already existed: {skip_count}")
    print(f"  ❌ Errors: {error_count}")
    print(f"  📊 Total templates: {len(templates)}")
    print()

    if error_count > 0:
        print("⚠️  Some templates failed to register. Check errors above.")
        return 1
    else:
        print("✅ All templates processed successfully!")
        print()
        print("Next steps:")
        print("  1. Verify activities have task_steps: ./scripts/verify-activities.py")
        print("  2. Test execution: opencode (use activity tool)")
        print("  3. Test evolution: opencode activity evolve <template-id>")
        return 0


if __name__ == "__main__":
    sys.exit(main())
