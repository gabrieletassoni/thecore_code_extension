// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
/**
 * Activates the extension.
 * 
 * @param {vscode.ExtensionContext} context - The extension context.
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "thecore" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	context.subscriptions.push(vscode.commands.registerCommand('thecore.setupDevcontainer', function () {
		// Call the business logic which is present into the commands directory in the setupDevContainer.js file
		require('./commands/setupDevContainer').perform();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('thecore.createApp', function () {
		// Call the business logic which is present into the commands directory in the createApp.js file
		require('./commands/createApp').perform();
	}));

	// context.subscriptions.push(vscode.commands.registerCommand('thecore.releaseApp', function () {
	// 	// Call the business logic which is present into the commands directory in the createApp.js file
	// 	require('./commands/releaseApp').perform();
	// }));

	context.subscriptions.push(vscode.commands.registerCommand('thecore.createATOM', function () {
		// Call the business logic which is present into the commands directory in the createApp.js file
		require('./commands/createATOM').perform();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('thecore.addRootAction', async (folder) => {
		// Call the business logic which is present into the commands directory in the createApp.js file
		require('./commands/addRootAction').perform(folder);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('thecore.addMemberAction', async (folder) => {
		// Call the business logic which is present into the commands directory in the createApp.js file
		require('./commands/addMemberAction').perform(folder);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('thecore.addMigration', async (folder) => {
		// Call the business logic which is present into the commands directory in the createApp.js file
		require('./commands/addMigration').perform(folder);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('thecore.addModel', async (folder) => {
		// Call the business logic which is present into the commands directory in the createApp.js file
		require('./commands/addModel').perform(folder);
	}));
}

// This method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
