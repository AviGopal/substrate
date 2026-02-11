#!/bin/bash

echo "path|git_timestamp|file_size|first_heading"

find . -type f -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*" \
  -not -path "*/.git/*" \
  -not -path "*/vendor/*" \
  2>/dev/null | while read -r file; do
  
  # Get git timestamp (last commit time) or fall back to file stat
  if git_ts=$(git log -1 --format=%ct "$file" 2>/dev/null) && [ -n "$git_ts" ]; then
    timestamp="$git_ts"
  else
    # Fall back to stat if file not in git
    timestamp=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null || echo "0")
  fi
  
  # Get file size in bytes
  size=$(stat -c %s "$file" 2>/dev/null || stat -f %z "$file" 2>/dev/null || echo "0")
  
  # Extract first heading (first line starting with #)
  heading=$(grep -m 1 "^#" "$file" 2>/dev/null | sed 's/^#* *//' | tr '|' '/' | head -c 100)
  
  # If no heading found, use filename
  if [ -z "$heading" ]; then
    heading=$(basename "$file" .md)
  fi
  
  echo "$file|$timestamp|$size|$heading"
done | sort -t'|' -k2 -rn

