#!/usr/bin/env python3
"""
Enhance activity templates with impulse integration using correct schema.

This script analyzes activity templates and adds:
1. Activity-level: contextRequirements (what impulses to CREATE)
2. Task-level: impulse_refs (what impulses to USE)

Usage:
    python3 enhance_template_with_impulses.py <template_path> [--output <output_path>]
"""

import json
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Any, Optional

# Impulse type definitions
IMPULSE_TYPES = {
    "file": "Load file content",
    "bashOutput": "Execute bash command and capture output",
    "toolOutput": "Execute tool and capture result",
    "memo": "Static text content",
    "metabobAnnotation": "Load Metabob component annotations",
    "metabobResolution": "Load past bug resolution notes",
}

# Task analysis patterns for context needs
CONTEXT_PATTERNS = {
    "design": ["examples", "patterns", "architecture"],
    "implement": ["design_output", "examples", "project_structure"],
    "test": ["implementation", "requirements"],
    "validate": ["test_results", "requirements"],
    "document": ["implementation", "design"],
    "refactor": ["existing_code", "patterns"],
    "fix": ["error_logs", "past_resolutions"],
}


class TemplateEnhancer:
    """Enhance activity templates with impulse integration."""

    def __init__(self, template_path: str):
        self.template_path = Path(template_path)
        self.template = self._load_template()
        self.context_requirements: List[Dict[str, Any]] = []
        self.impulse_refs_map: Dict[str, List[Dict[str, Any]]] = {}

    def _load_template(self) -> Dict[str, Any]:
        """Load and parse template JSON."""
        if not self.template_path.exists():
            raise FileNotFoundError(f"Template not found: {self.template_path}")

        with open(self.template_path, "r") as f:
            return json.load(f)

    def analyze_template(self) -> Dict[str, Any]:
        """Analyze template structure and identify impulse opportunities."""
        tasks = self.template.get("tasks", [])
        template_id = self.template.get("id", "unknown")
        template_name = self.template.get("name", "Unknown Template")
        category = self.template.get("category", "other")

        analysis = {
            "template_id": template_id,
            "template_name": template_name,
            "category": category,
            "task_count": len(tasks),
            "tasks": [],
            "impulse_opportunities": [],
        }

        for task in tasks:
            task_id = task.get("id", "unknown")
            task_desc = task.get("description", "")
            dependencies = task.get("dependencies", [])

            task_analysis = {
                "id": task_id,
                "description": task_desc,
                "dependencies": dependencies,
                "needs_context": self._identify_context_needs(
                    task_id, task_desc, dependencies
                ),
            }

            analysis["tasks"].append(task_analysis)

        return analysis

    def _identify_context_needs(
        self, task_id: str, description: str, dependencies: List[str]
    ) -> List[str]:
        """Identify what context this task needs based on patterns."""
        needs = []
        desc_lower = description.lower()

        # Check description against patterns
        for pattern_key, context_types in CONTEXT_PATTERNS.items():
            if pattern_key in desc_lower or pattern_key in task_id.lower():
                needs.extend(context_types)

        # If task has dependencies, likely needs their outputs
        if dependencies:
            needs.append("previous_task_output")

        # Generic patterns
        if "analyze" in desc_lower or "study" in desc_lower:
            needs.append("examples")
        if "implement" in desc_lower or "create" in desc_lower or "write" in desc_lower:
            needs.append("design_output")
        if "validate" in desc_lower or "verify" in desc_lower:
            needs.append("validation_target")

        return list(set(needs))  # Remove duplicates

    def design_impulses(self, analysis: Dict[str, Any]) -> None:
        """Design contextRequirements and impulse_refs based on analysis."""
        category = analysis["category"]
        tasks = analysis["tasks"]

        # Common impulses for all templates
        self._add_common_impulses(category)

        # Task-specific impulses
        for i, task in enumerate(tasks):
            task_id = task["id"]
            needs = task["needs_context"]

            # Initialize impulse_refs for this task
            self.impulse_refs_map[task_id] = []

            # Add impulses based on needs
            if "examples" in needs:
                impulse_id = self._add_examples_impulse(category)
                self._add_impulse_ref(task_id, impulse_id, "MEDIUM", required=False)

            if "design_output" in needs and i > 0:
                # Reference design from first task
                impulse_id = self._add_task_output_impulse(
                    tasks[0]["id"], "design_output"
                )
                self._add_impulse_ref(task_id, impulse_id, "HIGH", required=True)

            if "previous_task_output" in needs and task["dependencies"]:
                # Reference immediate predecessor
                predecessor_id = task["dependencies"][0]
                impulse_id = self._add_task_output_impulse(
                    predecessor_id, f"{predecessor_id}_output"
                )
                self._add_impulse_ref(task_id, impulse_id, "HIGH", required=True)

            if "project_structure" in needs:
                impulse_id = self._add_project_structure_impulse()
                self._add_impulse_ref(task_id, impulse_id, "LOW", required=False)

            if "past_resolutions" in needs:
                impulse_id = self._add_metabob_resolutions_impulse()
                self._add_impulse_ref(task_id, impulse_id, "MEDIUM", required=False)

    def _add_common_impulses(self, category: str) -> None:
        """Add impulses that all templates benefit from."""
        # High-quality examples from same category
        self.context_requirements.append(
            {
                "key": "categoryExamples",
                "hint": f'Use search_activities({{ category: "{category}", verbose: true }}) to find 2-3 templates with highest success rates (>= 0.7 if available)',
                "impulseTypes": ["toolOutput", "memo"],
                "required": False,
                "budgetRange": [3000, 5000],
            }
        )

    def _add_examples_impulse(self, category: str) -> str:
        """Add impulse for loading examples."""
        impulse_id = "categoryExamples"
        # Already added in common impulses
        return impulse_id

    def _add_task_output_impulse(self, task_id: str, impulse_id: str) -> str:
        """Add impulse for loading previous task output."""
        # Check if already exists
        existing = [cr for cr in self.context_requirements if cr["key"] == impulse_id]
        if existing:
            return impulse_id

        self.context_requirements.append(
            {
                "key": impulse_id,
                "hint": f"Load output from task '{task_id}'. Look for markdown files created by that task.",
                "impulseTypes": ["bashOutput", "file"],
                "required": False,
                "budgetRange": [2000, 4000],
            }
        )
        return impulse_id

    def _add_project_structure_impulse(self) -> str:
        """Add impulse for project structure context."""
        impulse_id = "projectStructure"
        # Check if already exists
        existing = [cr for cr in self.context_requirements if cr["key"] == impulse_id]
        if existing:
            return impulse_id

        self.context_requirements.append(
            {
                "key": impulse_id,
                "hint": "Load README.md and package.json to understand project structure and conventions",
                "impulseTypes": ["file"],
                "required": False,
                "budgetRange": [1000, 2000],
            }
        )
        return impulse_id

    def _add_metabob_resolutions_impulse(self) -> str:
        """Add impulse for Metabob past resolutions."""
        impulse_id = "pastResolutions"
        # Check if already exists
        existing = [cr for cr in self.context_requirements if cr["key"] == impulse_id]
        if existing:
            return impulse_id

        self.context_requirements.append(
            {
                "key": impulse_id,
                "hint": "Use metabob_search_codebase_issues to find similar past issues and their resolutions",
                "impulseTypes": ["metabobResolution", "metabobAnnotation"],
                "required": False,
                "budgetRange": [2000, 3000],
            }
        )
        return impulse_id

    def _add_impulse_ref(
        self, task_id: str, impulse_id: str, priority: str, required: bool
    ) -> None:
        """Add impulse_ref to task."""
        if task_id not in self.impulse_refs_map:
            self.impulse_refs_map[task_id] = []

        # Check for duplicates
        existing = [
            ref
            for ref in self.impulse_refs_map[task_id]
            if ref["impulse_id"] == impulse_id
        ]
        if not existing:
            self.impulse_refs_map[task_id].append(
                {"impulse_id": impulse_id, "priority": priority, "required": required}
            )

    def inject_impulses(self) -> Dict[str, Any]:
        """Inject contextRequirements and impulse_refs into template."""
        enhanced = self.template.copy()

        # Add contextRequirements at top level
        if self.context_requirements:
            enhanced["contextRequirements"] = self.context_requirements

        # Add impulse_refs to each task
        for task in enhanced.get("tasks", []):
            task_id = task.get("id")
            if task_id in self.impulse_refs_map and self.impulse_refs_map[task_id]:
                task["impulse_refs"] = self.impulse_refs_map[task_id]

        return enhanced

    def validate_enhancement(self, enhanced: Dict[str, Any]) -> Dict[str, Any]:
        """Validate enhanced template structure."""
        validation = {"valid": True, "errors": [], "warnings": [], "stats": {}}

        # Check contextRequirements structure
        context_reqs = enhanced.get("contextRequirements", [])
        if not context_reqs:
            validation["warnings"].append("No contextRequirements added")

        required_context_fields = [
            "key",
            "hint",
            "impulseTypes",
            "required",
            "budgetRange",
        ]
        for cr in context_reqs:
            for field in required_context_fields:
                if field not in cr:
                    validation["valid"] = False
                    validation["errors"].append(
                        f"contextRequirement missing field: {field}"
                    )

            # Validate budgetRange
            if "budgetRange" in cr:
                budget_range = cr["budgetRange"]
                if not isinstance(budget_range, list) or len(budget_range) != 2:
                    validation["valid"] = False
                    validation["errors"].append(
                        f"Invalid budgetRange in {cr.get('key')}: must be [min, max]"
                    )

        # Check impulse_refs structure
        tasks_with_refs = 0
        total_refs = 0
        for task in enhanced.get("tasks", []):
            if "impulse_refs" in task:
                tasks_with_refs += 1
                refs = task["impulse_refs"]
                total_refs += len(refs)

                for ref in refs:
                    # Check required fields
                    if "impulse_id" not in ref:
                        validation["valid"] = False
                        validation["errors"].append(
                            f"impulse_ref in task {task['id']} missing impulse_id"
                        )

                    # Check priority is uppercase enum
                    if "priority" in ref and ref["priority"] not in [
                        "HIGH",
                        "MEDIUM",
                        "LOW",
                    ]:
                        validation["valid"] = False
                        validation["errors"].append(
                            f"Invalid priority in task {task['id']}: {ref['priority']} (must be HIGH, MEDIUM, or LOW)"
                        )

                    # Check impulse_id references existing contextRequirement
                    impulse_id = ref.get("impulse_id")
                    if impulse_id:
                        context_keys = [cr["key"] for cr in context_reqs]
                        if impulse_id not in context_keys:
                            validation["valid"] = False
                            validation["errors"].append(
                                f"impulse_ref in task {task['id']} references non-existent impulse: {impulse_id}"
                            )

        # Stats
        validation["stats"] = {
            "context_requirements": len(context_reqs),
            "tasks_with_impulse_refs": tasks_with_refs,
            "total_impulse_refs": total_refs,
            "task_count": len(enhanced.get("tasks", [])),
            "impulse_usage_percentage": (
                tasks_with_refs / len(enhanced.get("tasks", [])) * 100
            )
            if enhanced.get("tasks")
            else 0,
        }

        return validation

    def enhance(self) -> tuple[Dict[str, Any], Dict[str, Any]]:
        """Main enhancement workflow."""
        # Step 1: Analyze
        analysis = self.analyze_template()
        print(f"✓ Analyzed template: {analysis['template_name']}")
        print(f"  - {analysis['task_count']} tasks")

        # Step 2: Design impulses
        self.design_impulses(analysis)
        print(f"✓ Designed impulses:")
        print(f"  - {len(self.context_requirements)} contextRequirements")
        print(
            f"  - {sum(len(refs) for refs in self.impulse_refs_map.values())} impulse_refs across {len(self.impulse_refs_map)} tasks"
        )

        # Step 3: Inject
        enhanced = self.inject_impulses()
        print(f"✓ Injected impulses into template")

        # Step 4: Validate
        validation = self.validate_enhancement(enhanced)
        if validation["valid"]:
            print(f"✓ Validation passed")
            print(
                f"  - Impulse usage: {validation['stats']['impulse_usage_percentage']:.1f}%"
            )
        else:
            print(f"✗ Validation failed:")
            for error in validation["errors"]:
                print(f"    - {error}")

        if validation["warnings"]:
            print(f"⚠ Warnings:")
            for warning in validation["warnings"]:
                print(f"    - {warning}")

        return enhanced, validation


