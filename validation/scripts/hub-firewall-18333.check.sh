#!/usr/bin/env bash
# hub-firewall-18333.check.sh: the federation relay port 18333 takes a source allowlist, ALLOW_18333_SRC, on the
# model of ALLOW_18080_SRC in scripts/substrate/hub-firewall.sh. Nothing here reaches a hub or the kernel: ssh is
# stubbed through HUB_FW_SSH, and the rule body runs under env -i with iptables, ip6tables, logger, systemctl, ip
# and ss shimmed first on PATH (each records its argv; iptables/ip6tables keep just enough chain state for -S).
#
#   hub-firewall-18333.check.sh [--print-mutations]
#     --print-mutations  print the apply-time rule calls for the unset case (to review a change to GOLDEN below)
#   HUB_FW_SCRIPT=<path> judges another copy of the script (mutation runs), never the tree's by default.
#
# Not a *.test.sh: it was committed red (check first), before the fix, and a red glue test blocks the commit.
# hub-firewall.test.sh runs it once green, so the cases stay under the pre-commit glue gate.
#
# Controls: ALLOW_18333_SRC absent, or set empty, leaves every rule call byte-identical to GOLDEN, the body as
# it was before the allowlist existed (18333 open to all; an old /etc/default file has no ALLOW_18333_SRC line,
# so absent must not trip the body's set -u). The 18080 rules do not change when the 18333 list is set.
# Must-fail: with a list, v4 admits NEW 18333 only from it (ahead of the REJECTs) and v6 denies 18333 the way
# it denies 18080; an invalid list is refused by the wrapper before ssh and by the body before any rule; status
# prints the 18333 rule; install-boot persists the list beside ALLOW_18080_SRC and the boot body reads it; the
# apply log line names the restriction.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
F="${HUB_FW_SCRIPT:-$HERE/../../scripts/substrate/hub-firewall.sh}"
T="$(mktemp -d "${TMPDIR:-/tmp}/hub-fw-18333.XXXXXX")"; trap 'rm -rf "$T"' EXIT
FAILS=0; ok() { echo "ok   - $*"; }; bad() { echo "FAIL - $*"; FAILS=$((FAILS+1)); }
A80=98.234.161.172; L=1.2.3.4,5.6.7.8; CH=SUBSTRATE-HUB-FW

mkdir -p "$T/bin"
cat > "$T/bin/iptables" <<'STUB'
#!/usr/bin/env bash
# fake iptables/ip6tables: logs argv to $FW_LOG; per-binary chain state in $FW_STATE/<binary>/<chain>
me="$(basename "$0")"; st="$FW_STATE/$me"; mkdir -p "$st"
printf '%s %s\n' "$me" "$*" >> "$FW_LOG"
case "${1:-}" in
  -N) touch "$st/$2" ;;
  -F) [ -n "${2:-}" ] && : > "$st/$2" ;;
  -A) c="$2"; shift 2; printf -- '-A %s %s\n' "$c" "$*" >> "$st/$c" ;;
  -I) c="$2"; shift 3; printf -- '-A %s %s\n' "$c" "$*" >> "$st/$c" ;;
  -C) exit 1 ;;
  -S) [ -f "$st/${2:-}" ] || exit 1; printf -- '-N %s\n' "$2"; cat "$st/$2" ;;
