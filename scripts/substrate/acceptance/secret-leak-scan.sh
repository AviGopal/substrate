#!/usr/bin/env bash
# secret-leak-scan — does any value in this node's secret store appear in what the node
# records about itself? Counts only; no value is ever printed or leaves the container.
#
# WHY THIS EXISTS
#
# A secret leaves the masked store through a log as easily as through a file: the identity
# seeder printed the fleet key into the journal on every genuine first boot, and the network
# acceptance scan missed it because it searched only for the one key it had issued itself.
# The question is not "did MY key leak" but "does ANY secret this node holds appear where
# the node writes", so the patterns are the store's own values, read here, inside the node.
#
# The judge runs it on the host, against one container:
#
#   secret-leak-scan.sh node <container> -- <engine argv…>     (e.g. -- docker, -- env -i … podman)
#
# which mints a canary and streams THIS file into the container twice (the image never
# grades itself, and no value ever crosses back out):
#
#   <engine> exec <c> bash -c "<this file>" secret-leak-scan plant <canary>
#   { <engine> logs <c> 2>&1; echo "<canary>"; } \
#     | <engine> exec -i <c> bash -c "<this file>" secret-leak-scan scan <canary>
#
# node   the host side above; prints the scan's JSON and exits with its code.
# plant  writes the canary to the journal (systemd-cat).
# scan   collects the values, then counts lines carrying any of them in each source:
#          journal       journalctl over EVERY retained boot, every unit (-a, no -b)
#          docker_logs   the engine's log of this container, piped in on stdin. That log is
#                        the entrypoint's transcript up to the hand-off to systemd (PID 1's
#                        stdout is /dev/null afterwards, so nothing inside can append to it);
#                        the judge appends the canary to the stream it pipes, and the stream
#                        must also carry the entrypoint's hand-off line, so a stream that is
#                        not this container's log reads as blind, not clean
#          trace_store   a `surreal export` of activity-system/learning_loop, when this node
#                        runs the datastore (a canary row is written to a scratch table for
#                        the export, then the table is removed). DATA rows are judged; schema
#                        (DEFINE …) lines are counted apart and not judged, because the
#                        datastore's JWT access definition carries JWT_SECRET by design
#
# VALUES: every NAME=VALUE in the persisted store (the store file in the masked store
# directory and the legacy flat store, as the image's secrets-manifest.json names them, and
# each .prev), every file under /etc/substrate/private, and the secret-named entries of
# /etc/substrate/env.
# Excluded, each for a stated reason: values shorter than 16 characters (owner names, mode
# words and flags match ordinary text; no generated secret is that short); URLs without
# userinfo and absolute paths (addresses, not credentials); names ending _SHA256 or
# _FINGERPRINT (digests published to identify a secret, not the secret).
#
# POSITIVE CONTROLS. The canary is added to the same pattern file the values are, so the
# grep that counts secrets is the grep that must find the canary; a source whose canary
# count is 0 is reported "scan_blind", never 0. The value set must name METABOB_API_KEY
# (an empty pattern file matches nothing and would read as clean).
#
# OUTPUT (stdout, one JSON line): store files read, how many names, and per source
# {hits, canary, by_name}. by_name carries NAMES only, for names with hits.
# EXIT: 0 clean · 1 a secret value was found in some source · 2 blind (a control failed)
# · 64 usage.
set -uo pipefail

mode="${1:-}"; canary="${2:-}"
if [ "$mode" = node ]; then
  c="${2:-}"; [ -n "$c" ] && [ "${3:-}" = "--" ] && [ $# -ge 4 ] \
    || { echo "usage: secret-leak-scan.sh node <container> -- <engine argv…>" >&2; exit 64; }
  shift 3; engine=("$@")
  self="$(cat "${BASH_SOURCE[0]}")" || exit 64
  canary="secret-leak-scan-canary-$(od -An -tx8 -N8 /dev/urandom | tr -d ' \n')"
  "${engine[@]}" exec "$c" bash -c "$self" secret-leak-scan plant "$canary" >/dev/null 2>&1
  sleep 1
  { "${engine[@]}" logs "$c" 2>&1; echo "$canary"; } \
    | "${engine[@]}" exec -i "$c" bash -c "$self" secret-leak-scan scan "$canary"
  exit "${PIPESTATUS[1]}"
fi
case "$mode" in plant|scan) ;; *) echo "usage: secret-leak-scan node|plant|scan …" >&2; exit 64 ;; esac
[ "${#canary}" -ge 16 ] || { echo "secret-leak-scan: the canary must be at least 16 characters" >&2; exit 64; }

