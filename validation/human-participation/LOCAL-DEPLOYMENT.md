# Local human surface deployment

Verified 2026-09-20 UTC. This is an operator deployment and read-only connectivity
assessment, not evidence of autonomous improvement or human comprehension.

## Running surface

- Browser: http://127.0.0.1:18310/
- Container: `substrate-live`; federation identity: `local-dev-spoke`.
- Service: `human-surface-vessel.service`, enabled and running on port 8310.
- Source: detached worktree `/workspace/git/human-surface-release`, commit
  `9398425ba62da45c0eb5254c7a9b052b8ea77360`.
- The pre-existing super-repo checkout and other vessel services were not updated.
- The source revision is pinned. A subsequent source rollout must explicitly
  advance this worktree and verify the service; ordinary super-repo pull-sync
  does not update this detached worktree.

The persisted fleet manifest lacked this vessel although the image manifest
contained it. Its entry was added from the image, then its workdir and build-hook
paths were pointed at the release worktree. The original manifest is backed up at
`/workspace/substrate/fleet/vessels.manifest.json.before-human-surface`.
Installation used `vessel-ctl install human-surface-vessel`.

The initial install against the old checkout failed on an unexpected export in
`src/store.js`. The restart loop was stopped and the reviewed revision fetched
through the container's existing git remote. The successful deployment uses the
committed UI bundle. Its vessel subtree remains clean. The reported restart
counter (10) includes the initial failed install; it remained unchanged across
the final checks.

## Local access

The existing container publishes no port 8310. A localhost-only forward avoids
recreating it:

- Host user service: `substrate-human-surface-port.service`, enabled.
- Unit: `/home/avi/.config/systemd/user/substrate-human-surface-port.service`.
- Listener: `127.0.0.1:18310`.
- `socat` enters the running container's network namespace through
  `podman unshare` and `nsenter`; each connection looks up its current PID.
- This depends on the host user's systemd manager, Podman, socat, and nsenter.
  It does not change the container's published-port configuration.

For a future container recreation, use the normal 18310-to-8310 publication and
remove this forward first to avoid a port conflict. To stop only local access:
`systemctl --user disable --now substrate-human-surface-port.service`.
To disable the vessel: `docker exec substrate-live vessel-ctl uninstall human-surface-vessel`.
Do not restore the entire manifest backup over subsequent fleet changes; undo
only this vessel's entry if removal is required.

## Verification

- Host `/health`: HTTP 200; discovery status `ok`; 11 advertised surface shapes.
- Browser: Chromium, 1440×900, HTTP 200, expected interface headings present,
  no JavaScript page errors. No goal or contribution submitted by the probe.
- `/api/discovery/shapes`: 396 shapes, registry read successful.
- `/api/resolve` with read shape `activeDispatches`: five requested rows returned.
- `/api/questions`: zero local questions.
- `/api/gaps`: successful response with zero matching gaps.
- Local capability lookup lists the surface at port 8310 alongside legacy UI
  at port 8270, and local plus libp2p goal-host candidates.
- Federation transport: healthy, one relay reservation, peer connection present.
  Its journal reports hub registration of 15 rows, all successful, after adding
  the surface; prior registrations had 14 rows. This is transport-side evidence,
  not an independently read hub registry.

## Whole-network state: not yet established

Capability discovery and a healthy federation transport do not prove exhaustive
state visibility. The current surface still has these scope limitations:

| State | Current read scope | Work required for network coverage |
|---|---|---|
| Capabilities | Configured discovery's advertised vocabulary | Identify contributing peers, freshness, and unreachable/missing registries |
| Runs | One selected goal host | Enumerate owners, read each, retain owner-qualified execution IDs and pagination |
| Questions and responses | This vessel's local journal/store | Discover question owners; preserve owner, revision, and response destination |
| Interface gaps | First responding gap store | Aggregate relevant owners with provenance and deduplication |
| Evidence | Selected resolver pathway | Resolve against the owning activity/store and expose unavailable evidence |

The next verification should compare an owner-qualified expected inventory with
actual reads across peers, including a disconnected peer. A missing response
must appear as partial or unavailable coverage, never as zero work. Authorized
visibility is the boundary: network coverage does not mean access to private
state a participant is not entitled to see.

Automatic approval review rejected a direct authenticated hub query because the
remote destination had not been verified for credential disclosure. That query
was not run. Local discovery and existing transport records supplied the bounded
evidence above; independent hub-side verification remains outstanding.
