# Directory structure

> Moved verbatim from `CLAUDE.md` on 2026-11-11 (full annotated directory tree). `CLAUDE.md` points here; keep this file accurate whenever the behaviour it describes changes.

## Directory Structure

```
.
├── extension.js              # Extension activation; registers all 9 commands
├── bin/                      # Headless CLI (thecore_code_extension#39) — NOT part of the VS Code
│   │                         # extension runtime, excluded from the vsix via .vscodeignore; exists
│   │                         # purely as the package.json "bin" entry for `npm install -g`
│   ├── thecore.js            # CLI entry point (commander); installs the vscode-shim require() hook
│   └── vscode-shim.js        # Minimal vscode API surface for running commands/*.js outside VS Code
├── commands/                 # One file per command, each exports perform(ctx)
│   ├── addCollectionAction.js
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
│   ├── bin/                  # Tests for the headless CLI (real subprocess spawns -- see its
│   │                         # own file header for why, not an in-process require('vscode'))
│   └── samples/atom/         # Fixture: a minimal ATOM directory for tests
├── .github/workflows/main.yml # CI/CD: triggered by semver tags; GitHub Release + Open VSX (Marketplace is manual, see PUBLISHING.md)
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
