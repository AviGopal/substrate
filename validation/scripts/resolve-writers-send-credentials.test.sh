#!/usr/bin/env bash
# resolve-writers-send-credentials.test.sh — a script that writes through a resolve route
# must send a credential on every request it makes to that route.
#
#   bash validation/scripts/resolve-writers-send-credentials.test.sh [repo-root]
#
# WHY. development-vessel authenticates write-type pointers (every `*_write` shape) posted to
# /v2/impulses/resolve and /resolvers/execute against identity-vessel. A writer that sends no
# `Authorization: ApiKey <key>` is answered 401, and a fire-and-forget writer (`|| true`,
# an unchecked fetch) loses its gap, pool impulse or memory note with no visible error: the
# detector fired and nothing is queryable. This lint is the class detector for that defect, so
# a new uncredentialed writer is refused at commit instead of found by a silent gap store.
#
# WHAT IT SCANS. Every *.sh, *.ts (not *.d.ts) and *.mjs under scripts/ and .claude/hooks/,
# node_modules excluded. Compiled *.js siblings under scripts/ are not scanned: no unit, hook or
# script invokes them (the .ts is what runs). validation/scripts is not scanned: its writers are
# hand-run harnesses and this lint's own fixtures live in the temp dir it creates.
#
# THE HEURISTIC (a line scanner, deliberately simple; comment lines are ignored throughout):
#   1. A file is a WRITER when it names a write-type pointer as a quoted string: an identifier
#      ending in `_write` immediately followed by a quote (", ', `, or an escaped \"). A prose
#      mention ("the memoryNote_write resolver") does not make a file a writer.
#   2. In a writer file, a REQUEST SITE is any line naming /v2/impulses/resolve or
#      /resolvers/execute, except a line that only binds the route to a name (`const RESOLVE =
#      …`, `URL="…"`) or names it as a bare path field value (`resolve_endpoint: '/v2/…'` in a
#      registration record); for such a bound name, a line that calls `fetch(NAME` or names `$NAME` /
#      `${NAME}` next to `curl` is a request site instead. A binding whose value is an arrow
#      function (`const resolve = (p) => http("POST", "/v2/impulses/resolve", p)`) is a request
#      site itself: the route rides into a helper there.
#   3. A site is CREDENTIALED when the lines from 3 above to 8 below it carry a caller credential
#      (`ApiKey`, or `Authorization` that is not the database login: `Basic …`/`sqlAuth` go to
#      SurrealDB, not to a vessel), a curl config read from stdin or a file (`-K`, `--config`),
#      or a name the file binds to a credential: a function, const/let/var or shell variable
#      whose definition is within the 15 lines above a credential line (a `headers()` helper, a
#      `HEADERS` object, a `post()` wrapper that sets the header). A binding of a request's
#      result (`const r = await fetch(…)`) is never such a name.
#   Every request site in a writer file must be credentialed — reads included. A line scanner
#   cannot tell a read from a write whose pointer is assembled elsewhere (a wrapper such as
#   emit_gap is called with the payload many lines away), and a credential on a read costs
#   nothing. Known blind spots: a route held in a variable defined in another file, and a
#   request whose credential sits more than 3 lines above or 8 below the route line.
#
# TWO MORE PREDICATES ON THE SAME CLASS (the key has to arrive, and its absence has to be heard):
#   4. KEY ON ARGV — in EVERY scanned file, writer or not: a header option (`-H`/`--header`) whose
#      value is an ApiKey or x-api-key credential expanded from a variable (`-H "Authorization:
#      ApiKey $KEY"`, `-H 'x-api-key: ${K}'`, including inside an `sh -c "…"` string). argv is
#      world-readable in a process listing (ps, /proc/<pid>/cmdline) for as long as curl runs, so
#      a credential there is disclosed to every local user and container co-tenant. The key goes
#      to curl as a config line instead: on stdin (`printf … | curl -K -`) or on a file
#      descriptor (`curl -K <(apikey_cfg "$KEY")`, printf being a builtin). Bearer/JWT and
#      registry tokens are a different credential and are not linted here; neither are unit
#      files (*.service), which this lint does not scan.
#   5. SILENT WRITER — in a writer file, a request site whose request discards both its output and
#      its status: a shell request ending `>/dev/null 2>&1 || true` (or `|| :`) on its own line
#      or a continuation line, or a fetch/post chained to `.catch(() => {})` / `() => undefined` /
#      `() => null` before its statement ends. Once the vessel answers 401, such a writer loses
#      its gap or pool impulse with no line anywhere; a writer must at least say so (a journal
#      line naming the HTTP status and what was not written).
#
# CONTROLS. A writer fixture with no credential (fetch, curl, fetch through a bound route name)
# must be flagged at the exact lines; a credentialed fixture in each idiom must pass; a prose-only
# `_write` mention must not make a file a writer. Fixtures carry a placeholder, never a key.
# Prints file:line only — never a header value. Exit 0 = all pass.
set -uo pipefail
ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
ok()  { echo "  ok   $*"; }
bad() { echo "  FAIL $*"; fails=$((fails + 1)); }

