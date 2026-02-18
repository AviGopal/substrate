#!/bin/bash
# Quick Start: DevBob Rebranding
# Run this script to begin the rebranding process

set -e

REPO_DIR="repos/metabob-opencode"
SCRIPTS_DIR="$REPO_DIR/scripts/rebrand"

echo "🚀 DevBob Rebranding - Quick Start"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -d "$REPO_DIR" ]; then
  echo "❌ Error: $REPO_DIR not found"
  echo "   Please run this script from: /home/avi/documents/work/exp-repo/metabob-devbob/"
  exit 1
fi

cd "$REPO_DIR"

echo "📍 Current directory: $(pwd)"
echo "📍 Current branch: $(git branch --show-current)"
echo ""

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  Warning: You have uncommitted changes"
  echo ""
  git status --short
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "📝 This script will:"
echo "  1. Create a new branch: rebrand/opencode-to-devbob"
echo "  2. Create rebranding automation scripts in scripts/rebrand/"
echo "  3. Provide next steps for manual execution"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Create rebrand branch
echo ""
echo "🌿 Creating branch: rebrand/opencode-to-devbob"
git checkout -b rebrand/opencode-to-devbob || {
  echo "⚠️  Branch already exists, switching to it"
  git checkout rebrand/opencode-to-devbob
}

# Create scripts directory
echo "📁 Creating scripts/rebrand/ directory"
mkdir -p scripts/rebrand

# Create automation scripts
echo "📝 Creating automation scripts..."

cat > scripts/rebrand/step1-packages.sh << 'EOF'
#!/bin/bash
set -e
echo "🔄 Step 1: Rebranding package names"
echo "   @opencode-ai/* → @metabob/*"
echo "   opencode → devbob"
echo ""

count=0
find . -name "package.json" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
  if grep -q "@opencode-ai\|\"opencode\"" "$file"; then
    echo "  📦 Updating: $file"
    sed -i.bak 's/@opencode-ai\//@metabob\//g' "$file"
    sed -i.bak 's/"opencode"/"devbob"/g' "$file"
    sed -i.bak 's/"name": "opencode"/"name": "devbob"/g' "$file"
    rm "$file.bak"
    count=$((count + 1))
  fi
done

echo ""
echo "✅ Updated package names in $count files"
EOF

cat > scripts/rebrand/step2-imports.sh << 'EOF'
#!/bin/bash
set -e
echo "🔄 Step 2: Rebranding TypeScript imports"
echo ""

count=0
find packages -type f \( -name "*.ts" -o -name "*.tsx" \) -not -path "*/node_modules/*" | while read file; do
  if grep -q "@opencode-ai" "$file"; then
    sed -i.bak 's/@opencode-ai\//@metabob\//g' "$file"
    sed -i.bak 's/from "opencode"/from "devbob"/g' "$file"
    rm "$file.bak"
    count=$((count + 1))
  fi
done

echo "✅ Updated imports in $count files"
EOF

cat > scripts/rebrand/step3-urls.sh << 'EOF'
#!/bin/bash
set -e
echo "🔄 Step 3: Rebranding GitHub URLs"
echo "   sst/opencode → metabobproject/devbob"
echo ""

count=0
find . -type f \( -name "*.md" -o -name "*.json" -o -name "*.yml" -o -name "*.yaml" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" | while read file; do
  if grep -q "sst/opencode\|github.com/sst/opencode" "$file"; then
    echo "  🔗 Updating: $file"
    sed -i.bak 's|github\.com/sst/opencode|github.com/metabobproject/devbob|g' "$file"
    sed -i.bak 's|sst/opencode|metabobproject/devbob|g' "$file"
    rm "$file.bak"
    count=$((count + 1))
  fi
done

echo "✅ Updated URLs in $count files"
EOF

cat > scripts/rebrand/step4-binaries.sh << 'EOF'
#!/bin/bash
set -e
echo "🔄 Step 4: Rebranding binary references"
echo ""

# Update binary references in build/publish scripts
if [ -d "packages/devbob/script" ]; then
  find packages/devbob/script -type f -name "*.ts" | while read file; do
    echo "  🔧 Updating: $file"
    sed -i.bak 's/opencode-linux/devbob-linux/g' "$file"
    sed -i.bak 's/opencode-darwin/devbob-darwin/g' "$file"
    sed -i.bak 's/opencode-windows/devbob-windows/g' "$file"
    sed -i.bak 's/opencode\.exe/devbob.exe/g' "$file"
    sed -i.bak 's/"opencode"/"devbob"/g' "$file"
    rm "$file.bak"
  done
else
  echo "  ⚠️  packages/devbob/script not found (packages/opencode not yet renamed)"
fi

echo "✅ Binary references updated"
EOF

cat > scripts/rebrand/step5-rename-dirs.sh << 'EOF'
#!/bin/bash
set -e
echo "🔄 Step 5: Renaming directories"
echo ""

if [ -d "packages/opencode" ]; then
  echo "  📁 Renaming: packages/opencode → packages/devbob"
  git mv packages/opencode packages/devbob
  echo "  ✅ Directory renamed"
else
  echo "  ⚠️  packages/opencode not found (already renamed?)"
fi

if [ -d "packages/devbob/bin" ]; then
  cd packages/devbob/bin
  if [ -f "opencode" ]; then
    echo "  📁 Renaming: bin/opencode → bin/devbob"
    git mv opencode devbob
  fi
  if [ -f "opencode.cmd" ]; then
    echo "  📁 Renaming: bin/opencode.cmd → bin/devbob.cmd"
    git mv opencode.cmd devbob.cmd
  fi
  cd ../../..
  echo "  ✅ Binaries renamed"
fi
EOF

cat > scripts/rebrand/run-all.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 DevBob Rebranding - Automated Execution"
echo "=========================================="
echo ""
echo "This will execute all rebranding steps:"
echo "  1. Package names"
echo "  2. TypeScript imports"
echo "  3. GitHub URLs"
echo "  4. Binary references"
echo "  5. Directory renames"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Run all steps
./scripts/rebrand/step1-packages.sh
echo ""
./scripts/rebrand/step2-imports.sh
echo ""
./scripts/rebrand/step3-urls.sh
echo ""
./scripts/rebrand/step4-binaries.sh
echo ""
./scripts/rebrand/step5-rename-dirs.sh

echo ""
echo "✅ All automated steps complete!"
echo ""
echo "📋 Next manual steps:"
echo "  1. Review changes: git status && git diff"
echo "  2. Update root package.json scripts (packages/opencode → packages/devbob)"
echo "  3. Test typecheck: bun run typecheck"
echo "  4. Commit: git commit -am 'rebrand: opencode → devbob - automated changes'"
echo ""
EOF

# Make scripts executable
chmod +x scripts/rebrand/*.sh

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "  Option A - Automated (Recommended):"
echo "    cd $REPO_DIR"
echo "    ./scripts/rebrand/run-all.sh"
echo ""
echo "  Option B - Manual (Step by step):"
echo "    cd $REPO_DIR"
echo "    ./scripts/rebrand/step1-packages.sh"
echo "    ./scripts/rebrand/step2-imports.sh"
echo "    ./scripts/rebrand/step3-urls.sh"
echo "    ./scripts/rebrand/step4-binaries.sh"
echo "    ./scripts/rebrand/step5-rename-dirs.sh"
echo ""
echo "  After running scripts:"
echo "    - Review: git diff"
echo "    - Test: bun run typecheck"
echo "    - Commit: git commit -am 'rebrand: opencode → devbob'"
echo ""
echo "📖 Full documentation: REBRANDING_PLAN.md"
echo ""
