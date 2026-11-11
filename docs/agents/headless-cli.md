# Headless CLI

> Moved verbatim from `CLAUDE.md` on 2026-11-11 (`bin/thecore.js` install path and vscode shim). `CLAUDE.md` points here; keep this file accurate whenever the behaviour it describes changes.

## Headless CLI (`bin/thecore.js`)

Ships as a `bin` entry in this same `package.json` (`"thecore": "./bin/thecore.js"`) — not a
separate npm package, not published to the npm registry (this repo publishes only to Open VSX, via GitHub Actions,
and to the VS Code Marketplace, via a manual `vsce publish`; see "Release Process" in `docs/agents/build-and-release.md`). Install
globally straight from a clone or the git remote:

```bash
npm install -g .                                                    # from a local clone
npm install -g github:gabrieletassoni/thecore_code_extension#release/3  # directly from git
```

`bin/vscode-shim.js` implements a minimal `vscode` API surface (`window.createOutputChannel`,
`window.showErrorMessage`/`showInformationMessage`/`showWarningMessage`/`showInputBox`,
`workspace.workspaceFolders`) and installs it via a `Module._load` override (the real-runtime
equivalent of `test/setup.js`'s own interception, kept as a separate file — see that file's
header comment for why not shared) so `commands/*.js` can run completely unmodified outside VS
Code. Currently wires up one subcommand, `thecore setup-dev-container --name <name>` (the one
original extension command with no Rails-native equivalent to delegate to instead — see ADR 0007
in the `thecore` repo) — structured so a future subcommand is an addition, not a redesign.
