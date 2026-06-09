# Change Log

All notable changes to the "thecore" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [3.1.8]

### Fixed
- Replace non-existent `ghcr.io/devcontainers-extra/features/graphviz:1` with `ghcr.io/devcontainers-extra/features/apt-packages:1` (packages: graphviz) in `templates/setupDevContainer/devcontainer.json`

## [3.1.6]

### Added
- `libs/workspaceContext.js` — `ATOMContext` / `AppContext` discriminated union with a `from(folder)` factory; centralises all workspace path derivation
- `libs/executionContext.js` — `ExecutionContext` deep module owning `OutputChannel`, `workspace`, `check` (`CheckContext`), and `write` (`WriteContext`) per command invocation
- `libs/commandRunner.js` — imperative builder for guard checks (`runner.check(result, onFail)`) and user input collection (`runner.input({prompt, validate, optional})`)
- `test/helpers/makeCtx.js` — shared stub factory for command unit tests (`makeCtx`, `makeAtomWorkspace`, `makeAppWorkspace`)
- `AGENTS.md` — AI agent guidance with architecture facts, testing strategy, and command conventions

### Changed
- All 7 commands migrated from `perform(folder)` to `perform(ctx)` using `ExecutionContext`
- All commands now use `CommandRunner` for guard checks and user input collection
- `libs/check.js` — stripped `outputChannel` parameters; functions are now pure predicates
- `libs/configs.js` — stripped `outputChannel` parameters; functions are now pure file I/O
- `railsStyleKey` moved from `libs/configs.js` to `libs/helpers.js`
- `setupDevContainer.js` imports `railsStyleKey` from `libs/helpers` instead of `libs/configs`
- `CheckContext` delegates to `check.js`; `WriteContext` delegates to `configs.js` — no more duplicated logic
- Command tests rewritten to use `makeCtx()` stub — no `proxyquire` required in command tests
- Updated `CLAUDE.md` and `README.md` to reflect current architecture

## [Unreleased]

- Initial release