esac
exit 0
STUB
cp "$T/bin/iptables" "$T/bin/ip6tables"
printf '#!/usr/bin/env bash\nprintf "%%s\\n" "$*" >> "$FW_LOGGER"\n' > "$T/bin/logger"
printf '#!/usr/bin/env bash\necho disabled; exit 1\n' > "$T/bin/systemctl"
printf '#!/usr/bin/env bash\nexit 0\n' > "$T/bin/ip"; cp "$T/bin/ip" "$T/bin/ss"
cat > "$T/bin/ssh" <<STUB
#!/usr/bin/env bash
# records the remote command and its stdin, one call per file
n=\$(ls "$T"/call.* 2>/dev/null | wc -l); for a; do last="\$a"; done
printf '%s\n' "\$last" > "$T/call.\$n.cmd"; cat > "$T/call.\$n.in"
STUB
chmod +x "$T"/bin/*

# body <file> <VAR=value>...: run a rule body against fresh state (keep=1: keep the state of the previous run)
body() {
  local f="$1"; shift
  [ "${keep:-0}" = 1 ] || rm -rf "$T/state" "$T/log" "$T/logger"
  mkdir -p "$T/state/iptables" "$T/state/ip6tables"
  touch "$T/state/iptables/DOCKER-USER" "$T/state/ip6tables/DOCKER-USER" "$T/state/ip6tables/INPUT"
  : > "$T/log"; : > "$T/logger"
  env -i PATH="$T/bin:/usr/bin:/bin" HOME="$T" FW_LOG="$T/log" FW_STATE="$T/state" FW_LOGGER="$T/logger" "$@" \
    bash "$f" > "$T/bout" 2>&1
}
mutations() { grep -E '^ip6?tables -[NFAICDX] ' "$T/log"; }   # rule-changing calls only; -S/-L are status reads
bash "$F" --print-body > "$T/body"
GOLDEN="$(cat <<'G'
iptables -N SUBSTRATE-HUB-FW
iptables -F SUBSTRATE-HUB-FW
iptables -A SUBSTRATE-HUB-FW -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
iptables -A SUBSTRATE-HUB-FW -p tcp -m conntrack --ctorigdstport 18100 -j RETURN
iptables -A SUBSTRATE-HUB-FW -p tcp -m conntrack --ctorigdstport 18101 -j RETURN
iptables -A SUBSTRATE-HUB-FW -p tcp -m conntrack --ctorigdstport 18333 -j RETURN
iptables -A SUBSTRATE-HUB-FW -s 98.234.161.172 -p tcp -m conntrack --ctorigdstport 18080 -j RETURN
iptables -A SUBSTRATE-HUB-FW -i eth0 -p tcp -m conntrack --ctstate NEW -j REJECT --reject-with tcp-reset
iptables -A SUBSTRATE-HUB-FW -i eth0 -m conntrack --ctstate NEW -j DROP
iptables -A SUBSTRATE-HUB-FW -i eth1 -p tcp -m conntrack --ctstate NEW -j REJECT --reject-with tcp-reset
iptables -A SUBSTRATE-HUB-FW -i eth1 -m conntrack --ctstate NEW -j DROP
iptables -C DOCKER-USER -j SUBSTRATE-HUB-FW
iptables -I DOCKER-USER 1 -j SUBSTRATE-HUB-FW
iptables -N SUBSTRATE-HUB-FW-IN4
iptables -F SUBSTRATE-HUB-FW-IN4
iptables -A SUBSTRATE-HUB-FW-IN4 -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
iptables -A SUBSTRATE-HUB-FW-IN4 -s 98.234.161.172 -p tcp --dport 9443 -j RETURN
iptables -A SUBSTRATE-HUB-FW-IN4 -i eth0 -p tcp --dport 9443 -j REJECT --reject-with tcp-reset
iptables -A SUBSTRATE-HUB-FW-IN4 -i eth1 -p tcp --dport 9443 -j REJECT --reject-with tcp-reset
iptables -C INPUT -j SUBSTRATE-HUB-FW-IN4
iptables -I INPUT 1 -j SUBSTRATE-HUB-FW-IN4
ip6tables -N SUBSTRATE-HUB-FW
ip6tables -F SUBSTRATE-HUB-FW
ip6tables -A SUBSTRATE-HUB-FW -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
ip6tables -A SUBSTRATE-HUB-FW -p tcp -m conntrack --ctorigdstport 18100 -j RETURN
ip6tables -A SUBSTRATE-HUB-FW -p tcp -m conntrack --ctorigdstport 18101 -j RETURN
ip6tables -A SUBSTRATE-HUB-FW -p tcp -m conntrack --ctorigdstport 18333 -j RETURN
ip6tables -A SUBSTRATE-HUB-FW -i eth0 -p tcp -m conntrack --ctstate NEW -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW -i eth0 -m conntrack --ctstate NEW -j DROP
ip6tables -A SUBSTRATE-HUB-FW -i eth1 -p tcp -m conntrack --ctstate NEW -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW -i eth1 -m conntrack --ctstate NEW -j DROP
ip6tables -C DOCKER-USER -j SUBSTRATE-HUB-FW
ip6tables -I DOCKER-USER 1 -j SUBSTRATE-HUB-FW
ip6tables -N SUBSTRATE-HUB-FW-IN
ip6tables -F SUBSTRATE-HUB-FW-IN
ip6tables -A SUBSTRATE-HUB-FW-IN -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN
ip6tables -A SUBSTRATE-HUB-FW-IN -p tcp --dport 18100 -j RETURN
ip6tables -A SUBSTRATE-HUB-FW-IN -p tcp --dport 18101 -j RETURN
ip6tables -A SUBSTRATE-HUB-FW-IN -p tcp --dport 18333 -j RETURN
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth0 -p tcp --dport 18080 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth1 -p tcp --dport 18080 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth0 -p tcp --dport 18090 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth1 -p tcp --dport 18090 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth0 -p tcp --dport 18210 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth1 -p tcp --dport 18210 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth0 -p tcp --dport 18250 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth1 -p tcp --dport 18250 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth0 -p tcp --dport 18260 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth1 -p tcp --dport 18260 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth0 -p tcp --dport 18270 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth1 -p tcp --dport 18270 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth0 -p tcp --dport 18310 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth1 -p tcp --dport 18310 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth0 -p tcp --dport 9443 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth1 -p tcp --dport 9443 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth0 -p tcp --dport 18000:18999 -j REJECT --reject-with tcp-reset
ip6tables -A SUBSTRATE-HUB-FW-IN -i eth1 -p tcp --dport 18000:18999 -j REJECT --reject-with tcp-reset
ip6tables -C INPUT -j SUBSTRATE-HUB-FW-IN
ip6tables -I INPUT 1 -j SUBSTRATE-HUB-FW-IN
G
)"
if [ "${1:-}" = --print-mutations ]; then body "$T/body" MODE=apply ALLOW_18080_SRC=$A80; mutations; exit 0; fi

# ── controls (green before and after the allowlist) ──
body "$T/body" MODE=apply ALLOW_18080_SRC=$A80; rc=$?
[ "$rc" = 0 ] && [ "$(mutations)" = "$GOLDEN" ] && ok "control: ALLOW_18333_SRC absent: rule calls byte-identical to the open-relay golden" \
  || { bad "control: ALLOW_18333_SRC absent changed the rules (rc=$rc)"; diff <(echo "$GOLDEN") <(mutations) | head -20; }
body "$T/body" MODE=apply ALLOW_18080_SRC=$A80 ALLOW_18333_SRC=; rc=$?
[ "$rc" = 0 ] && [ "$(mutations)" = "$GOLDEN" ] && ok "control: ALLOW_18333_SRC empty: rule calls byte-identical to the open-relay golden" \
  || bad "control: ALLOW_18333_SRC empty changed the rules (rc=$rc)"
body "$T/body" MODE=apply ALLOW_18080_SRC=$A80 ALLOW_18333_SRC=$L
[ "$(mutations | grep 18080)" = "$(echo "$GOLDEN" | grep 18080)" ] && ok "control: the 18080 rules are unchanged when the 18333 list is set" \
  || bad "control: the 18080 rules changed when the 18333 list is set"
body "$T/body" MODE=apply ALLOW_18080_SRC= ALLOW_18333_SRC=$L
mutations | grep -q "18080 -j RETURN" && bad "control: an empty ALLOW_18080_SRC still admits 18080" || ok "control: empty ALLOW_18080_SRC still closes 18080"

# ── must-fail: the list restricts 18333 ──
body "$T/body" MODE=apply ALLOW_18080_SRC=$A80 ALLOW_18333_SRC=$L
want="iptables -A $CH -s $L -p tcp -m conntrack --ctorigdstport 18333 -j RETURN"
at=$(grep -nxF "$want" "$T/log" | head -1 | cut -d: -f1); rej=$(grep -n "^iptables -A $CH .*-j REJECT" "$T/log" | head -1 | cut -d: -f1)
[ -n "$at" ] && [ -n "$rej" ] && [ "$at" -lt "$rej" ] && ok "v4 admits NEW 18333 only from the list, ahead of the REJECTs" || bad "v4 18333 source rule missing or after the REJECTs"
grep -qxF "iptables -A $CH -p tcp -m conntrack --ctorigdstport 18333 -j RETURN" "$T/log" && bad "v4 still opens 18333 to every source with the list set" || ok "v4 no longer opens 18333 to every source"
grep -qE '^ip6tables .*18333.*-j RETURN' "$T/log" && bad "v6 still returns 18333 with the list set" || ok "v6 never returns 18333 with the list set (as 18080)"
# pin: the restricted open list is the base ALLOW list minus 18333, nothing hard-coded beside it
base_open="$(sed -n 's/^CH=[^;]*; ALLOW="\([^"]*\)".*/\1/p' "$T/body" | tr ' ' '\n' | grep -vx 18333 | sort | tr '\n' ' ')"
got_open="$(sed -n "s/^iptables -A $CH -p tcp -m conntrack --ctorigdstport \([0-9]*\) -j RETURN$/\1/p" "$T/log" | sort | tr '\n' ' ')"
[ -n "$base_open" ] && [ "$got_open" = "$base_open" ] && ok "pin: the restricted open list is the base list minus 18333 ($got_open)" \
  || bad "pin: restricted open list '$got_open' != base list minus 18333 '$base_open'"
