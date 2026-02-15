#!/usr/bin/env python3
"""
Register bootstrap activity templates directly via SurrealDB HTTP API.
This bypasses the backend API and auth system.
"""

import json
import requests
from pathlib import Path

# Configuration
SURREAL_URL = "http://localhost:8000/sql"
SURREAL_USER = "root"
SURREAL_PASS = "root"
BOOTSTRAP_DIR = (
    Path(__file__).parent.parent / "repos/metabob-proto/activities/bootstrap"
)


def register_template(template_path: Path) -> bool:
    """Register a single template."""
    try:
        # Load template JSON
        with open(template_path) as f:
            template_data = json.load(f)

        # Prepare SurrealDB query
        # Use string substitution to avoid JSON escaping issues
        template_json = json.dumps(template_data)

        sql = f"""
        USE NS metabob DB production;
        CREATE activity_templates CONTENT {template_json};
        """

        # Execute query (SurrealDB HTTP API expects application/surql)
        sql_with_use = f"USE NS metabob DB production; CREATE activity_templates CONTENT {template_json};"
        response = requests.post(
            SURREAL_URL,
            auth=(SURREAL_USER, SURREAL_PASS),
            headers={"Content-Type": "application/surql", "Accept": "application/json"},
            data=sql_with_use,
            timeout=10,
        )

        # Check response
        if response.status_code == 200:
            result = response.json()
            # Check if operation succeeded
            if result and len(result) > 0:
                op_result = result[0] if isinstance(result[0], dict) else result
                if isinstance(op_result, dict) and op_result.get("status") == "OK":
                    return True
                elif isinstance(op_result, list) and len(op_result) > 1:
                    # Second element contains the CREATE result
                    return True

        print(f"  Response: {response.status_code} - {response.text[:200]}")
        return False

    except Exception as e:
        print(f"  Error: {e}")
        return False


def main():
    # Find all template files
    templates = sorted(BOOTSTRAP_DIR.glob("*.json"))

    print(f"Found {len(templates)} templates to register\n")

    success_count = 0
    for template_path in templates:
        print(f"Registering {template_path.name}...", end=" ")
        if register_template(template_path):
            print("✓")
            success_count += 1
        else:
            print("✗")

    print(f"\n✅ Registered {success_count}/{len(templates)} templates")

    # Verify by querying the database
    print("\nVerifying registration...")
    response = requests.post(
        SURREAL_URL,
        auth=(SURREAL_USER, SURREAL_PASS),
        headers={"Content-Type": "text/plain", "Accept": "application/json"},
        data="USE NS metabob DB metabob; SELECT count() FROM activities GROUP ALL;",
        timeout=5,
    )

    if response.status_code == 200:
        result = response.json()
        if result and len(result) > 1:
            count_result = result[1]
            if isinstance(count_result, list) and len(count_result) > 0:
                count = count_result[0].get("count", 0)
                print(f"✓ Total templates in database: {count}")


if __name__ == "__main__":
    main()
