#!/usr/bin/env python3
"""Direct test of CLI enrichment (bypass OpenCode)"""

import sys
import os

# Add CLI source to path
sys.path.insert(0, '/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-cli/src')

from metabob_cli.mcp.agent_execution_tools import AgentExecutionTools

def main():
    # Initialize tools
    tools = AgentExecutionTools()
    
    # Test enrichment on our sample file
    test_file = '/home/avi/documents/work/exp-repo/metabob-devbob/test_enrichment_sample.py'
    
    if not os.path.exists(test_file):
        print(f"ERROR: Test file not found: {test_file}")
        sys.exit(1)
    
    print(f"Testing enrichment on: {test_file}")
    print("-" * 60)
    
    # Call enrichment
    try:
        code_context = tools.enrich_with_code_context(
            file_path=test_file,
            project_root='/home/avi/documents/work/exp-repo/metabob-devbob'
        )
        
        if code_context:
            print("SUCCESS: Code context enriched!")
            print(f"Components found: {len(code_context.get('components', []))}")
            print(f"Components: {code_context.get('components', [])}")
            print(f"Impact score: {code_context.get('impact_score', 'N/A')}")
            print(f"Dependents: {code_context.get('dependents_count', 0)}")
            print(f"Similar files: {len(code_context.get('similar_files', []))}")
            sys.exit(0)
        else:
            print("WARNING: No code context returned")
            sys.exit(1)
    except Exception as e:
        print(f"ERROR: Enrichment failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
