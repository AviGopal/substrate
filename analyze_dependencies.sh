#!/bin/bash

cd /home/avi/documents/work/exp-repo/metabob-devbob/repos/metabob-opencode/packages/opencode

echo "{"
echo "  \"files\": ["

first=true
find src -type f -name "*.ts" | grep -E "(session/activity|session/impulse|session/memory|acp/|tool/activity|tool/impulse|tool/memory|tool/acp)" | sort | while read file; do
    if [ "$first" = false ]; then
        echo ","
    fi
    first=false
    
    # Get line count
    loc=$(wc -l < "$file" 2>/dev/null || echo 0)
    
    # Determine category
    category=""
    case "$file" in
        *activity*) category="activity" ;;
        *impulse*) category="impulse" ;;
        *memory*) category="memory" ;;
        *acp*) category="acp" ;;
        *) category="other" ;;
    esac
    
    echo -n "    {"
    echo -n "\"path\": \"$file\", "
    echo -n "\"loc\": $loc, "
    echo -n "\"category\": \"$category\", "
    
    # Get imports FROM this file
    echo -n "\"imports\": ["
    imports=$(grep "^import" "$file" 2>/dev/null | grep -o "from [\"'][^\"']*[\"']" | sed "s/from [\"']//" | sed "s/[\"']$//" | sort -u)
    first_import=true
    for import in $imports; do
        if [ "$first_import" = false ]; then
            echo -n ", "
        fi
        first_import=false
        echo -n "\"$import\""
    done
    echo -n "], "
    
    # Get who imports this file (importedBy)
    echo -n "\"importedBy\": ["
    # Convert file path to import path (remove src/ and .ts)
    import_path=$(echo "$file" | sed 's|^src/||' | sed 's|\.ts$||')
    importers=$(grep -r "from.*[\"']\..*$import_path[\"']" src/ --include="*.ts" 2>/dev/null | cut -d: -f1 | sort -u)
    importers2=$(grep -r "from.*[\"']$import_path[\"']" src/ --include="*.ts" 2>/dev/null | cut -d: -f1 | sort -u)
    all_importers=$(echo -e "$importers\n$importers2" | sort -u | grep -v "^$")
    
    first_importer=true
    for importer in $all_importers; do
        if [ "$first_importer" = false ]; then
            echo -n ", "
        fi
        first_importer=false
        echo -n "\"$importer\""
    done
    echo -n "]"
    echo -n "}"
done

echo ""
echo "  ],"
echo "  \"circularDeps\": [],"
echo "  \"stats\": {"
echo "    \"totalFiles\": $(find src -type f -name "*.ts" | grep -E "(session/activity|session/impulse|session/memory|acp/|tool/activity|tool/impulse|tool/memory|tool/acp)" | wc -l),"
echo "    \"totalLOC\": $(find src -type f -name "*.ts" | grep -E "(session/activity|session/impulse|session/memory|acp/|tool/activity|tool/impulse|tool/memory|tool/acp)" | xargs wc -l | tail -1 | awk '{print $1}'),"
echo "    \"byCategory\": {"
echo "      \"activity\": $(find src -type f -name "*.ts" | grep activity | wc -l),"
echo "      \"impulse\": $(find src -type f -name "*.ts" | grep impulse | wc -l),"
echo "      \"memory\": $(find src -type f -name "*.ts" | grep memory | wc -l),"
echo "      \"acp\": $(find src -type f -name "*.ts" | grep acp | wc -l)"
echo "    }"
echo "  }"
echo "}"