if [ "$mode" = plant ]; then
  printf 'secret-leak-scan canary %s\n' "$canary" | systemd-cat -t secret-leak-scan 2>/dev/null
  exit 0
fi

umask 077
work="$(mktemp -d /run/secret-leak-scan.XXXXXX)" || exit 2
trap 'rm -rf "$work"' EXIT
pairs="$work/pairs"; : >"$pairs"   # NAME<TAB>VALUE, root-only, removed on exit

add_file() {  # file [name-filter-regex]
  local f="$1" re="${2:-}" line name val
  [ -f "$f" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    name="${BASH_REMATCH[2]}"; val="${BASH_REMATCH[3]}"
    [ -n "$re" ] && ! [[ "$name" =~ $re ]] && continue
    val="${val%$'\r'}"
    if [[ "$val" =~ ^\"(.*)\"$ ]] || [[ "$val" =~ ^\'(.*)\'$ ]]; then val="${BASH_REMATCH[1]}"; fi
    [ "${#val}" -ge 16 ] || continue
    [[ "$name" =~ (_SHA256|_FINGERPRINT)$ ]] && continue
    [[ "$val" =~ ^[a-z][a-z0-9+.-]*://[^@/]*(/.*)?$ ]] && [[ "$val" != *@* ]] && continue
    [[ "$val" == /* ]] && continue
    printf '%s\t%s\n' "$name" "$val" >>"$pairs"
  done <"$f"
  store_files+=("$f")
}
store_files=()
man=/usr/local/share/substrate/secrets-manifest.json
sd="$(jq -r '.store_dir // empty' "$man" 2>/dev/null)"; sf="$(jq -r '.store_file // empty' "$man" 2>/dev/null)"
ls_="$(jq -r '.legacy_store // empty' "$man" 2>/dev/null)"
[ -n "$sd" ] || sd=/workspace/.substrate-private; [ -n "$sf" ] || sf=substrate-secrets
[ -n "$ls_" ] || ls_=/workspace/.substrate-secrets   # legacy-path: an image whose manifest predates the store fields
for f in "$sd/$sf" "$sd/$sf.prev" "$ls_" "$ls_.prev"; do
  [ -L "$f" ] && continue   # the migrated flat path is a symlink into the store directory
  add_file "$f"
done
if [ -d /etc/substrate/private ]; then
  while IFS= read -r -d '' f; do add_file "$f"; done < <(find /etc/substrate/private -type f -print0 2>/dev/null)
fi
add_file /etc/substrate/env '(KEY|SECRET|TOKEN|PASS|PASSWORD|PAT|CREDENTIAL|CREDENTIALS)$'

# One row per distinct value (the first name that carried it names it).
sort -t $'\t' -k2,2 -u "$pairs" -o "$pairs"
cut -f2- "$pairs" >"$work/values"
names_n="$(cut -f1 "$pairs" | sort -u | grep -c .)"
has_fleet_key=false; cut -f1 "$pairs" | grep -qx METABOB_API_KEY && has_fleet_key=true
printf '%s\n' "$canary" >"$work/canary"

count_source() {  # name file -> JSON {hits, canary, by_name}
  local src="$1" file="$2" hits can by='{}' name val n
  if [ -s "$work/values" ]; then hits="$(grep -aFc -f "$work/values" "$file")"; else hits=0; fi
  can="$(grep -aFc -f "$work/canary" "$file")"
  if [ "${hits:-0}" -gt 0 ]; then
    while IFS=$'\t' read -r name val; do
      n="$(grep -aFc -f <(printf '%s\n' "$val") "$file")"
      [ "${n:-0}" -gt 0 ] && by="$(jq -c --arg k "$name" --argjson n "$n" '.[$k] = ((.[$k] // 0) + $n)' <<<"$by")"
    done <"$pairs"
  fi
  if [ "${can:-0}" -ge 1 ]; then
    jq -nc --arg s "$src" --argjson h "${hits:-0}" --argjson c "$can" --argjson b "$by" '{($s): {hits: $h, canary: $c, by_name: $b}}'
  else
    jq -nc --arg s "$src" --argjson h "${hits:-0}" --argjson b "$by" '{($s): {hits: "scan_blind", unblinded_hits: $h, canary: 0, by_name: $b}}'
  fi
}

sources='{}'
journalctl --no-pager -a -o cat >"$work/journal" 2>/dev/null
sources="$(jq -c --argjson x "$(count_source journal "$work/journal")" '. + $x' <<<"$sources")"

cat >"$work/docker_logs"
if grep -aq 'handing off to systemd' "$work/docker_logs"; then
  sources="$(jq -c --argjson x "$(count_source docker_logs "$work/docker_logs")" '. + $x' <<<"$sources")"
else
  sources="$(jq -c '. + {docker_logs: {hits: "scan_blind", canary: 0, note: "the piped stream does not carry the entrypoint hand-off line"}}' <<<"$sources")"
fi

# The trace store, where this node runs the datastore. Credentials go through the CLI's
# environment (SURREAL_USER / SURREAL_PASS), never its argv.
if command -v surreal >/dev/null 2>&1 && curl -sf -m 5 http://127.0.0.1:8000/health >/dev/null 2>&1; then
  (
    set -a; . /etc/substrate/env 2>/dev/null; set +a
    export SURREAL_USER="${SURREAL_USER:-root}" SURREAL_PASS="${SURREAL_PASS:-}"
    q() { surreal sql --endpoint http://127.0.0.1:8000 --namespace activity-system --database learning_loop --hide-welcome >/dev/null 2>&1; }
    printf "CREATE secret_leak_scan_canary SET v = '%s';\n" "$canary" | q
    surreal export --endpoint http://127.0.0.1:8000 --namespace activity-system --database learning_loop "$work/trace" >/dev/null 2>&1 \
      || : >"$work/trace"
    printf 'REMOVE TABLE secret_leak_scan_canary;\n' | q
  )
  if [ -s "$work/trace" ] && grep -aq execution_trace "$work/trace"; then
    # Schema statements are excluded from the count, and counted apart: the datastore's
    # own `DEFINE ACCESS … TYPE JWT … KEY '<JWT_SECRET>'` is how it verifies tokens for
    # PERMISSIONS, so the key is there by design. What must never hold a secret is DATA:
    # traces, impulses, gaps, notes.
    grep -av '^DEFINE ' "$work/trace" >"$work/trace_rows"
    schema_n=0; [ -s "$work/values" ] && schema_n="$(grep -a '^DEFINE ' "$work/trace" | grep -aFc -f "$work/values")"
    sources="$(jq -c --argjson x "$(count_source trace_store "$work/trace_rows")" --argjson d "${schema_n:-0}" \
      '. + ($x | .trace_store += {schema_definitions_holding_a_value: $d})' <<<"$sources")"
  else
    sources="$(jq -c '. + {trace_store: {hits: "scan_blind", canary: 0, note: "export empty or without the execution_trace table"}}' <<<"$sources")"
  fi
else
  sources="$(jq -c '. + {trace_store: {hits: "not_present", note: "no datastore answers on this node"}}' <<<"$sources")"
fi

clean=true; blind=false
jq -e 'to_entries | any(.value.hits | type == "number" and . > 0)' <<<"$sources" >/dev/null && clean=false
jq -e 'to_entries | any(.value.hits == "scan_blind")' <<<"$sources" >/dev/null && blind=true
[ "$has_fleet_key" = true ] || blind=true
jq -nc --argjson f "$(printf '%s\n' "${store_files[@]}" | jq -R . | jq -sc 'map(select(length > 0))')" \
  --argjson n "${names_n:-0}" --argjson k "$has_fleet_key" --argjson s "$sources" --argjson c "$clean" --argjson b "$blind" \
  '{store_files: $f, names: $n, fleet_key_in_set: $k, sources: $s, clean: $c, blind: $b}'
[ "$clean" = true ] || exit 1
[ "$blind" = false ] || exit 2
exit 0
