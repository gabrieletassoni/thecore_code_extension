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

### Main application context

These commands appear when right-clicking on any folder **outside** `vendor/submodules/`.

| Command | Title | Description |
|---|---|---|
| `thecore.setupDevcontainer` | Thecore 3: Setup Devcontainer | Creates the `.devcontainer` configuration (Dockerfile, docker-compose) for the current workspace. |
| `thecore.createApp` | Thecore 3: Create an App | Scaffolds a new Thecore 3 Rails application with all required dependencies and folder structure. |
| `thecore.createATOM` | Thecore 3: Create an ATOM | Creates a new Rails engine (ATOM) as a reusable, self-contained submodule. |
| `thecore.addModel` | Thecore 3: Add a Model | Generates a Rails model with its migration and the standard Thecore concern structure (`Api`, `RailsAdmin`, `Endpoints`) directly in the main application. |

### ATOM context

These commands appear when right-clicking on a folder **directly inside** `vendor/submodules/` (i.e., on an ATOM root folder).

| Command | Title | Description |
|---|---|---|
| `thecore.addModel` | Thecore 3: Add a Model | Generates a Rails model with its migration and the standard Thecore concern structure (`Api`, `RailsAdmin`, `Endpoints`) inside the selected ATOM. |
| `thecore.addMigration` | Thecore 3: Add a DB Migration | Creates a new database migration inside the selected ATOM. |
| `thecore.addRootAction` | Thecore 3: Add a Root Action | Generates a root-level action for the `rails_admin` backend UI (dashboard-style main menu section), including controller, view, assets, and i18n entries. |
| `thecore.addMemberAction` | Thecore 3: Add a Member Action | Generates a member-level action for the `rails_admin` backend UI (per-row button in model list views), including controller, view, assets, and i18n entries. |

## Usage

### Context menu (recommended)

1. Open the **Explorer** panel.
2. Right-click on the relevant folder:
   - On the **project root** or any folder outside `vendor/submodules/` to access main-app commands.
   - On an **ATOM folder** inside `vendor/submodules/` to access ATOM-specific commands.
3. Select the desired **Thecore 3** command.

### Command Palette

1. Open the Command Palette with `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
2. Type `Thecore` and select the desired command.

> Note: commands that require a folder context (such as `Add a Model`) may prompt you to select a target folder when invoked from the Command Palette.

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

Releases are automated via GitHub Actions and triggered by pushing a version tag.

```bash
# Bump the version in package.json first, then:
git tag v3.0.7
git push origin v3.0.7
```

The workflow builds the extension, creates a GitHub Release with the `.vsix` attached, and publishes to the VS Code Marketplace.

> The `VSCE_PAT` secret (Azure DevOps Personal Access Token with Marketplace → Manage scope) must be configured in the repository's GitHub Actions secrets.

## Contributing

Contributions are welcome. Please open a pull request or create an issue to propose changes or report bugs.
