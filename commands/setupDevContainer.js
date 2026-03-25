// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { workspaceExixtence } = require('../libs/check');
const { writeTextFile, railsStyleKey } = require('../libs/configs');
const { renderTemplate } = require('../libs/templates');

// The code you place here will be executed every time your command is executed
/**
 * Sets up a Thecore 3 Devcontainer.
 */
async function perform() {
    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Setup Devcontainer');
    outputChannel.show();
    outputChannel.appendLine('Setting up a Thecore 3 Devcontainer.');

    // Call the checkWorkspace function from the checks.js file, if it's not ok, return
    if (!workspaceExixtence(outputChannel)) { return; }

    // Checking if the .devcontainer directory is present in the root of the vs code workspace and creating it if not
    const devcontainerDir = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.devcontainer');
    if (!fs.existsSync(devcontainerDir)) {
        try {
            fs.mkdirSync(devcontainerDir);
            outputChannel.appendLine('.devcontainer directory not exists, creating it right now.');

            // Asking the user for the name of the devcontainer
            const devcontainerName = await vscode.window.showInputBox({
                ignoreFocusOut: true,
                prompt: 'Please enter the name of this project, i.e. Thecore Backend.',
            })
            // transform the devcontainerNAme in a form compatible with the output from rails' .titleize.gsub(/[^0-9a-z]/i, '').underscore


            // Writing the devcontainer.json file
            writeTextFile(devcontainerDir, 'devcontainer.json', renderTemplate('setupDevContainer/devcontainer.json', { name: devcontainerName }), outputChannel);

            // Creating the docker-compose.yml file inside the .devcontainer directory
            writeTextFile(devcontainerDir, 'docker-compose.yml', renderTemplate('setupDevContainer/docker-compose.yml', { name: railsStyleKey(devcontainerName) })), outputChannel);

            // Creating the Dockerfile file inside the .devcontainer directory
            writeTextFile(devcontainerDir, 'Dockerfile', renderTemplate('setupDevContainer/Dockerfile'), outputChannel);

            // Creating the create-db-user.sql file inside the .devcontainer directory
            writeTextFile(devcontainerDir, 'create-db-user.sql', renderTemplate('setupDevContainer/create-db-user.sql'), outputChannel);

            // Create the backend.code-workspace file
            writeTextFile(devcontainerDir, 'backend.code-workspace', renderTemplate('setupDevContainer/backend.code-workspace'), outputChannel);

            outputChannel.appendLine('✅ .devcontainer directory created successfully.');
            vscode.window.showInformationMessage('✅ .devcontainer directory created successfully.');
        } catch (error) {
            outputChannel.appendLine(`❌ Error while creating the .devcontainer directory: ${error}`);
            vscode.window.showErrorMessage(`Error while creating the .devcontainer directory: ${error}`);
        }
    } else {
        outputChannel.appendLine('❌ .devcontainer directory already exists. I won\'t create it again since there could be a working configuration already setup.');
        vscode.window.showWarningMessage('❌ .devcontainer directory already exists. I won\'t create it again since there could be a working configuration already setup.');
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}