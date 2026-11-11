# Key libraries

> Moved verbatim from `CLAUDE.md` on 2026-11-11 (`libs/*.js` module reference). `CLAUDE.md` points here; keep this file accurate whenever the behaviour it describes changes.

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
- **`ATOMContext`** — folder inside an ATOM's tree; exposes `atomDir`, `atomName`, `migrationDir()`, `modelDir()`, `memberActionsDir()`, `rootActionsDir()`, `localesDir()`, `viewsDir()`, `jsAssetsDir()`, `cssAssetsDir()`, `concernsDir(type)`, `initializerFile(name)`, `assetsFile()`, `appRoot()`, `collectionActionsDir()`
- **`AppContext`** — all other folders; exposes the same path methods rooted at the workspace root, except `memberActionsDir()`/`rootActionsDir()`/`collectionActionsDir()` which point to `config/member_actions`/`config/root_actions`/`config/collection_actions` instead of `lib/` (Zeitwerk autoload safety — see `docs/adr/0001-main-app-actions-live-in-config.md`). Also exposes `concernsDir(type)`.
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
- `insertGemIntoDevelopmentGroup(gemfileContent, gemLine)` — pure content transform (no fs I/O); inserts `gemLine` into an existing bare `group :development do ... end` block or creates one at the end of the file. Used by `libs/thecoreGeneratorsGuard.js` to add `thecore_generators` as a dev-only dependency (`createApp.js` no longer calls this directly since its own delegation — the App template's own Gemfile stack adds `thecore_generators` itself now).

### `libs/thecoreGeneratorsGuard.js`

- `confirmAndAddThecoreGenerators(ctx, gemfilePath)` — the interactive confirm-and-fix flow described in `docs/agents/commands.md`; shows the warning, and on confirmation patches the Gemfile and runs `bundle install`. Returns a `Promise<boolean>` indicating whether the caller should proceed.
- `GEM_LINE` — the exact gem line added: `gem "thecore_generators", "~> 3.6"`.
- `ACTION_LABEL` — the warning dialog's action button text (`"Add & Bundle Install"`).

### `libs/helpers.js`

- `snakeToClassName(snake)` — converts `snake_case` to `ClassName`
- `railsStyleKey(str)` — converts a human-readable title (`'My Project'`) to Rails-style snake\_case key (`'my_project'`)

### `libs/os.js`

- `execShell(cmd, workingDirectory, outputChannel)` — async shell execution; streams dots while running; **rejects on any non-zero exit**.
- `execShellAllowNonZero(cmd, workingDirectory, outputChannel)` — same, but only rejects when nothing was captured at all; used solely by `checkPractices.js` via `ctx.execAllowNonZero` (see its own section in `docs/agents/commands.md`) since a non-zero exit isn't a failure for that one caller.
- `mkDirP(dir, outputChannel)` — recursive `mkdir`; creates a `.keep` file in new directories

### `libs/templates.js`

- `renderTemplate(templateRelPath, vars)` — reads `templates/<path>`, replaces all `{{key}}` with values from `vars`
