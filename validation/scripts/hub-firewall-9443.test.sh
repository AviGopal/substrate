#!/usr/bin/env bash
# hub-firewall-9443.test.sh: the hub's TLS terminator serves activity-api on 9443 with host networking, so its traffic
# never meets DOCKER-USER; scripts/substrate/hub-firewall.sh must give 9443 the SAME source list as 18080 in INPUT.
# The rule body runs under env -i with iptables/ip6tables/logger/systemctl/ip/ss shimmed (argv recorded; no kernel).
#   with a list: the INPUT chain admits 9443 ONLY from ALLOW_18080_SRC, ahead of the eth0/eth1 resets, and is hooked into INPUT
#   empty list:  no 9443 RETURN at all, the resets remain, so 9443 is closed to every outside source (as 18080 is)
#   one list:    the 9443 source is exactly the 18080 source (no second list to drift)
#   IPv6:        9443 is reset on eth0/eth1 in the v6 INPUT chain
#   undo:        unhooks and removes the v4 INPUT chain
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
F="${HUB_FW_SCRIPT:-$HERE/../../scripts/substrate/hub-firewall.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/hub-fw-9443.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
mkdir -p "$T/bin"
printf '#!/usr/bin/env bash\nprintf "%%s %%s\\n" "$(basename "$0")" "$*" >> "$FW_LOG"\n[ "${1:-}" = -C ] && exit 1; [ "${1:-}" = -S ] && exit 1; exit 0\n' > "$T/bin/iptables"
cp "$T/bin/iptables" "$T/bin/ip6tables"
for b in logger ip ss; do printf '#!/usr/bin/env bash\nexit 0\n' > "$T/bin/$b"; done
printf '#!/usr/bin/env bash\necho disabled; exit 1\n' > "$T/bin/systemctl"
chmod +x "$T"/bin/*
bash "$F" --print-body > "$T/body.sh" || { echo "FAIL - could not print the rule body"; exit 1; }
run() { : > "$T/log"; env -i PATH="$T/bin:/usr/bin:/bin" FW_LOG="$T/log" MODE="$1" ALLOW_18080_SRC="$2" bash "$T/body.sh" >/dev/null 2>&1 </dev/null; }
L=98.234.161.172,5.6.7.8
run apply "$L"
grep -qx "iptables -A SUBSTRATE-HUB-FW-IN4 -s $L -p tcp --dport 9443 -j RETURN" "$T/log" && ok "with a list: 9443 admitted only from ALLOW_18080_SRC" || bad "no 9443 RETURN from the list"
s80=$(sed -n 's/^iptables -A SUBSTRATE-HUB-FW -s \([^ ]*\) -p tcp -m conntrack --ctorigdstport 18080 -j RETURN$/\1/p' "$T/log")
s94=$(sed -n 's/^iptables -A SUBSTRATE-HUB-FW-IN4 -s \([^ ]*\) -p tcp --dport 9443 -j RETURN$/\1/p' "$T/log")
[ -n "$s80" ] && [ "$s80" = "$s94" ] && ok "one list: the 9443 source equals the 18080 source ($s94)" || bad "9443 source '$s94' differs from 18080 source '$s80'"
r=$(grep -n "SUBSTRATE-HUB-FW-IN4 -s" "$T/log" | cut -d: -f1); j=$(grep -n "SUBSTRATE-HUB-FW-IN4 -i eth0 -p tcp --dport 9443 -j REJECT" "$T/log" | cut -d: -f1)
[ -n "$r" ] && [ -n "$j" ] && [ "$r" -lt "$j" ] && ok "the allow precedes the reset" || bad "order: allow at ${r:-?}, reset at ${j:-?}"
for i in eth0 eth1; do grep -qx "iptables -A SUBSTRATE-HUB-FW-IN4 -i $i -p tcp --dport 9443 -j REJECT --reject-with tcp-reset" "$T/log" && ok "$i: other 9443 sources reset" || bad "$i: no 9443 reset"; done
grep -qx "iptables -I INPUT 1 -j SUBSTRATE-HUB-FW-IN4" "$T/log" && ok "the chain is hooked into INPUT" || bad "chain not hooked into INPUT"
for i in eth0 eth1; do grep -qx "ip6tables -A SUBSTRATE-HUB-FW-IN -i $i -p tcp --dport 9443 -j REJECT --reject-with tcp-reset" "$T/log" && ok "IPv6 $i: 9443 reset" || bad "IPv6 $i: 9443 not reset"; done
run apply ""
grep -q "SUBSTRATE-HUB-FW-IN4 -s .*9443 -j RETURN" "$T/log" && bad "empty list still admits a 9443 source" || ok "empty list: no 9443 source admitted"
[ "$(grep -c "SUBSTRATE-HUB-FW-IN4 -i eth[01] -p tcp --dport 9443 -j REJECT" "$T/log")" = 2 ] && ok "empty list: the resets remain (9443 closed to every outside source)" || bad "empty list: resets missing"
run undo "$L"
grep -qx "iptables -D INPUT -j SUBSTRATE-HUB-FW-IN4" "$T/log" && grep -qx "iptables -X SUBSTRATE-HUB-FW-IN4" "$T/log" && ok "undo unhooks and removes the INPUT chain" || bad "undo leaves the INPUT chain"
echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
