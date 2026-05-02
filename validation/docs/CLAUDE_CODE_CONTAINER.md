# Claude Code container choice

## TL;DR

We build our own minimal `metabob-validation/claude-code:local` image from
`Dockerfile.claude-code` (node:20-slim + `npm install -g @anthropic-ai/claude-code`).

## Why not an "official" image

As of 2026-04 there is no public, pre-built Claude Code Docker image
published by Anthropic. What exists:

- **Devcontainer Dockerfile**: https://github.com/anthropics/claude-code/blob/main/.devcontainer/Dockerfile
  Source-only; users build it themselves. It is dev-machine-shaped: zsh,
  fzf, GitHub CLI, iptables/ipset (firewall enforcement), `--cap-add=NET_ADMIN`
  in `runArgs`. Not suitable for a headless benchmark runner.
- **`ghcr.io/anthropics/claude-code:latest`**: cited by some third-party blog
  posts but returns `denied` on anonymous pull as of 2026-04-30. Either
  private, removed, or never published; we cannot rely on it.
- **Third-party images** (`gendosu/claude-code-docker`, `kasmweb/claude-code`,
  `nezhar/claude-container`): community-maintained, varying freshness and
  trust posture. Not used.

## Our image

`Dockerfile.claude-code` is intentionally tiny:

```
node:20-slim
+ git, ca-certificates, curl, jq
+ npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION:-latest}
```

No NET_ADMIN, no firewall rules, no extra editor tooling — Claude Code only
needs outbound HTTPS to `api.anthropic.com`, plus a writable `/workspace`.

## How the orchestrator invokes it

```
docker run --rm \
  -v <workspace>:/workspace \
  -e ANTHROPIC_API_KEY \
  metabob-validation/claude-code:local \
  claude -p "<prompt>" --output-format stream-json --verbose
```

`--output-format stream-json` (when supported by the installed CLI version)
emits JSONL we capture as the transcript. If a future CLI release breaks
this flag, the orchestrator falls back to plain `-p` and stores raw stdout
as the transcript.

## Bumping the CLI version

Edit `containers.json` → `claudeCode.image` tag, or rebuild with a pinned
version:

```
docker build -f Dockerfile.claude-code \
  --build-arg CLAUDE_CODE_VERSION=1.2.3 \
  -t metabob-validation/claude-code:1.2.3 .
```
