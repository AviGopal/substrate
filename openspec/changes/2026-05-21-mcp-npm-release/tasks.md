# Tasks — mcp-npm-release

- [x] 1. Verify `npm whoami` and current published version.
- [x] 2. `bun run build`; confirm `dist/cli.js` exists.
- [ ] 3. `npm publish --access public --otp=<code>`.
      **BLOCKED**: npm registry returned `EOTP` (one-time password required).
      The agent cannot supply 2FA codes. User must run:
      `cd repos/metabob-mcp && npm publish --access public --otp=<code-from-authenticator>`
- [ ] 4. Verify `npm view @metabob/mcp@latest version` == 0.2.8.
- [ ] 5. Smoke published artifact with `npx @metabob/mcp@0.2.8`; telemetry + outcomes land.
- [ ] 6. Archive spec — deferred until task 3 lands.
