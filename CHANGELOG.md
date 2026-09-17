# Change Log

All notable changes to the "thecore" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [3.6.0]

### Changed
- `commands/addRootAction.js`/`commands/addMemberAction.js` — now thin wrappers shelling out to `rails g thecore:root_action`/`thecore:member_action` (requires `thecore_generators` >= 3.5.0/3.6.0) instead of rendering templates and writing files themselves; no more locale YAML merging, `after_initialize.rb`/`assets.rb` writes, or stdout-scraping on the extension side (closes #36, #37)
- `commands/checkPractices.js` — now a thin wrapper shelling out to `rails thecore:check_practices -- --json[ --atom=NAME]` (requires `thecore_generators` >= 3.6.0) instead of scanning the filesystem, checking markers, or rendering templates itself; without `--atom` it now scans the main app plus every ATOM under `vendor/submodules/` in one pass — broader than before, which only ever looked at the invoking context. Re-invokes with `--fix` on the same confirmation QuickPick as before, applying every fixable violation in one pass with no client-side fix logic remaining (closes #38)
- `libs/os.js`/`libs/executionContext.js` — new `execShellAllowNonZero`/`ctx.execAllowNonZero`, used only by `checkPractices.js`, since `rails thecore:check_practices` exits non-zero whenever it finds violations as its normal reporting convention, not a failure
- `libs/thecoreGeneratorsGuard.js` — `GEM_LINE` bumped to `~> 3.6`
- `CONTEXT.md` — add "Application Template"/"Setup Devcontainer" glossary terms (thecore's ADR 0005)
- `README.md`/`AGENTS.md`/`CONTEXT.md` — fixed stale descriptions claiming `addRootAction.js`/`addMemberAction.js` move files themselves and `checkPractices.js` does its own scanning/marker-checking/fix-application

### Removed
- `templates/addRootAction/`, `templates/addMemberAction/`, `templates/shared/action.scss` — no longer read by anything, since `checkPractices.js`'s own `--fix` was their last reader
- `libs/check.js` — `hasUnreplacedTokens`/`hasSkeletonMarker`, used only by the pre-delegation detection logic this release removes

## [3.5.0]

### Added
- `templates/setupDevContainer/devcontainer.json` — `Anthropic.claude-code` extension, `ghcr.io/devcontainers-extra/features/claude-code:2` feature, and `mounts` persisting `.claude`/`.claude.json`/`.bundle`/`.gem`/glab-cli config across container rebuilds
- `templates/setupDevContainer/docker-compose.yml` — `RAILS_ENV`/`SECRET_KEY_BASE` dev defaults (required for JWT decoding) and a documented rationale for the `user: vscode` override
- `libs/thecoreGeneratorsGuard.js` — `confirmAndAddThecoreGenerators(ctx, gemfilePath)` warns and offers an "Add & Bundle Install" action when a host app's Gemfile is missing `thecore_generators`, preventing `addModel`/`addMigration` from silently falling back to un-hooked `rails generate` behavior (closes #34)
- `libs/check.js` — `hasThecoreGenerators(gemfileContent)` pure predicate, tolerant of quote style, version constraint, and `group` block nesting
- `libs/configs.js` — `insertGemIntoDevelopmentGroup(gemfileContent, gemLine)` pure content transform; reuses an existing bare `group :development do` block (e.g. Rails' own default `web-console` block) or creates one

### Changed
- `templates/setupDevContainer/devcontainer.json` — `postCreateCommand` now self-heals `/usr/local/bundle` ownership before bundling and runs `npx skills update --project --yes`, matching the convention adopted across host apps
- `templates/setupDevContainer/backend.code-workspace` — associate `Gemfile.base` (not `Gemfile`) with the `gemfile` language, matching the file the generated devcontainer actually formats
- `commands/createApp.js` — generated `.gitlab-ci.yml` now gates `build`/`to-dev`/`to-prod` on `only: changes: [version]` (skipping tag pipelines) instead of running on every commit, matching the convention adopted across host apps; newly-created apps' Gemfiles now include `thecore_generators` in the dev group automatically, so they never hit the guard above
- `commands/addModel.js`/`commands/addMigration.js` — now thin wrappers delegating to the `thecore_generators` gem's `rails g model`/`rails g migration` hook: no more templating `Api::`/`RailsAdmin::`/`Endpoints::` concern files, patching `include` lines into the model, parsing `rails g` stdout to relocate files, or `fs.renameSync` ATOM relocation for migrations. `addModel.js` no longer passes `--skip-test-framework`. Both now pass `--atom=<name>` (ATOM context only) and `--non-interactive` to the shelled-out command instead (closes #32); both also guard against a missing `thecore_generators` Gemfile dependency before collecting input (closes #34)

### Removed
- `templates/addModel/api_concern.rb`, `rails_admin_concern.rb`, `endpoints_concern.rb` — no longer rendered; `thecore_generators` supplies the equivalent starter files behind `--with-api-concern`/`--with-admin-concern` when a `rails g model` invocation needs them

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
