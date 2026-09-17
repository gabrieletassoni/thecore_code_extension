# Thecore VS Code Extension

A Visual Studio Code extension that streamlines the creation and maintenance of [Thecore 3](https://github.com/gabrieletassoni/thecore) Ruby on Rails applications and modular engines (ATOMs).

The extension enforces conventions on file and folder names and structures, automates boilerplate generation, and promotes a dynamic, introspection-based approach to development — favouring convention over configuration and sensible defaults.

## Installation

### From the VS Code Marketplace

Search for **Thecore** in the Extensions view (`Ctrl+Shift+X`) and click **Install**.

### From a VSIX file

Download the `.vsix` file from the [Releases page](https://github.com/gabrieletassoni/thecore_code_extension/releases), then run `Extensions: Install from VSIX...` from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

## Commands

Commands are accessible from the explorer context menu (right-click) and from the Command Palette.

### Main application only

These commands appear when right-clicking on any folder **outside** `vendor/submodules/`.

| Command | Title | Description |
|---|---|---|
| `thecore.setupDevcontainer` | Thecore 3: Setup Devcontainer | Creates the `.devcontainer` configuration (Dockerfile, docker-compose) for the current workspace. |
| `thecore.createApp` | Thecore 3: Create an App | Scaffolds a new Thecore 3 Rails application with all required dependencies and folder structure, including [`thecore_generators`](https://github.com/gabrieletassoni/thecore_generators) (added inside a `group :development do ... end` block in the generated `Gemfile` — see [Model / Migration generation](#model--migration-generation)). |
| `thecore.createATOM` | Thecore 3: Create an ATOM | Creates a new Rails engine (ATOM) as a reusable, self-contained submodule. |

### Main application and ATOM context

These commands appear when right-clicking on any folder. Right-clicking on an ATOM folder (or any folder inside it) targets that ATOM; right-clicking anywhere else targets the main application (after verifying the workspace root is a valid Ruby on Rails app). All four generator commands shell out to `rails g` and let the [`thecore_generators`](https://github.com/gabrieletassoni/thecore_generators) Rails generator hook place the files itself — the extension does no templating or file placement of its own for any of them (see [Model / Migration generation](#model--migration-generation) and [Root / Member Action generation](#root--member-action-generation) below). Main-app actions are generated into `config/root_actions` / `config/member_actions` (not `lib/`) so that Zeitwerk never autoloads them (see `docs/adr/0001-main-app-actions-live-in-config.md`).

| Command | Title | Description |
|---|---|---|
| `thecore.addModel` | Thecore 3: Add a Model | Runs `rails g model`, delegating scaffolding (placement, concerns, tests) to `thecore_generators`. |
| `thecore.addMigration` | Thecore 3: Add a DB Migration | Runs `rails g migration`, delegating placement to `thecore_generators`. |
| `thecore.addRootAction` | Thecore 3: Add a Root Action | Generates a root-level action for the `rails_admin` backend UI (dashboard-style main menu section), including controller, view, assets, and i18n entries. |
| `thecore.addMemberAction` | Thecore 3: Add a Member Action | Generates a member-level action for the `rails_admin` backend UI (per-row button in model list views), including controller, view, assets, and i18n entries. |
| `thecore.checkPractices` | Thecore 3: Check Practices | Audits the target (ATOM or main app) for Thecore structural conventions. Reports missing scaffold files, incomplete action companions, and model concern violations as VS Code diagnostics. Offers to auto-fix resolvable issues. |

## Usage

### Context menu (recommended)

1. Open the **Explorer** panel.
2. Right-click on the relevant folder:
   - On the **project root** or any folder outside `vendor/submodules/` to run commands against the main application.
   - On an **ATOM folder** inside `vendor/submodules/` (or any folder within it) to run commands against that ATOM.
3. Select the desired **Thecore 3** command.

### Command Palette

1. Open the Command Palette with `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
2. Type `Thecore` and select the desired command.

> Note: when invoked from the Command Palette there is no clicked folder, so commands that work in both contexts (`Add a Model`, `Add a DB Migration`, `Add a Root Action`, `Add a Member Action`) run against the **main application**. To target an ATOM, use the explorer context menu on the ATOM folder.

## Model / Migration generation

`Add a Model` and `Add a DB Migration` are thin wrappers: the extension collects the name and attribute definition, then shells out to `bundle install && rails g model|migration "<Name>" <definition> [--atom=<name>] --non-interactive` from the main application root and trusts the result — it does not template any files, parse the command's output, move anything, or edit the generated model file itself.

All of that is handled by the [`thecore_generators`](https://github.com/gabrieletassoni/thecore_generators) gem, which every Thecore 3 app depends on. It hooks Rails' own generators (`config.app_generators.orm :thecore`) so plain `rails g model`/`rails g migration` already:

- Place the migration/model files in the right ATOM (`--atom=<name>`, passed by the extension in ATOM context) or in the main app.
- Generate real test files (no `--skip-test-framework`).
- Skip the `Api::`/`RailsAdmin::`/`Endpoints::` concern trio by default — those now come from framework-wide defaults on `ApplicationRecord` instead. Pass `--with-api-concern`/`--with-admin-concern` to a `rails g model` invocation directly (outside the extension) to scaffold a starter concern when customization is already known to be needed.
- Wire the inverse `has_many`/`has_one` side of any `references` attribute into the target model automatically.

See `thecore_generators`' own README and the `docs/adr/` in the [`thecore`](https://github.com/gabrieletassoni/thecore) repo for the full behavior.

## Root / Member Action generation

`Add a Root Action` and `Add a Member Action` are thin wrappers too, the same way: the extension collects the snake_case action name, then shells out to `bundle install && rails g thecore:root_action|thecore:member_action "<name>" [--atom=<name>] --non-interactive` from the main application root and trusts the result — no template rendering, no `fs` writes, no locale YAML merging on the extension side. (The one thing the extension still checks itself is whether the action already exists, before shelling out, so a re-run gets a clear "already exists" error instead of risking a shelled, non-interactive process hitting an interactive file-collision prompt it could never answer.)

`thecore_generators`' `rails generate thecore:root_action`/`thecore:member_action` (`Thecore::Generators::RootActionGenerator`/`MemberActionGenerator`) create the action file (RailsAdmin `:root`/`:member` action type), its view/JS/SCSS companions, the `config/initializers/after_initialize.rb` require line, the `config/initializers/assets.rb` precompile line, and locale entries in every `*.yml` already present under `config/locales` — all in one generator run, with the same ATOM-aware placement Model/Migration generation uses.

### Missing `thecore_generators` guard

Since `addModel`/`addMigration`/`addRootAction`/`addMemberAction`/`checkPractices` all fully trust `rails`, a Gemfile that doesn't actually depend on `thecore_generators` would otherwise fail silently (for `model`/`migration`, which still "work" but with none of the behavior above) or fail outright (`thecore:root_action`/`thecore:member_action`/`thecore:check_practices` simply don't exist as commands). All five commands check for `thecore_generators` in the workspace's `Gemfile` before shelling out:

- **Present** — no change in behavior; the command proceeds exactly as described above.
- **Missing** — a warning is shown explaining the risk, with an **"Add & Bundle Install"** action button.
  - Clicking it adds `gem "thecore_generators", "~> 3.6"` inside a `group :development do ... end` block in the `Gemfile` (reusing one if the Gemfile already has a bare `group :development do` block, creating one otherwise), runs `bundle install`, and then proceeds with the original command.
  - Dismissing or cancelling the warning aborts the command entirely — nothing further is ever invoked.

`thecore.createApp` adds `thecore_generators` to a new app's `Gemfile` automatically (same `group :development` block), so freshly-created Thecore 3 apps never hit this guard.

## Check Practices

`thecore.checkPractices` is a thin wrapper over `rails thecore:check_practices` (`Thecore::CheckPractices` in `thecore_generators`): the extension shells out to `bundle install && rails thecore:check_practices -- --json[ --atom=<name>]`, parses the JSON payload, and renders it as VS Code diagnostics grouped by file — no filesystem scanning, marker checking, or template comparison happens in the extension itself. When any violation is fixable, a Yes/No QuickPick ("Fix N of M?") offers to apply them; on "Yes" the extension re-invokes with `--fix` appended (still `--json`, so the diagnostics can be re-rendered from whatever's left) — the rake task applies every fixable violation and reports what remains in that same pass, with no confirmation of its own.

## Requirements

The following tools must be available in the environment:

- Ruby
- Rails
- Bundler (`bundle`)

Using the provided [devcontainer](https://github.com/gabrieletassoni/thecore_code_extension) satisfies all requirements automatically.

## Publishing a new release

Releases are automated via GitHub Actions. Use the npm release scripts from a terminal — never create git tags manually.

```bash
npm run release:patch   # x.y.Z → x.y.(Z+1)  — bug fixes
npm run release:minor   # x.Y.z → x.(Y+1).0  — new features
npm run release:major   # X.y.z → (X+1).0.0  — breaking changes
```

Each command updates `package.json`, commits, tags, and pushes. GitHub Actions then runs tests, packages the `.vsix`, creates a GitHub Release, and publishes to the VS Code Marketplace.

> The `VSCE_PAT` secret (Azure DevOps Personal Access Token with Marketplace → Manage scope) must be configured in the repository's GitHub Actions secrets.

## Contributing

Contributions are welcome. Please open a pull request or create an issue to propose changes or report bugs.
