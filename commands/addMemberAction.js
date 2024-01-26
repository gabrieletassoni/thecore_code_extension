// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// The code you place here will be executed every time your command is executed
function perform() {
    // Display a message box to the user
    vscode.window.showInformationMessage('Adding a member Action to the current ATOM.');


}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}