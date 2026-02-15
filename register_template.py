#!/usr/bin/env python3
"""
Register create-activity-template with backend.

Converts OpenCode template JSON format to Metabob backend API format
and POSTs to /v2/activities/templates endpoint.
"""

import json
import sys
import requests
from pathlib import Path


def load_opencode_template(template_path: str) -> dict:
    """Load OpenCode template JSON."""
    with open(template_path, "r") as f:
        return json.load(f)


def convert_task_to_proto_format(task: dict) -> dict:
    """Convert OpenCode task format to ProtoTaskStep format.

    OpenCode format:
    {
      "id": "task-id",
      "subagent": "general",
      "description": "...",
      "dependencies": [],
      "impulseReferences": ["ref1"],
      "prompt": {
        "template": "...",
        "maxTokens": 6000,
        "compressionStrategy": "filter",
        "variables": [{"name": "var", "type": "string", ...}]
      },
      "validation": {
        "check": "none",
        "requiredFiles": [],
        "requiredPatterns": [],
        "forbiddenPatterns": [],
        "commands": []
      },
      "retry": {
        "max_attempts": 2,
        "strategy": "simple"
      }
    }

    ProtoTaskStep format:
    {
      "id": "task-id",
      "subagent": "general",
      "description": "...",
      "dependencies": [],
      "prompt": {
        "template": "...",
        "max_tokens": 6000,
        "compression_strategy": "filter",
        "variables": ["var1", "var2"]  # Just names
      },
      "validation": {
        "required_files": [],
        "required_patterns": [],
        "forbidden_patterns": [],
        "commands": [{"command": "...", "expected_exit_code": 0, "timeout_seconds": 30}]
      },
      "retry": {
        "max_attempts": 2,
        "strategy": "simple",
        "fallback_prompt": ""
      },
      "impulse_refs": [
        {"impulse_id": "ref1", "priority": "MEDIUM", "required": false}
      ],
      "metrics": {
        "success_rate": 0.0,
        "avg_tokens": 0,
        "avg_duration": 0,
        "common_failures": []
      }
    }
    """

    # Convert prompt
    prompt_in = task.get("prompt", {})
    prompt_variables = []
    if "variables" in prompt_in:
        # Extract just variable names from OpenCode format
        prompt_variables = [v.get("name") for v in prompt_in.get("variables", [])]

    prompt_out = {
        "template": prompt_in.get("template", ""),
        "max_tokens": prompt_in.get("maxTokens", 8000),
        "compression_strategy": prompt_in.get("compressionStrategy", "filter"),
        "variables": prompt_variables,
    }

    # Convert validation
    validation_in = task.get("validation", {})
    validation_commands = []
    for cmd in validation_in.get("commands", []):
        if isinstance(cmd, dict):
            validation_commands.append(
                {
                    "command": cmd.get("command", ""),
                    "expected_exit_code": cmd.get("expected_exit_code", 0),
                    "timeout_seconds": cmd.get("timeout_seconds", 30),
                }
            )

    validation_out = {
        "required_files": validation_in.get("requiredFiles", []),
        "required_patterns": validation_in.get("requiredPatterns", []),
        "forbidden_patterns": validation_in.get("forbiddenPatterns", []),
        "commands": validation_commands,
    }

    # Convert retry
    retry_in = task.get("retry", {})
    retry_out = {
        "max_attempts": retry_in.get("max_attempts", 3),
        "strategy": retry_in.get("strategy", "simple"),
        "fallback_prompt": retry_in.get("fallback_prompt", ""),
    }

    # Convert impulseReferences to impulse_refs
    impulse_refs = []
    for ref in task.get("impulseReferences", []):
        impulse_refs.append(
            {"impulse_id": ref, "priority": "MEDIUM", "required": False}
        )

    # Build ProtoTaskStep
    return {
        "id": task.get("id"),
        "subagent": task.get("subagent"),
        "description": task.get("description", ""),
        "dependencies": task.get("dependencies", []),
        "prompt": prompt_out,
        "validation": validation_out,
        "retry": retry_out,
        "impulse_refs": impulse_refs,
        "metrics": {
            "success_rate": 0.0,
            "avg_tokens": 0,
            "avg_duration": 0,
            "common_failures": [],
        },
        "guidance": [],
        "expected_actions": [],
    }


