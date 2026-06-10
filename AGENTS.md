# AGENTS.md — Thecore VS Code Extension

This file provides guidance for AI agents working in this repository.

## Mandatory Workflow for Features and Codebase Changes

**IMPORTANT**: When asked to implement a new feature or make changes to the codebase, do NOT write code directly. Instead, run the following skills in sequence:

1. `/grill-with-docs` — Gather requirements and clarify ambiguities by asking questions informed by documentation
2. `/to-prd` — Convert the gathered requirements into a Product Requirements Document
3. `/to-issues` — Break the PRD down into discrete, actionable issues
4. `/tdd` — Implement each issue using Test-Driven Development

Only after completing this sequence should any code be written.

## General Context

See [CLAUDE.md](CLAUDE.md) for full project overview, directory structure, and conventions.

## Key Architecture Facts for Agents

These are the non-obvious structural decisions that affect how to implement features or fixes.

### ExecutionContext is the Primary Injection Seam

Every command receives a single `ExecutionContext` object (`ctx`) instead of a raw folder. `ExecutionContext` (defined in `libs/executionContext.js`) owns:

- `ctx.workspace` — a `WorkspaceContext` (see below), or `null` if no folder was clicked
- `ctx.check` — a `CheckContext` with predicate methods that return `{ ok, value?, message? }`
- `ctx.write` — a `WriteContext` with file-writing methods that also log to the output channel
- `ctx.log(msg)` / `ctx.show()` — output channel helpers
- `ctx.exec(cmd, cwd)` — async shell execution
- `ctx.mkdir(dir)` — recursive mkdir

**In tests, never create a real `ExecutionContext`.** Use `makeCtx()` from `test/helpers/makeCtx.js`, which returns a plain object with sinon stubs for all `ctx.check.*` and `ctx.write.*` methods. This gives you complete control over every check result without touching the filesystem or VS Code API.

### Pure Libraries — No outputChannel Parameters

`libs/check.js` and `libs/configs.js` are pure utility modules:

- `check.js` functions are pure predicates/lookups — they return values (`true`/`false`/object/`false`) and take **no `outputChannel` parameter**.
- `configs.js` functions are pure file I/O — they read/write files and take **no `outputChannel` parameter**.

Logging happens exclusively in `CheckContext` and `WriteContext` (inside `executionContext.js`), which wrap these pure functions and call `ctx.log()` around them. Never add `outputChannel` params back to `check.js` or `configs.js`.

### WorkspaceContext — Discriminated Union

`libs/workspaceContext.js` exports a `from(folder)` factory that returns:

- `ATOMContext` — when the clicked folder is directly inside `vendor/submodules/`. Provides `atomDir`, `atomName`, and all ATOM-specific path methods (`migrationDir()`, `memberActionsDir()`, etc.)
- `AppContext` — for all other folders. Provides app-level paths only.
- `null` — when no folder was provided.

Commands check `ctx.workspace.type()` (`'atom'` or `'app'`) to branch behavior. Never access `vscode.workspace.workspaceFolders` directly in a command — use `ctx.check.workspaceExists()` and `ctx.workspace.*`.

### CommandRunner — Guard Checks and Input Collection

`libs/commandRunner.js` provides a fluent imperative builder for the two most common command patterns:

```js
const runner = new CommandRunner(ctx);
const showErr = msg => vscode.window.showErrorMessage(msg);

// Guard check: calls showErr and returns false on failure
if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

// User input: returns null on cancel or empty non-optional input
const name = await runner.input({ prompt: '...', validate: v => ... });
if (!name) return;
```

Never call `vscode.window.showInputBox` directly in a command — always use `runner.input()`. Never write `if (!result.ok) { showError; return; }` manually — use `runner.check()`.

### Test Strategy — Stub at the ExecutionContext Seam

Command tests are pure unit tests. They:

1. Import `perform` from the command file directly (`require('../commands/addModel').perform`)
2. Build a stub context with `makeCtx()` from `test/helpers/makeCtx.js`
3. Override specific stubs to exercise failure paths: `ctx.check.isDir.returns({ ok: false, message: '...' })`
4. Stub `vscode.window.showInputBox` for user input flows (CommandRunner delegates to it)

Do **not** use `proxyquire` for command tests. Do **not** stub `fs` or `vscode.window.createOutputChannel` in command tests — that complexity belongs in `executionContext.test.js`.

**Rule: When a test fails, fix the bug in the codebase — never modify the test to silence a failure. The only valid reason to change a test is if the test itself is provably wrong (e.g., it tests the wrong behaviour or has a logic error), and even then, document why in the commit message.**

### Adding a New Command

1. Create `commands/<newCommand>.js` exporting `async function perform(ctx)`
2. Follow this shell structure:
   ```js
   const runner = new CommandRunner(ctx);
   const showErr = msg => vscode.window.showErrorMessage(msg);
   if (!runner.check(ctx.check.workspaceExists(), showErr)) return;
   try {
       // inputs, logic, ctx.exec(), ctx.write.*
   } catch (error) {
       ctx.log(`❌ ...`); vscode.window.showErrorMessage(`...`);
   }
   ```
3. Register in `extension.js` with `new ExecutionContext('Channel Name', folder)`
4. Declare in `package.json` under `contributes.commands` and `contributes.menus`
5. Add tests in `test/<newCommand>.test.js` using `makeCtx()`

### Releasing

Use the npm release scripts — never create git tags manually:

```bash
npm run release:patch   # 3.1.x → 3.1.(x+1)
npm run release:minor   # 3.x.y → 3.(x+1).0
npm run release:major   # x.y.z → (x+1).0.0
```

Each script runs `npm version`, commits, tags, and pushes. GitHub Actions then runs tests, packages the extension, and creates a GitHub Release.
