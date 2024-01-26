// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

function execOrReturnFalse(command, args, options) {
    // This function executes a command and returns false if the command fails
    try {
        const execSync = require('child_process').execSync;
        execSync(command, args, options);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`The command ${command} failed.`);
        return false;
    }
}

// Make the following code available to the extension.js file
module.exports = {
    execOrReturnFalse,
}