grep -qxF "ip6tables -A $CH-IN -i eth0 -p tcp --dport 18333 -j REJECT --reject-with tcp-reset" "$T/log" \
  && grep -qxF "ip6tables -A $CH-IN -i eth1 -p tcp --dport 18333 -j REJECT --reject-with tcp-reset" "$T/log" \
  && ok "v6 INPUT rejects 18333 on eth0/eth1 (as 18080, via DENY6)" || bad "v6 INPUT does not reject 18333"
grep -q "18333 only from $L" "$T/logger" && ok "the apply log line names the 18333 restriction" || bad "apply log line: $(cat "$T/logger")"
keep=1 body "$T/body" MODE=status ALLOW_18080_SRC=$A80 ALLOW_18333_SRC=$L
grep -qE "18333 rule: .*-s $L .*18333" "$T/bout" && ok "status prints the restricted 18333 rule" || bad "status does not print the 18333 rule"
body "$T/body" MODE=apply ALLOW_18080_SRC=$A80
grep -qE "18333 rule: .*--ctorigdstport 18333 -j RETURN" "$T/bout" && ok "status prints the open 18333 rule when unset" || bad "status does not print the open 18333 rule"

# ── must-fail: an invalid list is refused, by the wrapper before ssh and by the body before any rule ──
run() { rm -f "$T"/call.*; HUB_FW_SSH="$T/bin/ssh" bash "$F" "$@" > "$T/out" 2>&1 </dev/null; }
calls() { ls "$T"/call.*.cmd 2>/dev/null | wc -l; }
for v in '1.2.3.4 ,5.6.7.8' '1.2.3.4,,5.6.7.8' , 1.2.3.4, ,1.2.3.4 example.com 01.2.3.4 256.1.1.1 '$(id)' "1.2.3.4'"; do
  ALLOW_18080_SRC=$A80 ALLOW_18333_SRC="$v" run root@hub apply; rc=$?
  [ "$rc" = 2 ] && [ "$(calls)" = 0 ] && ok "wrapper refuses before ssh: '$v'" || bad "wrapper accepted '$v' (rc=$rc calls=$(calls))"
