#!/usr/bin/env python3
"""
Analyze Shadowed and Verbose Naming

Find functionality with names like:
- 'enhanced', 'better', 'improved', 'upgraded'
- 'simple', 'quick', 'basic'
- 'new_', 'old_', 'v2', 'legacy'
- Overly verbose names

Suggest clean, timeless alternatives.
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, List, Any

sys.path.append(".")
from simple_reliable_delegation import SimpleReliableDelegator


class ShadowedNameAnalyzer:
    """Analyze and fix shadowed/verbose naming."""

    def __init__(self):
        self.delegator = SimpleReliableDelegator()
        self.findings = {
            "root_level": [],
            "repos": [],
            "shadowing_patterns": [],
            "recommendations": [],
        }

    async def analyze_root_level_files(self) -> Dict[str, Any]:
        """Analyze root-level Python files for shadowing names."""

        print("🔍 Analyzing Root-Level Files")
        print("=" * 60)

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Analyze root-level file naming",
            prompt="""
Analyze the root-level Python files for shadowing and verbose naming:

FILES TO ANALYZE:
- simple_activity_grader.py
- simple_reliable_delegation.py
- reliable_delegation_system.py
- reliable_dogfood_test.py
- duplicate_detection_system.py
- comprehensive_duplicate_detector.py (if exists)
- quick_dogfood_bootstrap.py
- demo_incremental_learning.py
- analyze_repository_compatibility.py
- validate_user_flows.py

FOR EACH FILE:

