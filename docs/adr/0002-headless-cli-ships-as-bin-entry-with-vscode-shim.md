# ADR 0002 — Headless CLI ships as a `bin` entry with a VS Code shim

**Status:** Accepted

## Context

The extension commands need to be usable from scripts and CI pipelines without a running VS Code process. All eight commands are driven by a fixed, known set of inputs that currently come from `vscode.window.showInputBox()` and `showQuickPick()`. If those calls can be redirected to CLI flags, the underlying command logic is fully reusable.

## Decision

1. **Same package, not a separate one.** A `bin.thecore` entry is added to the existing `package.json` pointing to `bin/thecore.js`. The package becomes both a VS Code extension and a globally-installable CLI tool (`npm install -g`), sharing one codebase and one version number.

2. **`commander` for argument parsing.** Each subcommand maps 1:1 to an existing extension command. Flag names are `kebab-case` (`--name`, `--fields`, `--url`). Missing required flags cause exit 1 with a usage message — there is no interactive fallback.

3. **VS Code shim, not a DI refactor.** `bin/vscode-shim.js` intercepts `require('vscode')` in the CLI process (same pattern as `test/setup.js`) and maps VS Code API calls to their CLI equivalents:
   - `showInputBox()` → resolves from pre-parsed flags; exits 1 if a required flag is absent
   - `showErrorMessage()` → writes to stderr
   - `showInformationMessage()` / `showWarningMessage()` → writes to stdout
   - `createDiagnosticCollection()` → accumulates Violations; prints them as text at the end
   - `workspace.workspaceFolders` → derived from `process.cwd()`

   Existing command files and all `libs/` are unchanged.

4. **CWD-based Target resolution.** `workspaceContext.from()` is called with `process.cwd()`. If CWD is inside `vendor/submodules/<atom>/`, the Target is that ATOM; otherwise it is the Main App. No `--target` flag is needed; scripts `cd` to the appropriate directory before invoking.

5. **Check Practices output.** Violations are printed as human-readable text to stdout (`path/to/file.rb:12: [Error] message`). The `--fix` flag applies all Fixable Violations without prompting. Exit code is 0 when no Violations are found, 1 otherwise.

## Alternatives rejected

- **Separate `thecore-cli` npm package.** Two packages to version, publish, and keep in sync. No concrete benefit over a `bin` entry.
- **Dependency-injection refactor.** Extracting a `UIProvider` interface and threading it through every command and test is a large, risky change. The shim achieves the same result by touching only one new file.
- **Interactive TTY fallback.** Falling back to stdin prompts when flags are missing blurs the non-interactive contract that makes the CLI scriptable. A hard error is clearer.

## Consequences

- The package's `npm install -g` surface becomes part of its public contract. Removing the `bin` entry later would be a breaking change for any script depending on it.
- The shim is the single adaptation point. Any future VS Code API call added to a command must also be handled in the shim.
- `commander` becomes a runtime dependency (not devDependency), since it is needed by the installed binary.
