#!/usr/bin/env python3

import sys
from datetime import datetime, timedelta
from collections import defaultdict

# Read metadata file
data = []
with open('md_metadata.txt', 'r') as f:
    lines = f.readlines()
    for line in lines[1:]:  # Skip header
        parts = line.strip().split('|')
        if len(parts) >= 4:
            path = parts[0]
            timestamp = int(parts[1]) if parts[1].isdigit() else 0
            size = int(parts[2]) if parts[2].isdigit() else 0
            heading = parts[3] if len(parts) > 3 else ""
            data.append({
                'path': path,
                'timestamp': timestamp,
                'size': size,
                'heading': heading
            })

# Current time
now = datetime.now()
current_ts = int(now.timestamp())

# Calculate age buckets
recent = []      # < 30 days
medium = []      # 30-90 days
stale = []       # 90-180 days
obsolete = []    # > 180 days

for doc in data:
    if doc['timestamp'] == 0:
        obsolete.append(doc)
        continue
    
    age_days = (current_ts - doc['timestamp']) / 86400
    
    if age_days < 30:
        recent.append(doc)
    elif age_days < 90:
        medium.append(doc)
    elif age_days < 180:
        stale.append(doc)
    else:
        obsolete.append(doc)

# Detect potential duplicates by title similarity
def normalize_title(title):
    # Remove common prefixes and normalize
    title = title.lower()
    for prefix in ['activity', 'session', 'task', 'final', 'complete', 'summary']:
        if title.startswith(prefix):
            title = title[len(prefix):].strip('_- ')
    return title

title_groups = defaultdict(list)
for doc in data:
    normalized = normalize_title(doc['heading'])
    if normalized:
        title_groups[normalized].append(doc)

duplicates = {k: v for k, v in title_groups.items() if len(v) > 1}

# Calculate stats
total_size = sum(d['size'] for d in data)
avg_size = total_size / len(data) if data else 0

# Output JSON for processing
import json
result = {
    'stats': {
        'total_files': len(data),
        'total_size': total_size,
        'avg_size': avg_size,
        'recent_count': len(recent),
        'medium_count': len(medium),
        'stale_count': len(stale),
        'obsolete_count': len(obsolete)
    },
    'recent': recent[:100],
    'medium': medium[:100],
    'stale': stale[:100],
    'obsolete': obsolete[:100],
    'duplicates': {k: v for k, v in list(duplicates.items())[:50]}
}

print(json.dumps(result, indent=2))
