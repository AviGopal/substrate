# Container substrates cycle freely and resync themselves

Two substrates on one host, different vessel inventories, both federated to
`syzygy.host`. Each stopped and started twice. No command issued between
`docker start` and the measurement.

```
self-resynced: 4/4
  cycle 1 substrate-live    130s · roster preserved
  cycle 1 substrate-ui      130s · roster preserved
  cycle 2 substrate-live    162s · roster preserved
  cycle 2 substrate-ui      130s · roster preserved
```

Federation identity stable across all four cycles (`spoke-cfda39e7`,
`spoke-e95855b8`), and one container converged its checkout on its own mid-run
(`5d381b43 -> 238e84e6`) without being told to.

**Rosters differ, which is what makes the result mean anything** — 11 units only
on the compute spoke, 5 only on the surface spoke, 4 shared. A resync result
across two identical containers would describe one configuration duplicated
twice.

## This property did not exist before it was measured

Stopping a container had not been tried in weeks. The first attempt found four
independent blockers, all on containers reporting healthy:

| blocker | why it stayed hidden |
|---|---|
| `.substrate-secrets` had two writers, both truncating | `API_KEY_SECRET` was destroyed, and `gen-env` then refuses to boot rather than sign keys with a secret it cannot reproduce. Only trips on restart, and only where a local datastore exists. |
| `FED_SUBSTRATE_ID` never persisted | every restart minted a NEW substrate identity and orphaned the old hub record |
| the repaired writer converged to the wrong path | `vessel-ctl` sources `/usr/local/share/substrate/secrets.env.sh`, not the `super-repo/scripts/substrate/` file of the same name — the fix read correct and changed nothing |
| bootstrap tier not self-updating | fixing it in git let each container repair itself BACK into the bug at the next boot |

## Four instrument faults, all in the flattering direction

Every one was a check that could not have produced the answer it claimed to
give. Worth reading as a class, not four incidents:

1. **Presence accepted for liveness.** Registry TTL is five minutes, so "the hub
   still lists this substrate" is true of a powered-off box. It scored a
   container that had `Exited (1)` as resynced in 1 second.
2. **`every()` over an empty set.** When a federation id churned, the pre-cycle
   shape set was empty, so the pass condition was unreachable — a substrate that
   came back with six shapes scored FAIL after 480s.
3. **A conditional shape held as mandatory.** `llm_completion` is withdrawn on
   purpose when provider lanes cool. Requiring it scored a vessel FAIL for
   obeying "never advertise a shape you cannot serve".
4. **Measuring a stopped container.** With no readable federation id the query
   matched nothing, and nothing was reported as a failed resync.

The verdict rule now records WHICH rule it applied, so a pass under the weaker
fallback cannot be read as the stronger one.

## Reproduce

```bash
node validation/scripts/substrate-cycle-resync.mjs --cycles 2
```

## Known limits

- `llm_completion` is polled and reported but excluded from the verdict.
- Roster preservation is asserted over RUNNING units. A converged inventory
  changes the roster at the next boot by design, so a cycle taken immediately
  after an inventory change legitimately shows a changed roster.
- Both substrates here are spokes. A hub cycle is not covered.
