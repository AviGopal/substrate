#!/usr/bin/env python3
"""
Database Migration Runner for SurrealDB

Applies versioned migrations from migrations/versions/ directory.
Tracks applied migrations in schema_version table.

Usage:
    # Check current schema version
    python scripts/migrate.py --status

    # Apply all pending migrations
    python scripts/migrate.py --apply

    # Apply up to specific version
    python scripts/migrate.py --apply --target-version 5

    # Rollback to specific version
    python scripts/migrate.py --rollback --target-version 3

    # Dry run (show what would be executed)
    python scripts/migrate.py --apply --dry-run

    # Validate current schema
    python scripts/migrate.py --validate

Environment Variables:
    SURREAL_HOST: SurrealDB host (default: localhost)
    SURREAL_PORT: SurrealDB port (default: 8000)
    SURREAL_USER: Database user (default: root)
    SURREAL_PASS: Database password (default: root)
    SURREAL_NAMESPACE: Database namespace (default: metabob)
    SURREAL_DATABASE: Database name (default: devbob)
"""

import argparse
import hashlib
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

try:
    import httpx
except ImportError:
    print(
        "Error: httpx not installed. Install with: pip install httpx", file=sys.stderr
    )
    sys.exit(1)


@dataclass
class Migration:
    """Represents a migration file."""

    version: int
    filename: str
    filepath: Path
    description: str
    author: Optional[str] = None
    date: Optional[str] = None
    depends: Optional[str] = None

    def checksum(self) -> str:
        """Calculate SHA256 checksum of migration file."""
        content = self.filepath.read_bytes()
        return hashlib.sha256(content).hexdigest()

    def sql(self) -> str:
        """Read migration SQL content."""
        return self.filepath.read_text()


