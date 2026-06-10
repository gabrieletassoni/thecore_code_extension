# CLAUDE.md — Thecore VS Code Extension

This file documents the codebase structure, conventions, and development workflows for AI assistants working on this project.

## Project Overview

A Visual Studio Code extension (publisher: `gabrieletassoni`, name: `thecore`, version `3.1.6`) that scaffolds and manages [Thecore 3](https://github.com/gabrieletassoni/thecore) Ruby on Rails applications and modular Rails engines called **ATOMs**. The extension generates boilerplate files, runs shell commands (e.g., `rails g model`), and enforces naming conventions.

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
│   └── workspaceContext.js   # ATOMContext / AppContext factory
├── templates/                # Static template files used by commands
│   ├── addMemberAction/      # action.rb, action.js, action.html.erb
│   ├── addModel/             # api_concern.rb, endpoints_concern.rb, rails_admin_concern.rb
│   ├── addRootAction/        # action.rb, action.js, action.html.erb
│   ├── createATOM/           # abilities.rb, after_initialize.rb, assets.rb, seeds.rb
│   └── shared/               # action.scss, gitignore
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
| `thecore.addRootAction` | `addRootAction.js` | Inside `vendor/submodules/` (ATOM root) |
| `thecore.addMemberAction` | `addMemberAction.js` | Inside `vendor/submodules/` (ATOM root) |
| `thecore.addMigration` | `addMigration.js` | Inside `vendor/submodules/` (ATOM root) |

Context is controlled in `package.json` via `contributes.menus["explorer/context"][].when` expressions.

---

## Key Libraries

### `libs/executionContext.js`

The central deep module. Commands receive a single `ExecutionContext ctx` that owns everything needed for one command invocation:

- **`ctx.workspace`** — `ATOMContext | AppContext | null` from `workspaceContext.from(folder)`
- **`ctx.check`** — `CheckContext` instance with methods returning `{ ok, value?, message? }`:
  - `workspaceExists()`, `workspaceEmpty()`, `railsAppValid(hideError?)`, `fileExists(path)`, `commandExists(cmd)`, `isDir(path)`, `isFile(path)`, `hasGemspec(atomDir, atomName)`
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

- `from(folder)` — returns `ATOMContext`, `AppContext`, or `null`
- **`ATOMContext`** — folder directly inside `vendor/submodules/`; exposes `atomDir`, `atomName`, `migrationDir()`, `modelDir()`, `memberActionsDir()`, `rootActionsDir()`, `localesDir()`, `viewsDir()`, `jsAssetsDir()`, `cssAssetsDir()`, `initializerFile(name)`, `assetsFile()`, `appRoot()`
- **`AppContext`** — all other folders; exposes `modelDir()`, `migrationDir()`, `concernsDir(type)`, `appRoot()`
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

### `libs/configs.js`

Pure file I/O helpers — **no `outputChannel` parameter**. Write files; callers handle logging.

- `writeJSONFile(dir, file, obj)`, `writeYAMLFile(dir, file, obj)`, `writeTextFile(dir, file, content)`, `createGitignoreFile(dir)`, `mergeYmlContent(ymlDir, file, action, titleCase, root)`

### `libs/helpers.js`

- `snakeToClassName(snake)` — converts `snake_case` to `ClassName`
- `railsStyleKey(str)` — converts a human-readable title (`'My Project'`) to Rails-style snake\_case key (`'my_project'`)

### `libs/os.js`

- `execShell(cmd, workingDirectory, outputChannel)` — async shell execution; streams dots while running
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
- `execShell` rejects on non-zero exit codes.

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

## Known Quirks

- `workspaceExixtence` has a typo (`Exixtence` not `Existence`) — this is the existing exported name; do not rename without updating all callers and tests.
- `rubyOnRailsAppValidity` accepts a `hideErrorMessage` first parameter — retained for API compatibility but has no effect since the function is now pure (it never logged anyway after migration).
- `releaseApp.js` exists but its command is commented out in `extension.js` — do not activate without understanding why it was disabled.
- The `fmt` script in `package.json` targets `src/**/*.ts` (no-op for this project's JS files).
- `mkDirP` always creates a `.keep` file in newly created directories — intentional for Git tracking.
