#!/usr/bin/env bash
# metabob-census.test.sh: the retire-metabob-names census finds every form of the old names, flags default
# fallbacks, classifies the file, and reads only the committed ref (never the working tree).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T="$(mktemp -d "${TMPDIR:-/tmp}/metabob-census.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
g() { git -C "$1" -c user.name=t -c user.email=t@t "${@:2}" >/dev/null 2>&1; }
R="$T/super"; mkdir -p "$R/scripts" "$R/docs" "$R/validation" "$R/repos/vx/src"
cat > "$R/scripts/a.ts" <<'EOF'
const k = process.env.METABOB_API_KEY;
const e = process.env.METABOB_ENDPOINT ?? "http://127.0.0.1:8080";
const c = process.env.METABOB_CONFIG_PATH || join(homedir(), ".metabob", "config.json");
EOF
cat > "$R/scripts/b.sh" <<'EOF'
EP="${METABOB_ENDPOINT:-http://127.0.0.1:8080}"
cfg=~/.metabob/config.json
EOF
printf 'k = os.environ.get("METABOB_API_KEY", "")\nSUBSTRATE_API_KEY=x\nk3 = os.environ.get("METABOB_API_KEY") or ""\nk4 = os.environ.get("METABOB_API_KEY")\n' > "$R/scripts/c.py"
cat > "$R/scripts/d.ts" <<'TS'
const a = process.env["METABOB_API_KEY"] ?? "";
const b = env['METABOB_ENDPOINT'] || "x";
const { METABOB_API_KEY = "" } = process.env;
const { METABOB_ENDPOINT } = process.env;
if (process.env.METABOB_API_KEY === undefined) {}
TS
cat > "$R/scripts/e.sh" <<'SH'
EP="${METABOB_ENDPOINT-http://x}"
: "${METABOB_ENDPOINT:=http://x}"
K="${METABOB_API_KEY:-$(grep '^METABOB_API_KEY=' f)}"
[ -n "${METABOB_API_KEY}" ]
SH
printf 'Set METABOB_API_KEY.\n' > "$R/docs/x.md"; printf 'echo $METABOB_API_KEY\n' > "$R/validation/t.test.sh"
g "$R" init -q; g "$R" add -A; g "$R" commit -qm c; g "$R" branch -f census-ref
printf 'k2 = process.env.METABOB_API_KEY\n' > "$R/repos/vx/src/v.ts"; g "$R/repos/vx" init -q; g "$R/repos/vx" add -A; g "$R/repos/vx" commit -qm c; g "$R/repos/vx" branch -f census-ref
echo 'METABOB_API_KEY in the working tree only' > "$R/scripts/uncommitted.ts"
out="$(bash "$HERE/metabob-census.sh" --ref census-ref --root "$R")"
row() { printf '%s\n' "$out" | awk -F'\t' -v f="$1" -v l="$2" '$2==f && $3==l'; }
[ "$(row scripts/a.ts 1 | cut -f4,5,6)" = "$(printf 'API_KEY\t0\tcode')" ] && ok "plain read: API_KEY, no fallback, code" || bad "plain read row: $(row scripts/a.ts 1)"
[ "$(row scripts/a.ts 2 | cut -f4,5)" = "$(printf 'ENDPOINT\t1')" ] && ok "?? default flagged as fallback" || bad "?? row: $(row scripts/a.ts 2)"
[ "$(row scripts/a.ts 3 | cut -f4,5)" = "$(printf 'CONFIG_PATH,PATH\t1')" ] && ok "|| default flagged; CONFIG_PATH and the .metabob path both named" || bad "|| row: $(row scripts/a.ts 3)"
[ "$(row scripts/b.sh 1 | cut -f5)" = 1 ] && ok '${NAME:-x} flagged as fallback' || bad ":- row: $(row scripts/b.sh 1)"
[ "$(row scripts/b.sh 2 | cut -f4,5)" = "$(printf 'PATH\t0')" ] && ok "~/.metabob path found" || bad "path row: $(row scripts/b.sh 2)"
[ "$(row scripts/c.py 1 | cut -f5)" = 1 ] && ok ".get('NAME', default) flagged as fallback" || bad "get row: $(row scripts/c.py 1)"
[ -z "$(row scripts/c.py 2)" ] && ok "SUBSTRATE_API_KEY is not counted" || bad "new name counted"
for c in "d.ts 1 1 bracket ?? default" "d.ts 2 1 bracket || default" "d.ts 3 1 destructuring default" "d.ts 4 0 destructuring WITHOUT a default" "d.ts 5 0 an === comparison" "e.sh 1 1 \${X-x}" "e.sh 2 1 \${X:=x}" "e.sh 3 1 \${X:-\$(...)}" "e.sh 4 0 a plain \${X}" "c.py 3 1 python .get(X) or" "c.py 4 0 python .get(X) without a default"; do
  set -- $c; f=$1; l=$2; want=$3; shift 3
  got="$(row "scripts/$f" "$l" | cut -f5)"; [ "$got" = "$want" ] && ok "fallback=$want: $*" || bad "fallback for $f:$l ($*) is '${got:-no row}', want $want"
done
[ "$(printf '%s\n' "$out" | awk -F'\t' '$2=="scripts/e.sh" && $3==3' | wc -l)" = 1 ] && ok "a line with two old-name reads and a default is ONE row" || bad "e.sh:3 counted more than once"
[ "$(row docs/x.md 1 | cut -f6)" = doc ] && [ "$(row validation/t.test.sh 1 | cut -f6)" = test ] && ok "doc and test kinds" || bad "kinds: $(row docs/x.md 1) / $(row validation/t.test.sh 1)"
printf '%s\n' "$out" | grep -q "^vx	src/v.ts	1	API_KEY" && ok "submodule repos under repos/ are read" || bad "submodule row missing"
printf '%s\n' "$out" | grep -q uncommitted.ts && bad "working-tree file counted" || ok "only the committed ref counts (an uncommitted file is ignored)"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
