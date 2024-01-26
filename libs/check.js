// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

function workspacePresence() {
    // Before checking for devcontainer directory, we need to check if the workspace is open
    if (vscode.workspace.workspaceFolders === undefined) {
        vscode.window.showErrorMessage('No workspace is open. Please open a workspace and try again.');
        return false;
    }
    return true;
}

function workspaceEmpty() {
    // Check if the workspace is empty
    if (vscode.workspace.workspaceFolders.length > 1) {
        vscode.window.showErrorMessage('The workspace is not empty. Please open an empty workspace and try again.');
        return false;
    }
    return true;
}

function rubyOnRailsAppValidity() {
    // Check if the workspace root is a Ruby on Rails app
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
    const dirsObject = {
        workspaceRoot,
        appDir,
        binDir,
        configDir,
        dbDir,
        libDir,
        logDir,
        publicDir,
        storageDir,
        testDir,
        tmpDir,
        vendorDir,
    };
    if (!fs.existsSync(appDir) || !fs.existsSync(binDir) || !fs.existsSync(configDir) || !fs.existsSync(dbDir) || !fs.existsSync(libDir) || !fs.existsSync(logDir) || !fs.existsSync(publicDir) || !fs.existsSync(storageDir) || !fs.existsSync(testDir) || !fs.existsSync(tmpDir) || !fs.existsSync(vendorDir)) {
        vscode.window.showErrorMessage('The workspace root is not a Ruby on Rails app. Please open a Ruby on Rails app and try again.');
        return false;
    }
    return dirsObject;
}

function fileExists(filePath) {
    // Check if a file exists
    if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(`The file ${filePath} does not exist.`);
        return false;
    }
    return true;
}

function commandExists(command) {
    // This function checks if a command exists
    try {
        const execSync = require('child_process').execSync;
        execSync(`which ${command}`);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`The command ${command} does not exist.`);
        return false;
    }
}

// Make the following code available to the extension.js file
module.exports = {
    workspacePresence,
    rubyOnRailsAppValidity,
    fileExists,
    workspaceEmpty,
    commandExists,
}