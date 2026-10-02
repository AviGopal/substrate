# The composer restarts itself — evidence for `decentralized-compose-ownership`

Window: 2026-09-24 09:40Z–13:40Z, container `substrate-live` (standalone profile, one
node). Every number is from the container journal or the ledger; the commands are
inline so a later run can repeat them.

## Restart attribution (development-vessel)

```
journalctl -u development-vessel --since -4h | grep -o "restarted by [a-z-]*" | sort | uniq -c
     14 restarted by mitosis-cutover
      1 restarted by pull-sync
```

14 of 15 restarts of the composer were its own cutovers: the vessel that composes for
every repo restarted because it landed a change to its own repo.

## Landing targets

```
journalctl -u development-vessel --since -4h | grep -o "freshness vessel=[a-z-]*" | sort | uniq -c
     17 freshness vessel=development-vessel
      7 freshness vessel=activity-api
      1 freshness vessel=goal-host-vessel
```

17 of 25 landings targeted the composer's own repo. The lane spends most of its work on
itself, and each of those landings interrupts whatever else the lane had in flight.

## Lane pressure

```
selection skipped: compose lane full   35   (2h window)
[gap-to-feature] pick                   8   (2h window)
```

The autonomous cap was 2 (operator drop-in `COMPOSE_MAX_CONCURRENT=3`, one slot reserved
for directed composes). At 12:27:29Z the restart-attribution line reads "restarted by
mitosis-cutover … it observed 2 in flight": both autonomous slots were busy when the
composer restarted itself.

## One landing's pipeline (graded run 5, item R)

| stage | time |
|---|---|
| dispatch accepted | 12:22 |
| semantic gate + cutover verdict FAVORABLE | 12:25:40 |
| commit `7ad3e5c` | 12:26:17 |
| post-land suite | 12:26:49 |
| composer SIGTERM / restart | 12:27:29 |

About five minutes from pick to restart. A graded run (four landings plus settlement
windows) took 60–75 minutes; the difference is queueing (BUSY, lane full) and
settlement waits, not pipeline time.

## Reach, split by author (2h window ending 13:00Z)

| source | reached | busy |
|---|---|---|
| run-goal (other) | 7/79 | 0 |
| autonomous gap | 0/7 | 2 |
| operator (other) | 2/19 | 6 |
| operator ledger | 3/11 | 3 |

## What the peer registry already shows

```
POST :8100/resolve {"pointer":{"type":"vesselCapability","shape":"feature_compose"}}
development-vessel-local              http://localhost:8090   protocol=null    distribution_policy=stateless
development-vessel-local@syzygy-hub   http://127.0.0.1:8401   protocol=libp2p  distribution_policy=stateless
```

A second `feature_compose` producer is already visible through peer discovery (the
syzygy hub's composer, dialled through the local transport ingress). `pickSatisfierProducer`
scores a local row one point above a remote one at equal priority, and honours a
`stateful_data_owner_pin` before scoring, so ownership can steer the pick without a
new routing mechanism.
