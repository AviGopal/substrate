#!/usr/bin/env python3

import json
from datetime import datetime

# Load analysis
with open('doc_analysis.json', 'r') as f:
    analysis = json.load(f)

# Load full metadata
docs_by_timestamp = []
with open('md_metadata.txt', 'r') as f:
    lines = f.readlines()
    for line in lines[1:]:  # Skip header
        parts = line.strip().split('|')
        if len(parts) >= 4:
            path = parts[0]
            timestamp = int(parts[1]) if parts[1].isdigit() else 0
            size = int(parts[2]) if parts[2].isdigit() else 0
            heading = parts[3] if len(parts) > 3 else ""
            
            # Calculate age
            if timestamp > 0:
                age_days = (datetime.now().timestamp() - timestamp) / 86400
                date_str = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M')
            else:
                age_days = 999999
                date_str = "Unknown"
            
            docs_by_timestamp.append({
                'path': path,
                'timestamp': timestamp,
                'size': size,
                'heading': heading,
                'age_days': age_days,
                'date_str': date_str
            })

# Sort by timestamp (newest first)
docs_by_timestamp.sort(key=lambda x: x['timestamp'], reverse=True)

# Generate markdown report
output = []

output.append("# Documentation Analysis by Modification Date")
output.append(f"\n**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
output.append(f"\n**Total Files Analyzed**: {analysis['stats']['total_files']}")
output.append(f"**Total Size**: {analysis['stats']['total_size'] / 1024 / 1024:.2f} MB")
output.append(f"**Average File Size**: {analysis['stats']['avg_size'] / 1024:.2f} KB")

output.append("\n---\n")
output.append("## Executive Summary\n")
output.append(f"- **Recent** (< 30 days): {analysis['stats']['recent_count']} files")
output.append(f"- **Medium** (30-90 days): {analysis['stats']['medium_count']} files")
output.append(f"- **Stale** (90-180 days): {analysis['stats']['stale_count']} files")
output.append(f"- **Obsolete** (> 180 days): {analysis['stats']['obsolete_count']} files")

output.append("\n---\n")
output.append("## 📊 Age Distribution\n")

# Recent files
output.append(f"### ✅ Recent (< 30 days) - {analysis['stats']['recent_count']} files\n")
output.append("*Most active documentation, reflecting current work*\n")

recent_docs = [d for d in docs_by_timestamp if d['age_days'] < 30]
output.append("\n#### Top 50 Most Recently Modified:\n")
for i, doc in enumerate(recent_docs[:50], 1):
    size_kb = doc['size'] / 1024
    output.append(f"{i}. **{doc['path']}**")
    output.append(f"   - Modified: {doc['date_str']} ({int(doc['age_days'])} days ago)")
    output.append(f"   - Size: {size_kb:.1f} KB")
    output.append(f"   - Title: {doc['heading']}")
    output.append("")

# Medium files
medium_docs = [d for d in docs_by_timestamp if 30 <= d['age_days'] < 90]
output.append(f"\n### ⚠️ Medium (30-90 days) - {len(medium_docs)} files\n")
output.append("*May need review or updating*\n")
for doc in medium_docs:
    size_kb = doc['size'] / 1024
    output.append(f"- **{doc['path']}**")
    output.append(f"  - Modified: {doc['date_str']} ({int(doc['age_days'])} days ago)")
    output.append(f"  - Size: {size_kb:.1f} KB")
    output.append(f"  - Title: {doc['heading']}")
    output.append("")

# Stale files
stale_docs = [d for d in docs_by_timestamp if 90 <= d['age_days'] < 180]
output.append(f"\n### 🔶 Stale (90-180 days) - {len(stale_docs)} files\n")
output.append("*Likely outdated, consider archiving or updating*\n")
for doc in stale_docs:
    size_kb = doc['size'] / 1024
    output.append(f"- **{doc['path']}**")
    output.append(f"  - Modified: {doc['date_str']} ({int(doc['age_days'])} days ago)")
    output.append(f"  - Size: {size_kb:.1f} KB")
    output.append(f"  - Title: {doc['heading']}")
    output.append("")

# Obsolete files
obsolete_docs = [d for d in docs_by_timestamp if d['age_days'] >= 180]
output.append(f"\n### 🔴 Obsolete (> 180 days) - {len(obsolete_docs)} files\n")
output.append("*Strong candidates for archiving or deletion*\n")
for doc in obsolete_docs:
    size_kb = doc['size'] / 1024
    output.append(f"- **{doc['path']}**")
    output.append(f"  - Modified: {doc['date_str']} ({int(doc['age_days'])} days ago)")
    output.append(f"  - Size: {size_kb:.1f} KB")
    output.append(f"  - Title: {doc['heading']}")
    output.append("")

output.append("\n---\n")
output.append("## 🔍 Duplicate Detection\n")
output.append("*Files with similar titles that may contain overlapping content*\n")

# Find duplicates by similar titles
from collections import defaultdict

def get_key_terms(heading):
    """Extract key terms from heading for similarity matching"""
    import re
    # Convert to lowercase and remove special chars
    clean = re.sub(r'[^a-z0-9\s]', '', heading.lower())
    # Split and filter common words
    stopwords = {'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during'}
    words = [w for w in clean.split() if w not in stopwords and len(w) > 3]
    return set(words)

# Group by key terms
term_groups = defaultdict(list)
for doc in docs_by_timestamp:
    if doc['heading']:
        terms = get_key_terms(doc['heading'])
        # Create fingerprint from sorted terms
        fingerprint = ' '.join(sorted(terms)[:5])  # Use first 5 terms
        if fingerprint:
            term_groups[fingerprint].append(doc)

duplicates = {k: v for k, v in term_groups.items() if len(v) > 1}

if duplicates:
    output.append(f"\n**Found {len(duplicates)} potential duplicate groups:**\n")
    for i, (fingerprint, docs) in enumerate(list(duplicates.items())[:30], 1):
        output.append(f"\n### Group {i}: {fingerprint}\n")
        for doc in docs[:10]:  # Limit to 10 per group
            output.append(f"- {doc['path']}")
            output.append(f"  - {doc['heading']} ({doc['date_str']})")
        output.append("")
else:
    output.append("\nNo obvious duplicates detected.\n")

output.append("\n---\n")
output.append("## 📁 Documentation by Directory\n")

# Group by directory
dir_groups = defaultdict(list)
for doc in docs_by_timestamp:
    import os
    directory = os.path.dirname(doc['path']) or '.'
    dir_groups[directory].append(doc)

# Sort directories by file count
sorted_dirs = sorted(dir_groups.items(), key=lambda x: len(x[1]), reverse=True)

output.append("\n### Top Directories by Document Count:\n")
for directory, docs in sorted_dirs[:20]:
    total_size = sum(d['size'] for d in docs) / 1024 / 1024
    output.append(f"- **{directory}** ({len(docs)} files, {total_size:.2f} MB)")

output.append("\n---\n")
output.append("## 🎯 Recommendations\n")

output.append("\n### Immediate Actions:\n")
if obsolete_docs:
    output.append(f"1. **Review {len(obsolete_docs)} obsolete files** (> 180 days old)")
    output.append("   - Consider archiving or deleting outdated content")
    output.append("   - Update if still relevant\n")

if stale_docs:
    output.append(f"2. **Review {len(stale_docs)} stale files** (90-180 days old)")
    output.append("   - Verify accuracy against current codebase")
    output.append("   - Update or archive as needed\n")

if len(duplicates) > 5:
    output.append(f"3. **Consolidate {len(duplicates)} duplicate groups**")
    output.append("   - Merge similar documentation")
    output.append("   - Create single source of truth\n")

output.append("4. **Establish Documentation Hygiene**")
output.append("   - Set up regular review cycles (monthly/quarterly)")
output.append("   - Implement documentation retirement policy")
output.append("   - Add date metadata to all docs")
output.append("   - Consider documentation versioning\n")

output.append("\n### Documentation Hotspots:\n")
root_docs = [d for d in docs_by_timestamp if d['path'].startswith('./') and '/' not in d['path'][2:]]
if len(root_docs) > 50:
    output.append(f"- **Root directory has {len(root_docs)} markdown files** - consider organizing into subdirectories")
    output.append(f"- Total size in root: {sum(d['size'] for d in root_docs) / 1024 / 1024:.2f} MB\n")

output.append("\n---\n")
output.append("## 📈 Statistics Summary\n")
output.append(f"- **Newest file**: {docs_by_timestamp[0]['path']} ({docs_by_timestamp[0]['date_str']})")
if obsolete_docs:
    oldest = min(obsolete_docs, key=lambda x: x['timestamp'])
    output.append(f"- **Oldest file**: {oldest['path']} ({oldest['date_str']})")
output.append(f"- **Largest file**: {max(docs_by_timestamp, key=lambda x: x['size'])['path']} ({max(docs_by_timestamp, key=lambda x: x['size'])['size'] / 1024:.1f} KB)")
output.append(f"- **Average file age**: {sum(d['age_days'] for d in docs_by_timestamp) / len(docs_by_timestamp):.1f} days")

# Write report
with open('doc-jiggle-analysis-new.md', 'w') as f:
    f.write('\n'.join(output))

print("Report generated: doc-jiggle-analysis-new.md")
print(f"Total lines: {len(output)}")
