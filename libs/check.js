// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const execSync = require('child_process').execSync;

function workspaceExixtence(outputChannel) {
    outputChannel.appendLine('❓️ Checking if a workspace is open.');
    // Before checking for devcontainer directory, we need to check if the workspace is open
    if (vscode.workspace.workspaceFolders === undefined) {
        outputChannel.appendLine(' ❌ No workspace is open. Please open a workspace and try again.');
        return false;
    }
    outputChannel.appendLine(' ✅ A workspace is open.');
    return true;
}

function workspaceEmptiness(outputChannel) {
    outputChannel.appendLine('❓️ Checking if the workspace is empty.');
    // Check if the workspace is empty
    if (vscode.workspace.workspaceFolders.length > 1) {
        outputChannel.appendLine(' ❌ The workspace is not empty. Please open an empty workspace and try again.');
        return false;
    }
    outputChannel.appendLine(' ✅ The workspace is empty.');
    return true;
}

function rubyOnRailsAppValidity(hideErrorMessage = false, outputChannel) {
    outputChannel.appendLine('❓️ Checking if the workspace root is a Ruby on Rails app.');
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
        if(!hideErrorMessage) outputChannel.appendLine(' ❌ The workspace root is not a Ruby on Rails app. Please open a Ruby on Rails app and try again.');
        return false;
    }
    outputChannel.appendLine(' ✅ The workspace root is a Ruby on Rails app.');
    return dirsObject;
}

function fileExistence(filePath, outputChannel) {
    outputChannel.appendLine(`❓️ Checking if the file ${filePath} exists.`);
    // Check if a file exists
    if (!fs.existsSync(filePath)) {
        outputChannel.appendLine(` ❌ The file ${filePath} does not exist.`);
        return false;
    }
    outputChannel.appendLine(` ✅ The file ${filePath} exists.`);
    return true;
}

function commandExistence(command, outputChannel) {
    outputChannel.appendLine(`❓️ Checking if the command ${command} exists.`);
    // This function checks if a command exists using execs, so it is OS agnostic, if it does not exist, it returns to the caller false, otherwise true
    try {
        const stdout = execSync(`${command} --version`, { encoding: 'utf8', stdio: 'pipe' });
        outputChannel.appendLine(` ✅ STDOUT: ${stdout}`);
        return true;
    } catch (error) {
        outputChannel.appendLine(` ❌ The command ${command} does not exist:\n${error}`);
        return false;
    }
}

const isPascalCase = (word) => {
    if (typeof word !== 'string')
    {
      return 'It must be a string.'
    }
    const pattern = /^[A-Z][A-Za-z]*$/
    return pattern.test(word)
  }

// Make the following code available to the extension.js file
module.exports = {
    workspaceExixtence,
    rubyOnRailsAppValidity,
    fileExistence,
    workspaceEmptiness,
    commandExistence,
    isPascalCase
}