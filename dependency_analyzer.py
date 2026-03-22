#!/usr/bin/env python3

import os
import re
import json
import subprocess
from pathlib import Path

def get_line_count(file_path):
    try:
        return sum(1 for line in open(file_path, 'r', encoding='utf-8', errors='ignore'))
    except:
        return 0

def get_imports_from_file(file_path):
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line in f:
                line = line.strip()
                if line.startswith('import'):
                    # Extract the 'from' part
                    from_match = re.search(r'from\s+["\']([^"\']+)["\']', line)
                    if from_match:
                        imports.append(from_match.group(1))
    except:
        pass
    return sorted(list(set(imports)))

def find_importers(file_path, base_dir):
    """Find files that import this file"""
    # Convert file path to import path
    rel_path = os.path.relpath(file_path, os.path.join(base_dir, 'src'))
    import_path = rel_path.replace('.ts', '').replace('\\', '/')
    
    importers = []
    
    # Search for imports of this file
    patterns = [
        f'from.*["\'].*{import_path}["\']',
        f'from.*["\']\..*{import_path}["\']',
        f'from.*["\']\.\..*{import_path}["\']',
        f'from.*["\']@/.*{import_path}["\']'
    ]
    
    try:
        for pattern in patterns:
            result = subprocess.run([
                'grep', '-r', pattern, os.path.join(base_dir, 'src'),
                '--include=*.ts'
            ], capture_output=True, text=True, cwd=base_dir)
            
            if result.returncode == 0:
                for line in result.stdout.split('\n'):
                    if line.strip():
                        file_match = line.split(':')[0]
                        if file_match and file_match not in importers:
                            importers.append(file_match)
    except:
        pass
        
    return sorted(list(set(importers)))

def categorize_file(file_path):
    path_lower = file_path.lower()
    if 'activity' in path_lower:
        return 'activity'
    elif 'impulse' in path_lower:
        return 'impulse'
    elif 'memory' in path_lower:
        return 'memory'
    elif 'acp' in path_lower:
        return 'acp'
    else:
        return 'other'

def main():
    base_dir = '/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode'
    os.chdir(base_dir)
    
    # Find target files
    result = subprocess.run([
        'find', 'src', '-type', 'f', '-name', '*.ts'
    ], capture_output=True, text=True)
    
    all_files = result.stdout.strip().split('\n')
    target_pattern = re.compile(r'(session/activity|session/impulse|session/memory|acp/|tool/activity|tool/impulse|tool/memory|tool/acp)')
    target_files = [f for f in all_files if target_pattern.search(f)]
    target_files.sort()
    
    print(f"Found {len(target_files)} target files")
    
    # Analyze each file
    files_data = []
    total_loc = 0
    category_counts = {'activity': 0, 'impulse': 0, 'memory': 0, 'acp': 0, 'other': 0}
    
    for file_path in target_files:
        full_path = os.path.join(base_dir, file_path)
        if not os.path.exists(full_path):
            continue
            
        loc = get_line_count(full_path)
        imports = get_imports_from_file(full_path)
        importers = find_importers(full_path, base_dir)
        category = categorize_file(file_path)
        
        total_loc += loc
        category_counts[category] += 1
        
        files_data.append({
            'path': file_path,
            'loc': loc,
            'category': category,
            'imports': imports,
            'importedBy': importers
        })
        
        print(f"Processed {file_path} ({loc} lines, {len(imports)} imports, {len(importers)} importers)")
    
    # Create final JSON structure
    result_data = {
        'files': files_data,
        'circularDeps': [],  # TODO: Implement circular dependency detection
        'stats': {
            'totalFiles': len(target_files),
            'totalLOC': total_loc,
            'byCategory': category_counts
        }
    }
    
    # Write to output file
    output_path = '/home/avi/documents/work/exp-repo/metabob-devbob/DEPENDENCY_GRAPH.json'
    with open(output_path, 'w') as f:
        json.dump(result_data, f, indent=2)
    
    print(f"\nDependency graph saved to {output_path}")
    print(f"Total files: {len(target_files)}")
    print(f"Total LOC: {total_loc}")
    print(f"Category breakdown: {category_counts}")

if __name__ == '__main__':
    main()