SCAN_AWK='
function trim(s) { sub(/^[ \t]+/, "", s); return s }
function iscomment(s) { s = trim(s); return (s ~ /^(#|\/\/|\*|\/\*)/) }
function defname(s,   m) {
  if (match(s, /function[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*\(/)) { m = substr(s, RSTART, RLENGTH); sub(/^function[ \t]+/, "", m); sub(/[ \t]*\($/, "", m); return m }
  if (match(s, /^[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*\(\)[ \t]*\{/)) { m = substr(s, RSTART, RLENGTH); m = trim(m); sub(/[ \t]*\(.*/, "", m); return m }
  if (match(s, /(const|let|var)[ \t]+[A-Za-z_][A-Za-z0-9_]*[ \t]*[=:]/)) { m = substr(s, RSTART, RLENGTH); sub(/^(const|let|var)[ \t]+/, "", m); sub(/[ \t]*[=:]$/, "", m); return m }
  if (match(s, /^[ \t]*(local[ \t]+|export[ \t]+)?[A-Za-z_][A-Za-z0-9_]*=/)) { m = substr(s, RSTART, RLENGTH); m = trim(m); sub(/^(local|export)[ \t]+/, "", m); sub(/=$/, "", m); return m }
  return ""
}
# A caller credential: an ApiKey header, or an Authorization header that is not the database
# login (Basic / sqlAuth go to SurrealDB, not to a vessel).
function credline(s) { return (s ~ /ApiKey/ || (s ~ /Authorization/ && s !~ /Basic|sql[A-Za-z]*Auth/)) }
BEGIN { ROUTE = "/v2/impulses/resolve|/resolvers/execute" }
NR == FNR {
  line[FNR] = $0; n = FNR
  if (iscomment($0)) next
  if ($0 ~ /[A-Za-z][A-Za-z0-9]*_write\\?["\047`]/) writer = 1
  d = ($0 ~ /(fetch\(|curl|await)/) ? "" : defname($0)
  if ($0 ~ ROUTE && d != "" && $0 !~ /=>/) { routeid[d] = 1; routedef[FNR] = 1 }
  if (d != "") defat[FNR] = d
  if (credline($0)) for (k = FNR - 15; k <= FNR; k++) if (k in defat) authid[defat[k]] = 1
  next
}
FNR == 1 { if (!writer) exit }
{
  if (iscomment($0) || routedef[FNR]) next
  site = ($0 ~ ROUTE && $0 !~ /[A-Za-z_]["\047]?[ \t]*:[ \t]*["\047`]\/(v2\/impulses\/resolve|resolvers\/execute)["\047`]/)
  if (!site) for (r in routeid) {
    if ($0 ~ ("fetch\\([ \t]*" r "([^A-Za-z0-9_]|$)")) { site = 1; break }
    if ($0 ~ /curl/ && ($0 ~ ("\\$" r "([^A-Za-z0-9_]|$)") || index($0, "${" r "}"))) { site = 1; break }
  }
  if (!site) next
  cred = 0
  for (i = FNR - 3; i <= FNR + 8 && !cred; i++) {
    if (i < 1 || i > n || iscomment(line[i])) continue
    w = line[i]
    if (credline(w) || w ~ /curl[^|]*[ \t](-K|--config)([ \t=]|$)/) { cred = 1; break }
    k = split(w, tok, /[^A-Za-z0-9_]+/)
    for (j = 1; j <= k; j++) if (tok[j] in authid) { cred = 1; break }
  }
  if (!cred) printf "%s:%d\n", DISPLAY, FNR
}'

scan_file() { # <file> <display-name> -> uncredentialed request sites, one "name:line" per line
  awk -v DISPLAY="$2" "$SCAN_AWK" "$1" "$1"
}
# Predicate 4: a credential expanded from a variable inside a header option, anywhere on a line.
ARGV_AWK='
function trim(s) { sub(/^[ \t]+/, "", s); return s }
{
  if (trim($0) ~ /^(#|\/\/|\*|\/\*)/) next
  if ($0 ~ /(-H|--header)[ \t=]*["\047]?([Aa]uthorization:[ \t]*[Aa]pi[Kk]ey|[Xx]-[Aa][Pp][Ii]-[Kk][Ee][Yy]:)[ \t]*\$/) printf "%s:%d\n", DISPLAY, FNR
}'
scan_argv_file() { # <file> <display-name> -> lines that put a key on curl argv
  awk -v DISPLAY="$2" "$ARGV_AWK" "$1"
}
# Predicate 5: a request site in a writer file whose request swallows both output and status.
SILENT_AWK='
function trim(s) { sub(/^[ \t]+/, "", s); return s }
function iscomment(s) { s = trim(s); return (s ~ /^(#|\/\/|\*|\/\*)/) }
BEGIN { ROUTE = "/v2/impulses/resolve|/resolvers/execute" }
NR == FNR { line[FNR] = $0; n = FNR; if (!iscomment($0) && $0 ~ /[A-Za-z][A-Za-z0-9]*_write\\?["\047`]/) writer = 1; next }
FNR == 1 { if (!writer) exit }
{
  if (iscomment($0) || $0 !~ ROUTE) next
  sh = (DISPLAY ~ /\.sh$/)
  for (i = FNR; i <= FNR + 15 && i <= n; i++) {
    w = line[i]
    if (w ~ />[ \t]*\/dev\/null[ \t]+2>&1[ \t]*\|\|[ \t]*(true|:)/ || w ~ /\.catch\([ \t]*(async[ \t]*)?\([ \t]*[A-Za-z_]*[ \t]*\)[ \t]*=>[ \t]*(undefined|null|\{[ \t]*\}|void 0)[ \t]*\)/) { printf "%s:%d\n", DISPLAY, FNR; break }
    if (sh && w !~ /\\[ \t]*$/) break
    if (!sh && w ~ /;[ \t]*$/) break
  }
}'
scan_silent_file() { # <file> <display-name> -> request sites in a writer that swallow output and status
  awk -v DISPLAY="$2" "$SILENT_AWK" "$1" "$1"
}
scanned_files() { # <root> -> every scanned file under scripts/ and .claude/hooks/
  local r="$1"
  for d in "$r/scripts" "$r/.claude/hooks"; do
    [ -d "$d" ] || continue
    find "$d" -type f \( -name '*.sh' -o -name '*.ts' -o -name '*.mjs' \) -not -name '*.d.ts' -not -path '*/node_modules/*' -print
  done | LC_ALL=C sort
}
scan_tree() { # <root> -> every uncredentialed request site under scripts/ and .claude/hooks/
  local r="$1" f
  scanned_files "$r" | while IFS= read -r f; do scan_file "$f" "${f#"$r"/}"; done
}
scan_tree_argv() { # <root> -> every key on curl argv under scripts/ and .claude/hooks/
  local r="$1" f
  scanned_files "$r" | while IFS= read -r f; do scan_argv_file "$f" "${f#"$r"/}"; done
}
scan_tree_silent() { # <root> -> every silent writer request under scripts/ and .claude/hooks/
  local r="$1" f
  scanned_files "$r" | while IFS= read -r f; do scan_silent_file "$f" "${f#"$r"/}"; done
}

echo "== resolve-writers-send-credentials ($ROOT)"

# ── controls ────────────────────────────────────────────────────────────────────
F="$T/fx"; mkdir -p "$F"
cat > "$F/neg.ts" <<'EOF'
const DEV = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const RESOLVE = DEV + "/v2/impulses/resolve";
async function fileGap(gap: unknown) {
  await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ impulse: { pointer: { type: "substrateGap_write", gap } } }),
  });
}
async function seed(body: unknown) {
  await fetch(RESOLVE, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function sql(q: string) {
  const r = await fetch(`${SURREAL}/sql`, { method: "POST", headers: { Authorization: `Basic ${LOGIN}` }, body: q });
  return r.json();
}
async function fileAgain(gap: unknown) {
  const r = await fetch(`${DEV}/v2/impulses/resolve`, { method: "POST", body: JSON.stringify({ impulse: { type: "substrateGap_write", gap } }) });
}
EOF
cat > "$F/neg.sh" <<'EOF'
#!/usr/bin/env bash
emit_gap() {
  curl -s --max-time 8 -X POST "$DEV_VESSEL/v2/impulses/resolve" -H 'Content-Type: application/json' -d "$1" || true
}
emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"x\"}}}}"
EOF
cat > "$F/pos.ts" <<'EOF'
const KEY = process.env.METABOB_API_KEY ?? "";
const DEV = process.env.DEV_VESSEL_ENDPOINT ?? "http://127.0.0.1:8090";
const RESOLVE = DEV + "/v2/impulses/resolve";
function hdrs(): Record<string, string> {
  return { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) };
}
async function fileGap(gap: unknown) {
  await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
    body: JSON.stringify({ impulse: { pointer: { type: "substrateGap_write", gap } } }),
  });
}
async function seed(body: unknown) {
  await fetch(RESOLVE, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}
EOF
cat > "$F/pos.sh" <<'EOF'
#!/usr/bin/env bash
emit_gap() {
  { if [ -n "${METABOB_API_KEY:-}" ]; then printf 'header = "Authorization: ApiKey %s"\n' "$METABOB_API_KEY"; fi; } \
    | curl -K - -s --max-time 8 -X POST "$DEV_VESSEL/v2/impulses/resolve" -H 'Content-Type: application/json' -d "$1" || true
}
emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\",\"gap\":{\"id\":\"x\"}}}}"
EOF
cat > "$F/prose.sh" <<'EOF'
#!/usr/bin/env bash
# reads gaps; the memoryNote_write resolver is someone else's concern
curl -s -X POST "$DEV_VESSEL/v2/impulses/resolve" -d '{"impulse":{"pointer":{"type":"substrateGap"}}}'
EOF

got="$(scan_file "$F/neg.ts" neg.ts | tr '\n' ' ')"
[ "$got" = "neg.ts:4 neg.ts:11 neg.ts:18 " ] \
  && ok "negative control (ts): an uncredentialed fetch, a fetch through a bound route name, and a fetch whose only nearby credential is a database login are flagged (neg.ts:4, :11, :18)" \
  || bad "negative control (ts): expected 'neg.ts:4 neg.ts:11 neg.ts:18', got '${got}'"
got="$(scan_file "$F/neg.sh" neg.sh | tr '\n' ' ')"
[ "$got" = "neg.sh:3 " ] && ok "negative control (sh): an uncredentialed curl inside an emit_gap wrapper is flagged (neg.sh:3)" \
  || bad "negative control (sh): expected 'neg.sh:3', got '${got}'"
got="$(scan_file "$F/pos.ts" pos.ts)"
[ -z "$got" ] && ok "positive control (ts): inline header and a header helper pass" || bad "positive control (ts) flagged: $(echo $got)"
got="$(scan_file "$F/pos.sh" pos.sh)"
[ -z "$got" ] && ok "positive control (sh): a header piped to curl -K - passes" || bad "positive control (sh) flagged: $(echo $got)"
got="$(scan_file "$F/prose.sh" prose.sh)"
[ -z "$got" ] && ok "a prose-only *_write mention does not make a file a writer" || bad "prose-only mention made a writer: $(echo $got)"

cat > "$F/argv.sh" <<'EOF'
#!/usr/bin/env bash
curl -s -X POST "$DEV/v2/impulses/resolve" -H "Authorization: ApiKey $METABOB_API_KEY" -d "$1"
curl -s -X POST "$DEV/v2/impulses/resolve" \
  -H 'Content-Type: application/json' -H "Authorization: ApiKey ${KEY:-}" -d "$1"
eng exec "$C" sh -c "curl -s http://127.0.0.1:8210/run-goal -H 'Authorization: ApiKey $client_key' -d '{}'"
curl -s "$HUB/resolve" --header "x-api-key: $KEY" -d "$1"
# a comment that quotes -H "Authorization: ApiKey $KEY" is not a request
EOF
cat > "$F/keyfd.sh" <<'EOF'
#!/usr/bin/env bash
apikey_cfg() { [ -n "${1:-}" ] && printf 'header = "Authorization: ApiKey %s"\n' "$1"; return 0; }
curl -s -X POST "$DEV/v2/impulses/resolve" -K <(apikey_cfg "$METABOB_API_KEY") -d "$1"
apikey_cfg "$KEY" | eng exec -i "$C" curl -K - -s http://127.0.0.1:8210/run-goal -d '{}'
curl -s "$REGISTRY/v2/x/manifests/y" -H "Authorization: Bearer $tok"
EOF
cat > "$F/silent.sh" <<'EOF'
#!/usr/bin/env bash
emit_gap() {
  srv_auth | curl -K - -s -X POST "$DEV_VESSEL/v2/impulses/resolve" -H 'Content-Type: application/json' -d "$1" >/dev/null 2>&1 || true
}
emit_gap2() {
  srv_auth | curl -K - -s -X POST "$DEV_VESSEL/v2/impulses/resolve" \
    -d "$1" >/dev/null 2>&1 || :
}
emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\"}}}"
EOF
cat > "$F/silent.ts" <<'EOF'
const KEY = process.env.METABOB_API_KEY ?? "";
async function emitGap(gap: unknown) {
  await fetch(`${DEV}/v2/impulses/resolve`, {
    method: "POST",
    headers: { ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
    body: JSON.stringify({ impulse: { type: "substrateGap_write", gap } }),
  }).catch(() => undefined);
}
async function report(body: unknown) {
  await post(`${DEV}/v2/impulses/resolve`, { impulse: { type: "poolImpulse_write", body } }, 5000).catch(() => {})
}
EOF
cat > "$F/loud.sh" <<'EOF'
#!/usr/bin/env bash
emit_gap() {
  local out code
  out="$(srv_auth | curl -K - -s -w '\n%{http_code}' -X POST "$DEV_VESSEL/v2/impulses/resolve" -d "$1" 2>/dev/null || printf '\n000')"
  code="${out##*$'\n'}"
  case "$code" in 2*) ;; *) echo "emit_gap FAILED http=$code" >&2 ;; esac
}
read_lease() { srv_auth | curl -K - -s -X POST "$DEV_VESSEL/v2/impulses/resolve" -d '{}' > "$st" 2>/dev/null || true; }
emit_gap "{\"impulse\":{\"pointer\":{\"type\":\"substrateGap_write\"}}}"
EOF
cat > "$F/loud.ts" <<'EOF'
const KEY = process.env.METABOB_API_KEY ?? "";
async function emitGap(id: string, gap: unknown) {
  try {
    const r = await fetch(`${DEV}/v2/impulses/resolve`, {
      method: "POST",
      headers: { ...(KEY ? { Authorization: `ApiKey ${KEY}` } : {}) },
      body: JSON.stringify({ impulse: { type: "substrateGap_write", gap } }),
    });
    if (!r.ok) console.error(`gap ${id} NOT filed: http=${r.status}`);
  } catch (e) {
    console.error(`gap ${id} NOT filed: ${String(e)}`);
  }
}
EOF

got="$(scan_argv_file "$F/argv.sh" argv.sh | tr '\n' ' ')"
[ "$got" = "argv.sh:2 argv.sh:4 argv.sh:5 argv.sh:6 " ] \
  && ok "negative control (argv): a key in -H (double- and single-quoted, inside sh -c, x-api-key, --header) is flagged (argv.sh:2, :4, :5, :6); a comment is not" \
  || bad "negative control (argv): expected 'argv.sh:2 argv.sh:4 argv.sh:5 argv.sh:6', got '${got}'"
got="$(scan_argv_file "$F/keyfd.sh" keyfd.sh)"
[ -z "$got" ] && ok "positive control (argv): a key on curl -K <(…) or on stdin to curl -K - passes; a Bearer token is out of scope" \
  || bad "positive control (argv) flagged: $(echo $got)"
got="$(scan_argv_file "$F/pos.sh" pos.sh)"
[ -z "$got" ] && ok "positive control (argv): the printf | curl -K - writer passes" || bad "positive control (argv) flagged pos.sh: $(echo $got)"
got="$(scan_silent_file "$F/silent.sh" silent.sh | tr '\n' ' ')"
[ "$got" = "silent.sh:3 silent.sh:6 " ] \
  && ok "negative control (silent, sh): a writer request ending >/dev/null 2>&1 || true (same line, continuation line) is flagged (silent.sh:3, :6)" \
  || bad "negative control (silent, sh): expected 'silent.sh:3 silent.sh:6', got '${got}'"
got="$(scan_silent_file "$F/silent.ts" silent.ts | tr '\n' ' ')"
[ "$got" = "silent.ts:3 silent.ts:10 " ] \
  && ok "negative control (silent, ts): a writer fetch/post chained to .catch(() => undefined|{}) is flagged (silent.ts:3, :10)" \
  || bad "negative control (silent, ts): expected 'silent.ts:3 silent.ts:10', got '${got}'"
got="$(scan_silent_file "$F/loud.sh" loud.sh)$(scan_silent_file "$F/loud.ts" loud.ts)"
[ -z "$got" ] && ok "positive control (silent): a writer that logs its status passes, and a read whose output goes to a file is not silent" \
  || bad "positive control (silent) flagged: $(echo $got)"

# ── the tree ────────────────────────────────────────────────────────────────────
hits="$(scan_tree "$ROOT")"
if [ -z "$hits" ]; then
  ok "every resolve-route request in a writer script under scripts/ and .claude/hooks/ sends a credential"
else
  while IFS= read -r h; do bad "$h: resolve-route request in a *_write writer sends no Authorization"; done <<< "$hits"
fi

hits="$(scan_tree_argv "$ROOT")"
if [ -z "$hits" ]; then
  ok "no script under scripts/ or .claude/hooks/ puts an ApiKey/x-api-key on curl argv"
else
  while IFS= read -r h; do bad "$h: a key on curl argv (readable in any process listing); send it with curl -K - or -K <(…)"; done <<< "$hits"
fi
hits="$(scan_tree_silent "$ROOT")"
if [ -z "$hits" ]; then
  ok "no writer under scripts/ or .claude/hooks/ discards both the output and the status of a resolve-route request"
else
  while IFS= read -r h; do bad "$h: a writer request that swallows its output and status (a 401 would lose the write with no line anywhere)"; done <<< "$hits"
fi

if [ "$fails" -eq 0 ]; then echo "PASSED"; exit 0; fi
echo "FAILED ($fails)"; exit 1