def convert_context_requirements(requirements: list) -> list:
    """Convert OpenCode contextRequirements to backend format.

    OpenCode format:
    {
      "key": "highQualityExamples",
      "hint": "...",
      "impulseTypes": ["toolOutput", "memo"],
      "required": true,
      "budgetRange": [5000, 8000]
    }

    Backend format (simplified):
    {
      "type": "highQualityExamples",
      "required": true
    }
    """
    converted = []
    for req in requirements:
        converted.append(
            {"type": req.get("key", ""), "required": req.get("required", True)}
        )
    return converted


def convert_to_backend_format(opencode_template: dict) -> dict:
    """Convert full OpenCode template to backend TemplateCreateRequest format."""

    # Convert tasks
    task_steps = []
    for task in opencode_template.get("tasks", []):
        task_steps.append(convert_task_to_proto_format(task))

    # Convert context requirements
    context_requirements = convert_context_requirements(
        opencode_template.get("contextRequirements", [])
    )

    # Build TemplateCreateRequest
    return {
        "name": opencode_template.get("name", ""),
        "description": opencode_template.get("description", ""),
        "category": opencode_template.get("category", "infrastructure"),
        "variables": {},  # OpenCode doesn't have top-level variables (they're in tasks)
        "context_requirements": context_requirements,
        "task_steps": task_steps,
        "parent_id": None,
    }


def get_session_token() -> str:
    """Load session token from .metabob/state."""
    state_file = Path.home() / ".local/share/opencode/.metabob/state"
    if not state_file.exists():
        # Try project-local path
        state_file = Path(".metabob/state")

    if not state_file.exists():
        raise FileNotFoundError(
            "Session state file not found. Run: python3 scripts/create_session_state.py"
        )

    with open(state_file, "r") as f:
        state = json.load(f)

    return state.get("session_metadata", {}).get("session_token", "")


def register_template(
    backend_template: dict, base_url: str, session_token: str
) -> dict:
    """POST template to backend /v2/activities/templates endpoint."""

    url = f"{base_url}/v2/activities/templates"
    headers = {
        "Authorization": f"Bearer {session_token}",
        "Content-Type": "application/json",
    }

    print(f"POST {url}")
    print(f"Payload: {json.dumps(backend_template, indent=2)[:500]}...")

    response = requests.post(url, json=backend_template, headers=headers)

    if response.status_code == 200:
        print(f"✅ Template registered successfully")
        return response.json()
    else:
        print(f"❌ Registration failed: {response.status_code}")
        print(f"Response: {response.text}")
        response.raise_for_status()


def main():
    # Paths
    template_path = "repos/metabob-opencode/packages/opencode/templates/built-in/create-activity-template.json"
    base_url = "http://localhost:8080"

    print("=" * 60)
    print("Register create-activity-template with Metabob backend")
    print("=" * 60)

    # Load OpenCode template
    print(f"\n[1/4] Loading OpenCode template: {template_path}")
    opencode_template = load_opencode_template(template_path)
    print(f"  ✓ Template: {opencode_template['name']}")
    print(f"  ✓ Tasks: {len(opencode_template['tasks'])}")

    # Convert to backend format
    print(f"\n[2/4] Converting to backend format (ProtoTaskStep)")
    backend_template = convert_to_backend_format(opencode_template)
    print(f"  ✓ Converted {len(backend_template['task_steps'])} tasks")

    # Get session token
    print(f"\n[3/4] Loading session token")
    try:
        session_token = get_session_token()
        print(f"  ✓ Token loaded: {session_token[:20]}...")
    except FileNotFoundError as e:
        print(f"  ❌ {e}")
        sys.exit(1)

    # Register with backend
    print(f"\n[4/4] Registering with backend")
    try:
        result = register_template(backend_template, base_url, session_token)
        print(f"\n{'=' * 60}")
        print(f"✅ SUCCESS")
        print(f"{'=' * 60}")
        print(f"Template ID: {result.get('variant_id', 'N/A')}")
        print(f"Activity ID: {result.get('activity_id', 'N/A')}")
        print(f"\nVerify with:")
        print(f"  search_activities({{ query: 'create activity' }})")
    except Exception as e:
        print(f"\n{'=' * 60}")
        print(f"❌ FAILED")
        print(f"{'=' * 60}")
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
