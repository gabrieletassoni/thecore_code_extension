# Conventions

> Moved verbatim from `CLAUDE.md` on 2026-11-11 (command structure skeleton, naming, logging, error handling). `CLAUDE.md` points here; keep this file accurate whenever the behaviour it describes changes.

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
- `execShell` rejects on non-zero exit codes — except `execShellAllowNonZero`/`ctx.execAllowNonZero`, used only by `checkPractices.js`, which doesn't (see `libs/os.js` and the `checkPractices` section in `docs/agents/commands.md`).
