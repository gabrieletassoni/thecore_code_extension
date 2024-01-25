// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// The code you place here will be executed every time your command is executed
function releaseApp() {
    // Display a message box to the user
    vscode.window.showInformationMessage('Releasing this Thecore 3 App.');

    // Check if we are inside a workspace
    if (vscode.workspace.workspaceFolders === undefined) {
        vscode.window.showErrorMessage('No workspace is open. Please open a workspace and try again.');
        return;
    }

    // Check if the workspace root is a Ruby on Rails app
    const fs = require('fs');
    const path = require('path');
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const appDir = path.join(workspaceRoot, 'app');
    const binDir = path.join(workspaceRoot, 'bin');
    const configDir = path.join(workspaceRoot, 'config');
    const dbDir = path.join(workspaceRoot, 'db');
    const libDir = path.join(workspaceRoot, 'lib');
    const logDir = path.join(workspaceRoot, 'log');
    const publicDir = path.join(workspaceRoot, 'public');
    const storageDir = path.join(workspaceRoot, 'storage');
    const testDir = path.join(workspaceRoot, 'test');
    const tmpDir = path.join(workspaceRoot, 'tmp');
    const vendorDir = path.join(workspaceRoot, 'vendor');
    if (!fs.existsSync(appDir) || !fs.existsSync(binDir) || !fs.existsSync(configDir) || !fs.existsSync(dbDir) || !fs.existsSync(libDir) || !fs.existsSync(logDir) || !fs.existsSync(publicDir) || !fs.existsSync(storageDir) || !fs.existsSync(testDir) || !fs.existsSync(tmpDir) || !fs.existsSync(vendorDir)) {
        vscode.window.showErrorMessage('The workspace root is not a Ruby on Rails app. Please open a Ruby on Rails app and try again.');
        return;
    }

    // Run the `thecore deploy` command
    const { exec } = require('child_process');
    exec('thecore deploy', (err, stdout, stderr) => {
        if (err) {
            vscode.window.showErrorMessage('Thecore deploy failed. Please check the output for more information.');
            return;
        }
        vscode.window.showInformationMessage('Thecore deploy finished successfully.');
    });
}

// Make the following code available to the extension.js file
module.exports = {
    releaseApp,
}