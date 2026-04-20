#!/bin/bash
# Quick-start script for learning dashboard

echo "═══════════════════════════════════════════════════════════════════"
echo "  MiniBob Learning State Dashboard"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "This dashboard combines:"
echo "  • Terminal rendering (ANSI colors, formatting)"
echo "  • React components (Ink library)"
echo "  • Database queries (Thompson Sampling, execution traces)"
echo ""
echo "To show the vessel's learning state in real-time."
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies (React + Ink)..."
    bun install
    echo ""
fi

echo "Select dashboard mode:"
echo ""
echo "  1. Mock data (demo with sample data)"
echo "  2. Live database (requires backend access)"
echo "  3. As activity (through vessel)"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "▓▓▓ Running Mock Dashboard ▓▓▓"
        echo ""
        echo "Press Ctrl+C to exit"
        echo ""
        sleep 2
        bun run learning-dashboard.tsx
        ;;
    2)
        echo ""
        echo "▓▓▓ Running Live Dashboard ▓▓▓"
        echo ""

        if [ -z "$METABOB_API_KEY" ]; then
            echo "⚠ Warning: METABOB_API_KEY not set"
            echo "   Dashboard will run in offline mode"
            echo ""
            sleep 2
        fi

        echo "Backend: ${ACTIVITY_API_URL:-https://activity.metabob.com}"
        echo "Press Ctrl+C to exit"
        echo ""
        sleep 2
        bun run learning-dashboard-live.tsx
        ;;
    3)
        echo ""
        echo "▓▓▓ Running as Activity ▓▓▓"
        echo ""
        echo "Activity: demo:learning-dashboard"
        echo "Mode: mock"
        echo "Duration: 30 seconds"
        echo ""
        sleep 2
        cd ../repos/minibob
        bun run index.ts --single "Execute the learning dashboard demonstration from activities/demo/learning-dashboard.json with mode=mock for 30 seconds"
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Dashboard Demonstration Complete"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "What you saw:"
echo "  • Real-time React rendering in terminal"
echo "  • Thompson Sampling scores (α/β values)"
echo "  • Activity performance metrics"
echo "  • Execution history"
echo ""
echo "Key insights:"
echo "  • Vessel learning is observable"
echo "  • Thompson Sampling evolves over time"
echo "  • Dashboard IS an activity (meta!)"
echo "  • Everything is composable"
echo ""
