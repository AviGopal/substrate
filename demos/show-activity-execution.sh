#!/bin/bash
# Demonstrate running terminal vessel demos as activities

echo "═══════════════════════════════════════════════════════════════════"
echo "  Demonstrating: Terminal Vessel Demos as Activities"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Concept: 'Activities All The Way Down'"
echo "  → Even demonstrations about the system are activities"
echo "  → Meta-operations flow through the vessel just like work"
echo "  → Everything is observable, traceable, and learnable"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""

echo "📋 Activity Template: terminal-vessel-demo.json"
echo ""
cat <<'EOF'
{
  "id": "demo:terminal-vessel",
  "name": "Terminal Vessel Demonstration",
  "tasks": [
    {
      "id": "run-deduplication-demo",
      "description": "Run the deduplication terminal vessel demonstration",
      "resolver": "bash",
      "config": {
        "command": "bun run demos/deduplication-vessel-demo.ts"
      }
    }
  ]
}
EOF

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "🚀 Executing Activity: demo:terminal-vessel"
echo "   Task: run-deduplication-demo"
echo "   Resolver: bash"
echo "   Variable: demo_type=deduplication"
echo ""
echo "Press Enter to execute..."
read

echo ""
echo "▓▓▓ Activity Execution Starting ▓▓▓"
echo ""

# Execute the task from the activity
cd /home/avi/documents/work/exp-repo/metabob-devbob
bun run demos/deduplication-vessel-demo.ts

echo ""
echo "▓▓▓ Activity Execution Complete ▓▓▓"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  What Just Happened?"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Traditional approach:"
echo "  • Run TypeScript file directly"
echo "  • Output to terminal"
echo "  • Not captured or traced"
echo "  • Not part of vessel ecosystem"
echo ""
echo "Activity approach (what we just did):"
echo "  • Activity template defines the task"
echo "  • Bash resolver executes TypeScript"
echo "  • Output would be captured as impulses"
echo "  • Execution would be traced to backend"
echo "  • Part of vessel learning loop"
echo ""
echo "Key insight:"
echo "  The demonstration IS an activity. It flows through"
echo "  the same execution path as any other vessel work."
echo "  This is 'activities all the way down' in practice."
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""
