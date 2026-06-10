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
| `thecore.createApp` | Thecore 3: Create an App | Scaffolds a new Thecore 3 Rails application with all required dependencies and folder structure. |
| `thecore.createATOM` | Thecore 3: Create an ATOM | Creates a new Rails engine (ATOM) as a reusable, self-contained submodule. |

### Main application and ATOM context

These commands appear when right-clicking on any folder. Right-clicking on a folder **directly inside** `vendor/submodules/` (an ATOM root) targets that ATOM; right-clicking anywhere else targets the main application (after verifying the workspace root is a valid Ruby on Rails app). Generated files stay where they belong for the chosen target: in ATOM context they are moved into the ATOM, in main app context they remain in the standard Rails locations.

| Command | Title | Description |
|---|---|---|
| `thecore.addModel` | Thecore 3: Add a Model | Generates a Rails model with its migration and the standard Thecore concern structure (`Api`, `RailsAdmin`, `Endpoints`). |
| `thecore.addMigration` | Thecore 3: Add a DB Migration | Creates a new database migration. |
| `thecore.addRootAction` | Thecore 3: Add a Root Action | Generates a root-level action for the `rails_admin` backend UI (dashboard-style main menu section), including controller, view, assets, and i18n entries. |
| `thecore.addMemberAction` | Thecore 3: Add a Member Action | Generates a member-level action for the `rails_admin` backend UI (per-row button in model list views), including controller, view, assets, and i18n entries. |

## Usage

### Context menu (recommended)

1. Open the **Explorer** panel.
2. Right-click on the relevant folder:
   - On the **project root** or any folder outside `vendor/submodules/` to run commands against the main application.
   - On an **ATOM folder** inside `vendor/submodules/` to run commands against that ATOM.
3. Select the desired **Thecore 3** command.

### Command Palette

1. Open the Command Palette with `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
2. Type `Thecore` and select the desired command.

> Note: when invoked from the Command Palette there is no clicked folder, so commands that work in both contexts (`Add a Model`, `Add a DB Migration`, `Add a Root Action`, `Add a Member Action`) run against the **main application**. To target an ATOM, use the explorer context menu on the ATOM folder.

## Model structure

When `Add a Model` is run, the extension:

1. Runs `rails g model` to generate the migration and the base model file.
2. In **ATOM context**: moves the generated files into the ATOM's `db/migrate/` and `app/models/` directories.
   In **main app context**: files remain in the standard Rails locations.
3. Creates the following concern files:

| File | Module | Purpose |
|---|---|---|
| `app/models/concerns/api/<model>.rb` | `Api::<Model>` | Controls JSON serialization via `ModelDrivenApi.smart_merge` |
| `app/models/concerns/rails_admin/<model>.rb` | `RailsAdmin::<Model>` | Configures the `rails_admin` UI (navigation label, icon) |
| `app/models/concerns/endpoints/<model>.rb` | `Endpoints::<Model>` | Defines custom non-CRUD API endpoints (OpenAPI/Swagger documented) |

4. Adds `include Api::<Model>` and `include RailsAdmin::<Model>` to the generated model class.

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
