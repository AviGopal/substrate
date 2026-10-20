#!/usr/bin/env bash
# discovery-deregister-on-stop.test.sh: every service's stop removes exactly the discovery rows that unit registered
# (units/service.d/20-deregister-on-stop.conf -> discovery-deregister --unit %N), so a stopped vessel is never
# forwarded to. Without it a stopped vessel's row stays "healthy" until its 5-minute TTL plus the prune, and every
# resolve of its shapes in that window answers 502 forward_failed (discovery-vessel src/index.ts forward path).
#   (a) the drop-in applies to every service (service.d/) and runs the --unit form with %N, failure-tolerant ('-')
#   (b) --unit <vessel>: DELETEs the unit's own rows (exact id, id plus an instance suffix, or the same vesselName)
#       and nothing else: not another vessel whose id merely contains the name, not a peer substrate's '@' row
#   (c) --unit <oneshot or timer-driven unit> and --unit <unit not in the inventory>: no request at all, exit 0
#       (the hook runs on every oneshot tick, so a non-vessel must cost nothing)
#   (d) --unit <vessel> that registered nothing: exit 0 quietly; the substring form still exits 2 for a typo
#   (e) on the committed inventory, no vessel's unit name plus "-" is a prefix of another inventory vessel's name
#       (else the instance-suffix rule could remove a neighbour's rows)
# usage: validation/scripts/discovery-deregister-on-stop.test.sh   (bash, jq; no network, no root)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; S="$ROOT/scripts/substrate"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
D="$S/units/service.d/20-deregister-on-stop.conf"
grep -qxF 'ExecStopPost=-/usr/local/bin/discovery-deregister --unit %N' "$D" 2>/dev/null && grep -qx '\[Service\]' "$D" \
  && ok "(a) every service runs 'discovery-deregister --unit %N' on stop, failure-tolerant" || bad "(a) the stop hook drop-in is missing or changed: $D"

mkdir -p "$T/bin"; CALLS="$T/calls"
cat > "$T/bin/curl" <<EOF
#!/usr/bin/env bash
echo "\$*" | grep -oE 'DELETE|/resolve|/vessels/[^ ]+' | tr '\n' ' ' >> "$CALLS"; echo >> "$CALLS"
case "\$*" in *DELETE*) exit 0 ;; esac
cat <<'JSON'
{"content":{"vessels":[
 {"vesselId":"goal-host-vessel","vesselName":"goal-host-vessel"},
 {"vesselId":"goal-host-vessel-local","vesselName":"Goal Host"},
 {"vesselId":"goal-host-vessel@peer-substrate","vesselName":"goal-host-vessel"},
 {"vesselId":"goal-host-vesselx","vesselName":"other"},
 {"vesselId":"concept-db-local","vesselName":"concept-db"},
 {"vesselId":"my-goal-host-vessel","vesselName":"mine"}]}}
JSON
EOF
chmod +x "$T/bin/curl"
printf '{"vessels":[{"unit":"goal-host-vessel.service","health_port":8210},{"unit":"concept-db.service","health_port":8260},{"unit":"bootstrap-seeder.service"},{"unit":"quiet-vessel.service","health_port":8999}]}\n' > "$T/inv.json"
dr() { : > "$CALLS"; env -i PATH="$T/bin:$PATH" METABOB_API_KEY=k FED_SUBSTRATE_ID=this-substrate DEREGISTER_INVENTORY="$T/inv.json" \
         bash "$S/discovery-deregister.sh" "$@" > "$T/out" 2>&1; echo $?; }
rc="$(dr --unit goal-host-vessel)"; del="$(grep -o '/vessels/[^ ]*' "$CALLS" | sort | tr '\n' ' ')"
[ "$rc" = 0 ] && [ "$del" = "/vessels/goal-host-vessel /vessels/goal-host-vessel-local " ] \
  && ok "(b) --unit goal-host-vessel removes its own two rows only (not the peer's @ row, goal-host-vesselx or my-goal-host-vessel)" \
  || bad "(b) rc=$rc deleted: $del"
rc="$(dr --unit bootstrap-seeder)"; n1="$(grep -c . "$CALLS")"; rc2="$(dr --unit not-in-inventory)"; n2="$(grep -c . "$CALLS")"
[ "$rc" = 0 ] && [ "$n1" = 0 ] && [ "$rc2" = 0 ] && [ "$n2" = 0 ] \
  && ok "(c) a oneshot and an unlisted unit make no request at all and exit 0" || bad "(c) oneshot rc=$rc calls=$n1; unlisted rc=$rc2 calls=$n2"
rc="$(dr --unit quiet-vessel)"; rc2="$(dr no-such-vessel)"
[ "$rc" = 0 ] && ! grep -q DELETE "$CALLS" && [ "$rc2" = 2 ] \
  && ok "(d) a vessel that registered nothing exits 0 in --unit form; the substring form still exits 2" || bad "(d) --unit rc=$rc, substring rc=$rc2"
names="$(jq -r '.vessels[] | select(.health_port != null) | .unit | sub("\\.service$"; "")' "$S/vessels.inventory.json" | sort -u)"
clash=""; for a in $names; do for b in $names; do [ "$a" != "$b" ] && [ "${b#"$a"-}" != "$b" ] && clash="$clash $a<$b"; done; done
[ -z "$clash" ] && ok "(e) no inventory vessel name is another's name plus a '-' suffix" || bad "(e) prefix clashes:$clash"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