1. Check for shadowing adjectives:
   - 'simple' (implies there's a complex version)
   - 'reliable' (implies there's an unreliable version)
   - 'comprehensive' (overly verbose)
   - 'quick' (implies there's a slow version)
   - 'demo' (is this a demo or real code?)

2. Check for redundancy:
   - 'system' when it's already a standalone file
   - Multiple files doing similar things
   - Test files with 'test' in the name AND filename

3. Identify what each file actually does:
   - Core purpose in one phrase
   - Is this the primary implementation or a variant?
   - Is there another file with similar functionality?

REPORT FORMAT:
File: [filename]
Current Name: [current name]
Shadowing Terms: [list of problematic terms]
Core Purpose: [what it actually does]
Is Primary Implementation: [yes/no]
Conflicts With: [other files if any]
Suggested Name: [clean, timeless name]
Reasoning: [why this name is better]

Suggested naming patterns:
- Use domain nouns: Grader, Delegator, Detector, Validator
- Avoid adjectives: simple, reliable, comprehensive, enhanced
- Be specific: ActivityGrader not Grader
- Be timeless: names that will make sense in 5 years

Example good names:
- activity_grader.py (not simple_activity_grader.py)
- delegator.py or acp_delegator.py (not simple_reliable_delegation.py)
- duplicate_detector.py (not comprehensive_duplicate_detection_system.py)
            """,
            timeout=240,
        )

        self.findings["root_level"] = {
            "timestamp": "2026-01-29",
            "success": result.success,
            "message": result.message,
        }

        return result

    async def analyze_repos_shadowing(self) -> Dict[str, Any]:
        """Analyze repository files for shadowing patterns."""

        print("\n🔍 Analyzing Repository Shadowing Patterns")
        print("=" * 60)

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Find shadowing patterns in repos",
            prompt="""
Search repos/ directory for shadowing patterns:

PATTERNS TO FIND:

1. Enhanced/Better/Improved classes or functions:
   - EnhancedContextSelector
   - EnhancedTemplateEngine
   - EnhancedImpulseMemory
   - BetterValidator
   - ImprovedProcessor

2. Version suffixes:
   - _v2, _v3
   - New*, Old*
   - Legacy*

3. Multiple implementations of the same thing:
   - SimpleX and ComplexX
   - BasicX and AdvancedX
   - X and XImproved

FOR EACH PATTERN FOUND:

Report:
- File: [path]
- Entity: [class/function name]
- Shadowing Term: [enhanced/better/improved/etc.]
- Purpose: [what it does]
- Is Primary: [is this the main implementation?]
- Conflicts: [other similar entities]
- Suggested Rename: [clean name]

Focus on:
- repos/metabob-opencode/packages/opencode/src/session/
- repos/metabob-opencode/packages/opencode/src/activity/
- repos/metabob-opencode/packages/opencode/src/agent/
- repos/metabob-cli/src/
- repos/metabob-rpc-api/server/

Use grep or search to find:
- 'Enhanced' in class names
- 'Improved' in function names  
- '_v2' in filenames
- 'Legacy' in code

Suggested clean names:
- EnhancedTemplateEngine → TemplateEngine
- EnhancedContextSelector → ContextSelector
- ImprovedValidator → Validator
- BetterProcessor → Processor

If there's a conflict (e.g., TemplateEngine already exists), then:
- Keep the better implementation, deprecate the other
- Or merge functionality
- Or use domain-specific names (not adjectives)
            """,
            timeout=300,
        )

        self.findings["repos"] = {
            "timestamp": "2026-01-29",
            "success": result.success,
            "message": result.message,
        }

        return result

    async def identify_duplicate_functionality(self) -> Dict[str, Any]:
        """Identify actual duplicate functionality to merge."""

        print("\n🔍 Identifying Duplicate Functionality")
        print("=" * 60)

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Find duplicate functionality",
            prompt="""
Find cases where we have multiple implementations of the same concept:

LOOK FOR:

1. Delegation Systems:
   - simple_reliable_delegation.py
   - reliable_delegation_system.py
   - Are these different? Or is one shadowing the other?

2. Activity Grading:
   - simple_activity_grader.py
   - Is there another activity grader?

3. Duplicate Detection:
   - duplicate_detection_system.py
   - Is there another duplicate detector?

4. Template Engines:
   - EnhancedTemplateEngine
   - Is there a base TemplateEngine?
   - Should Enhanced be the primary?

5. Context Selectors:
   - EnhancedContextSelector
   - Is there a base ContextSelector?

FOR EACH DUPLICATE:

Report:
- Functionality: [what it does]
- Implementations:
  - Implementation 1: [file/class]
    - Features: [what it has]
    - Quality: [code quality]
    - Usage: [where it's used]
  - Implementation 2: [file/class]
    - Features: [what it has]
    - Quality: [code quality]
    - Usage: [where it's used]

Recommendation:
- Action: [keep 1, merge, rename]
- Primary: [which should be primary]
- Rationale: [why]
- Migration: [how to migrate if needed]

Use metabob_search_codebase_issues to find similar implementations.
Use grep to search for usage of each implementation.
            """,
            timeout=300,
        )

        self.findings["shadowing_patterns"] = {
            "timestamp": "2026-01-29",
            "success": result.success,
            "message": result.message,
        }

        return result

    async def generate_rename_plan(self) -> Dict[str, Any]:
        """Generate comprehensive rename and consolidation plan."""

        print("\n📝 Generating Rename Plan")
        print("=" * 60)

        result = await self.delegator.delegate_with_reliability(
            preferred_container="opencode",
            task_description="Create rename and consolidation plan",
            prompt=f"""
Based on all analysis, create a comprehensive rename and consolidation plan:

Analysis Results:
{json.dumps(self.findings, indent=2)}

CREATE A PRIORITIZED PLAN:

PHASE 1: Root-Level Files (Immediate - these are our new files)
For each file that needs renaming:
- Current: [current filename]
- Proposed: [clean filename]
- Rationale: [why this name is better]
- Breaking: [yes/no - does it break imports?]
- References: [files that import this]
- Migration: [update import statements in X files]

PHASE 2: Repository Files (Important - affects existing code)
For each class/function that needs renaming:
- Current: [EnhancedX]
- Proposed: [X or better domain name]
- Location: [file path]
- Breaking: [yes/no]
- Usage: [how widely used]
- Migration: [steps to rename]

PHASE 3: Consolidation (Complex - merge duplicates)
For duplicate functionality:
- Duplicates: [Implementation 1, Implementation 2]
- Primary: [which to keep]
- Merge Plan: [how to merge features]
- Deprecation: [how to deprecate old one]
- Timeline: [immediate, 1 week, 1 month]

NAMING PRINCIPLES TO APPLY:

✅ DO:
- Use clear domain nouns (ActivityGrader, Delegator, Detector)
- Be specific about domain (ACP, Activity, Template)
- Use timeless names that don't imply version
- Keep names concise but descriptive

❌ DON'T:
- Use adjectives (simple, reliable, enhanced, comprehensive)
- Use version indicators (_v2, New*, Improved*)
- Use vague terms (system, manager, handler without context)
- Create overly long names (>30 chars)

EXAMPLE RENAMES:

Root Level:
- simple_activity_grader.py → activity_grader.py
- simple_reliable_delegation.py → acp_delegator.py
- reliable_delegation_system.py → (merge with above or delete)
- duplicate_detection_system.py → duplicate_detector.py
- comprehensive_X.py → X.py

Repos:
- EnhancedTemplateEngine → TemplateEngine
- EnhancedContextSelector → ContextSelector
- EnhancedImpulseMemory → ImpulseMemory

OUTPUT FORMAT:

## Rename Plan

### Phase 1: Root-Level Files (Priority: HIGH)
1. simple_activity_grader.py → activity_grader.py
   - Breaks: No (new file, no external imports yet)
   - Action: Rename file, update local imports
   - Effort: 5 minutes

[continue for all files]

### Phase 2: Repository Classes (Priority: MEDIUM)
[list all class renames]

### Phase 3: Consolidation (Priority: LOW)
[list merges]

### Implementation Order:
1. [First task - least breaking]
2. [Second task]
3. [etc.]

Save to: shadowed_names_rename_plan.md
            """,
            timeout=240,
        )

        self.findings["recommendations"] = {
            "timestamp": "2026-01-29",
            "success": result.success,
            "message": result.message,
        }

        # Save findings
        with open("shadowed_names_analysis.json", "w") as f:
            json.dump(self.findings, f, indent=2)

        print("✅ Analysis saved to: shadowed_names_analysis.json")

        return result

    async def run_full_analysis(self):
        """Run complete shadowed name analysis."""

        print("🚀 ANALYZING SHADOWED AND VERBOSE NAMING")
        print("=" * 60)
        print()

        try:
            await self.analyze_root_level_files()
            await self.analyze_repos_shadowing()
            await self.identify_duplicate_functionality()
            await self.generate_rename_plan()

            print()
            print("✅ ANALYSIS COMPLETE")
            print("=" * 60)
            print("📄 Reports generated:")
            print("   - shadowed_names_analysis.json (detailed findings)")
            print("   - shadowed_names_rename_plan.md (actionable plan)")
            print()
            print("🎯 Next Steps:")
            print("   1. Review the rename plan")
            print("   2. Approve proposed names")
            print("   3. Execute renames in priority order")
            print("   4. Update documentation")

        except Exception as e:
            print(f"❌ Analysis failed: {e}")
            import traceback

            traceback.print_exc()


async def main():
    """Main entry point."""
    analyzer = ShadowedNameAnalyzer()
    await analyzer.run_full_analysis()


if __name__ == "__main__":
    asyncio.run(main())
