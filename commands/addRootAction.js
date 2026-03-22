// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { writeTextFile, mergeYmlContent } = require('../libs/configs');
const { renderTemplate } = require('../libs/templates');
const { mkDirP } = require('../libs/os');
const { hasGemspec, workspaceExixtence, isDir, isFile } = require('../libs/check');

// The code you place here will be executed every time your command is executed
async function perform(atomDir) {
    if (!atomDir) {
        vscode.window.showErrorMessage('Please right click on the ATOM folder and select Add Root Action.');
        return;
    }

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Add Root Action');
    outputChannel.show();
    outputChannel.appendLine('Adding a root Action to the current ATOM.');

    // Check if we are inside a workspace
    if (!workspaceExixtence(outputChannel)) { return; }

    try {
        // Check if The right clicked folder which sent this command is a valid submodule of the Thecore 3 app, being a valid ATOM, which means having a gemspec and lib/root_actions folder
        outputChannel.appendLine(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);
        // Get only the full path without the file schema
        atomDir = atomDir.fsPath;
        if (!isDir(atomDir, outputChannel)) { return; }

        // Is the root_actons folder present?
        const atomRootActionsDir = path.join(atomDir, 'lib', 'root_actions');
        if (!isDir(atomRootActionsDir, outputChannel)) { return; }
        // Has a Gemspex file?
        const atomName = path.basename(atomDir);
        if (!hasGemspec(atomDir, atomName, outputChannel)) { return; }

        // Get the rootActionName from the user input and check if it's snakecase, if it's not, show an error message and return
        const rootActionName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Please enter the snake_case name of the root action.',
            validateInput: (rootActionName) => {
                // Validates if the input exists and is snakecase
                if (!rootActionName || !rootActionName.match(/^[a-z0-9_]+$/)) {
                    return '❌ The snake_case name is not valid. Please try again.';
                }
                return null;
            }
        });
        if (!rootActionName) {
            outputChannel.appendLine(`❌ The root action name is not valid. Please try again.`);
            return; 
        }
        // Check if the root action already exists
        const rootActionFile = path.join(atomRootActionsDir, `${rootActionName}.rb`);
        if (isFile(rootActionFile, outputChannel)) { return; }
                
        // Create a title case verson of the snake case rootActionName
        const rootActionNameSnakeCase = rootActionName.toLowerCase().replace(/[-_][a-z0-9]/g, (group) => group.slice(-1).toUpperCase());;

        // Create the root action file from template
        const rootActionContent = renderTemplate('addRootAction/action.rb', { actionName: rootActionName });
        writeTextFile(atomRootActionsDir, `${rootActionName}.rb`, rootActionContent, outputChannel);

        // Using the same logic, add a file in app/views/rails_admin/main from template
        const mainViewDir = path.join(atomDir, "app", 'views', 'rails_admin', 'main');
        mkDirP(mainViewDir, outputChannel);
        const mainViewContent = renderTemplate('addRootAction/action.html.erb', { actionName: rootActionName });
        writeTextFile(mainViewDir, `${rootActionName}.html.erb`, mainViewContent, outputChannel);

        // Add the root action to the rails_admin initializer, if not already present, into after_initialize.rb file
        // Below the `config.after_initialize do` line add the `require 'root_actions/tcp_debug'` line, obviously replacing tcp_debug with the root action name
        const afterInitializeFile = path.join(atomDir, "config", 'initializers', 'after_initialize.rb');
        const afterInitializeContent = fs.readFileSync(afterInitializeFile).toString();
        if (!afterInitializeContent.includes(`require 'root_actions/${rootActionName}'`)) {
            const afterInitializeLines = afterInitializeContent.split('\n');
            const afterInitializeIndex = afterInitializeLines.findIndex(line => line.includes('config.after_initialize do'));
            afterInitializeLines.splice(afterInitializeIndex + 1, 0, `        require 'root_actions/${rootActionName}'`);
            fs.writeFileSync(afterInitializeFile, afterInitializeLines.join('\n'));
            outputChannel.appendLine(`The root action require line has been added to the ${afterInitializeFile} file.`);
        } else {
            outputChannel.appendLine(`The root action require line is already present in the ${afterInitializeFile} file.`);
        }

        // Append to the file path.join(atomDir, "config", 'initializers', 'assets.rb') the string Rails.application.config.assets.precompile += %w( root_actions/main_${rootActionName}.js root_actions/main_${rootActionName}.css ) if it doesn't exist
        const assetsFile = path.join(atomDir, "config", 'initializers', 'assets.rb');
        const assetsContent = fs.readFileSync(assetsFile).toString();
        if (!assetsContent.includes(`Rails.application.config.assets.precompile += %w( rails_admin/actions/${rootActionName}.js rails_admin/actions/${rootActionName}.css )`)) {
            fs.appendFileSync(assetsFile, `\nRails.application.config.assets.precompile += %w( rails_admin/actions/${rootActionName}.js rails_admin/actions/${rootActionName}.css )`);
            outputChannel.appendLine(`The root action assets precompile line has been added to the ${assetsFile} file.`);
        } else {
            outputChannel.appendLine(`The root action assets precompile line is already present in the ${assetsFile} file.`);
        }

        // Add the SCSS file from shared template
        const mainScssContent = renderTemplate('shared/action.scss', { actionName: rootActionName });
        writeTextFile(path.join(atomDir, 'app', 'assets', 'stylesheets', 'rails_admin', 'actions'), `${rootActionName}.scss`, mainScssContent, outputChannel);

        // Add the JavaScript file from template
        const mainJsContent = renderTemplate('addRootAction/action.js', { actionName: rootActionName, actionNameCamelCase: rootActionNameSnakeCase });
        writeTextFile(path.join(atomDir, 'app', 'assets', 'javascripts', 'rails_admin', 'actions'), `${rootActionName}.js`, mainJsContent, outputChannel);

        // Create a title case verson of the snake case rootActionName
        const rootActionNameTitleCase = rootActionName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const ymlDir = path.join(atomDir, "config", 'locales');
        mergeYmlContent(ymlDir, 'en.yml', rootActionName, rootActionNameTitleCase, "en", outputChannel);
        mergeYmlContent(ymlDir, 'it.yml', rootActionName, rootActionNameTitleCase, "it", outputChannel);

        // The command executed successfully, show a success message
        outputChannel.appendLine(`✅ The root action ${rootActionName} has been added successfully.`);
        vscode.window.showInformationMessage(`The root action ${rootActionName} has been added successfully.`);
    } catch (error) {
        outputChannel.appendLine(`❌ An error occurred while adding the root action: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the root action: ${error.message}`);
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}