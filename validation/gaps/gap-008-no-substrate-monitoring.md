---
title: gap-008 — No external monitoring / alerting on substrate crashes
severity: CRITICAL
blocker: true
generated_at: 2026-05-25T04:20:06Z
---

# Finding: Substrate crashes go undetected without manual polling

## Symptom

Iteration 17 (04:20Z) polled the substrate and discovered the
`substrate-live` container dead. No prior notification. The container
had crashed sometime between iter-16 (03:52Z) and the poll, advancing
5 tasks before termination, but producing no alerts or logs.

## Root cause

The validation loop is 100% dependent on polling the substrate's HTTP
API. There is no external health monitor, no alerting, no death
notification channel. A crash in the container is invisible until the
next polling cycle.

## Impact

- Development halted silently at the moment of crash
- No operator notification
- Validation loop blocked until manual restart
- Audit cannot detect if substrate is up or down
- No way to correlate crash time with task execution

## Why it matters

During the high-velocity Phase 6/7/9 development cycle, a silent crash
could hide:
- Resource exhaustion (OOMKill, CPU throttle)
- Runtime panics in newly-deployed vessels
- Deadlocks or infinite loops
- Silent data corruption

The substrate-explicit-vessels fleet is scaling; crashes will happen.
Without external observability, the development loop cannot distinguish
"substrate is fine but slow" from "substrate is dead".

## Recommendation

Implement external health monitoring:
1. Systemd watchdog (on the host) to restart dead containers
2. HTTP health-check polling with alerting on 5xx / timeout
3. Log aggregation (container STDERR/STDOUT to persistent syslog)
4. Container exit-code capture (docker events → log file)
5. Optional: push-based health reporting (substrate emits heartbeat
   impulses to a logging vessel)

Shortterm: operator adds a cron job or monitor script to check
`docker ps` every 5 min and alert on dead substrate-live.
