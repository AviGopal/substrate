// FALSE-POSITIVE GUARDS. Neither of the following is a colour literal, and the
// check must not claim they are:
//   1. a hex-SHAPED trace id, which has no leading hash — the anchor is the
//      whole defence, since '994b5e' is six hex characters and nothing else;
//   2. a URL fragment, which does have a hash but is not hex after it.
export const trace = { traceId: '994b5e', parent: 'deadbeef' };
export const docsAnchor = '/docs/human-surface#section';
export const badge = {
  reachedColor: 'var(--state-reached)',
  notReachedColor: 'var(--state-not-reached)',
};
