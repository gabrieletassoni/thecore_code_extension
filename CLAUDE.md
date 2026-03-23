# CLAUDE.md — Thecore VS Code Extension

This file documents the codebase structure, conventions, and development workflows for AI assistants working on this project.

## Project Overview

A Visual Studio Code extension (publisher: `gabrieletassoni`, name: `thecore`, version `3.0.9`) that scaffolds and manages [Thecore 3](https://github.com/gabrieletassoni/thecore) Ruby on Rails applications and modular Rails engines called **ATOMs**. The extension generates boilerplate files, runs shell commands (e.g., `rails g model`), and enforces naming conventions.

- **Entry point:** `extension.js`
- **Bundled output:** `out/main.js` (via esbuild, never edit this directly)
- **VS Code engine:** `^1.85.0`
- **Node requirement:** `>=18`

---

## Directory Structure

```
.
├── extension.js              # Extension activation; registers all 7 commands
├── commands/                 # One file per command, each exports perform()
│   ├── addMemberAction.js
│   ├── addMigration.js
│   ├── addModel.js
│   ├── addRootAction.js
│   ├── createATOM.js
│   ├── createApp.js
│   ├── releaseApp.js         # Currently unused / commented out
│   └── setupDevContainer.js
├── libs/                     # Shared utility modules
│   ├── check.js              # Validation functions (workspace, Rails app, naming)
│   ├── configs.js            # File-writing helpers (JSON, YAML, text, .gitignore)
│   ├── helpers.js            # Case conversion (snakeToClassName)
│   ├── os.js                 # Shell execution (execShell) and mkdir (mkDirP)
│   └── templates.js          # Template rendering with {{key}} substitution
├── templates/                # Static template files used by commands
│   ├── addMemberAction/      # action.rb, action.js, action.html.erb
│   ├── addModel/             # api_concern.rb, endpoints_concern.rb, rails_admin_concern.rb
│   ├── addRootAction/        # action.rb, action.js, action.html.erb
│   ├── createATOM/           # abilities.rb, after_initialize.rb, assets.rb, seeds.rb
│   └── shared/               # action.scss, gitignore
├── test/                     # Mocha test suite
│   ├── setup.js              # Global require hook — intercepts require('vscode')
│   ├── vscode.mock.js        # Lightweight VSCode API mock
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
├── .npmrc                    # Sets tag-version-prefix= so npm version tags as "3.0.12" not "v3.0.12"
├── jsconfig.json
└── out/                      # Build output (git-ignored, never edit)
```

---

## Commands

All commands are registered in `extension.js` using lazy `require()` and each implementation lives in `commands/<name>.js` exporting a single `perform(folder?)` function.

| Command ID | File | Context |
|---|---|---|
| `thecore.setupDevcontainer` | `setupDevContainer.js` | Outside `vendor/submodules/` |
| `thecore.createApp` | `createApp.js` | Outside `vendor/submodules/` |
| `thecore.createATOM` | `createATOM.js` | Outside `vendor/submodules/` |
| `thecore.addModel` | `addModel.js` | Both contexts |
| `thecore.addRootAction` | `addRootAction.js` | Inside `vendor/submodules/` (ATOM root) |
| `thecore.addMemberAction` | `addMemberAction.js` | Inside `vendor/submodules/` (ATOM root) |
| `thecore.addMigration` | `addMigration.js` | Inside `vendor/submodules/` (ATOM root) |

Context is controlled in `package.json` via `contributes.menus["explorer/context"][].when` expressions — do not change these unless you understand the VSCode `when` clause syntax.

---

## Key Libraries

### `libs/check.js`
Validation functions, all taking an `outputChannel` for user-visible logging:

- `workspaceExixtence(outputChannel)` — checks `vscode.workspace.workspaceFolders` is defined (note: the typo `Exixtence` is intentional/legacy — do not rename)
- `workspaceEmptiness(outputChannel)` — ensures exactly one workspace folder
- `rubyOnRailsAppValidity(hideErrorMessage, outputChannel)` — validates standard Rails directory structure; returns a `dirsObject` on success or `false`
- `fileExistence(filePath, outputChannel)` — wraps `fs.existsSync`
- `commandExistence(command, outputChannel)` — runs `<command> --version` via `execSync`
- `isPascalCase(word)` — validates model names; pattern: `/^[A-Z][A-Za-z]*$/`
- `hasGemspec(atomDir, atomName, outputChannel)` — validates ATOM by checking for a `.gemspec` file (handles dash-to-underscore variant names)
- `isDir(path, outputChannel)` / `isFile(path, outputChannel)` — type checks

### `libs/os.js`
- `execShell(cmd, workingDirectory, outputChannel)` — async shell execution via `child_process.exec`; streams dots to the output channel while running; resolves/rejects with stdout/stderr
- `mkDirP(dir, outputChannel)` — recursive `mkdir`; also creates a `.keep` file inside newly created directories

### `libs/templates.js`
- `renderTemplate(templateRelPath, vars)` — reads a file from `templates/<templateRelPath>` and replaces all `{{key}}` occurrences with values from `vars`

### `libs/configs.js`
- `writeJSONFile(filePath, content, outputChannel)`
- `writeYAMLFile(filePath, content, outputChannel)` — uses `js-yaml`
- `writeTextFile(filePath, content, outputChannel)`
- `createGitignoreFile(dir, outputChannel)` — uses `templates/shared/gitignore`
- `mergeYmlContent(filePath, newContent, outputChannel)` — deep-merges YAML using `lodash.merge`

### `libs/helpers.js`
- `snakeToClassName(snake)` — converts `snake_case` to `ClassName`

---

## Templates

Templates live in `templates/` and use `{{key}}` as placeholder syntax (no logic, pure substitution via `renderTemplate`). When adding a new template:

1. Create the file under the appropriate `templates/<command>/` subdirectory.
2. Use `{{variableName}}` for dynamic values.
3. Call `renderTemplate('command/file.ext', { variableName: value })` from the command file.
4. Never hardcode file content inline in command files — always extract to a template.

---

## Conventions

### Naming
- **Command files:** `camelCase` (e.g., `addModel.js`, `setupDevContainer.js`)
- **Model names (user input):** must be `PascalCase` — validated via `isPascalCase()`
- **Ruby concern modules:** `Api::<Model>`, `RailsAdmin::<Model>`, `Endpoints::<Model>`
- **ATOM gemspec:** `<atom-name>.gemspec` or `<atom_name>.gemspec` (dash/underscore variant handled by `hasGemspec`)

### OutputChannel Logging
Every user-visible operation logs to a VSCode `OutputChannel` using emoji prefixes:
- `❓️` — checking/validating
- `✅` — success
- `❌` — error/failure
- `⌛` — running a command

All functions that log accept `outputChannel` as a parameter (never use `console.log` for user output).

### Error Handling
- Commands use `try/catch` at the top level.
- Validation functions return `false` on failure (they log internally); callers must check the return value and return early.
- `execShell` rejects the promise on non-zero exit codes.

### Adding a New Command
1. Create `commands/<newCommand>.js` exporting `perform(folder?)`.
2. Register in `extension.js`: `context.subscriptions.push(vscode.commands.registerCommand('thecore.<newCommand>', ...))`.
3. Declare in `package.json` under both `contributes.commands` and `contributes.menus["explorer/context"]` with the appropriate `when` clause.
4. Add tests in `test/<newCommand>.test.js`.

---

## Testing

**Framework:** Mocha + Sinon + proxyquire

**Run tests:**
```bash
npm test          # Mocha unit tests (no VS Code process needed)
npm run test:vscode  # Full VS Code integration tests
```

**Key test infrastructure:**
- `test/setup.js` — registered as a Mocha `require` file (see `.mocharc.yml`); installs a `require` hook so `require('vscode')` returns the mock instead of the real VS Code API
- `test/vscode.mock.js` — minimal stub of the VS Code API (workspace, window, commands, Uri, etc.)
- Tests use `proxyquire` to inject stubs for `vscode` and other modules
- `test/samples/atom/` — a fixture directory with a real-ish ATOM structure (gemspec, config/locales, lib/) used by ATOM-related tests

**Mocha config (`.mocharc.yml`):**
```yaml
require:
  - test/setup.js
spec: "test/**/*.test.js"
timeout: 10000
```

When adding tests for a new command, follow the pattern in existing test files: use `proxyquire` to load the command with mocked dependencies, then test the `perform()` function.

---

## Build

```bash
npm run build    # esbuild with sourcemaps → out/main.js
npm run watch    # esbuild in watch mode
npm run package  # vsce package → .vsix
npm run deploy   # vsce publish to Marketplace
```

The build bundles `extension.js` and all `commands/`, `libs/`, and `templates/` into `out/main.js`. The `vscode` module is marked external and never bundled.

---

## Release Process

Releases are automated via `.github/workflows/main.yml`. The version lives in exactly one place — `package.json` — and is never typed manually elsewhere.

### Releasing (use the terminal, not VS Code Source Control)

**Do not use the VS Code Source Control panel to release.** It cannot create the git tag, so you would end up pushing a commit without a tag (no release triggered) or mismatching the tag against the version in `package.json`.

Instead, use the npm release scripts from a terminal. They atomically bump `package.json`, commit, tag, and push in one step:

```bash
npm run release:patch   # x.y.Z → x.y.(Z+1)  — bug fixes
npm run release:minor   # x.Y.z → x.(Y+1).0  — new features
npm run release:major   # X.y.z → (X+1).0.0  — breaking changes
```

Each command runs `npm version <level>` (which updates `package.json`, commits, and creates a tag) followed by `git push --follow-tags` (which pushes both the commit and the tag in one go).

### What happens next

Once the tag is pushed, GitHub Actions:
1. Runs tests (`npm test`) — if they fail, publishing is aborted.
2. Packages the extension (`vsce package` → `.vsix`).
3. Creates a GitHub Release with the `.vsix` attached.

### Why no `v` prefix on tags

`.npmrc` sets `tag-version-prefix=` (empty). This keeps tags in the format `3.0.12` to match the CI trigger pattern `[0-9]+.[0-9]+.[0-9]+`. Do not remove this setting.

### Secret required

The `VSCE_PAT` secret must be set in the GitHub repository. It is an Azure DevOps Personal Access Token scoped to **Marketplace → Manage**.

---

## Dependencies

| Package | Type | Purpose |
|---|---|---|
| `js-yaml` | runtime | YAML serialization in `configs.js` |
| `lodash` | runtime | `merge` for deep YAML merging |
| `mocha` | dev | Test runner |
| `sinon` | dev | Stubs/mocks in tests |
| `proxyquire` | dev | Module injection in tests |
| `esbuild` | dev | Fast bundler |
| `eslint` | dev | Linting |
| `prettier` | dev | Formatting |
| `@vscode/vsce` | dev | Extension packaging/publishing |

---

## Known Quirks

- `workspaceExixtence` has a typo (`Exixtence` not `Existence`) — this is the existing exported name; do not rename it without updating all callers and tests.
- `releaseApp.js` exists but its command is commented out in `extension.js` — do not activate it without understanding why it was disabled.
- The `fmt` script in `package.json` targets `src/**/*.ts` which does not exist in this project; it is effectively a no-op for TypeScript files but the ESLint part still runs.
- `mkDirP` always creates a `.keep` file in newly created directories — this is intentional for Git tracking of empty directories.