class DatabaseConnection:
    """Manages connection to SurrealDB."""

    def __init__(
        self,
        host: str = "localhost",
        port: int = 8000,
        user: str = "root",
        password: str = "root",
        namespace: str = "metabob",
        database: str = "devbob",
    ):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.namespace = namespace
        self.database = database
        self.base_url = f"http://{host}:{port}"

    def execute(self, sql: str) -> dict:
        """Execute SQL query and return result."""
        url = f"{self.base_url}/sql"

        # Prepend USE statement
        full_sql = f"USE NS {self.namespace} DB {self.database};\n{sql}"

        try:
            response = httpx.post(
                url,
                content=full_sql,
                auth=(self.user, self.password),
                headers={"Accept": "application/json", "Content-Type": "text/plain"},
                timeout=60.0,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            raise Exception(f"Database error: {e}")

    def test_connection(self) -> bool:
        """Test database connection."""
        try:
            result = self.execute("INFO FOR DB")
            return len(result) > 0 and result[0].get("status") == "OK"
        except Exception as e:
            print(f"Connection test failed: {e}", file=sys.stderr)
            return False


class MigrationRunner:
    """Manages database migrations."""

    def __init__(self, db: DatabaseConnection, migrations_dir: Path):
        self.db = db
        self.migrations_dir = migrations_dir
        self.versions_dir = migrations_dir / "versions"

    def discover_migrations(self) -> List[Migration]:
        """Discover all migration files."""
        if not self.versions_dir.exists():
            raise Exception(f"Migrations directory not found: {self.versions_dir}")

        migrations = []

        for filepath in sorted(self.versions_dir.glob("*.sql")):
            # Parse filename: NNN_description.sql
            match = re.match(r"(\d{3})_(.+)\.sql$", filepath.name)
            if not match:
                print(
                    f"Warning: Skipping invalid migration filename: {filepath.name}",
                    file=sys.stderr,
                )
                continue

            version = int(match.group(1))
            description = match.group(2).replace("_", " ")

            # Parse migration header
            content = filepath.read_text()
            author = self._extract_header(content, "Author")
            date = self._extract_header(content, "Date")
            depends = self._extract_header(content, "Depends")

            migrations.append(
                Migration(
                    version=version,
                    filename=filepath.name,
                    filepath=filepath,
                    description=description,
                    author=author,
                    date=date,
                    depends=depends,
                )
            )

        return migrations

    def _extract_header(self, content: str, field: str) -> Optional[str]:
        """Extract value from migration header comment."""
        match = re.search(rf"--\s*{field}:\s*(.+)", content)
        return match.group(1).strip() if match else None

    def get_current_version(self) -> Optional[int]:
        """Get current schema version from database."""
        try:
            result = self.db.execute("""
                SELECT * FROM schema_version 
                WHERE success = true 
                ORDER BY version DESC 
                LIMIT 1
            """)

            # Result is array: [USE result, SELECT result]
            if result and len(result) > 1:
                select_result = result[1]
                if select_result.get("status") == "OK":
                    records = select_result.get("result", [])
                    if records:
                        return records[0].get("version")
            return None
        except Exception as e:
            # Table might not exist yet
            return None

    def get_applied_migrations(self) -> List[int]:
        """Get list of applied migration versions."""
        try:
            result = self.db.execute("""
                SELECT version FROM schema_version 
                WHERE success = true 
                ORDER BY version
            """)

            # Result is array: [USE result, SELECT result]
            if result and len(result) > 1:
                select_result = result[1]
                if select_result.get("status") == "OK":
                    records = select_result.get("result", [])
                    return [r["version"] for r in records]
            return []
        except Exception:
            return []

    def apply_migration(self, migration: Migration, dry_run: bool = False) -> bool:
        """Apply a single migration."""
        print(f"  [{migration.version:03d}] {migration.description}")

        if dry_run:
            print(
                f"       DRY RUN - would execute {len(migration.sql().splitlines())} SQL statements"
            )
            return True

        start_time = time.time()

        try:
            # Execute migration SQL
            result = self.db.execute(migration.sql())

            # Check for errors
            errors = []
            for stmt_result in result:
                if stmt_result.get("status") != "OK":
                    errors.append(stmt_result.get("result", "Unknown error"))

            if errors:
                error_msg = "; ".join(str(e) for e in errors)
                print(f"       ✗ FAILED: {error_msg}", file=sys.stderr)

                # Try to record failure in schema_version
                try:
                    self.db.execute(f"""
                        CREATE schema_version CONTENT {{
                            version: {migration.version},
                            applied_at: time::now(),
                            applied_by: 'migration-runner',
                            description: '{migration.description}',
                            migration_file: '{migration.filename}',
                            checksum: '{migration.checksum()}',
                            duration_ms: {int((time.time() - start_time) * 1000)},
                            success: false,
                            error_message: '{error_msg}'
                        }};
                    """)
                except Exception:
                    pass

                return False

            duration_ms = int((time.time() - start_time) * 1000)
            print(f"       ✓ Applied successfully ({duration_ms}ms)")
            return True

        except Exception as e:
            print(f"       ✗ FAILED: {e}", file=sys.stderr)

            # Try to record failure
            try:
                duration_ms = int((time.time() - start_time) * 1000)
                self.db.execute(f"""
                    CREATE schema_version CONTENT {{
                        version: {migration.version},
                        applied_at: time::now(),
                        applied_by: 'migration-runner',
                        description: '{migration.description}',
                        migration_file: '{migration.filename}',
                        checksum: '{migration.checksum()}',
                        duration_ms: {duration_ms},
                        success: false,
                        error_message: '{str(e).replace("'", "''")}'
                    }};
                """)
            except Exception:
                pass

            return False

    def apply_pending_migrations(
        self, target_version: Optional[int] = None, dry_run: bool = False
    ):
        """Apply all pending migrations up to target version."""
        migrations = self.discover_migrations()
        applied = self.get_applied_migrations()
        current = self.get_current_version()

        print(
            f"\nCurrent schema version: {current if current is not None else 'not initialized'}"
        )
        print(f"Available migrations: {len(migrations)}")
        print(f"Applied migrations: {len(applied)}")

        # Filter pending migrations
        pending = [m for m in migrations if m.version not in applied]

        if target_version is not None:
            pending = [m for m in pending if m.version <= target_version]

        if not pending:
            print("\n✓ No pending migrations to apply")
            return True

        print(f"\nPending migrations: {len(pending)}")
        if dry_run:
            print("DRY RUN MODE - No changes will be made\n")
        else:
            print()

        # Apply migrations in order
        success_count = 0
        for migration in pending:
            if self.apply_migration(migration, dry_run):
                success_count += 1
            else:
                print(
                    f"\n✗ Migration {migration.version} failed - stopping",
                    file=sys.stderr,
                )
                return False

        new_version = pending[-1].version if pending else current
        print(f"\n✓ Successfully applied {success_count}/{len(pending)} migrations")
        print(f"  New schema version: {new_version}")
        return True

    def rollback_to_version(self, target_version: int, dry_run: bool = False):
        """Rollback to specific version (not implemented - destructive operation)."""
        current = self.get_current_version()

        if current is None:
            print(
                "Error: Cannot rollback - schema_version table not initialized",
                file=sys.stderr,
            )
            return False

        if target_version >= current:
            print(
                f"Error: Target version {target_version} >= current version {current}",
                file=sys.stderr,
            )
            return False

        print(f"\n⚠️  Rollback from version {current} to {target_version}")
        print("⚠️  WARNING: Rollback is a destructive operation!")
        print("⚠️  This will NOT automatically undo data changes.")
        print("⚠️  You may need to manually restore data from backups.")

        if not dry_run:
            response = input("\nProceed with rollback? (yes/no): ")
            if response.lower() != "yes":
                print("Rollback cancelled")
                return False

        # For now, rollback is not fully implemented
        # Would require explicit rollback SQL for each migration
        print("\n✗ Rollback not yet implemented", file=sys.stderr)
        print(
            "  Rollback requires explicit rollback SQL for each migration",
            file=sys.stderr,
        )
        print("  Consider manual rollback or restore from backup", file=sys.stderr)
        return False

    def validate_schema(self):
        """Validate current schema against migrations."""
        print("\n Validating schema...")

        migrations = self.discover_migrations()
        applied = self.get_applied_migrations()
        current = self.get_current_version()

        if current is None:
            print(
                "✗ Schema not initialized - no schema_version table found",
                file=sys.stderr,
            )
            return False

        # Check for missing migrations
        expected_versions = set(range(0, current + 1))
        applied_set = set(applied)
        missing = expected_versions - applied_set

        if missing:
            print(f"✗ Missing migrations: {sorted(missing)}", file=sys.stderr)
            return False

        # Check for extra migrations
        extra = applied_set - expected_versions
        if extra:
            print(f"⚠️  Warning: Applied migrations beyond expected: {sorted(extra)}")

        print(f"✓ Schema valid - version {current}")
        print(f"  Applied migrations: {len(applied)}")
        print(f"  Available migrations: {len(migrations)}")

        return True

    def show_status(self):
        """Show current migration status."""
        print("\nDatabase Migration Status")
        print("=" * 60)

        # Connection info
        print(f"Database: {self.db.namespace}.{self.db.database}")
        print(f"Host: {self.db.host}:{self.db.port}")

        # Test connection
        if not self.db.test_connection():
            print("\n✗ Cannot connect to database", file=sys.stderr)
            return False

        print("Connection: ✓ OK")

        # Current version
        current = self.get_current_version()
        if current is None:
            print("\nSchema Status: Not initialized")
            print("  Run: python scripts/migrate.py --apply")
            return True

        print(f"\nCurrent Version: {current}")

        # Applied migrations
        applied = self.get_applied_migrations()
        print(f"Applied Migrations: {len(applied)}")

        # Available migrations
        migrations = self.discover_migrations()
        pending = [m for m in migrations if m.version not in applied]

        if pending:
            print(f"\nPending Migrations: {len(pending)}")
            for migration in pending[:5]:  # Show first 5
                print(f"  [{migration.version:03d}] {migration.description}")
            if len(pending) > 5:
                print(f"  ... and {len(pending) - 5} more")
        else:
            print("\nPending Migrations: None - schema is up to date ✓")

        return True


def main():
    parser = argparse.ArgumentParser(
        description="Database migration runner for SurrealDB",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    # Actions
    parser.add_argument("--status", action="store_true", help="Show migration status")
    parser.add_argument("--apply", action="store_true", help="Apply pending migrations")
    parser.add_argument(
        "--rollback", action="store_true", help="Rollback to target version"
    )
    parser.add_argument("--validate", action="store_true", help="Validate schema")

    # Options
    parser.add_argument(
        "--target-version", type=int, help="Target version for apply/rollback"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be executed without applying",
    )

    # Database connection
    parser.add_argument(
        "--host", default=os.getenv("SURREAL_HOST", "localhost"), help="SurrealDB host"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("SURREAL_PORT", "8000")),
        help="SurrealDB port",
    )
    parser.add_argument(
        "--user", default=os.getenv("SURREAL_USER", "root"), help="Database user"
    )
    parser.add_argument(
        "--password",
        default=os.getenv("SURREAL_PASS", "root"),
        help="Database password",
    )
    parser.add_argument(
        "--namespace",
        default=os.getenv("SURREAL_NAMESPACE", "metabob"),
        help="Database namespace",
    )
    parser.add_argument(
        "--database",
        default=os.getenv("SURREAL_DATABASE", "devbob"),
        help="Database name",
    )

    args = parser.parse_args()

    # Determine migrations directory
    script_dir = Path(__file__).parent
    migrations_dir = script_dir.parent / "migrations"

    if not migrations_dir.exists():
        print(
            f"Error: Migrations directory not found: {migrations_dir}", file=sys.stderr
        )
        sys.exit(1)

    # Create database connection
    db = DatabaseConnection(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        namespace=args.namespace,
        database=args.database,
    )

    # Create migration runner
    runner = MigrationRunner(db, migrations_dir)

    # Execute action
    try:
        if args.status or not (args.apply or args.rollback or args.validate):
            success = runner.show_status()
        elif args.apply:
            success = runner.apply_pending_migrations(args.target_version, args.dry_run)
        elif args.rollback:
            success = runner.rollback_to_version(args.target_version, args.dry_run)
        elif args.validate:
            success = runner.validate_schema()
        else:
            parser.print_help()
            sys.exit(1)

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user", file=sys.stderr)
        sys.exit(130)
    except Exception as e:
        print(f"\nError: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