def main():
    parser = argparse.ArgumentParser(
        description="Enhance activity template with impulse integration"
    )
    parser.add_argument("template_path", help="Path to activity template JSON file")
    parser.add_argument(
        "-o",
        "--output",
        help="Output path for enhanced template (default: <template>-enhanced.json)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Analyze only, don't write output"
    )

    args = parser.parse_args()

    try:
        enhancer = TemplateEnhancer(args.template_path)
        enhanced, validation = enhancer.enhance()

        if not validation["valid"]:
            print("\n❌ Enhancement failed validation")
            sys.exit(1)

        if args.dry_run:
            print("\n[DRY RUN] Would write enhanced template")
            print(json.dumps(validation["stats"], indent=2))
            return

        # Determine output path
        if args.output:
            output_path = Path(args.output)
        else:
            stem = Path(args.template_path).stem
            output_path = Path(args.template_path).parent / f"{stem}-enhanced.json"

        # Write enhanced template
        with open(output_path, "w") as f:
            json.dump(enhanced, f, indent=2)

        print(f"\n✅ Enhanced template written to: {output_path}")
        print(f"\nEnhancement Summary:")
        print(f"  - contextRequirements: {validation['stats']['context_requirements']}")
        print(
            f"  - Tasks with impulses: {validation['stats']['tasks_with_impulse_refs']}/{validation['stats']['task_count']}"
        )
        print(f"  - Total impulse_refs: {validation['stats']['total_impulse_refs']}")
        print(
            f"  - Impulse usage: {validation['stats']['impulse_usage_percentage']:.1f}%"
        )

    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