done
body "$T/body" MODE=apply ALLOW_18080_SRC=$A80 "ALLOW_18333_SRC=1.2.3.4 ,5.6.7.8"; rc=$?
[ "$rc" = 2 ] && [ -z "$(mutations)" ] && ok "the body refuses an invalid list before any rule" || bad "the body applied an invalid list (rc=$rc)"

# ── must-fail: the wrapper carries the list to the hub; install-boot persists it and the boot body reads it ──
ALLOW_18080_SRC=$A80 ALLOW_18333_SRC=$L run root@hub apply
grep -qF "ALLOW_18333_SRC='$L'" "$T/call.0.cmd" 2>/dev/null && ok "apply passes ALLOW_18333_SRC to the hub" || bad "apply does not pass ALLOW_18333_SRC"
ALLOW_18080_SRC=$A80 ALLOW_18333_SRC=$L run root@hub install-boot --go
def="$(grep -l '/etc/default/substrate-hub-fw' "$T"/call.*.cmd 2>/dev/null | head -1 | sed 's/cmd$/in/')"
sbin="$(grep -l 'usr/local/sbin/substrate-hub-fw' "$T"/call.*.cmd 2>/dev/null | head -1 | sed 's/cmd$/in/')"
[ -n "$def" ] && grep -qx "ALLOW_18333_SRC=$L" "$def" && grep -qx "ALLOW_18080_SRC=$A80" "$def" \
  && ok "install-boot writes ALLOW_18333_SRC beside ALLOW_18080_SRC" || bad "defaults file: $(cat "$def" 2>/dev/null | tr '\n' ' ')"
if [ -n "$def" ] && [ -n "$sbin" ]; then
  tail -n +3 "$sbin" > "$T/installed"; mapfile -t envf < <(grep -E '^[A-Z0-9_]+=' "$def")   # the unit's EnvironmentFile
  body "$T/installed" MODE=apply "${envf[@]}"
  grep -qxF "$want" "$T/log" && ok "the boot body restricts 18333 from the defaults file" || bad "the boot body ignores the persisted list"
else bad "install-boot did not install the body and the defaults file"; fi
ALLOW_18080_SRC=$A80 run root@hub install-boot --go
def="$(grep -l '/etc/default/substrate-hub-fw' "$T"/call.*.cmd 2>/dev/null | head -1 | sed 's/cmd$/in/')"
[ -n "$def" ] && grep -qx "ALLOW_18333_SRC=" "$def" && ok "install-boot with no list persists it empty (18333 open)" || bad "install-boot without a list: no empty ALLOW_18333_SRC line"

echo; [ "$FAILS" = 0 ] && { echo PASS; exit 0; } || { echo "$FAILS FAILED"; exit 1; }
