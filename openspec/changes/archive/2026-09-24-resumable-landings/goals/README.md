# Dispatch goals for this change

One goal per file, one source file per goal. Each text is dispatched as-is through
goal-host `/run-goal` (edit-intent routes it to `feature_compose`). They quote the
exact anchors that exist in the target file and carry the reason any earlier draft
was rejected, so a re-dispatch does not repeat the rejected recipe.

Order that respects the dependencies: 2.1 → 3.1a → 3.1 remainder → 3.2 → 1.1 → 1.3 →
1.2 → 1.4 → 1.5; 3.3b before 3.3a (a seed edit is inert until the seeder upserts
changed seeds). 3.4 has landed.

Dispatch into a development-vessel process that has been up for at least a minute
with a free compose slot. A dispatch that meets a draining producer falls through to
a shell walk that edits the super-repo checkout; check `git status` in
`/workspace/git/super-repo/repos/development-vessel` afterwards.
