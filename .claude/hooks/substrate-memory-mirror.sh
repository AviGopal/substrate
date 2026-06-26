#!/usr/bin/env bash
# substrate-memory-mirror.sh — PostToolUse hook (matcher: Write|Edit|MultiEdit).
# When a file under the operator memory dir is written/edited, mirror it into
# the substrate as a memoryNote_write impulse. The file is the cache; the
# substrate copy is authoritative.
#
# Fail-open: any failure is logged and swallowed (exit 0) — a memory-write hook
# must never block the tool result.
set -uo pipefail

# Anchor on the project root. Claude Code sets $CLAUDE_PROJECT_DIR when invoking
# hooks; fall back to resolving it from this script's location (hooks live at
# .claude/hooks/, two levels under the project root) when run standalone.
: "${CLAUDE_PROJECT_DIR:=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

# Claude Code's project-memory slug is the project dir path with every "/" -> "-".
MEM_SLUG="$(printf '%s' "$CLAUDE_PROJECT_DIR" | sed 's#/#-#g')"
MEM_DIR="$HOME/.claude/projects/$MEM_SLUG/memory"
MIRROR="$CLAUDE_PROJECT_DIR/scripts/substrate/mirror-memory-note.ts"
LOG="$HOME/.claude/substrate-memory-mirror.log"

input="$(cat)"
fp="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)"
[ -z "$fp" ] && exit 0

# Only memory .md files, never the MEMORY.md index
case "$fp" in
  "$MEM_DIR"/*.md) ;;
  *) exit 0 ;;
esac
case "$fp" in
  */MEMORY.md) exit 0 ;;
esac
[ -f "$fp" ] || exit 0

DEV_VESSEL_ENDPOINT="${DEV_VESSEL_ENDPOINT:-http://localhost:18090}" \
  bun "$MIRROR" "$fp" >>"$LOG" 2>&1 || echo "$(date -u) mirror failed for $fp" >>"$LOG"
exit 0
