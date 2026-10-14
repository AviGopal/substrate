#!/usr/bin/env bash
# hub-firewall-open-18080.test.sh: ALLOW_18080_SRC=any opens activity-api (18080) and its TLS twin (9443) to every source,
# per the user ruling of 2026-10-13 (the hub is not walled; protection lives in auth). Every other published port keeps
# its default-deny. A source list and the empty list behave exactly as before.
# The rule body runs under env -i with iptables/ip6tables/logger/systemctl/ip/ss shimmed (argv recorded; no kernel).
#   (a) MUST-FAIL: `any` puts 18080 in the open list and admits 9443 from every source
#   (b) `any` still resets every other new inbound connection, and 18090/18210/18260 get no RETURN
#   (c) control: a source list still restricts 18080 and 9443 to that list (no unsourced RETURN)
#   (d) control: an empty list still closes 18080 and 9443
#   (e) the operator front end accepts `any` and still refuses a malformed list before any ssh
#   (f) `any` leaves IPv6 unchanged: 18080 gets no v6 RETURN and its v6 reject remains
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
F="${HUB_FW_SCRIPT:-$HERE/../../scripts/substrate/hub-firewall.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/hub-fw-open.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
mkdir -p "$T/bin"
printf '#!/usr/bin/env bash\nprintf "%%s %%s\\n" "$(basename "$0")" "$*" >> "$FW_LOG"\n[ "${1:-}" = -C ] && exit 1; [ "${1:-}" = -S ] && exit 1; exit 0\n' > "$T/bin/iptables"
cp "$T/bin/iptables" "$T/bin/ip6tables"
for b in logger ip ss; do printf '#!/usr/bin/env bash\nexit 0\n' > "$T/bin/$b"; done
printf '#!/usr/bin/env bash\necho disabled; exit 1\n' > "$T/bin/systemctl"
chmod +x "$T"/bin/*
bash "$F" --print-body > "$T/body.sh" </dev/null || { echo "FAIL - could not print the rule body"; exit 1; }
run() { : > "$T/log"; env -i PATH="$T/bin:/usr/bin:/bin" FW_LOG="$T/log" MODE=apply ALLOW_18080_SRC="$1" bash "$T/body.sh" >/dev/null 2>&1 </dev/null; echo $?; }

rc=$(run any)
[ "$rc" = 0 ] && ok "(a) the rule body accepts ALLOW_18080_SRC=any" || bad "(a) the rule body refused any (rc=$rc)"
grep -qx "iptables -A SUBSTRATE-HUB-FW -p tcp -m conntrack --ctorigdstport 18080 -j RETURN" "$T/log" \
  && ok "(a) any: 18080 is open to every source" || bad "(a) any: no unsourced 18080 RETURN"
grep -qx "iptables -A SUBSTRATE-HUB-FW-IN4 -p tcp --dport 9443 -j RETURN" "$T/log" \
  && ok "(a) any: 9443 is open to every source" || bad "(a) any: no unsourced 9443 RETURN"
for p in 18090 18210 18260; do
  grep -q "ctorigdstport $p -j RETURN" "$T/log" && bad "(b) any: $p was opened" || ok "(b) any: $p stays closed"
done
for i in eth0 eth1; do grep -qx "iptables -A SUBSTRATE-HUB-FW -i $i -p tcp -m conntrack --ctstate NEW -j REJECT --reject-with tcp-reset" "$T/log" \
  && ok "(b) any: $i still resets other new inbound" || bad "(b) any: $i default reset missing"; done
# IPv6 is unchanged by `any`: no v6 RETURN for 18080 in either chain, and the v6 INPUT reject for 18080 remains.
grep -qE "^ip6tables -A SUBSTRATE-HUB-FW(-IN)? .*(ctorigdstport|dport) 18080 -j RETURN" "$T/log" \
  && bad "(f) any: 18080 was opened on IPv6" || ok "(f) any: 18080 stays closed on IPv6 (no v6 RETURN)"
for i in eth0 eth1; do grep -qx "ip6tables -A SUBSTRATE-HUB-FW-IN -i $i -p tcp --dport 18080 -j REJECT --reject-with tcp-reset" "$T/log" \
  && ok "(f) any: IPv6 $i still rejects 18080" || bad "(f) any: IPv6 $i 18080 reject missing"; done

L=203.0.113.7
rc=$(run "$L")
grep -qx "iptables -A SUBSTRATE-HUB-FW -s $L -p tcp -m conntrack --ctorigdstport 18080 -j RETURN" "$T/log" \
  && ! grep -qx "iptables -A SUBSTRATE-HUB-FW -p tcp -m conntrack --ctorigdstport 18080 -j RETURN" "$T/log" \
  && ok "(c) a list still restricts 18080 to the list" || bad "(c) a list no longer restricts 18080"
grep -qx "iptables -A SUBSTRATE-HUB-FW-IN4 -p tcp --dport 9443 -j RETURN" "$T/log" && bad "(c) a list opened 9443 to everyone" || ok "(c) a list keeps 9443 restricted"

rc=$(run "")
grep -q "ctorigdstport 18080 -j RETURN" "$T/log" && bad "(d) the empty list opened 18080" || ok "(d) the empty list keeps 18080 closed"
grep -q "SUBSTRATE-HUB-FW-IN4 .*--dport 9443 -j RETURN" "$T/log" && bad "(d) the empty list opened 9443" || ok "(d) the empty list keeps 9443 closed"

cat > "$T/ssh" <<STUB
#!/usr/bin/env bash
echo called >> "$T/sshcalls"; cat >/dev/null
STUB
chmod +x "$T/ssh"
: > "$T/sshcalls"; ALLOW_18080_SRC=any HUB_FW_SSH="$T/ssh" bash "$F" root@hub apply >/dev/null 2>&1 </dev/null; rc=$?
[ "$rc" = 0 ] && ok "(e) the front end accepts any (dry run, rc 0)" || bad "(e) the front end refused any (rc=$rc)"
: > "$T/sshcalls"; ALLOW_18080_SRC=anything HUB_FW_SSH="$T/ssh" bash "$F" root@hub apply --go >/dev/null 2>&1 </dev/null; rc=$?
[ "$rc" = 2 ] && [ ! -s "$T/sshcalls" ] && ok "(e) a malformed list is still refused before any ssh" || bad "(e) 'anything' rc=$rc ssh=$(wc -l < "$T/sshcalls")"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
