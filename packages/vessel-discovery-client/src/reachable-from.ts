/**
 * Rewrite a loopback endpoint into one the CALLER can actually dial.
 *
 * WHY THIS IS SHARED (task #60, 2026-08-10). Every vessel registers its
 * IN-CONTAINER address, and `derivePublicEndpoint` in discovery-vessel rewrites
 * the PORT (8xxx → 18xxx, the host mapping convention) while carrying the
 * loopback HOSTNAME through verbatim. That is the origin of registry rows like
 * `http://127.0.0.1:18401`: a correct port on a host no remote caller can dial.
 * The row is half-translated, not corrupt.
 *
 * The repair existed in exactly ONE consumer — human-surface-vessel's proxy —
 * while every other reader of a discovery endpoint took the row as given.
 * `grep -rln reachableFrom` across the fleet returned a single file. Lifting it
 * here makes the fix adoptable instead of re-derivable, which is the whole
 * content of the filed gap.
 *
 * WHY NOT FIX IT AT THE SOURCE INSTEAD. Discovery cannot know which interface a
 * given caller can reach; the publishing vessel's idea of "my public host" is
 * exactly the missing information, and inventing one risks publishing an address
 * that is wrong for EVERYONE rather than wrong only for remote callers. The
 * answering registry's host, on the other hand, is known for free at call time —
 * so the correct place to resolve reachability is the consumer, and the only
 * defect was that the consumer had to write it themselves.
 */

/** Hosts that are only meaningful inside the publishing process's own netns. */
export const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "0.0.0.0", "::1", "[::1]"]);

/**
 * @param raw        the endpoint as advertised in the registry row
 * @param resolvedAt the base URL of the registry that ANSWERED this lookup
 *
 * Returns `raw` unchanged whenever rewriting would be wrong or unnecessary, and
 * `undefined` only for a missing input — so a caller can substitute it directly
 * for the raw endpoint with no other change.
 */
export function reachableFrom(raw: string | undefined, resolvedAt: string): string | undefined {
  if (!raw) return undefined;
  let target: URL;
  let disc: URL;
  try {
    target = new URL(raw);
    // The rewrite host is whichever registry ANSWERED, not whichever registry
    // this vessel registers with. On a federated spoke those are two different
    // machines: goal shapes are resolved on the hub while registration stays
    // local, so rewriting a hub record's loopback to the local discovery host
    // would produce an address on the wrong machine entirely.
    disc = new URL(resolvedAt);
  } catch {
    // Unparseable input is passed through rather than dropped: a caller that
    // was working with a non-URL endpoint keeps working, and a rewrite we
    // cannot reason about is worse than none.
    return raw;
  }
  if (!LOOPBACK_HOSTS.has(target.hostname)) return raw;
  if (LOOPBACK_HOSTS.has(disc.hostname)) return raw; // we are in-container; loopback is correct
  target.hostname = disc.hostname;
  return target.toString().replace(/\/+$/, "");
}
