# Thecore 3 VS Code Extension

Thecore 3 is a Visual Studio Code extension that provides a set of commands to enhance your development workflow. These commands are available in the command palette and under the "Thecore 3" menu.
All the commands are made to enforce the adoption of conventions on files and folders names and structures, and to automate the creation of new applications and engines.
It enforces the usage of introspection and reflection to make the code more readable and maintainable and adaptive.

## Commands

The extension provides the following commands:

- `thecore.setupDevcontainer`: This command sets up a development container for your application. It is available when the explorer viewlet is visible and focused, and the root resource is selected in the explorer.

- `thecore.createApp`: This command creates a new application. It is available under the same conditions as `thecore.setupDevcontainer`.

- `thecore.createATOM`: This command creates a new rails engine, called ATOM in the Thecore context, to encapsulate reusable logic. It is available under the same conditions as `thecore.createATOM`.

- `thecore.addRootAction`: This command creates a new root action, available in the main menu of the rails_admin backend UI. It is available only by clicking on a folder in the explorer viewlet. The root actions are rails_admin sections in the main menu which enable dashboard like views.

- `thecore.addMemberAction`: This command creates a new member action, available each rows of the list view of a Model. It is available only by clicking on a folder in the explorer viewlet. The member actions are visualized as buttons or links in the commands section of each row of the Models in which they are available.

- `thecore.addModel`: This command creates a new Ruby on Rails Model adding all the files and folders which enforce a more dinamic approach to development, in order to simplify it by using conventions over configurations and sane defaults for simple funcitonality extension. The command will ask you for the name of the model, the fields for the migration and the name of the engine in which it will be created. It is available only by clicking on a folder in the explorer viewlet.

- `thecore.releaseApp`: This command releases your application. It is also available under the same conditions.

## Usage

To use these commands, follow these steps:

1. Open the command palette with `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
2. Type the name of the command (e.g., "Thecore: Setup Devcontainer") and press `Enter`.

Alternatively, you can access these commands from the "Thecore 3" menu:

1. Right-click in the explorer viewlet to open the context menu.
    - the `addRootAction`, `addMemberAction` and `addModel` commands are available only by right clicking on folders.
2. Hover over "Thecore 3" to open the submenu.
3. Click on the command you want to execute.

## Installation

To install the extension, download the `.vsix` file from the [extensions repository](https://github.com/gabrieletassoni/thecore_code_extension) and install it in VS Code using the "Install from VSIX..." command in the Extensions view command drop-down, or the `Extensions: Install from VSIX...` command in the Command Palette.

## Contributing

Contributions are welcome! Please submit a pull request or create an issue to propose changes or report bugs.