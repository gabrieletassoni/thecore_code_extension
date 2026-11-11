# CLAUDE.md — Thecore VS Code Extension

VS Code extension (publisher `gabrieletassoni`, name `thecore`) that scaffolds and manages [Thecore 3](https://github.com/gabrieletassoni/thecore) Rails apps and their engines (**ATOMs**). Nearly every command is a thin wrapper that shells out to `thecore_generators` (`rails g ...`, `rails thecore:check_practices`, the App template). Version lives only in `package.json`. Entry point `extension.js`; bundle `out/main.js` (esbuild, never edit it). VS Code `^1.85.0`, Node `>=18`.

> **⚠️ MANDATORY — read [AGENTS.md](AGENTS.md) before writing any code.**
> When implementing a new feature or changing the codebase, AGENTS.md requires running the
> `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/tdd` skill sequence **before** any code is written.
> This file (CLAUDE.md) covers structure and conventions only; the mandatory workflow lives in AGENTS.md.

## Where things are

```
extension.js     registers all 9 commands, one ExecutionContext per invocation
commands/        one file per command, each exports perform(ctx)
libs/            executionContext, commandRunner, workspaceContext, check (pure), configs (pure),
                 thecoreGeneratorsGuard, os (execShell, mkDirP), templates, helpers
templates/       {{key}} templates (setupDevContainer/, shared/)
bin/             headless CLI (thecore.js + vscode-shim.js), not in the vsix
test/            Mocha suite: setup.js, vscode.mock.js, helpers/makeCtx.js, libs/, bin/, samples/atom/
docs/adr/  docs/agents/  GLOSSARY.md  PUBLISHING.md  CHANGELOG.md
```

## Read before working on…

| Topic | File |
| --- | --- |
| Full annotated directory tree | `docs/agents/directory-structure.md` |
| Any command: table, ATOM-vs-app dispatch, `thecore_generators` wrappers, Gemfile guard, `createApp`, `setupDevContainer`, `checkPractices` | `docs/agents/commands.md` |
| `libs/*.js` APIs (`ExecutionContext`, `CommandRunner`, `WorkspaceContext`, `check`, `configs`, `os`, …) | `docs/agents/key-libraries.md` |
| Command skeleton, naming, logging emoji, error handling | `docs/agents/conventions.md` |
| Tests: framework, `makeCtx`, command vs library tests, Mocha config | `docs/agents/testing.md` |
| Build, releasing, tags, secrets, dependencies, VSIX packaging | `docs/agents/build-and-release.md` |
| Headless CLI (`bin/thecore.js`) | `docs/agents/headless-cli.md` |
| Security scanning (CodeQL, secret scanning, Dependabot) | `docs/agents/security-scanning.md` |
| Issues (GitHub), triage labels, glossary/ADR layout | `docs/agents/issue-tracker.md`, `triage-labels.md`, `domain.md` |

## Rules most tasks need

- Commands: workspace-null guard before `ctx.show()`; guard checks via `runner.check(result, showErr)`, inputs via `runner.input()`, never `vscode.window.showInputBox` directly; a top-level `try/catch` around I/O (copy `addMigration.js`'s shape, not `addModel.js`'s). Register new commands in `extension.js` and `package.json` (`contributes.commands`/`menus`).
- Never access `vscode.workspace.workspaceFolders` in a command; use `ctx.check.workspaceExists()` and `ctx.workspace.*` (`type()` is `'atom'` or `'app'`). Main-app actions go in `config/*_actions`, never `lib/` (`docs/adr/0001-main-app-actions-live-in-config.md`).
- Shelled `rails g` calls always pass `--non-interactive`, plus `--atom=<name>` in ATOM context. Commands that need `thecore_generators` run the Gemfile guard before collecting input.
- Every user-visible operation logs via `ctx.log(msg)` with emoji prefixes (`❓️ ✅ ❌ ⌛ 📝 📄`). Never use `console.log` for user output. Never pass `outputChannel` to `check.js` or `configs.js` functions.
- `execShell`/`ctx.exec` reject on non-zero exit; only `checkPractices.js` uses `ctx.execAllowNonZero`.
- Naming: command files `camelCase`; model names `PascalCase` (`isPascalCase()`).

## Templates

Templates live in `templates/` using `{{key}}` placeholder syntax. When adding a template:

1. Create the file under `templates/<command>/`.
2. Call `renderTemplate('command/file.ext', { key: value })` from the command file.
3. Never hardcode file content inline — always use a template.

## Testing

**Rule: Always add or update tests when adding or modifying any function.**

**Rule: When a test fails, fix the bug in the codebase — never modify the test to silence a failure. The only valid reason to change a test is if the test itself is provably wrong (e.g., it tests the wrong behaviour or has a logic error), and even then, document why in the commit message.**

```bash
npm test             # Mocha unit tests (no VS Code process needed)
npm run test:vscode  # Full VS Code integration tests
npm run build        # esbuild → out/main.js
```

Command tests use `makeCtx()` from `test/helpers/makeCtx.js`: no proxyquire, no `fs` stubs. Proxyquire only for `os.test.js`.

## Releasing

`npm run release:patch|minor|major` from the terminal, never VS Code Source Control, never a manual tag; move `CHANGELOG.md`'s `## [Unreleased]` first. Tags carry no `v` prefix. CI publishes to Open VSX only; the Marketplace is a manual `VSCE_PAT=<PAT> npm run deploy`. Keep `VSCE_PAT` out of the repository and the workflow. Don't remove the dev/AI entries (including `docs/**`) from `.vscodeignore`.

## Known Quirks

- `workspaceExixtence` has a typo (`Exixtence` not `Existence`) — this is the existing exported name; do not rename without updating all callers and tests.
- `rubyOnRailsAppValidity` accepts a `hideErrorMessage` first parameter — retained for API compatibility but has no effect since the function is now pure (it never logged anyway after migration).
- `releaseApp.js` exists but its command is commented out in `extension.js` — do not activate without understanding why it was disabled.
- The `fmt` script in `package.json` targets `src/**/*.ts` (no-op for this project's JS files).
- `mkDirP` always creates a `.keep` file in newly created directories — intentional for Git tracking.

Secret scanning push protection is the only check that blocks anything: if it fires on a real secret, remove it from the commit and rotate the secret; never bypass it.

## Agent skills

### Issue tracker

Tasks, issues, bugs, tickets and specs for this repository live **only** in its GitHub Issues
(`gabrieletassoni/thecore_code_extension`), handled with the `gh` CLI. See `docs/agents/issue-tracker.md`.

**Mandatory rule.** Whenever a skill or development work creates, reads, updates, comments on,
assigns, blocks or closes a task, issue, bug, ticket or spec (for example /to-tickets, /to-spec,
/triage, /wayfinder, /implement, /diagnosing-bugs, /code-review, closing a piece of work, a bug found
during a session), do it in this repository's GitHub Issues following `docs/agents/issue-tracker.md`.
Never use Odoo, `.scratch/` or local Markdown files as a tracker: Odoo is only for the repositories
on Bancolini's GitLab. `#123` means a GitHub issue number of this repository. If `gh` doesn't work,
stop and say so instead of falling back to another tracker.

### Triage labels

The five canonical triage roles map to GitHub labels with the same name (`needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily when the first
term or decision is resolved. See `docs/agents/domain.md`.

### Skills

Matt Pocock's skills come from the `mattpocock-skills` Claude Code plugin installed on the
developer's **host** (`claude plugins install mattpocock-skills`, official marketplace), never
vendored here: no `.agents/skills/`, `.claude/commands/` or `skills-lock.json`. Its `ask-matt` skill
maps how the skills connect.

Keep `CLAUDE.md` or the `docs/agents/` file it points to accurate whenever the behaviour it describes changes.
