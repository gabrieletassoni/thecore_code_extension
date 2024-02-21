// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { mkDirP, execShell } = require('../libs/os');
const { isPascalCase, hasGemspec, isDir, workspaceExixtence } = require('../libs/check');

// The code you place here will be executed every time your command is executed
async function perform(atomDir) {
    if (!atomDir) {
        vscode.window.showErrorMessage('Please right click on the ATOM folder and select Add migration.');
        return;
    }

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Add migration');
    outputChannel.show();
    outputChannel.appendLine('Adding a migration to the current ATOM.');

    // Check if we are inside a workspace
    if (!workspaceExixtence(outputChannel)) { return; }

    // get the root folder path of the workspace
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

    try {
        // Check if The right clicked folder which sent this command is a valid submodule of the Thecore 3 app, being a valid ATOM, which means having a gemspec and db/migrate folder
        outputChannel.appendLine(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);
        // Get only the full path without the file schema
        atomDir = atomDir.fsPath;
        if (!isDir(atomDir)) { return; }

        const atomName = path.basename(atomDir);
        // In some cases, the atomName can have a variant name, for example, the atomName can have dashes, like "the-core-atom", in this case, the variantName will be "the_core_atom"
        if (!hasGemspec(atomDir, atomName, outputChannel)) { return; }

        // Get the Migration from the user input and check if it's PascalCase, if it's not, show an error message and return
        const migrationName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Please enter the PascalCase name of the migration.',
            validateInput: (migrationName) => {
                // Validates if the input exists and is snakecase
                if (!migrationName || !isPascalCase(migrationName)) {
                    return '❌ The PascalCase name is not valid. Please try again.';
                }
                return null;
            }
        });

        // Get the migration definition, it must be a list of fields with their types, like "name:string age:integer"
        const migrationDefinition = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Please enter the definition of the migration. Example: name:string age:integer',
            validateInput: (migrationDefinition) => {
                // Validates the input, it can be empty, but if it's not, it must be a valid migration definition like "name:string age:integer"
                if (migrationDefinition && !migrationDefinition.match(/^(\w+:\w+\s?)+$/)) {
                    return '❌ The migration definition is not valid. Please try again.';
                }
                return null;
            }
        });
        
        // Run the rails g migration command to create the migration file
        const output = await execShell(`bundle install && rails g migration "${migrationName}" ${migrationDefinition}`, workspaceRoot, outputChannel);
        // Parse the output to check if the migration was created successfully, if it's the case, move all the created files into ${atomDir}/db/migrate folder
        let migrationFiles = [];
        if(output) {
            migrationFiles = [...output.matchAll(/^\s+create\s+(db\/migrate\/.+\.rb)$/gm)];
        } else {
            const errorMessage = "No output from rails g command exists, cannot go on";
            outputChannel.appendLine(`❌ ${errorMessage}, please inspect theoutput window.`);
            vscode.window.showErrorMessage(`${errorMessage}, please inspect the output window.`);
            return;
        }
        
        if (!migrationFiles) {
            const errorMessage = "No output from rails g command matches evidence of migration file creation, cannot go on";
            outputChannel.appendLine(`❌ ${errorMessage}, please inspect lines above.`);
            vscode.window.showErrorMessage(`${errorMessage}, please inspect output window.`);
            return;
        } else {
            migrationFiles.forEach(el => {
                const migrationFilePath = path.join(workspaceRoot, el[1]);
                const targetAtomDir = path.join(atomDir, 'db', 'migrate');
                if (!fs.existsSync(targetAtomDir)) {
                    outputChannel.appendLine(`📁 Creating the migrations folder: ${targetAtomDir}`);
                    mkDirP(targetAtomDir,outputChannel);
                }
                outputChannel.appendLine(`📄 Moving the migration file to the migrations folder: ${migrationFilePath}`);
                fs.renameSync(migrationFilePath, path.join(targetAtomDir, path.basename(migrationFilePath)));
            });
        }

        // The command executed successfully, show a success message
        outputChannel.appendLine(`✅ The migration ${migrationName} has been added successfully.`);
        vscode.window.showInformationMessage(`The migration ${migrationName} has been added successfully.`);
    } catch (error) {
        outputChannel.appendLine(`❌ An error occurred while adding the migration: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the migration: ${error.message}`);
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}