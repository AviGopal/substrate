#!/usr/bin/env python3
"""Test v2 template registration"""

import json
import httpx
import sys


def test_register_template():
    """Test registering a template using v2 endpoint"""

    # Load the test template
    with open("test-template-simple.json", "r") as f:
        template_data = json.load(f)

    # Build v2 request
    request_data = {
        "name": template_data.get("name"),
        "category": template_data.get("category", "feature"),
        "description": template_data.get("description"),
        "tasks": template_data.get("tasks", []),
        "variables": template_data.get("variables", {}),
        "context_requirements": template_data.get("contextRequirements", []),
    }

    print("=" * 60)
    print("V2 Template Registration Test")
    print("=" * 60)
    print(f"\nTemplate Name: {request_data['name']}")
    print(f"Category: {request_data['category']}")
    print(f"Tasks: {len(request_data['tasks'])}")
    print(f"Variables: {len(request_data['variables'])}")

    # Make request to backend
    api_url = "http://localhost:8080"

    print(f"\nRegistering template to: {api_url}/v2/activities/templates")
    print("\nRequest payload:")
    print(json.dumps(request_data, indent=2))

    with httpx.Client(timeout=30.0) as client:
        try:
            response = client.post(
                f"{api_url}/v2/activities/templates",
                json=request_data,
                headers={"Content-Type": "application/json"},
            )

            print(f"\nResponse status: {response.status_code}")

            if response.status_code in [200, 201]:
                result = response.json()
                print("\n✓ Template registered successfully!")
                print(f"  Template ID: {result.get('id', 'N/A')}")
                print(f"  Name: {result.get('name', 'N/A')}")
                print(f"  Category: {result.get('category', 'N/A')}")
                print(f"  Task count: {len(result.get('tasks', []))}")

                # Verify template is retrievable
                template_id = result.get("id")
                if template_id:
                    print(f"\nVerifying template retrieval...")
                    verify_response = client.get(
                        f"{api_url}/v2/activities/templates/{template_id}",
                        timeout=10.0,
                    )
                    if verify_response.status_code == 200:
                        print("  ✓ Template verified in backend")
                        return True
                    else:
                        print(f"  ⚠ Verification failed: {verify_response.status_code}")
                        print(f"  Response: {verify_response.text}")
                        return False

            elif response.status_code == 409:
                print("\n⚠ Template already exists")
                print(response.text)
                return False

            else:
                print(f"\n✗ Registration failed: {response.status_code}")
                print(f"Response: {response.text}")
                return False

        except Exception as e:
            print(f"\n✗ Error: {e}")
            import traceback

            traceback.print_exc()
            return False


if __name__ == "__main__":
    success = test_register_template()
    sys.exit(0 if success else 1)
