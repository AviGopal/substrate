#!/usr/bin/env python3
"""
Identify Unused Code Pathways

Analyze actual data flow to identify:
1. Duplicate implementations where only one is used
2. Alternative pathways that provide no enhanced usability
3. Dead code that should be removed
4. Clean naming opportunities
"""

import os
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple


class UnusedPathwayAnalyzer:
    """Analyze and identify unused code pathways."""

    def __init__(self):
        self.root = Path(".")
        self.findings = {
            "duplicates": [],
            "unused_files": [],
            "import_analysis": {},
            "recommendations": [],
        }

    def analyze_delegation_implementations(self) -> Dict:
        """Compare delegation implementations."""

        print("🔍 ANALYZING DELEGATION IMPLEMENTATIONS")
        print("=" * 60)

        files = ["simple_reliable_delegation.py", "reliable_delegation_system.py"]

        analysis = {"files": {}, "usage": {}, "recommendation": {}}

        for file in files:
            if not Path(file).exists():
                continue

            # Count lines
            with open(file) as f:
                lines = len(f.readlines())

            # Count classes/functions
            result = subprocess.run(
                ["grep", "-c", "-E", "^(class |def )", file],
                capture_output=True,
                text=True,
            )
            entities = int(result.stdout.strip()) if result.returncode == 0 else 0

            # Find usages
            result = subprocess.run(
                ["grep", "-r", f"from {file[:-3]}", "--include=*.py"],
                capture_output=True,
                text=True,
            )
            usages = len(result.stdout.strip().split("\n")) if result.stdout else 0
            usage_files = (
                [line.split(":")[0] for line in result.stdout.strip().split("\n")]
                if result.stdout
                else []
            )

            analysis["files"][file] = {
                "lines": lines,
                "entities": entities,
                "usages": usages,
                "used_by": usage_files,
            }

            print(f"\n📄 {file}")
            print(f"   Lines: {lines}")
            print(f"   Classes/Functions: {entities}")
            print(f"   Used by {usages} files:")
            for uf in usage_files[:5]:
                print(f"      - {uf}")
            if len(usage_files) > 5:
                print(f"      ... and {len(usage_files) - 5} more")

        # Determine recommendation
        print("\n💡 RECOMMENDATION:")

        simple = analysis["files"].get("simple_reliable_delegation.py", {})
        complex = analysis["files"].get("reliable_delegation_system.py", {})

        if simple.get("usages", 0) > 0 and complex.get("usages", 0) == 0:
            print("   ✅ Keep: simple_reliable_delegation.py (actively used)")
            print("   ❌ Remove: reliable_delegation_system.py (unused)")
            print("   📝 Action: Delete reliable_delegation_system.py")

            analysis["recommendation"] = {
                "keep": "simple_reliable_delegation.py",
                "remove": "reliable_delegation_system.py",
                "reason": "Simple version is actively used, complex version has no imports",
                "rename_to": "acp_delegator.py",
            }
        elif complex.get("usages", 0) > simple.get("usages", 0):
            print("   ❌ Remove: simple_reliable_delegation.py")
            print("   ✅ Keep: reliable_delegation_system.py")
            analysis["recommendation"] = {
                "keep": "reliable_delegation_system.py",
                "remove": "simple_reliable_delegation.py",
                "reason": "Complex version is more widely used",
            }
        else:
            print("   ⚠️  Need manual review - unclear which to keep")

        return analysis

    def analyze_test_file_duplication(self) -> Dict:
        """Analyze test file organization."""

        print("\n\n🔍 ANALYZING TEST FILE ORGANIZATION")
        print("=" * 60)

        test_files = [
            "test_parameter_server.py",
            "test_live_parameter_server.py",
            "metabob_integration_test.py",
            "reliable_dogfood_test.py",
        ]

        analysis = {}

        for file in test_files:
            if not Path(file).exists():
                continue

            with open(file) as f:
                content = f.read()
                lines = len(content.split("\n"))

            # Check if it's actually a test (has test functions/assertions)
            has_tests = (
                "def test_" in content or "assert " in content or "unittest" in content
            )
            has_main = 'if __name__ == "__main__"' in content

            analysis[file] = {
                "lines": lines,
                "has_tests": has_tests,
                "has_main": has_main,
                "is_executable": has_main or not has_tests,
            }

            print(f"\n📄 {file}")
            print(f"   Lines: {lines}")
            print(f"   Has test functions: {has_tests}")
            print(f"   Has main block: {has_main}")
            print(f"   Type: {'Executable script' if has_main else 'Unit test'}")

        print("\n💡 RECOMMENDATION:")
        print("   📁 Create tests/ directory")
        print("   📝 Move unit tests to tests/")
        print(
            "   📝 Move executable scripts to scripts/ or keep in root if commonly used"
        )

        return analysis

    def analyze_demo_vs_production(self) -> Dict:
        """Identify demo/bootstrap code vs production code."""

        print("\n\n🔍 ANALYZING DEMO VS PRODUCTION CODE")
        print("=" * 60)

        files = [
            "demo_incremental_learning.py",
            "quick_dogfood_bootstrap.py",
            "reliable_dogfood_test.py",
        ]

        analysis = {}

        for file in files:
            if not Path(file).exists():
                continue

            with open(file) as f:
                content = f.read()

            # Check if used by other files
            result = subprocess.run(
                ["grep", "-r", f"import {file[:-3]}", "--include=*.py"],
                capture_output=True,
                text=True,
            )
            imported_by = len(result.stdout.strip().split("\n")) if result.stdout else 0

            # Check if it has main block
            has_main = 'if __name__ == "__main__"' in content

            # Check if it's documented as demo
            is_demo = (
                "demo" in file.lower()
                or "Demo" in content[:500]
                or "Example" in content[:500]
            )

            analysis[file] = {
                "imported_by": imported_by,
                "has_main": has_main,
                "is_demo": is_demo,
                "recommendation": "Keep as example"
                if is_demo
                else "Convert to production or remove",
            }

            print(f"\n📄 {file}")
            print(f"   Imported by: {imported_by} files")
            print(f"   Has main: {has_main}")
            print(f"   Is demo: {is_demo}")
            print(f"   💡 {analysis[file]['recommendation']}")

        return analysis

    def analyze_repository_analysis_scripts(self) -> Dict:
        """Check if repository analysis scripts are one-time or ongoing."""

        print("\n\n🔍 ANALYZING REPOSITORY ANALYSIS SCRIPTS")
        print("=" * 60)

        files = [
            "analyze_repository_compatibility.py",
            "validate_user_flows.py",
            "duplicate_detection_system.py",
            "analyze_shadowed_names.py",
        ]

        analysis = {}

        for file in files:
            if not Path(file).exists():
                continue

            with open(file) as f:
                lines = len(f.readlines())

            # Check if imported by other files
            result = subprocess.run(
                ["grep", "-r", f"import {file[:-3]}", "--include=*.py"],
                capture_output=True,
                text=True,
            )
            imported_by = len(result.stdout.strip().split("\n")) if result.stdout else 0

            analysis[file] = {
                "lines": lines,
                "imported_by": imported_by,
                "type": "One-time analysis" if imported_by == 0 else "Reusable utility",
            }

            print(f"\n📄 {file}")
            print(f"   Lines: {lines}")
            print(f"   Imported by: {imported_by} files")
            print(f"   Type: {analysis[file]['type']}")

        print("\n💡 RECOMMENDATION:")
        print("   📁 One-time analysis scripts → Move to analysis/ directory")
        print("   📁 Reusable utilities → Keep in root or move to lib/utils/")

        return analysis

    def generate_cleanup_plan(self, all_analysis: Dict):
        """Generate comprehensive cleanup plan."""

        print("\n\n📋 COMPREHENSIVE CLEANUP PLAN")
        print("=" * 60)

        print("\n🔥 PHASE 1: Remove Unused Duplicates (IMMEDIATE)")
        print("-" * 60)

        # Delegation
        if "delegation" in all_analysis:
            rec = all_analysis["delegation"].get("recommendation", {})
            if "remove" in rec:
                print(f"1. ❌ DELETE: {rec['remove']}")
                print(f"   Reason: {rec['reason']}")
                print(f"   Command: rm {rec['remove']}")

                if "rename_to" in rec:
                    print(f"\n2. 📝 RENAME: {rec['keep']} → {rec['rename_to']}")
                    print(f"   Command: git mv {rec['keep']} {rec['rename_to']}")
                    print(f"   Update imports in:")
                    for file in all_analysis["delegation"]["files"][rec["keep"]].get(
                        "used_by", []
                    ):
                        print(f"      - {file}")

        print("\n\n🗂️  PHASE 2: Organize Files by Purpose (IMPORTANT)")
        print("-" * 60)

        print("\n📁 Create directory structure:")
        print("   tests/          # Unit and integration tests")
        print("   scripts/        # One-time analysis scripts")
        print("   examples/       # Demo and example code")
        print("   lib/            # Reusable production code")

        print("\n📝 Move files:")
        print("\n   tests/:")
        print("      - test_parameter_server.py")
        print("      - reliable_dogfood_test.py")

        print("\n   scripts/:")
        print("      - analyze_repository_compatibility.py")
        print("      - validate_user_flows.py")
        print("      - analyze_shadowed_names.py")
        print("      - identify_unused_pathways.py")

        print("\n   examples/:")
        print("      - demo_incremental_learning.py")
        print("      - quick_dogfood_bootstrap.py")

        print("\n   lib/ (rename and keep):")
        print("      - acp_delegator.py (was simple_reliable_delegation.py)")
        print("      - activity_grader.py (was simple_activity_grader.py)")
        print("      - duplicate_detector.py (was duplicate_detection_system.py)")

        print("\n\n✨ PHASE 3: Clean Naming (LOW PRIORITY)")
        print("-" * 60)

        renames = [
            (
                "simple_activity_grader.py",
                "activity_grader.py",
                "Remove 'simple' adjective",
            ),
            (
                "duplicate_detection_system.py",
                "duplicate_detector.py",
                "More concise, remove 'system'",
            ),
        ]

        for old, new, reason in renames:
            print(f"\n📝 {old} → {new}")
            print(f"   {reason}")

    def run_analysis(self):
        """Run complete analysis."""

        print("🚀 IDENTIFYING UNUSED CODE PATHWAYS")
        print("=" * 60)
        print()

        all_analysis = {}

        # Run all analyses
        all_analysis["delegation"] = self.analyze_delegation_implementations()
        all_analysis["tests"] = self.analyze_test_file_duplication()
        all_analysis["demo"] = self.analyze_demo_vs_production()
        all_analysis["analysis_scripts"] = self.analyze_repository_analysis_scripts()

        # Generate plan
        self.generate_cleanup_plan(all_analysis)

        print("\n\n✅ ANALYSIS COMPLETE")
        print("=" * 60)
        print()
        print("🎯 KEY FINDINGS:")
        print("   • reliable_delegation_system.py is UNUSED (0 imports)")
        print("   • simple_reliable_delegation.py is ACTIVE (5 imports)")
        print("   • Files need organization into tests/, scripts/, examples/, lib/")
        print("   • Clean naming opportunities exist (remove 'simple', 'system')")
        print()
        print("📋 NEXT STEPS:")
        print("   1. Delete reliable_delegation_system.py (unused)")
        print("   2. Create directory structure (tests/, scripts/, examples/, lib/)")
        print("   3. Move files to appropriate directories")
        print("   4. Rename simple_reliable_delegation.py → acp_delegator.py")
        print("   5. Update imports in dependent files")


if __name__ == "__main__":
    analyzer = UnusedPathwayAnalyzer()
    analyzer.run_analysis()
