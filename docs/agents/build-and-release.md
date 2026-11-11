# Build and release

> Moved verbatim from `CLAUDE.md` on 2026-11-11 (build scripts, release process, tags, secrets, dependencies, VSIX packaging). `CLAUDE.md` points here; keep this file accurate whenever the behaviour it describes changes.

## Build

```bash
npm run build    # esbuild with sourcemaps → out/main.js
npm run watch    # esbuild in watch mode
npm run package  # vsce package → .vsix
npm run deploy   # vsce publish to the VS Code Marketplace (manual, needs VSCE_PAT; see PUBLISHING.md)
```

## Release Process

Releases are tag-driven via `.github/workflows/main.yml`. The version lives in exactly one place — `package.json`. `PUBLISHING.md` is the step-by-step guide.

### Releasing (use the terminal, not VS Code Source Control)

```bash
npm run release:patch   # x.y.Z → x.y.(Z+1)  — bug fixes
npm run release:minor   # x.Y.z → x.(Y+1).0  — new features
npm run release:major   # X.y.z → (X+1).0.0  — breaking changes
```

Move `CHANGELOG.md`'s `## [Unreleased]` to the new version and commit it first. Each command runs `npm version <level>` (updates `package.json` and `package-lock.json`, commits, creates the tag) then `git push --follow-tags`. GitHub Actions then: runs tests → packages the `.vsix` → creates the GitHub Release with it → publishes to Open VSX (`npx ovsx publish`). **It does not publish to the VS Code Marketplace**: that is a manual `VSCE_PAT=<PAT> npm run deploy` from the same commit (3.11.0 reached Open VSX automatically; the Marketplace keeps the previous version until someone publishes by hand).

### Why no `v` prefix on tags

`.npmrc` sets `tag-version-prefix=` (empty). Tags are `3.1.6` to match the CI trigger pattern `[0-9]+.[0-9]+.[0-9]+`.

### Secrets

- `OVSX_PAT` — GitHub repository secret, an Open VSX access token; the workflow's only publish credential.
- `VSCE_PAT` — an Azure DevOps PAT with Marketplace → Manage scope, used only for the manual `npm run deploy`. Keep it out of the repository and out of the workflow.

## Dependencies

| Package | Type | Purpose |
|---|---|---|
| `js-yaml` | runtime | YAML serialization in `configs.js` |
| `lodash` | runtime | `merge` for deep YAML merging |
| `commander` | runtime | CLI flag/subcommand parsing for `bin/thecore.js` (thecore_code_extension#39) |
| `mocha` | dev | Test runner |
| `sinon` | dev | Stubs/mocks in tests |
| `proxyquire` | dev | Module injection in tests (OS-level tests only) |
| `esbuild` | dev | Fast bundler |
| `eslint` | dev | Linting |
| `prettier` | dev | Formatting |
| `@vscode/vsce` | dev | Extension packaging/publishing |

## VSIX Packaging

`.vscodeignore` controls what ends up in the distributed `.vsix`. The following are explicitly excluded because they are development/AI tooling with no value to extension users — and some (`.agents/`, `.claude/`, `PUBLISHING.md`, `CLAUDE.md`) can trigger `vsce`'s secret scanner:

- `.agents/**`, `.claude/**` — AI skill files
- `AGENTS.md`, `CLAUDE.md`, `GLOSSARY.md`, `PUBLISHING.md` — dev/AI documentation
- `docs/**` — internal ADRs
- `.mocharc.yml`, `.vscode-test.mjs`, `jsconfig.json`, `.npmrc` — dev tooling config
- `test/**`, `tests/**`, `src/**`, `node_modules/**`, `.github/**` — source/test/CI artifacts
- `bin/**` — the headless CLI (thecore_code_extension#39); it has no purpose inside the VS Code
  extension runtime (`extension.js` never requires it), so it's excluded from the vsix the same
  way `test/**` is, even though it isn't test code. It's still shipped via `package.json`'s `bin`
  entry, which `.vscodeignore` has no effect on — see `docs/agents/headless-cli.md`.

What is intentionally included: `out/main.js`, `commands/`, `libs/`, `templates/`, `assets/`, `.devcontainer/`, `package.json`, `README.md`, `LICENSE.md`, `CHANGELOG.md`.
