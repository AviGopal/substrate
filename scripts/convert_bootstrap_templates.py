#!/usr/bin/env python3
"""
Convert bootstrap templates from old format to v2 API format

Transformations:
1. tasks → task_steps
2. Add missing 'name' field (derive from variant_name or activity_id)
3. Convert task structure to ProtoTaskStep format
4. Ensure all required fields present

Usage:
    python convert_bootstrap_templates.py <input_dir> <output_dir>
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List


def convert_task_to_proto_step(task: Dict[str, Any], order: int) -> Dict[str, Any]:
    """Convert old task format to ProtoTaskStep format"""

    # Extract prompt configuration
    prompt_config = task.get("prompt", {})
    if isinstance(prompt_config, str):
        # Simple string prompt
        prompt = {
            "template": prompt_config,
            "max_tokens": 8000,
            "compression_strategy": "filter",
            "variables": [],
        }
    elif isinstance(prompt_config, dict):
        # Already structured
        prompt = {
            "template": prompt_config.get("template", ""),
            "max_tokens": prompt_config.get(
                "maxTokens", prompt_config.get("max_tokens", 8000)
            ),
            "compression_strategy": prompt_config.get(
                "compressionStrategy",
                prompt_config.get("compression_strategy", "filter"),
            ),
            "variables": prompt_config.get("variables", []),
        }
    else:
        prompt = {
            "template": "",
            "max_tokens": 8000,
            "compression_strategy": "filter",
            "variables": [],
        }

    # Extract validation rules
    validation = task.get("validation", {})
    if not isinstance(validation, dict):
        validation = {}

    # Build ProtoTaskStep
    proto_step = {
        "id": task.get("id", f"task-{order}"),
        "order": order,
        "subagent": task.get("subagent", "general"),
        "description": task.get("description", ""),
        "dependencies": task.get("dependencies", []),
        "prompt": prompt,
        "validation": {
            "required_files": validation.get(
                "requiredFiles", validation.get("required_files", [])
            ),
            "required_patterns": validation.get(
                "requiredPatterns", validation.get("required_patterns", [])
            ),
            "forbidden_patterns": validation.get(
                "forbiddenPatterns", validation.get("forbidden_patterns", [])
            ),
            "commands": validation.get("commands", []),
        },
        "retry": task.get("retry", {"max_attempts": 3, "strategy": "simple"}),
        "impulse_refs": [],  # Empty for now, will be populated during execution
    }

    return proto_step


def derive_template_name(template: Dict[str, Any], filename: str) -> str:
    """Derive template name from various fields"""

    # Priority: name > variant_name > activity_id > filename
    if "name" in template and template["name"]:
        return template["name"]

    if "variant_name" in template and template["variant_name"]:
        return template["variant_name"]

    if "activity_id" in template and template["activity_id"]:
        # Convert activity_id to human-readable name
        # e.g., "add-rest-endpoint" → "Add REST Endpoint"
        activity_id = template["activity_id"]
        return activity_id.replace("-", " ").title()

    # Fallback to filename
    return filename.replace("-", " ").replace("_", " ").title()


def convert_template(template: Dict[str, Any], filename: str) -> Dict[str, Any]:
    """Convert bootstrap template to v2 API format"""

    # Derive name if missing
    name = derive_template_name(template, filename)

    # Derive activity_id (priority: activity_id from template > generated from name)
    if "activity_id" in template and template["activity_id"]:
        activity_id = template["activity_id"]
    else:
        # Generate from name: "Add REST Endpoint" → "add-rest-endpoint"
        import re

        activity_id = name.lower().replace(" ", "-").replace("_", "-")
        activity_id = re.sub(r"[^a-z0-9-]", "", activity_id)
        activity_id = re.sub(r"-+", "-", activity_id).strip("-")

    # Convert tasks to task_steps
    tasks = template.get("tasks", [])
    task_steps = [convert_task_to_proto_step(task, i) for i, task in enumerate(tasks)]

    # Build v2 template
    v2_template = {
        "name": name,
        "description": template.get("description", f"Activity template: {name}"),
        "category": template.get("category", "feature"),
        "activity_id": activity_id,
        "variables": {},
        "context_requirements": [],
        "task_steps": task_steps,
    }

    # Convert variables if present
    if "variables" in template:
        variables = template["variables"]
        if isinstance(variables, dict):
            # Convert to TemplateVariable format
            for var_name, var_config in variables.items():
                if isinstance(var_config, dict):
                    v2_template["variables"][var_name] = {
                        "type": var_config.get("type", "string"),
                        "required": var_config.get("required", True),
                        "default": var_config.get("default"),
                        "description": var_config.get(
                            "description", f"Variable: {var_name}"
                        ),
                    }
                else:
                    # Simple type string
                    v2_template["variables"][var_name] = {
                        "type": str(var_config),
                        "required": True,
                        "description": f"Variable: {var_name}",
                    }

    # Preserve activity_id for reference (not part of v2 schema, but useful)
    if "activity_id" in template:
        v2_template["_original_activity_id"] = template["activity_id"]

    # Preserve parent_id if present
    if "parent_id" in template:
        v2_template["parent_id"] = template["parent_id"]

    return v2_template


def main():
    if len(sys.argv) != 3:
        print("Usage: python convert_bootstrap_templates.py <input_dir> <output_dir>")
        sys.exit(1)

    input_dir = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    if not input_dir.exists():
        print(f"Error: Input directory not found: {input_dir}")
        sys.exit(1)

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    # Process all JSON files
    converted_count = 0
    failed_count = 0

    for input_file in sorted(input_dir.glob("*.json")):
        try:
            print(f"Converting {input_file.name}...", end=" ")

            # Load template
            with open(input_file, "r") as f:
                template = json.load(f)

            # Convert to v2 format
            filename = input_file.stem
            v2_template = convert_template(template, filename)

            # Write converted template
            output_file = output_dir / input_file.name
            with open(output_file, "w") as f:
                json.dump(v2_template, f, indent=2)

            print(f"✓ → {output_file.name}")
            converted_count += 1

        except Exception as e:
            print(f"✗ Failed: {e}")
            failed_count += 1

    print(f"\nConversion complete:")
    print(f"  ✓ Converted: {converted_count}")
    print(f"  ✗ Failed: {failed_count}")
    print(f"  Output: {output_dir}")


if __name__ == "__main__":
    main()
