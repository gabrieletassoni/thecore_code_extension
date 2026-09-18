# CLAUDE.md — Thecore VS Code Extension

This file documents the codebase structure, conventions, and development workflows for AI assistants working on this project.

> **⚠️ MANDATORY — read [AGENTS.md](AGENTS.md) before writing any code.**
> When implementing a new feature or changing the codebase, AGENTS.md requires running the
> `/grill-with-docs` → `/to-spec` → `/to-tickets` → `/tdd` skill sequence **before** any code is written.
> This file (CLAUDE.md) covers structure and conventions only; the mandatory workflow lives in AGENTS.md.

## Project Overview

A Visual Studio Code extension (publisher: `gabrieletassoni`, name: `thecore`) that scaffolds and manages [Thecore 3](https://github.com/gabrieletassoni/thecore) Ruby on Rails applications and modular Rails engines called **ATOMs**. The extension generates boilerplate files, runs shell commands (e.g., `rails g model`), enforces naming conventions, and audits ATOMs for Thecore practices conformance. The current version is in `package.json`.

- **Entry point:** `extension.js`
- **Bundled output:** `out/main.js` (via esbuild, never edit this directly)
- **VS Code engine:** `^1.85.0`
- **Node requirement:** `>=18`

---

## Directory Structure

```
.
├── extension.js              # Extension activation; registers all 7 commands
├── commands/                 # One file per command, each exports perform(ctx)
│   ├── addMemberAction.js
│   ├── addMigration.js
│   ├── addModel.js
│   ├── addRootAction.js
│   ├── checkPractices.js     # Audits ATOM/app for Thecore conventions; emits VS Code diagnostics
│   ├── createATOM.js
│   ├── createApp.js
│   ├── releaseApp.js         # Currently unused / commented out
│   └── setupDevContainer.js
├── libs/                     # Shared utility modules
│   ├── check.js              # Pure validation predicates (no outputChannel)
│   ├── commandRunner.js      # Guard-check and input-collection builder
│   ├── configs.js            # Pure file-writing helpers (no outputChannel)
│   ├── executionContext.js   # ExecutionContext, CheckContext, WriteContext
│   ├── helpers.js            # Case conversion: snakeToClassName, railsStyleKey
│   ├── os.js                 # Shell execution (execShell) and mkdir (mkDirP)
│   ├── templates.js          # Template rendering with {{key}} substitution
│   ├── thecoreGeneratorsGuard.js # Confirm-and-fix flow for the thecore_generators Gemfile guard
│   └── workspaceContext.js   # ATOMContext / AppContext factory
├── templates/                # Static template files used by commands
│   ├── setupDevContainer/    # Dockerfile, docker-compose.yml, devcontainer.json, etc.
│   └── shared/               # gitignore (action.scss was removed alongside checkPractices.js's
│                             # delegation — thecore_code_extension#38 — its only remaining reader;
│                             # createATOM/ was removed the same way alongside #40's delegation)
├── test/                     # Mocha test suite
│   ├── setup.js              # Global require hook — intercepts require('vscode')
│   ├── vscode.mock.js        # Lightweight VSCode API mock
│   ├── helpers/
│   │   └── makeCtx.js        # Stub factory: makeCtx(), makeAtomWorkspace(), makeAppWorkspace()
│   ├── *.test.js             # One test file per command
│   ├── libs/                 # Unit tests for libs/
│   └── samples/atom/         # Fixture: a minimal ATOM directory for tests
├── .github/workflows/main.yml # CI/CD: triggered by semver tags, publishes to Marketplace
├── .devcontainer/            # Dev container config (Dockerfile + devcontainer.json)
├── .vscode/                  # launch.json, extensions.json
├── assets/logo.png           # Extension icon
├── package.json
├── .eslintrc.json
├── .mocharc.yml
├── .npmrc                    # Sets tag-version-prefix= so npm version tags as "3.1.6" not "v3.1.6"
├── jsconfig.json
└── out/                      # Build output (git-ignored, never edit)
```

---

## Commands

All commands are registered in `extension.js`. Each creates an `ExecutionContext` for the invocation and calls `perform(ctx)` on the command module.

| Command ID | File | Context |
|---|---|---|
| `thecore.setupDevcontainer` | `setupDevContainer.js` | Outside `vendor/submodules/` |
| `thecore.createApp` | `createApp.js` | Outside `vendor/submodules/` |
| `thecore.createATOM` | `createATOM.js` | Outside `vendor/submodules/` |
| `thecore.addModel` | `addModel.js` | Both contexts |
| `thecore.addRootAction` | `addRootAction.js` | Both contexts |
| `thecore.addMemberAction` | `addMemberAction.js` | Both contexts |
| `thecore.addMigration` | `addMigration.js` | Both contexts |
| `thecore.checkPractices` | `checkPractices.js` | Both contexts |

Context is controlled in `package.json` via `contributes.menus["explorer/context"][].when` expressions.

Dual-context commands (`addModel`, `addRootAction`, `addMemberAction`, `addMigration`) dispatch on `ctx.workspace.type()`: in ATOM context they validate the gemspec against `ctx.workspace.atomDir`/`atomName`; in app context they validate the workspace root with `railsAppValid()`. Right-clicking *any* folder inside an ATOM's tree resolves to the owning ATOM. When invoked from the Command Palette (no folder argument), `workspaceContext.from(undefined)` falls back to an `AppContext` on the workspace root, so the main app is the default target. Main-app actions are generated into `config/root_actions` / `config/member_actions`, never `lib/` (see `docs/adr/0001-main-app-actions-live-in-config.md`).

Five dual-context commands (`addModel`/`addMigration`/`addRootAction`/`addMemberAction`/`createATOM`) are now thin wrappers over `thecore_generators` — see the next section — and so is `checkPractices` (see its own section further below). `createApp` is the one command left that still places/moves its generated files itself: `thecore_generators` ships a real App application template (`rails new -m <app_template.rb URL>`, ADR 0005/0007 in the `thecore` repo), but `createApp.js` itself hasn't been delegated to it yet — tracked as thecore_code_extension#41, blocked by the App template's own non-interactive mode (thecore_generators#23) landing first, so `createApp.js`'s always-zero-prompt, always-installs-everything behavior has no regression path when it does delegate.

### `addModel` / `addMigration` / `addRootAction` / `addMemberAction` — thin wrappers over `thecore_generators`

Since the [`thecore_generators`](https://github.com/gabrieletassoni/thecore_generators) gem now ships real Rails generator hooks — `config.app_generators.orm :thecore` (registered by its Railtie) for `model`/`migration`, plus its own `thecore:root_action`/`thecore:member_action` namespaced generators (`rails/generators`' own namespace-by-path discovery, no Railtie registration needed for those) — `rails generate model`/`migration`/`thecore:root_action`/`thecore:member_action` are themselves fully Thecore-aware: ATOM-vs-host-app file placement, no more always-generated `Api::`/`RailsAdmin::`/`Endpoints::` concern trio for models (only via `--with-api-concern`/`--with-admin-concern`), real test file generation, migration-driven inverse-association wiring, and — for the two action generators — the action file plus its view/JS/SCSS companions, the `after_initialize.rb` require line, the `assets.rb` precompile line, and locale entries, all happening *inside the Rails process*, regardless of who invokes it. `addModel.js`/`addMigration.js`/`addRootAction.js`/`addMemberAction.js` are therefore thin wrappers: they collect the name (and, for model/migration, the attribute definition) via the usual guard-check + `runner.input()` flow, shell out to `bundle install && rails g model|migration|thecore:root_action|thecore:member_action "<name>" [<definition>] [--atom=<name>] --non-interactive`, and trust the result — no template rendering, no stdout-scraping for `create ...` lines, no `fs.renameSync` relocation, no patching `include Api::X`/`include RailsAdmin::X` lines into the model file, and (for the two action commands) no more locale YAML merging or `after_initialize.rb`/`assets.rb` writes of their own. `addModel.js` also no longer passes `--skip-test-framework` (`thecore_generators` never suppresses test generation). `addRootAction.js`/`addMemberAction.js` are the exception that each keep a pre-flight check of their own: they still call `ctx.check.isFile(actionFile)` before shelling out and error with the same "already exists" message they always have — neither `thecore:root_action` nor `thecore:member_action` has a generator-level notion of that being an error (Thor would just no-op on identical content or, worse, ask an interactive question with no TTY behind it on genuinely different content), so the extension keeps deciding that case itself rather than letting a shelled, non-interactive process risk hitting a prompt no one can answer.

The flags on the shelled-out command matter and are always passed together:

- **`--atom=<name>`** (only in ATOM context, using `ctx.workspace.atomName`) — `thecore_generators`' `Thecore::Generators::WorkspaceContext` normally detects ATOM-vs-app context by reading the *generator process's own* `Dir.pwd`, mirroring this extension's `atomRootOf`/`hasGemspec` check (see `workspaceContext.js` below) but resolved from a terminal's cwd instead of a clicked folder. That cwd-reading is **not** reliable for this extension to lean on directly: plain `rails` (unlike the host app's `bin/rails` invoked by an explicit path) is `railties`' `exe/rails`, which — via `Rails::AppLoader.exec_app` — walks *up* the directory tree from `Dir.pwd` looking for `bin/rails`, `Dir.chdir("..")`-ing at every step, and only then `exec`s it; by the time the actual generator code runs, `Dir.pwd` has already been reset to the host app root, not wherever the extension originally set the child process's `cwd`. `thecore_generators` anticipated exactly this: `--atom=NAME` is an explicit, cwd-independent override "for scripted/CI invocations" (its own ADR 0002) that skips `Dir.pwd`-detection entirely and resolves the ATOM directly from the app root instead. So each of these commands keeps shelling out with `cwd: ctx.workspace.appRoot()` (as before, unchanged — needed for `bundle install` and for `rails`/`bin/rails` to resolve at all) and passes `--atom=<name>` explicitly whenever `ctx.workspace.type() === 'atom'`, rather than trying to fight the cwd-reset behavior above.
- **`--non-interactive`** (always) — for `model`/`migration`, this skips `thecore_generators`' inverse-association cardinality prompt (`has_many`/`has_one`/`skip`, added when a definition includes a `references` attribute — see its ADR 0003); `ctx.exec`'s child process has no real TTY behind it, so the prompt would hang waiting for input that can never arrive. Neither `thecore:root_action` nor `thecore:member_action` declares this option at all (they have no interactive prompt of their own to skip) — passed anyway, for the same reason and same command shape as the other two; verified directly that an unrecognized boolean-ish switch on a real `rails generate` invocation is silently accepted, not rejected.

`ctx.workspace` (from `libs/workspaceContext.js`) is still used here — for the guard checks (`hasGemspec`/`railsAppValid`) and to read `atomName` for the `--atom=` flag, plus (`addRootAction.js`/`addMemberAction.js` only) `rootActionsDir()`/`memberActionsDir()` for the pre-flight `isFile` check above — but it is no longer used to *decide where generated files end up*; that placement decision now lives entirely in `thecore_generators`. `libs/workspaceContext.js`'s detection logic remains load-bearing for `createApp`, the one command left that still does its own file placement.

### `createATOM` — thin wrapper over `rails g thecore:atom` (thecore_code_extension#40)

Unlike the four commands above, `createATOM` has no ATOM-vs-host-app branching at all — creating a *new* ATOM only ever makes sense from the host app root. It resolves its own app root via `ctx.check.railsAppValid()` (the same older context-access pattern it already used pre-delegation, left as-is rather than migrated to `ctx.workspace`, since this command never needed ATOM-vs-app detection to begin with) and passes that as the `rails g thecore:atom` call's `cwd`. The shared `confirmAndAddThecoreGenerators` guard helper it now also calls, however, *does* depend on `ctx.workspace.appRoot()` internally for its own `bundle install` call — so `ctx.workspace` isn't entirely out of the picture, it's just not this command's own choice of resolution path. The two happen to agree today (both ultimately read `vscode.workspace.workspaceFolders[0]`), but they're two independent paths to the same value, not one shared one. Its six `runner.input()` prompts (name, summary, description, author, email, url) and their validation are unchanged from before delegation — the command still owns collecting them, then shells out to `rails g thecore:atom "<snake_case_name>" --non-interactive --summary="..." --description="..." --author="..." --email="..." --url="..."` (`thecore_generators` 3.10.0/3.11.0, ADR 0006 in the `thecore` repo) and trusts the result. `--skip-api-admin-deps` is deliberately never passed — this command has always added `model_driven_api`/`thecore_ui_rails_admin` unconditionally, and omitting the flag preserves that exact behavior. No more template rendering, `fs` writes, `mkdir` calls, or CI YAML generation on the extension side — `thecore_generators` now owns the Rails engine creation, Scaffold Files, both CI files, `git init`, and host-Gemfile wiring. The now-orphaned `templates/createATOM/*` (`abilities.rb`, `after_initialize.rb`, `assets.rb`, `seeds.rb`) were removed alongside this delegation, the same way `templates/addRootAction/`/`templates/addMemberAction/`/`templates/shared/action.scss` were removed alongside `#38`'s.

**`try`/`catch` scope**: `addMigration.js` wraps its *entire* body (context guard checks, the Gemfile guard, `runner.input()`, everything) in one `try` opened right after the initial `workspaceExists` check — matching "Error Handling"'s "Commands use a top-level `try/catch` around I/O operations" rule exactly, since the Gemfile guard alone does real `fs`/`ctx.exec` I/O. `addModel.js` does not — its `try` opens later, after all of that, so a throw from its own Gemfile guard would be an unhandled rejection (`extension.js` never awaits/catches `perform()`). `addRootAction.js`/`addMemberAction.js` were written to match `addMigration.js`'s compliant shape, not `addModel.js`'s — if you're porting another command from the old always-do-everything-then-catch-at-the-end style, copy `addMigration.js` (or either of the two action commands), not `addModel.js`.

**The "already exists" pre-flight check logs, not just dialogs**: `addRootAction.js`/`addMemberAction.js`'s `ctx.check.isFile(actionFile).ok` branch calls `ctx.log(...)` immediately before `vscode.window.showErrorMessage(...)`, with the identical message — per "Logging"'s "every user-visible operation logs to the output channel" rule. Both files initially shipped (thecore_code_extension#36/#37) with only the dialog and no log call — caught by code review — so if you're porting a third action-style command, keep both calls together.

#### `thecore_generators` Gemfile guard

Because `addModel`/`addMigration`/`addRootAction`/`addMemberAction`/`checkPractices` now trust `rails` completely, a host app whose `Gemfile` doesn't actually depend on `thecore_generators` gets a **silent** regression (for `model`/`migration`) or an outright failure (`thecore:root_action`/`thecore:member_action`/`thecore:check_practices` simply don't exist as namespaces/tasks) — there is no clear "you're missing a dependency" signal either way. All five commands guard against this after their existing context guard checks (`hasGemspec`/`railsAppValid`) but *before* collecting the name (and definition) or running the audit, so a dismissed prompt doesn't waste typing:

```js
const gemfilePath = path.join(ctx.workspace.appRoot(), 'Gemfile');
if (!ctx.check.hasThecoreGenerators(gemfilePath).ok) {
    if (!(await confirmAndAddThecoreGenerators(ctx, gemfilePath))) return;
}
```

- **`ctx.check.hasThecoreGenerators(gemfilePath)`** (`CheckContext`, in `libs/executionContext.js`) reads the Gemfile (treating a missing file as empty content) and delegates the actual detection to the pure `check.hasThecoreGenerators(gemfileContent)` predicate in `libs/check.js` — a tolerant regex (`/gem\s+['"]thecore_generators['"]/`) that matches regardless of quote style, version constraint, or whether the line sits bare or inside a `group` block.
- On a failed check, `confirmAndAddThecoreGenerators(ctx, gemfilePath)` (`libs/thecoreGeneratorsGuard.js`) shows a `vscode.window.showWarningMessage` explaining the silent-fallback risk, with a single **"Add & Bundle Install"** action button.
  - **Dismissed/cancelled** (any response other than that exact button, including pressing Escape) — the function returns `false`, all five commands `return` immediately, and no `rails`/`bundle` command of the caller's own ever runs.
  - **Confirmed** — it patches the Gemfile via `insertGemIntoDevelopmentGroup` (`libs/configs.js`, a pure content transform — see below), adding `gem "thecore_generators", "~> 3.6"` inside a `group :development do ... end` block (reusing one if the Gemfile already has a bare `group :development do` block — Rails' own default Gemfile ships one, e.g. for `web-console` — or creating a fresh one otherwise; it deliberately does **not** reuse a `group :development, :test do` block, since that would also load the gem in the test env), runs `bundle install` via `ctx.exec`, and returns `true` so the caller proceeds with its own original command.

Regression check: a workspace whose Gemfile already has `thecore_generators` never triggers the warning at all — `ctx.check.hasThecoreGenerators` is `ok: true` and all five commands proceed exactly as before this guard existed.

### `checkPractices` — thin wrapper over `rails thecore:check_practices`

Since `thecore_generators` ships `rails thecore:check_practices` (thecore_generators#13/#14, per ADR 0004 in the `thecore` repo), `checkPractices.js` no longer scans the filesystem, checks markers, or renders templates to decide what's fixable itself — it shells out to `rails thecore:check_practices -- --json[ --atom=<name>]`, parses the JSON payload into the same `vscode.Diagnostic`s-grouped-by-file shape it always rendered, and — on the same Yes/No QuickPick ("Fix N of M?") it always showed — re-invokes with ` --fix` appended (still asking for `--json` too, so the *remaining* violations can be parsed and re-rendered). The rake task applies every fixable violation itself and reports whatever's left in the same pass; there is no separate client-side "apply, then re-scan" round trip, and no confirmation on the `--fix` side — the QuickPick is the only one. `--atom=<name>` is passed only in ATOM context, same convention as the other four commands; omitted in host-app context it now scans the host app **plus every ATOM under `vendor/submodules/`** in one pass (broader than the old JS, which only ever looked at the host app's own `app/models`/action directories when invoked from there — a deliberate scope widening from ADR 0004, not a bug).

**`ctx.execAllowNonZero`, not `ctx.exec`**: `rails thecore:check_practices` exits non-zero whenever it finds violations — its normal, expected reporting convention (mirroring RuboCop/ESLint), not a failure — but `ctx.exec`/`execShell` rejects on *any* non-zero exit and, verified directly (`node -e "require('child_process').exec(...)"` against this runtime), Node's own exec error object does not carry stdout here, so the reject path would silently discard the `--json` payload on the overwhelmingly common "found some violations" outcome. `execShellAllowNonZero` (`libs/os.js`) / `ctx.execAllowNonZero` (`libs/executionContext.js`) is a **separate** function/method for this one caller — deliberately not a behavior change to `execShell`/`ctx.exec` itself, since every other command relies on it rejecting on a genuine `rails g` failure (which also exits non-zero and can print output) to show that failure as an error rather than a false "success". It only rejects when nothing was captured at all (e.g. `bundle install` itself failing before check_practices ever runs).

**Extracting the JSON from a noisy stdout**: a real `rails thecore:check_practices -- --json` invocation prints Rails/RailsAdmin/Sidekiq boot noise to stdout *before* the actual payload (verified directly — none of it goes to stderr, so it can't be filtered out that way). `commands/checkPractices.js`'s `extractJson` scans the captured output from the last line backward for the last brace-delimited line that both `JSON.parse`s *and* has an array `violations` key, since `Thecore::CheckPractices::Reporter.json` always `puts`s the payload as a single line, last — the shape check (not just a successful parse) is what lets the scan keep looking further back if some other single-line JSON object (e.g. a structured-logging gem) ever ends up printed after the real payload, instead of misreporting it as unparseable output.

`runCheckPractices(ctx, isAtom, extraFlags, withBundleInstall = true)` prefixes the shelled command with `bundle install && ` only when `withBundleInstall` is true. The initial scan needs it (nothing has ensured `thecore_generators` is actually installed yet), but the `--fix` re-invocation passes `withBundleInstall: false` — the Gemfile/lockfile cannot have changed in the few seconds between the two calls within one `perform()` run, so re-running `bundle install` a second time would just be wasted work.

No violation-detection logic (marker checks, `fs` scans, template comparisons, `renderTemplate` calls) remains in `checkPractices.js` — `templates/addRootAction/`, `templates/addMemberAction/`, and `templates/shared/action.scss` were deleted alongside this port, since `checkPractices.js`'s own `--fix` handling was their last reader (`addRootAction.js`/`addMemberAction.js` stopped reading them when *they* were delegated, thecore_code_extension#36/#37).

---

## Key Libraries

### `libs/executionContext.js`

The central deep module. Commands receive a single `ExecutionContext ctx` that owns everything needed for one command invocation:

- **`ctx.workspace`** — `ATOMContext | AppContext | null` from `workspaceContext.from(folder)`
- **`ctx.check`** — `CheckContext` instance with methods returning `{ ok, value?, message? }`:
  - `workspaceExists()`, `workspaceEmpty()`, `railsAppValid(hideError?)`, `fileExists(path)`, `commandExists(cmd)`, `isDir(path)`, `isFile(path)`, `hasGemspec(atomDir, atomName)`, `hasThecoreGenerators(gemfilePath)`
- **`ctx.write`** — `WriteContext` instance with methods that log and write files:
  - `textFile(dir, name, content)`, `yamlFile(dir, name, obj)`, `jsonFile(dir, name, obj)`, `gitignoreFile(dir)`, `mergeYaml(dir, file, action, titleCase, rootEl)`
- **`ctx.log(msg)`** / **`ctx.show()`** — output channel helpers
- **`ctx.exec(cmd, cwd)`** — async shell execution
- **`ctx.mkdir(dir)`** — recursive mkdir

`CheckContext` delegates to `check.js` (pure predicates). `WriteContext` delegates to `configs.js` (pure I/O) and adds logging via `ctx.log()`.

### `libs/commandRunner.js`

Imperative builder for the two patterns that appear in every command:

```js
const runner = new CommandRunner(ctx);
const showErr = msg => vscode.window.showErrorMessage(msg);

// Guard check — calls showErr on failure, returns false
if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

// User input — returns null on cancel or empty (required) input
const name = await runner.input({ prompt, placeHolder, validate, optional });
if (!name) return;
```

### `libs/workspaceContext.js`

Factory and two adapter classes for the discriminated workspace type:

- `from(folder)` — returns `ATOMContext`, `AppContext`, or `null`; any folder at or below `vendor/submodules/<atom>/` resolves to that ATOM's root; with no folder (Command Palette) it falls back to an `AppContext` on the workspace root, and returns `null` only when no workspace is open
- **`ATOMContext`** — folder inside an ATOM's tree; exposes `atomDir`, `atomName`, `migrationDir()`, `modelDir()`, `memberActionsDir()`, `rootActionsDir()`, `localesDir()`, `viewsDir()`, `jsAssetsDir()`, `cssAssetsDir()`, `concernsDir(type)`, `initializerFile(name)`, `assetsFile()`, `appRoot()`
- **`AppContext`** — all other folders; exposes the same path methods rooted at the workspace root, except `memberActionsDir()`/`rootActionsDir()` which point to `config/member_actions`/`config/root_actions` instead of `lib/` (Zeitwerk autoload safety — see `docs/adr/0001-main-app-actions-live-in-config.md`). Also exposes `concernsDir(type)`.
- Both expose `type()` (`'atom'` or `'app'`), `targetDir()`

### `libs/check.js`

Pure validation predicates — **no `outputChannel` parameter**. Return values only; callers handle messaging.

- `workspaceExixtence()` — returns `true/false` (note: legacy typo preserved)
- `workspaceEmptiness()` — returns `true/false`
- `rubyOnRailsAppValidity(hideErrorMessage?)` — returns a `dirsObject` or `false`
- `fileExistence(filePath)` — wraps `fs.existsSync`
- `commandExistence(command)` — runs `<command> --version` via `execSync`
- `isPascalCase(word)` — returns `true/false` or a string error for non-string input
- `hasGemspec(atomDir, atomName)` — returns gemspec path or `false`
- `isDir(path)` / `isFile(path)` — type checks
- `hasThecoreGenerators(gemfileContent)` — returns `true` if `gemfileContent` contains a `thecore_generators` gem line (tolerant of quote style, version constraint, and `group` block nesting)

### `libs/configs.js`

Pure file I/O helpers — **no `outputChannel` parameter**. Write files; callers handle logging.

- `writeJSONFile(dir, file, obj)`, `writeYAMLFile(dir, file, obj)`, `writeTextFile(dir, file, content)`, `createGitignoreFile(dir)`, `mergeYmlContent(ymlDir, file, action, titleCase, root)`
- `insertGemIntoDevelopmentGroup(gemfileContent, gemLine)` — pure content transform (no fs I/O); inserts `gemLine` into an existing bare `group :development do ... end` block or creates one at the end of the file. Used by `createApp.js` and `libs/thecoreGeneratorsGuard.js` to add `thecore_generators` as a dev-only dependency.

### `libs/thecoreGeneratorsGuard.js`

- `confirmAndAddThecoreGenerators(ctx, gemfilePath)` — the interactive confirm-and-fix flow described above; shows the warning, and on confirmation patches the Gemfile and runs `bundle install`. Returns a `Promise<boolean>` indicating whether the caller should proceed.
- `GEM_LINE` — the exact gem line added: `gem "thecore_generators", "~> 3.6"`.
- `ACTION_LABEL` — the warning dialog's action button text (`"Add & Bundle Install"`).

### `libs/helpers.js`

- `snakeToClassName(snake)` — converts `snake_case` to `ClassName`
- `railsStyleKey(str)` — converts a human-readable title (`'My Project'`) to Rails-style snake\_case key (`'my_project'`)

### `libs/os.js`

- `execShell(cmd, workingDirectory, outputChannel)` — async shell execution; streams dots while running; **rejects on any non-zero exit**.
- `execShellAllowNonZero(cmd, workingDirectory, outputChannel)` — same, but only rejects when nothing was captured at all; used solely by `checkPractices.js` via `ctx.execAllowNonZero` (see its own CLAUDE.md section) since a non-zero exit isn't a failure for that one caller.
- `mkDirP(dir, outputChannel)` — recursive `mkdir`; creates a `.keep` file in new directories

### `libs/templates.js`

- `renderTemplate(templateRelPath, vars)` — reads `templates/<path>`, replaces all `{{key}}` with values from `vars`

---

## Templates

Templates live in `templates/` using `{{key}}` placeholder syntax. When adding a template:

1. Create the file under `templates/<command>/`.
2. Call `renderTemplate('command/file.ext', { key: value })` from the command file.
3. Never hardcode file content inline — always use a template.

---

## Conventions

### Command Structure

Every command follows this pattern:

```js
async function perform(ctx) {
    // 1. Workspace-null guard (before ctx.show)
    if (!ctx.workspace) { vscode.window.showErrorMessage('Please right click...'); return; }

    ctx.show();
    ctx.log('Starting operation...');

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    // 2. Guard checks via runner
    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

    try {
        // 3. Remaining checks + inputs + logic
        if (!runner.check(ctx.check.isDir(...), showErr)) return;
        const name = await runner.input({ prompt: '...', validate: v => ... });
        if (!name) return;

        // 4. Actual work
        await ctx.exec(...);
        ctx.write.textFile(...);
        vscode.window.showInformationMessage('Success!');
    } catch (error) {
        ctx.log(`❌ ...`);
        vscode.window.showErrorMessage(`...`);
    }
}
```

### Naming

- **Command files:** `camelCase` (e.g., `addModel.js`, `setupDevContainer.js`)
- **Model names (user input):** must be `PascalCase` — validated via `isPascalCase()`
- **ATOM gemspec:** `<atom-name>.gemspec` or `<atom_name>.gemspec` (handled by `hasGemspec`)

### Logging

Every user-visible operation logs to the `ExecutionContext` output channel via `ctx.log(msg)`. Use emoji prefixes:
- `❓️` — checking/validating
- `✅` — success
- `❌` — error/failure
- `⌛` — running a command
- `📝` — writing a file
- `📄` — moving/creating a file

Never use `console.log` for user output. Never pass `outputChannel` to `check.js` or `configs.js` functions.

### Error Handling

- Commands use `runner.check(result, showErr)` for guard checks — it calls `showErr` and returns `false` on failure.
- Commands use a top-level `try/catch` around I/O operations.
- `execShell` rejects on non-zero exit codes — except `execShellAllowNonZero`/`ctx.execAllowNonZero`, used only by `checkPractices.js`, which doesn't (see `libs/os.js` and the `checkPractices` section above).

---

## Testing

**Rule: Always add or update tests when adding or modifying any function.**

**Rule: When a test fails, fix the bug in the codebase — never modify the test to silence a failure. The only valid reason to change a test is if the test itself is provably wrong (e.g., it tests the wrong behaviour or has a logic error), and even then, document why in the commit message.**

**Framework:** Mocha + Sinon (no proxyquire needed for command tests)

**Run tests:**
```bash
npm test          # Mocha unit tests (no VS Code process needed)
npm run test:vscode  # Full VS Code integration tests
```

**Key test infrastructure:**

- `test/setup.js` — Mocha `require` file; installs a hook so `require('vscode')` returns the mock
- `test/vscode.mock.js` — minimal stub of the VS Code API
- `test/helpers/makeCtx.js` — exports `makeCtx(overrides?)`, `makeAtomWorkspace(overrides?)`, `makeAppWorkspace(overrides?)`, `FAKE_ROOT`, `ATOM_DIR`. Provides a plain stub `ExecutionContext` with sinon stubs for all `ctx.check.*` and `ctx.write.*` methods.
- `test/samples/atom/` — fixture ATOM directory with real gemspec, locales, lib/

**Command tests** (in `test/*.test.js`):
- Use `makeCtx()` directly — no proxyquire, no `fs` stubs for guard paths
- Override check stubs to test failure: `ctx.check.isDir.returns({ ok: false, message: 'err' })`
- Stub `vscode.window.showInputBox` for input flows (CommandRunner delegates to it)

**Library tests** (in `test/libs/*.test.js`):
- Use proxyquire only for OS-level tests (`os.test.js`)
- Stub `fs` / `vscode` directly for `check.test.js` and `executionContext.test.js`
- `check.test.js` calls may pass extra args (legacy `oc()`) — these are silently ignored

**Mocha config (`.mocharc.yml`):**
```yaml
require:
  - test/setup.js
spec: "test/**/*.test.js"
timeout: 10000
```

---

## Build

```bash
npm run build    # esbuild with sourcemaps → out/main.js
npm run watch    # esbuild in watch mode
npm run package  # vsce package → .vsix
npm run deploy   # vsce publish to Marketplace
```

---

## Release Process

Releases are automated via `.github/workflows/main.yml`. The version lives in exactly one place — `package.json`.

### Releasing (use the terminal, not VS Code Source Control)

```bash
npm run release:patch   # x.y.Z → x.y.(Z+1)  — bug fixes
npm run release:minor   # x.Y.z → x.(Y+1).0  — new features
npm run release:major   # X.y.z → (X+1).0.0  — breaking changes
```

Each command runs `npm version <level>` (updates `package.json`, commits, creates a tag) then `git push --follow-tags`. GitHub Actions then: runs tests → packages extension → creates GitHub Release with `.vsix`.

### Why no `v` prefix on tags

`.npmrc` sets `tag-version-prefix=` (empty). Tags are `3.1.6` to match the CI trigger pattern `[0-9]+.[0-9]+.[0-9]+`.

### Secret required

`VSCE_PAT` must be set in GitHub repository secrets — an Azure DevOps PAT with Marketplace → Manage scope.

---

## Dependencies

| Package | Type | Purpose |
|---|---|---|
| `js-yaml` | runtime | YAML serialization in `configs.js` |
| `lodash` | runtime | `merge` for deep YAML merging |
| `mocha` | dev | Test runner |
| `sinon` | dev | Stubs/mocks in tests |
| `proxyquire` | dev | Module injection in tests (OS-level tests only) |
| `esbuild` | dev | Fast bundler |
| `eslint` | dev | Linting |
| `prettier` | dev | Formatting |
| `@vscode/vsce` | dev | Extension packaging/publishing |

---

## VSIX Packaging

`.vscodeignore` controls what ends up in the distributed `.vsix`. The following are explicitly excluded because they are development/AI tooling with no value to extension users — and some (`.agents/`, `.claude/`, `PUBLISHING.md`, `CLAUDE.md`) can trigger `vsce`'s secret scanner:

- `.agents/**`, `.claude/**` — AI skill files
- `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `PUBLISHING.md` — dev/AI documentation
- `docs/**` — internal ADRs
- `.mocharc.yml`, `.vscode-test.mjs`, `jsconfig.json`, `.npmrc` — dev tooling config
- `test/**`, `tests/**`, `src/**`, `node_modules/**`, `.github/**` — source/test/CI artifacts

What is intentionally included: `out/main.js`, `commands/`, `libs/`, `templates/`, `assets/`, `.devcontainer/`, `package.json`, `README.md`, `LICENSE.md`, `CHANGELOG.md`.

---

## Known Quirks

- `workspaceExixtence` has a typo (`Exixtence` not `Existence`) — this is the existing exported name; do not rename without updating all callers and tests.
- `rubyOnRailsAppValidity` accepts a `hideErrorMessage` first parameter — retained for API compatibility but has no effect since the function is now pure (it never logged anyway after migration).
- `releaseApp.js` exists but its command is commented out in `extension.js` — do not activate without understanding why it was disabled.
- The `fmt` script in `package.json` targets `src/**/*.ts` (no-op for this project's JS files).
- `mkDirP` always creates a `.keep` file in newly created directories — intentional for Git tracking.
