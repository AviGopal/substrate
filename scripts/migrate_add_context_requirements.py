#!/usr/bin/env python3
"""
Migrate activity templates to add context_requirements field.

This script adds appropriate context_requirements to templates based on their category.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any

# Context requirements templates by category
CONTEXT_REQUIREMENTS = {
    "feature-impl": [
        {
            "key": "codebase-patterns",
            "hint": "Existing code patterns and similar features for reference",
            "impulseTypes": ["file", "component", "bashOutput"],
            "budgetRange": [5000, 10000],
            "required": True
        },
        {
            "key": "project-conventions",
            "hint": "Project coding standards and conventions documentation",
            "impulseTypes": ["file", "memo"],
            "budgetRange": [2000, 4000],
            "required": False
        },
        {
            "key": "dependency-context",
            "hint": "Related components and dependencies",
            "impulseTypes": ["component", "file"],
            "budgetRange": [3000, 6000],
            "required": False
        }
    ],
    "bug-fix": [
        {
            "key": "bug-context",
            "hint": "Bug report, error logs, and reproduction steps",
            "impulseTypes": ["memo", "bashOutput", "file"],
            "budgetRange": [2000, 4000],
            "required": True
        },
        {
            "key": "affected-code",
            "hint": "Files and components related to the bug",
            "impulseTypes": ["file", "component"],
            "budgetRange": [4000, 8000],
            "required": True
        },
        {
            "key": "similar-fixes",
            "hint": "Historical bug fixes and patterns",
            "impulseTypes": ["memo", "component"],
            "budgetRange": [1000, 2000],
            "required": False
        }
    ],
    "refactor": [
        {
            "key": "target-code",
            "hint": "Code to be refactored with current structure",
            "impulseTypes": ["file", "component"],
            "budgetRange": [5000, 10000],
            "required": True
        },
        {
            "key": "usage-patterns",
            "hint": "How the code is currently used (dependents)",
            "impulseTypes": ["component", "bashOutput"],
            "budgetRange": [2000, 4000],
            "required": True
        },
        {
            "key": "test-coverage",
            "hint": "Existing tests for the refactored code",
            "impulseTypes": ["file", "bashOutput"],
            "budgetRange": [2000, 4000],
            "required": False
        }
    ],
    "activity-create": [
        {
            "key": "pattern-source",
            "hint": "Source interaction or pattern to formalize",
            "impulseTypes": ["memo", "file"],
            "budgetRange": [3000, 6000],
            "required": True
        },
        {
            "key": "similar-templates",
            "hint": "Existing activity templates for reference",
            "impulseTypes": ["file", "memo"],
            "budgetRange": [2000, 4000],
            "required": False
        },
        {
            "key": "validation-context",
            "hint": "Test data and validation requirements",
            "impulseTypes": ["memo", "bashOutput"],
            "budgetRange": [1000, 2000],
            "required": False
        }
    ],
    "add-rest-endpoint": [
        {
            "key": "api-context",
            "hint": "Existing API structure and patterns",
            "impulseTypes": ["file", "component"],
            "budgetRange": [3000, 6000],
            "required": True
        },
        {
            "key": "endpoint-spec",
            "hint": "API specification and requirements",
            "impulseTypes": ["memo", "file"],
            "budgetRange": [1000, 2000],
            "required": True
        }
    ]
}

def detect_template_type(template: Dict[str, Any]) -> str:
    """Detect template type from activity_id or variant_id."""
    activity_id = template.get("activity_id", "")
    variant_id = template.get("variant_id", "")
    
    # Check activity_id first
    for key in CONTEXT_REQUIREMENTS.keys():
        if key in activity_id:
            return key
    
    # Check variant_id
    for key in CONTEXT_REQUIREMENTS.keys():
        if key in variant_id:
            return key
    
    return None

def migrate_template(template_path: Path, dry_run: bool = False) -> Dict[str, Any]:
    """Add context_requirements to a template."""
    print(f"\n{'='*60}")
    print(f"Processing: {template_path.name}")
    print(f"{'='*60}")
    
    with open(template_path, 'r') as f:
        template = json.load(f)
    
    # Check if already has context_requirements
    if template.get("context_requirements"):
        print("✓ Already has context_requirements")
        return {"status": "skipped", "reason": "already_exists"}
    
    # Detect template type
    template_type = detect_template_type(template)
    if not template_type:
        print("⚠️  Could not detect template type")
        return {"status": "skipped", "reason": "unknown_type"}
    
    print(f"Detected type: {template_type}")
    
    # Add context_requirements
    context_reqs = CONTEXT_REQUIREMENTS[template_type]
    template["context_requirements"] = context_reqs
    
    print(f"Adding {len(context_reqs)} context requirements:")
    for cr in context_reqs:
        req_status = "REQUIRED" if cr["required"] else "optional"
        print(f"  - {cr['key']}: {cr['impulseTypes']} [{cr['budgetRange'][0]}-{cr['budgetRange'][1]}] ({req_status})")
    
    if not dry_run:
        # Write back
        with open(template_path, 'w') as f:
            json.dump(template, f, indent=2)
        print("✅ Template updated!")
    else:
        print("🔍 DRY RUN - No changes written")
    
    return {"status": "migrated", "type": template_type, "count": len(context_reqs)}

def main():
    dry_run = "--dry-run" in sys.argv
    
    if dry_run:
        print("🔍 DRY RUN MODE - No files will be modified\n")
    
    # Templates to migrate
    bootstrap_dir = Path("repos/metabob-proto/activities/bootstrap")
    templates = [
        "feature-impl.json",
        "bug-fix.json",
        "refactor.json",
        "activity-create-v2.json",
        "add-rest-endpoint.json"
    ]
    
    results = []
    for template_name in templates:
        template_path = bootstrap_dir / template_name
        if not template_path.exists():
            print(f"⚠️  Not found: {template_name}")
            results.append({"name": template_name, "status": "not_found"})
            continue
        
        result = migrate_template(template_path, dry_run)
        result["name"] = template_name
        results.append(result)
    
    # Summary
    print(f"\n{'='*60}")
    print("MIGRATION SUMMARY")
    print(f"{'='*60}")
    
    migrated = [r for r in results if r["status"] == "migrated"]
    skipped = [r for r in results if r["status"] == "skipped"]
    not_found = [r for r in results if r["status"] == "not_found"]
    
    print(f"✅ Migrated: {len(migrated)}")
    print(f"⏭️  Skipped: {len(skipped)}")
    print(f"❌ Not Found: {len(not_found)}")
    
    if dry_run:
        print("\n🔍 DRY RUN COMPLETE - Run without --dry-run to apply changes")
    else:
        print("\n✨ MIGRATION COMPLETE")

if __name__ == "__main__":
    main()
