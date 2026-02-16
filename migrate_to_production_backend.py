#!/usr/bin/env python3
"""
Migrate local development environment to use production backend.

This script updates all configuration files to point to the production
backend instead of localhost, using the devbob project API key.

Usage:
    python migrate_to_production_backend.py --url <backend_url> --api-key <api_key> [--dry-run]

Example:
    python migrate_to_production_backend.py \\
        --url "https://api.metabob.com" \\
        --api-key "mb_prod_xxxxxxxxxxxx" \\
        --dry-run
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple


class ProductionBackendMigration:
    """Handles migration to production backend configuration."""

    def __init__(self, base_url: str, api_key: str, dry_run: bool = False):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.dry_run = dry_run
        self.root = Path(__file__).parent
        self.changes: List[Tuple[Path, str, str]] = []

    def find_config_files(self) -> List[Path]:
        """Find all .metabob/config.json files."""
        config_files = []

        # Known locations
        locations = [
            "repos/metabob-cli/.metabob/config.json",
            "repos/metabob-opencode/.metabob/config.json",
            "repos/metabob-opencode/packages/opencode/.metabob/config.json",
        ]

        for location in locations:
            path = self.root / location
            if path.exists():
                config_files.append(path)
                print(f"✓ Found config: {path.relative_to(self.root)}")
            else:
                print(f"⚠ Missing config: {location}")

        return config_files

    def update_config_file(self, config_path: Path) -> bool:
        """Update a single config file."""
        try:
            # Read current config
            with open(config_path, "r") as f:
                config = json.load(f)

            # Store original for comparison
            original_config = json.dumps(config, indent=2, sort_keys=True)

            # Update fields
            old_url = config.get("base_url", "unknown")
            old_key = config.get("api_key", "unknown")

            config["base_url"] = self.base_url
            config["api_key"] = self.api_key

            # Ensure state_directory is set
            if "state_directory" not in config:
                config["state_directory"] = ".metabob"

            # New config
            new_config = json.dumps(config, indent=2, sort_keys=True)

            # Check if changes were made
            if original_config == new_config:
                print(f"  → No changes needed")
                return False

            # Record changes
            self.changes.append((config_path, old_url, self.base_url))

            print(f"  → base_url: {old_url} → {self.base_url}")
            print(f"  → api_key: {old_key[:20]}... → {self.api_key[:20]}...")

            # Write if not dry run
            if not self.dry_run:
                with open(config_path, "w") as f:
                    json.dump(config, f, indent=2)
                    f.write("\n")
                print(f"  ✓ Updated")
            else:
                print(f"  [DRY RUN] Would update")

            return True

        except Exception as e:
            print(f"  ✗ Error: {e}")
            return False

    def update_opencode_config(self) -> bool:
        """Update opencode.json MCP configuration."""
        opencode_config = (
            self.root / "repos/metabob-opencode/packages/opencode/opencode.json"
        )

        if not opencode_config.exists():
            print(
                f"⚠ OpenCode config not found: {opencode_config.relative_to(self.root)}"
            )
            return False

        try:
            with open(opencode_config, "r") as f:
                config = json.load(f)

            original = json.dumps(config, indent=2, sort_keys=True)

            # Update MCP metabob configuration
            if "mcp" not in config:
                config["mcp"] = {}

            if "metabob" not in config["mcp"]:
                config["metabob"] = {}

            # Ensure MCP metabob is enabled and using local CLI
            config["mcp"]["metabob"] = {
                "type": "local",
                "command": ["metabob", "mcp", "--transport", "stdio"],
                "enabled": True,
            }

            # Ensure metabob analysis is configured
            if "metabob" not in config:
                config["metabob"] = {}

            metabob_config = config["metabob"]
            metabob_config.setdefault("enabled", True)
            metabob_config.setdefault("max_issues", 5)
            metabob_config.setdefault("min_severity", "MEDIUM")
            metabob_config.setdefault("inject_annotations", True)
            metabob_config.setdefault("auto_impact_analysis", True)
            metabob_config.setdefault("auto_inject", True)

            new = json.dumps(config, indent=2, sort_keys=True)

            if original != new:
                print(
                    f"\n✓ Found OpenCode config: {opencode_config.relative_to(self.root)}"
                )
                print(f"  → Ensured MCP metabob is enabled")
                print(f"  → Ensured metabob analysis is configured")

                if not self.dry_run:
                    with open(opencode_config, "w") as f:
                        json.dump(config, f, indent=2)
                        f.write("\n")
                    print(f"  ✓ Updated")
                else:
                    print(f"  [DRY RUN] Would update")

                return True
            else:
                print(f"  → No changes needed")
                return False

        except Exception as e:
            print(f"  ✗ Error: {e}")
            return False

    def verify_backend_connection(self) -> bool:
        """Verify the backend is accessible."""
        import urllib.request
        import urllib.error

        health_url = f"{self.base_url}/health"

        print(f"\n🔍 Verifying backend connection...")
        print(f"   URL: {health_url}")

        try:
            req = urllib.request.Request(health_url)
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    print(f"   ✓ Backend is healthy (HTTP 200)")
                    return True
                else:
                    print(f"   ⚠ Backend returned HTTP {response.status}")
                    return False

        except urllib.error.URLError as e:
            print(f"   ✗ Failed to connect: {e.reason}")
            return False
        except Exception as e:
            print(f"   ✗ Error: {e}")
            return False

    def test_authentication(self) -> bool:
        """Test API key authentication by creating a session."""
        import urllib.request
        import urllib.error

        session_url = f"{self.base_url}/v2/session"

        print(f"\n🔑 Testing API key authentication...")
        print(f"   URL: {session_url}")

        try:
            data = json.dumps({"name": "migration-test"}).encode("utf-8")
            req = urllib.request.Request(
                session_url,
                data=data,
                headers={
                    "Content-Type": "application/json",
                    "X-API-Key": self.api_key,
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    result = json.loads(response.read())
                    session_id = result.get("session_id", "unknown")
                    org_id = result.get("org_id", "unknown")
                    print(f"   ✓ Authentication successful!")
                    print(f"   Session ID: {session_id}")
                    print(f"   Organization: {org_id}")
                    return True
                else:
                    print(f"   ✗ Authentication failed (HTTP {response.status})")
                    return False

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            print(f"   ✗ HTTP {e.code}: {error_body}")
            return False
        except Exception as e:
            print(f"   ✗ Error: {e}")
            return False

    def run(self) -> bool:
        """Execute the migration."""
        print("=" * 70)
        print("Production Backend Migration")
        print("=" * 70)
        print(f"\nTarget Backend: {self.base_url}")
        print(f"API Key: {self.api_key[:30]}...")
        print(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")
        print()

        # Step 1: Verify backend
        if not self.verify_backend_connection():
            print("\n❌ Backend verification failed. Aborting migration.")
            return False

        # Step 2: Test authentication
        if not self.test_authentication():
            print("\n❌ Authentication test failed. Aborting migration.")
            return False

        # Step 3: Find and update config files
        print("\n" + "=" * 70)
        print("Updating Configuration Files")
        print("=" * 70)
        print()

        config_files = self.find_config_files()

        if not config_files:
            print("\n❌ No config files found. Aborting migration.")
            return False

        updated = 0
        for config_file in config_files:
            print(f"\n📝 {config_file.relative_to(self.root)}")
            if self.update_config_file(config_file):
                updated += 1

        # Step 4: Update OpenCode config
        print("\n" + "=" * 70)
        print("Updating OpenCode Configuration")
        print("=" * 70)
        print()

        self.update_opencode_config()

        # Summary
        print("\n" + "=" * 70)
        print("Migration Summary")
        print("=" * 70)
        print(f"\nConfig files found: {len(config_files)}")
        print(f"Config files updated: {updated}")
        print()

        if self.changes:
            print("Changes made:")
            for path, old_url, new_url in self.changes:
                print(f"  • {path.relative_to(self.root)}")
                print(f"    {old_url} → {new_url}")
            print()

        if self.dry_run:
            print("⚠️  DRY RUN - No files were modified")
            print("   Remove --dry-run to apply changes")
        else:
            print("✅ Migration complete!")
            print()
            print("Next steps:")
            print("  1. Verify MCP server: metabob-cli mcp --transport stdio")
            print("  2. Test from OpenCode: Use metabob tools in a session")
            print("  3. Check activity execution: search_activities + activity")

        return True


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Migrate local dev environment to production backend"
    )
    parser.add_argument(
        "--url",
        required=True,
        help="Production backend URL (e.g., https://api.metabob.com)",
    )
    parser.add_argument(
        "--api-key", required=True, help="Production API key for devbob project"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be changed without modifying files",
    )

    args = parser.parse_args()

    # Validate inputs
    if not args.url.startswith(("http://", "https://")):
        print("❌ Error: URL must start with http:// or https://")
        sys.exit(1)

    if not args.api_key.startswith("mb_"):
        print(
            "⚠️  Warning: API key doesn't start with 'mb_' - are you sure this is correct?"
        )
        response = input("Continue anyway? [y/N]: ")
        if response.lower() != "y":
            sys.exit(1)

    # Run migration
    migration = ProductionBackendMigration(args.url, args.api_key, args.dry_run)

    try:
        success = migration.run()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration cancelled by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\n❌ Migration failed: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
