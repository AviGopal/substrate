#!/usr/bin/env python3
"""
Find Disconnected Code - Identify Unused Functionality

Use git history and static analysis to find:
1. Files with no imports (disconnected from codebase)
2. Functions/classes never called
3. Code added but never integrated
4. Orphaned functionality
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.acp_delegator import SimpleReliableDelegator


async def find_disconnected_code():
    """Find disconnected functionality across all repos."""
    
    delegator = SimpleReliableDelegator()
    
    print("🔍 FINDING DISCONNECTED CODE")
    print("=" * 60)
    print()
    
    # Task 1: Find files with no imports
    print("📋 Task 1: Files Not Imported Anywhere")
    print("-" * 60)
    
    result1 = await delegator.delegate_with_reliability(
        preferred_container="opencode",
        task_description="Find Python files with zero imports",
        prompt=r"""
Find Python files that are never imported by other code:

1. Search all Python files in repos/:
   find repos/ -name "*.py" -type f > /tmp/all_python_files.txt

2. For each file, check if it's imported anywhere:
   while read file; do
     basename=$(basename "$file" .py)
     # Search for imports of this file
     count=$(grep -r "from.*$basename import\\|import.*$basename" repos/ --include="*.py" 2>/dev/null | grep -v "$file" | wc -l)
     if [ "$count" -eq 0 ]; then
       echo "DISCONNECTED: $file (0 imports)"
     fi
   done < /tmp/all_python_files.txt

3. Exclude patterns:
   - __init__.py files (often not imported directly)
   - __main__.py files (entry points)
   - test_*.py files (run directly)
   - *_test.py files
   - setup.py, conftest.py (special files)

4. Report format:
   File: [path]
   Lines: [line count]
   Last Modified: [git log date]
   Reason: No imports found in codebase

Focus on repos/metabob-cli, repos/metabob-opencode, repos/metabob-rpc-api

List top 10 disconnected files by size.
        """,
        timeout=300
    )
    
    print(f"✅ Task 1: {result1.message[:100]}...")
    print()
    
    # Task 2: Find orphaned functionality using git
    print("📋 Task 2: Code Added But Never Integrated")
    print("-" * 60)
    
    result2 = await delegator.delegate_with_reliability(
        preferred_container="opencode",
        task_description="Find code added but never integrated",
        prompt=r"""
Use git history to find code that was added but never connected:

1. Find recently added Python files (last 30 days):
   git log --since="30 days ago" --name-only --diff-filter=A --pretty=format: repos/ 2>/dev/null | \
     grep "\.py$" | sort -u

2. For each file added in last 30 days:
   - Check if it's imported anywhere
   - Check if it has any git history of being modified after creation
   - Check if referenced in any documentation
   - Check if used in tests

3. Report suspicious files:
   File: [path]
   Added: [date]
   Modified after creation: [yes/no]
   Imports found: [count]
   Test references: [count]
   Status: [ORPHANED / INTEGRATED]

Focus on repos/ subdirectories.
        """,
        timeout=300
    )
    
    print(f"✅ Task 2: {result2.message[:100]}...")
    print()
    
    # Task 3: Find dead API endpoints
    print("📋 Task 3: Dead API Endpoints (Registered But Unused)")
    print("-" * 60)
    
    result3 = await delegator.delegate_with_reliability(
        preferred_container="opencode",
        task_description="Find unused API endpoints",
        prompt=r"""
Find API endpoints that are defined but never called:

1. Find all FastAPI route definitions in metabob-rpc-api:
   grep -r "@router\\.(get|post|put|delete|patch)" repos/metabob-rpc-api/server/routes/ \
     --include="*.py" -A 1

2. For each endpoint found:
   - Extract the path (e.g., "/api/activities/execute")
   - Search for references to this path in:
     - repos/metabob-cli (CLI might call it)
     - repos/metabob-opencode (OpenCode might call it)
     - Test files
     - Documentation

3. Report endpoints with zero external references:
   Endpoint: POST /api/some-feature
   File: repos/metabob-rpc-api/server/routes/some_feature.py
   Handler: execute_some_feature()
   External references: 0
   Test coverage: No
   Status: DISCONNECTED (defined but never called)

4. List top 10 disconnected endpoints (if found).
        """,
        timeout=300
    )
    
    print(f"✅ Task 3: {result3.message[:100]}...")
    print()
    
    # Task 4: Generate comprehensive report
    print("📋 Task 4: Generate Disconnected Code Report")
    print("-" * 60)
    
    result4 = await delegator.delegate_with_reliability(
        preferred_container="opencode",
        task_description="Generate disconnected code report",
        prompt="""
Create a comprehensive report of all disconnected code:

Based on previous analysis, create a report with:

1. **Executive Summary**
   - Files with 0 imports found
   - Orphaned code identified
   - Dead API endpoints (if any)
   - Estimated impact of removal

2. **High Priority Removals**
   Files/code that should be reviewed for deletion:
   - 0 imports
   - No test coverage
   - Not entry points

3. **Recommendations**
   For each identified item:
   - File/Code: [name]
   - Reason: [why it's disconnected]
   - Action: [DELETE / REVIEW / KEEP]
   - Impact: [LOW/MEDIUM/HIGH]

Save to: reports/disconnected_code_analysis.md

Include actionable recommendations.
        """,
        timeout=300
    )
    
    print(f"✅ Task 4: {result4.message[:100]}...")
    print()
    
    print("✅ ANALYSIS COMPLETE")
    print("=" * 60)
    print()
    print("📄 Check: reports/disconnected_code_analysis.md")
    print()
    print("🎯 Next Steps:")
    print("   1. Review the analysis report")
    print("   2. Validate findings manually")
    print("   3. Remove confirmed disconnected code")
    print("   4. Commit changes")


async def main():
    """Main entry point."""
    await find_disconnected_code()


if __name__ == "__main__":
    asyncio.run(main())
