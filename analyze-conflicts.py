#!/usr/bin/env python3
"""
Analyze conflicts between user-authentication-login-flow-fix and other specifications
"""

import json
import os
from pathlib import Path

# Our specification
CURRENT_SPEC = "user-authentication-login-flow-fix"

# Files modified by our spec
OUR_FILES = {
    "repos/metabob-rpc-api/server/db/operations/user_ops.py": {
        "changes": ["User ID format changed from hyphens to underscores"],
        "components": ["create_user", "user ID generation"]
    },
    "repos/metabob-rpc-api/server/routes/cloud_auth.py": {
        "changes": ["Fixed SurrealDB query result parsing", "Added debug logging"],
        "components": ["login endpoint", "query result parsing"]
    },
    "scripts/init-surrealdb-devbob-schema-v2.sql": {
        "changes": ["Added users, organizations, user_organizations, refresh_tokens tables"],
        "components": ["database schema", "authentication tables"]
    }
}

def find_related_specs():
    """Find other specifications that touch related components"""
    related = []
    
    # Scan validation results
    impulse_dir = Path("impulses")
    if not impulse_dir.exists():
        print(f"Warning: {impulse_dir} not found")
        return related
    
    for file in impulse_dir.glob("validation-results-*.json"):
        try:
            with open(file, 'r') as f:
                data = json.load(f)
            
            spec_name = data.get('metadata', {}).get('specificationName') or data.get('specificationName')
            if not spec_name or spec_name == CURRENT_SPEC:
                continue
            
            # Check if this spec touches our files
            touches_our_files = False
            affected_components = []
            
            # Check for overlaps in content
            content_str = json.dumps(data)
            
            if 'user_ops' in content_str or 'create_user' in content_str:
                touches_our_files = True
                affected_components.append('user_ops.py')
            
            if 'cloud_auth' in content_str or 'login' in content_str:
                touches_our_files = True
                affected_components.append('cloud_auth.py')
            
            if 'schema' in content_str or 'surrealdb' in content_str.lower():
                touches_our_files = True
                affected_components.append('SurrealDB schema')
            
            if touches_our_files:
                related.append({
                    'spec': spec_name,
                    'file': str(file.name),
                    'components': affected_components
                })
        
        except Exception as e:
            print(f"Error reading {file}: {e}")
    
    return related

def analyze_conflicts(related_specs):
    """Analyze potential conflicts"""
    conflicts = []
    
    # Known conflict patterns
    for spec_info in related_specs:
        spec = spec_info['spec']
        components = spec_info['components']
        
        # Check for SurrealDB-related conflicts
        if 'SurrealDB schema' in components:
            conflicts.append({
                'type': 'SCHEMA_OVERLAP',
                'spec1': CURRENT_SPEC,
                'spec2': spec,
                'sharedComponent': 'scripts/init-surrealdb-devbob-schema-v2.sql',
                'description': f'{spec} may have also modified SurrealDB schema. Need to verify schema changes are compatible.',
                'severity': 'MEDIUM',
                'resolution': 'Review both schema files and merge changes if needed'
            })
        
        # Check for authentication-related conflicts
        if 'cloud_auth.py' in components:
            conflicts.append({
                'type': 'CODE_OVERLAP',
                'spec1': CURRENT_SPEC,
                'spec2': spec,
                'sharedComponent': 'repos/metabob-rpc-api/server/routes/cloud_auth.py',
                'description': f'{spec} may have modified cloud_auth.py. Our query parsing fix could conflict.',
                'severity': 'HIGH',
                'resolution': 'Review both implementations and ensure query parsing logic is consistent'
            })
        
        # Check for user creation conflicts
        if 'user_ops.py' in components:
            conflicts.append({
                'type': 'CODE_OVERLAP',
                'spec1': CURRENT_SPEC,
                'spec2': spec,
                'sharedComponent': 'repos/metabob-rpc-api/server/db/operations/user_ops.py',
                'description': f'{spec} may have modified user_ops.py. Our user ID format change could conflict.',
                'severity': 'HIGH',
                'resolution': 'Ensure user ID format (underscores) is consistent across all specs'
            })
    
    return conflicts

def check_deployment_conflicts():
    """Check for deployment-related conflicts"""
    deployment_conflicts = []
    
    # Our spec requires RPC API rebuild
    # Check if other recent specs also require this
    deployment_conflicts.append({
        'type': 'DEPLOYMENT_DEPENDENCY',
        'issue': 'Multiple specs require RPC API rebuild',
        'specs': [CURRENT_SPEC, 'surrealdb-authentication-fix-and-dashboard-live-test'],
        'description': 'Both specs modify RPC API code and require Docker rebuild/redeploy',
        'severity': 'LOW',
        'resolution': 'Rebuild RPC API image once with all changes combined'
    })
    
    return deployment_conflicts

def main():
    print("=" * 70)
    print("CONFLICT ANALYSIS: user-authentication-login-flow-fix")
    print("=" * 70)
    print()
    
    # Find related specifications
    print("Finding related specifications...")
    related_specs = find_related_specs()
    
    print(f"Found {len(related_specs)} related specifications:")
    for spec_info in related_specs:
        print(f"  - {spec_info['spec']}")
        print(f"    Components: {', '.join(spec_info['components'])}")
    print()
    
    # Analyze conflicts
    print("Analyzing conflicts...")
    conflicts = analyze_conflicts(related_specs)
    deployment_conflicts = check_deployment_conflicts()
    
    all_conflicts = conflicts + deployment_conflicts
    
    print(f"Found {len(all_conflicts)} potential conflicts:")
    for i, conflict in enumerate(all_conflicts, 1):
        print(f"\n{i}. {conflict['type']} ({conflict['severity']} severity)")
        print(f"   Component: {conflict.get('sharedComponent', conflict.get('issue'))}")
        print(f"   Description: {conflict['description']}")
        print(f"   Resolution: {conflict['resolution']}")
    
    # Generate summary
    summary = {
        'specificationName': CURRENT_SPEC,
        'otherSpecifications': [s['spec'] for s in related_specs],
        'totalConflicts': len(all_conflicts),
        'highSeverity': len([c for c in all_conflicts if c['severity'] == 'HIGH']),
        'mediumSeverity': len([c for c in all_conflicts if c['severity'] == 'MEDIUM']),
        'lowSeverity': len([c for c in all_conflicts if c['severity'] == 'LOW']),
        'conflicts': all_conflicts,
        'sharedComponents': [
            {
                'component': file,
                'affectedBySpecs': [CURRENT_SPEC, 'surrealdb-authentication-fix-and-dashboard-live-test'],
                'recommendation': f"Review both implementations of {file}"
            }
            for file in OUR_FILES.keys()
        ],
        'conflictImpulseId': f'conflict-analysis-{CURRENT_SPEC}'
    }
    
    # Save results
    output_file = f'CONFLICT_ANALYSIS_{CURRENT_SPEC}.json'
    with open(output_file, 'w') as f:
        json.dump(summary, f, indent=2)
    
    print()
    print("=" * 70)
    print(f"SUMMARY: {len(all_conflicts)} conflicts detected")
    print(f"  HIGH severity: {summary['highSeverity']}")
    print(f"  MEDIUM severity: {summary['mediumSeverity']}")
    print(f"  LOW severity: {summary['lowSeverity']}")
    print()
    print(f"Results saved to: {output_file}")
    print("=" * 70)
    
    return 0 if len(all_conflicts) == 0 else 1

if __name__ == '__main__':
    import sys
    sys.exit(main())
