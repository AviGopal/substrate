#!/bin/bash

PROJECT_FILES=$(find /workspace/git/super-repo/Substrate/Projects -name "*.md")

for file_path in $PROJECT_FILES; do
    echo "Processing file: $file_path"
    temp_file=$(mktemp)
    
    TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
    
    awk -v timestamp="$TIMESTAMP" '{
        if ($0 ~ /^## To do/) {
            in_todo_section = 1
        } else if (in_todo_section == 1 && $0 !~ /^- \[ \]/ && length($0) > 0) {
            # If we are in a todo section and encounter a non-todo, non-empty line,
            # we assume the todo section has ended.
            in_todo_section = 0
        }

        if (in_todo_section == 1 && $0 ~ /^- \[ \]/) {
            # This is an undispatched todo item
            gsub(/^- \[ \]/, "- [x]")
            print $0 " [DISPATCHED:" timestamp "]"
        } else {
            # Print all other lines as is
            print
        }
    }' "$file_path" > "$temp_file"
    
    mv "$temp_file" "$file_path"
done
