// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { writeTextFile, mergeYmlContent } = require('../libs/configs');
const { renderTemplate } = require('../libs/templates');
const { mkDirP } = require('../libs/os');
const { hasGemspec, workspaceExixtence, isDir } = require('../libs/check');

// The code you place here will be executed every time your command is executed
async function perform(atomDir) {
    if (!atomDir) {
        vscode.window.showErrorMessage('Please right click on the ATOM folder and select Add member action.');
        return;
    }

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Add member action');
    outputChannel.show();
    outputChannel.appendLine('Adding a member action to the current ATOM.');

    // Check if we are inside a workspace
    if (!workspaceExixtence(outputChannel)) { return; }
    try {
        // Check if The right clicked folder which sent this command is a valid submodule of the Thecore 3 app, being a valid ATOM, which means having a gemspec and lib/member_actions folder
        outputChannel.appendLine(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);
        // Get only the full path without the file schema
        atomDir = atomDir.fsPath;
        if (!isDir(atomDir, outputChannel)) { return; }

        const atomMemberActionsDir = path.join(atomDir, 'lib', 'member_actions');
        if (!isDir(atomMemberActionsDir, outputChannel)) { return; }

        const atomName = path.basename(atomDir);
        if (!hasGemspec(atomDir, atomName, outputChannel)) { return; }

        // Get the memberActionName from the user input and check if it's snakecase, if it's not, show an error message and return
        const memberActionName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Please enter the snake_case name of the member action.',
            validateInput: (memberActionName) => {
                // Validates if the input exists and is snakecase
                if (!memberActionName || !memberActionName.match(/^[a-z0-9_]+$/)) {
                    return '❌ The snake_case name is not valid. Please try again.';
                }
                return null;
            }
        });
        if (!memberActionName) {
            outputChannel.appendLine(`❌ The member action name is not valid. Please try again.`);
            return; 
        }
        // Check if the member action already exists
        const memberActionFile = path.join(atomMemberActionsDir, `${memberActionName}.rb`);
        if (fs.existsSync(memberActionFile)) {
            outputChannel.appendLine(`❌ The member action ${memberActionName} already exists. Please try again.`);
            vscode.window.showErrorMessage(`The member action ${memberActionName} already exists. Please try again.`);
            return;
        }
        
        // Create a title case verson of the snake case memberActionName
        const memberActionNameSnakeCase = memberActionName.toLowerCase().replace(/[-_][a-z0-9]/g, (group) => group.slice(-1).toUpperCase());;

        // Create the member action file from template
        const memberActionContent = renderTemplate('addMemberAction/action.rb', { actionName: memberActionName });
        writeTextFile(atomMemberActionsDir, `${memberActionName}.rb`, memberActionContent, outputChannel);

        // Add a file in app/views/rails_admin/main from template
        const mainViewDir = path.join(atomDir, "app", 'views', 'rails_admin', 'main');
        mkDirP(mainViewDir, outputChannel);
        const mainViewContent = renderTemplate('addMemberAction/action.html.erb', { actionName: memberActionName });
        writeTextFile(mainViewDir, `${memberActionName}.html.erb`, mainViewContent, outputChannel);

        // Add the member action to the rails_admin initializer, if not already present, into after_initialize.rb file
        // Below the `config.after_initialize do` line add the `require 'member_actions/tcp_debug'` line, obviously replacing tcp_debug with the member action name
        const afterInitializeFile = path.join(atomDir, "config", 'initializers', 'after_initialize.rb');
        const afterInitializeContent = fs.readFileSync(afterInitializeFile).toString();
        if (!afterInitializeContent.includes(`require 'member_actions/${memberActionName}'`)) {
            const afterInitializeLines = afterInitializeContent.split('\n');
            const afterInitializeIndex = afterInitializeLines.findIndex(line => line.includes('config.after_initialize do'));
            afterInitializeLines.splice(afterInitializeIndex + 1, 0, `        require 'member_actions/${memberActionName}'`);
            fs.writeFileSync(afterInitializeFile, afterInitializeLines.join('\n'));
            outputChannel.appendLine(`The member action require line has been added to the ${afterInitializeFile} file.`);
        } else {
            outputChannel.appendLine(`The member action require line is already present in the ${afterInitializeFile} file.`);
        }

        // Append to the file path.join(atomDir, "config", 'initializers', 'assets.rb') the string Rails.application.config.assets.precompile += %w( member_actions/main_${memberActionName}.js member_actions/main_${memberActionName}.css ) if it doesn't exist
        const assetsFile = path.join(atomDir, "config", 'initializers', 'assets.rb');
        const assetsContent = fs.readFileSync(assetsFile).toString();
        // The paths are like if show_sample_chart is the member action name:
        // rails_admin/actions/show_sample_chart.js
        // rails_admin/actions/show_sample_chart.css
        if (!assetsContent.includes(`Rails.application.config.assets.precompile += %w( rails_admin/actions/${memberActionName}.js rails_admin/actions/${memberActionName}.css )`)) {
            fs.appendFileSync(assetsFile, `\nRails.application.config.assets.precompile += %w( rails_admin/actions/${memberActionName}.js rails_admin/actions/${memberActionName}.css )`);
            outputChannel.appendLine(`The member action assets precompile line has been added to the ${assetsFile} file.`);
        } else {
            outputChannel.appendLine(`The member action assets precompile line is already present in the ${assetsFile} file.`);
        }

        // Add the SCSS file from shared template
        const mainScssContent = renderTemplate('shared/action.scss', { actionName: memberActionName });
        writeTextFile(path.join(atomDir, 'app', 'assets', 'stylesheets', 'rails_admin', 'actions'), `${memberActionName}.scss`, mainScssContent, outputChannel);

        // Add the JavaScript file from template
        const mainJsContent = renderTemplate('addMemberAction/action.js', { actionName: memberActionName, actionNameCamelCase: memberActionNameSnakeCase });
        writeTextFile(path.join(atomDir, 'app', 'assets', 'javascripts', 'rails_admin', 'actions'), `${memberActionName}.js`, mainJsContent, outputChannel);

        // Create a title case verson of the snake case memberActionName
        const memberActionNameTitleCase = memberActionName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const ymlDir = path.join(atomDir, "config", 'locales');
        mergeYmlContent(ymlDir, 'en.yml', memberActionName, memberActionNameTitleCase, "en", outputChannel);
        mergeYmlContent(ymlDir, 'it.yml', memberActionName, memberActionNameTitleCase, "it", outputChannel);

        // Success message
        outputChannel.appendLine(`✅ The member Action ${memberActionName} has been added successfully.`);
        vscode.window.showInformationMessage(`The member Action ${memberActionName} has been added successfully.`);
    } catch (error) {
        outputChannel.appendLine(`❌ An error occurred while adding the member action: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the member action: ${error.message}`);
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}