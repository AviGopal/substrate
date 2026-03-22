#!/usr/bin/env python3

import os
import re
import json
import subprocess
from pathlib import Path

# Change to the correct directory
os.chdir('/home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode')

def get_line_count(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return sum(1 for line in f)
    except:
        return 0

def get_imports_from_file(file_path):
    imports = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            # Match import statements with from clause
            pattern = r'import[^;]*from\s+["\']([^"\']*)["\']'
            matches = re.findall(pattern, content, re.MULTILINE)
            imports.extend(matches)
            
            # Also match dynamic imports
            dynamic_pattern = r'import\(["\']([^"\']*)["\']\)'
            dynamic_matches = re.findall(dynamic_pattern, content)
            imports.extend(dynamic_matches)
            
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
    
    return sorted(list(set(imports)))

def find_importers_of_file(target_file, all_ts_files):
    """Find which files import the target file"""
    # Convert file path to potential import paths
    rel_path = target_file.replace('src/', '').replace('.ts', '')
    
    import_patterns = [
        f"from [\"'].*{rel_path}[\"']",
        f"from [\"']\\..*{rel_path}[\"']",  
        f"from [\"']\\.\\..*{rel_path}[\"']",
        f"from [\"']@/.*{rel_path}[\"']",
        f"import\\([\"'].*{rel_path}[\"']\\)"
    ]
    
    importers = []
    
    for ts_file in all_ts_files:
        if ts_file == target_file:
            continue
            
        try:
            with open(ts_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                for pattern in import_patterns:
                    if re.search(pattern, content):
                        importers.append(ts_file)
                        break
        except:
            continue
    
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

def detect_circular_deps(files_data):
    """Simple circular dependency detection"""
    # Build import graph
    import_graph = {}
    for file_data in files_data:
        file_path = file_data['path']
        imports = []
        # Convert external imports to internal ones if they exist
        for imp in file_data['imports']:
            if imp.startswith('.') or imp.startswith('@/'):
                # Try to resolve relative imports
                if imp.startswith('@/'):
                    resolved = 'src/' + imp[2:] + '.ts'
                elif imp.startswith('./'):
                    dir_path = os.path.dirname(file_path) 
                    resolved = os.path.normpath(os.path.join(dir_path, imp[2:] + '.ts'))
                elif imp.startswith('../'):
                    dir_path = os.path.dirname(file_path)
                    resolved = os.path.normpath(os.path.join(dir_path, imp + '.ts'))
                else:
                    continue
                    
                if any(f['path'] == resolved for f in files_data):
                    imports.append(resolved)
        
        import_graph[file_path] = imports
    
    # DFS to find cycles
    circular_deps = []
    visited = set()
    rec_stack = set()
    
    def has_cycle(node, path):
        if node in rec_stack:
            # Found cycle
            cycle_start = path.index(node)
            cycle = path[cycle_start:] + [node]
            return cycle
        
        if node in visited:
            return None
            
        visited.add(node)
        rec_stack.add(node)
        
        for neighbor in import_graph.get(node, []):
            cycle = has_cycle(neighbor, path + [node])
            if cycle:
                return cycle
                
        rec_stack.remove(node)
        return None
    
    for node in import_graph:
        if node not in visited:
            cycle = has_cycle(node, [])
            if cycle:
                circular_deps.append(cycle)
    
    return circular_deps

# Main execution
print("Building comprehensive dependency graph...")

# Get all TypeScript files  
result = subprocess.run(['find', 'src', '-name', '*.ts', '-type', 'f'], 
                       capture_output=True, text=True)
all_ts_files = [f.strip() for f in result.stdout.split('\n') if f.strip()]

# Filter target files
target_pattern = re.compile(r'(session/activity|session/impulse|session/memory|acp/|tool/activity|tool/impulse|tool/memory|tool/acp)')
target_files = [f for f in all_ts_files if target_pattern.search(f)]
target_files.sort()

print(f"Analyzing {len(target_files)} target files out of {len(all_ts_files)} total TypeScript files...")

files_data = []
total_loc = 0
category_counts = {'activity': 0, 'impulse': 0, 'memory': 0, 'acp': 0, 'other': 0}

for i, file_path in enumerate(target_files):
    print(f"Processing {i+1}/{len(target_files)}: {file_path}")
    
    if not os.path.exists(file_path):
        continue
    
    loc = get_line_count(file_path)
    imports = get_imports_from_file(file_path)
    importers = find_importers_of_file(file_path, all_ts_files)
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

print("Detecting circular dependencies...")
circular_deps = detect_circular_deps(files_data)

# Create final result
result_data = {
    'files': files_data,
    'circularDeps': circular_deps,
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

print(f"\\nDependency graph saved to {output_path}")
print(f"Total files analyzed: {len(target_files)}")
print(f"Total lines of code: {total_loc}")
print(f"Category breakdown: {category_counts}")
print(f"Circular dependencies found: {len(circular_deps)}")

# Show some key statistics
high_import_files = [f for f in files_data if len(f['imports']) > 10]
high_dependent_files = [f for f in files_data if len(f['importedBy']) > 5]

print(f"\\nFiles with >10 imports: {len(high_import_files)}")
print(f"Files imported by >5 others: {len(high_dependent_files)}")

if high_dependent_files:
    print("\\nMost depended-upon files:")
    for f in sorted(high_dependent_files, key=lambda x: len(x['importedBy']), reverse=True)[:5]:
        print(f"  {f['path']}: {len(f['importedBy'])} dependents")