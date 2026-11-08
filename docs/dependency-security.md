# Dependency security notes

## Next.js 16.4.5 upgrade (2026-11-08)

Next.js, its `@next/*` packages, and `eslint-config-next` are aligned at 16.4.5.
The lockfile selects sharp 0.35.5 and libvips platform packages 1.3.4.
Babel, semver, and browser-data packages retain their previous versions.
React Hooks ESLint 7.1.1 is required by Next's `^7.1.0` dependency; the previous
7.0.1 does not satisfy it. No peer requirements or lint rules are disabled.

Compatible lockfile patches also address existing advisories in source-map-js
(1.2.2), undici (7.30.2), zod (4.6.7), and brace-expansion (1.1.21 / 5.0.12).
They remain within their parents' declared ranges.

## Temporary parser-scoped minimatch override

[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)
affects minimatch 7 through 10; the fix starts at 11.0.1. Both the locked parser
8.56.1 and the inspected latest 8.72.1 declare minimatch `^10.2.2`.
[Upstream tracks the missing update](https://github.com/typescript-eslint/typescript-eslint/issues/13125).

The override applies **only to typescript-estree 8.56.1**, selecting minimatch
11.0.5. It does not replace unrelated minimatch 3 consumers. Its Node requirement
is `20 || >=22`; validation uses Node 22.20.0, and the Vercel project uses Node 24.
The parser's sole minimatch use is `minimatch(filePath, pattern, { dot: true })`
in `useProgramFromProjectService.js`. It does not use the APIs removed in
[minimatch 11](https://github.com/isaacs/minimatch/blob/v11.0.5/changelog.md), such
as `makeRe`, `AST`, or `matchOne`.

Before adoption, 204 matching comparisons against the prior minimatch version
passed, as did real parser project-service acceptance/rejection cases. Run
`npm run test:tooling` for the maintained matching and parser integration tests.
This is a locally validated compatibility override, not an upstream-supported
dependency selection. Remove it once a supported parser version declares a
patched minimatch, then rerun audit, signature verification, tooling tests,
lint, and build. The exact parent-version selector makes a parser upgrade
require a fresh dependency/security review.
