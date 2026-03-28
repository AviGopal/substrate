#!/usr/bin/env python3
"""
Backend Template Audit Script
Analyzes all 20 templates stored in backend and identifies issues
"""

import json
import requests
import sys
from typing import Dict, List, Any, Set
from dataclasses import dataclass
from enum import Enum

# Backend API configuration
BACKEND_URL = "http://localhost:8080"
API_KEY = "c2Vzc2lvbnM6ZDFmYWU2MGMtM2Y5OS00NzBmLWE1ZGQtZGI5ZTMyOTU0OGY1OmJvb3RzdHJhcC1vcmc6Ym9vdHN0cmFwLXVzZXI="


class Severity(Enum):
    CRITICAL = 4  # Blocks execution
    HIGH = 3  # Should fix before production
    MEDIUM = 2  # Should fix eventually
    LOW = 1  # Cosmetic/nice-to-have

    def __str__(self):
        labels = {4: "🔴 CRITICAL", 3: "🟠 HIGH", 2: "🟡 MEDIUM", 1: "🟢 LOW"}
        return labels[self.value]


@dataclass
class Issue:
    severity: Severity
    category: str
    description: str
    fix: str


class TemplateAuditor:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
        )
        self.issues: Dict[str, List[Issue]] = {}

    def fetch_templates(self) -> List[Dict[str, Any]]:
        """Fetch all templates from backend"""
        resp = self.session.get(f"{BACKEND_URL}/v2/activities/templates")
        resp.raise_for_status()
        return resp.json()["templates"]

    def fetch_template_details(self, template_id: str) -> Dict[str, Any]:
        """Fetch full template details including task steps"""
        resp = self.session.get(f"{BACKEND_URL}/v2/activities/templates/{template_id}")
        resp.raise_for_status()
        return resp.json()

    def add_issue(self, template_id: str, issue: Issue):
        """Record an issue for a template"""
        if template_id not in self.issues:
            self.issues[template_id] = []
        self.issues[template_id].append(issue)

    def audit_template_name(self, template: Dict[str, Any]):
        """Check if template has valid name"""
        template_id = template["id"]
        name = template.get("name", "")

        if not name or name.strip() == "":
            self.add_issue(
                template_id,
                Issue(
                    severity=Severity.CRITICAL,
                    category="Missing Name",
                    description="Template has no name",
                    fix="Add descriptive name to template definition",
                ),
            )
        elif name.lower() == "unknown":
            self.add_issue(
                template_id,
                Issue(
                    severity=Severity.CRITICAL,
                    category="Invalid Name",
                    description=f"Template name is 'unknown'",
                    fix="Investigate why template name is missing and update",
                ),
            )

    def audit_test_artifact(self, template: Dict[str, Any]):
        """Check if template is a test artifact"""
        template_id = template["id"]
        name = template.get("name", "")

        test_indicators = [
            "test context",
            "test ",
            "e2e context requirements test",
            " v4",
            " v5",
            " v6",
            " v8",
            " v9",
            " v10",  # Version suffixes from testing
        ]

        if any(indicator in name.lower() for indicator in test_indicators):
            self.add_issue(
                template_id,
                Issue(
                    severity=Severity.HIGH,
                    category="Test Artifact",
                    description=f"Template appears to be test artifact: '{name}'",
                    fix=f"DELETE this template (not for production use)",
                ),
            )

    def audit_category(self, template: Dict[str, Any]):
        """Check if template category is correct"""
        template_id = template["id"]
        category = template.get("category", "")
        name = template.get("name", "")

        # Check for category mismatches
        category_hints = {
            "create-activity-template": "infrastructure",
            "activity-create": "infrastructure",
            "activity-debug": "infrastructure",
            "activity-evolve": "infrastructure",
            "boredom-task-processor": "infrastructure",
            "jiggle-documentation": "infrastructure",
            "add-rest-endpoint": "feature",
            "security-audit": "security",
        }

        for hint, expected_category in category_hints.items():
            if hint in name.lower() and category != expected_category:
                self.add_issue(
                    template_id,
                    Issue(
                        severity=Severity.MEDIUM,
                        category="Wrong Category",
                        description=f"Category is '{category}' but should be '{expected_category}' based on name",
                        fix=f"Update category to '{expected_category}'",
                    ),
                )

    def audit_task_steps(self, template_id: str, details: Dict[str, Any]):
        """Check task steps for issues"""
        task_steps = details.get("task_steps", [])

        if not task_steps or len(task_steps) == 0:
            self.add_issue(
                template_id,
                Issue(
                    severity=Severity.CRITICAL,
                    category="No Tasks",
                    description="Template has no task steps",
                    fix="Add task steps or delete template",
                ),
            )
            return

        # Check each task step
        for idx, task in enumerate(task_steps):
            task_id = task.get("id", f"task-{idx}")
            prompt = task.get("prompt", {})

            # Check for empty prompts
            template_text = prompt.get("template", "")
            if not template_text or template_text.strip() == "":
                self.add_issue(
                    template_id,
                    Issue(
                        severity=Severity.CRITICAL,
                        category="Empty Prompt",
                        description=f"Task '{task_id}' has empty prompt",
                        fix="Add prompt or remove task step",
                    ),
                )

            # Check for missing dependencies on previous_step_output usage
            variables = prompt.get("variables", [])
            dependencies = task.get("dependencies", [])

            has_previous_output = any(
                v.get("name") == "previous_step_output" for v in variables
            )

            if has_previous_output and not dependencies:
                self.add_issue(
                    template_id,
                    Issue(
                        severity=Severity.MEDIUM,
                        category="Missing Dependency",
                        description=f"Task '{task_id}' uses previous_step_output but has no dependencies",
                        fix="Add dependency on previous task or remove previous_step_output variable",
                    ),
                )

    def audit_variables(self, template_id: str, details: Dict[str, Any]):
        """Check variable definitions across tasks"""
        task_steps = details.get("task_steps", [])

        # Collect all required variables from first task
        if task_steps:
            first_task = task_steps[0]
            first_prompt = first_task.get("prompt", {})
            first_vars = first_prompt.get("variables", [])

            required_top_level = [
                v["name"]
                for v in first_vars
                if v.get("required", False) and v["name"] != "previous_step_output"
            ]

            # If first task has required variables (other than previous_step_output),
            # template should document them
            if required_top_level:
                template_vars = details.get("variables", {})
                if not template_vars or len(template_vars) == 0:
                    self.add_issue(
                        template_id,
                        Issue(
                            severity=Severity.LOW,
                            category="Missing Variable Docs",
                            description=f"First task requires variables {required_top_level} but template-level variables is empty",
                            fix="Document required variables at template level",
                        ),
                    )

    def audit_all(self) -> Dict[str, List[Issue]]:
        """Run all audits on all templates"""
        print("🔍 Fetching templates from backend...")
        templates = self.fetch_templates()
        print(f"✅ Found {len(templates)} templates\n")

        print("🔍 Auditing templates...")
        for template in templates:
            template_id = template["id"]

            # Basic audits (from summary data)
            self.audit_template_name(template)
            self.audit_test_artifact(template)
            self.audit_category(template)

            # Detailed audits (fetch full template)
            try:
                details = self.fetch_template_details(template_id)
                self.audit_task_steps(template_id, details)
                self.audit_variables(template_id, details)
            except Exception as e:
                self.add_issue(
                    template_id,
                    Issue(
                        severity=Severity.CRITICAL,
                        category="Fetch Error",
                        description=f"Failed to fetch template details: {e}",
                        fix="Investigate backend error or delete corrupted template",
                    ),
                )

        return self.issues

    def print_report(self):
        """Print comprehensive audit report"""
        print("\n" + "=" * 80)
        print("📋 BACKEND TEMPLATE AUDIT REPORT")
        print("=" * 80 + "\n")

        if not self.issues:
            print("✅ All templates passed audit! No issues found.\n")
            return

        # Count issues by severity
        severity_counts = {s: 0 for s in Severity}
        for issues_list in self.issues.values():
            for issue in issues_list:
                severity_counts[issue.severity] += 1

        print("📊 SUMMARY BY SEVERITY\n")
        for severity in Severity:
            count = severity_counts[severity]
            if count > 0:
                print(f"  {severity}: {count} issues")

        print("\n" + "-" * 80 + "\n")

        # Group templates by issue severity
        critical_templates = []
        high_templates = []
        medium_templates = []
        low_templates = []

        for template_id, issues_list in self.issues.items():
            max_severity = max((i.severity.value for i in issues_list), default=0)
            if max_severity == Severity.CRITICAL.value:
                critical_templates.append((template_id, issues_list))
            elif max_severity == Severity.HIGH.value:
                high_templates.append((template_id, issues_list))
            elif max_severity == Severity.MEDIUM.value:
                medium_templates.append((template_id, issues_list))
            else:
                low_templates.append((template_id, issues_list))

        # Print critical issues first
        if critical_templates:
            print("🔴 CRITICAL ISSUES (blocking execution)\n")
            for template_id, issues_list in critical_templates:
                self._print_template_issues(template_id, issues_list)

        if high_templates:
            print("\n🟠 HIGH PRIORITY (should fix before production)\n")
            for template_id, issues_list in high_templates:
                self._print_template_issues(template_id, issues_list)

        if medium_templates:
            print("\n🟡 MEDIUM PRIORITY (should fix eventually)\n")
            for template_id, issues_list in medium_templates:
                self._print_template_issues(template_id, issues_list)

        if low_templates:
            print("\n🟢 LOW PRIORITY (cosmetic/nice-to-have)\n")
            for template_id, issues_list in low_templates:
                self._print_template_issues(template_id, issues_list)

        # Print actionable recommendations
        print("\n" + "=" * 80)
        print("🛠️  RECOMMENDED ACTIONS")
        print("=" * 80 + "\n")

        self._print_recommendations(
            critical_templates, high_templates, medium_templates
        )

    def _print_template_issues(self, template_id: str, issues_list: List[Issue]):
        """Print issues for a single template"""
        print(f"Template: {template_id}")
        for issue in issues_list:
            print(f"  {issue.severity} [{issue.category}]")
            print(f"    Problem: {issue.description}")
            print(f"    Fix: {issue.fix}")
        print()

    def _print_recommendations(self, critical, high, medium):
        """Print actionable recommendations"""

        # Collect DELETE candidates
        delete_candidates = set()
        for template_id, issues_list in critical + high:
            for issue in issues_list:
                if "DELETE" in issue.fix.upper() or issue.category == "Test Artifact":
                    delete_candidates.add(template_id)

        if delete_candidates:
            print("1️⃣  DELETE TEST ARTIFACTS\n")
            print(f"   Delete {len(delete_candidates)} test templates:")
            for template_id in sorted(delete_candidates):
                print(
                    f"   curl -X DELETE {BACKEND_URL}/v2/activities/templates/{template_id} \\"
                )
                print(f"     -H 'Authorization: Bearer $METABOB_API_KEY'")
            print()

        # Collect INVESTIGATE candidates
        investigate_candidates = set()
        for template_id, issues_list in critical:
            has_critical_non_test = any(
                issue.severity == Severity.CRITICAL
                and issue.category != "Test Artifact"
                for issue in issues_list
            )
            if has_critical_non_test and template_id not in delete_candidates:
                investigate_candidates.add(template_id)

        if investigate_candidates:
            print("2️⃣  INVESTIGATE CRITICAL ISSUES\n")
            print(f"   {len(investigate_candidates)} templates with blocking issues:")
            for template_id in sorted(investigate_candidates):
                print(f"   - {template_id}")
            print()

        # Count category fixes
        category_fixes = 0
        for template_id, issues_list in medium:
            if any(issue.category == "Wrong Category" for issue in issues_list):
                category_fixes += 1

        if category_fixes > 0:
            print(f"3️⃣  FIX CATEGORIES\n")
            print(f"   {category_fixes} templates have wrong category field")
            print(f"   These are cosmetic issues (don't block functionality)")
            print()

        # Summary
        print("📝 PRIORITY ORDER:\n")
        print("   1. Delete test artifacts (high priority)")
        print("   2. Investigate critical issues (blocks execution)")
        print("   3. Fix category fields (cosmetic)")
        print()

    def export_json(self, filename: str):
        """Export audit results as JSON"""
        output = {}
        for template_id, issues_list in self.issues.items():
            output[template_id] = [
                {
                    "severity": issue.severity.name,
                    "category": issue.category,
                    "description": issue.description,
                    "fix": issue.fix,
                }
                for issue in issues_list
            ]

        with open(filename, "w") as f:
            json.dump(output, f, indent=2)

        print(f"📄 Audit results exported to: {filename}\n")


def main():
    auditor = TemplateAuditor()

    try:
        auditor.audit_all()
        auditor.print_report()
        auditor.export_json("template-audit-results.json")

        # Exit code based on severity
        has_critical = any(
            any(issue.severity == Severity.CRITICAL for issue in issues)
            for issues in auditor.issues.values()
        )
        sys.exit(1 if has_critical else 0)

    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Cannot connect to backend at", BACKEND_URL)
        print("   Make sure metabob-rpc-api is running")
        sys.exit(2)
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(2)


if __name__ == "__main__":
    main()
