const vscode = require('vscode');
const { ExecutionContext } = require('./libs/executionContext');

function activate(context) {
    console.log('Congratulations, your extension "thecore" is now active!');

    context.subscriptions.push(vscode.commands.registerCommand('thecore.setupDevcontainer', function () {
        const ctx = new ExecutionContext('Thecore: Setup Devcontainer', undefined);
        require('./commands/setupDevContainer').perform(ctx);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('thecore.createApp', function () {
        const ctx = new ExecutionContext('Thecore: Create App', undefined);
        require('./commands/createApp').perform(ctx);
    }));

    // context.subscriptions.push(vscode.commands.registerCommand('thecore.releaseApp', function () {
    //     const ctx = new ExecutionContext('Thecore: Release App', undefined);
    //     require('./commands/releaseApp').perform(ctx);
    // }));

    context.subscriptions.push(vscode.commands.registerCommand('thecore.createATOM', function () {
        const ctx = new ExecutionContext('Thecore: Create ATOM', undefined);
        require('./commands/createATOM').perform(ctx);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('thecore.addRootAction', async (folder) => {
        const ctx = new ExecutionContext('Thecore: Add Root Action', folder);
        require('./commands/addRootAction').perform(ctx);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('thecore.addMemberAction', async (folder) => {
        const ctx = new ExecutionContext('Thecore: Add member action', folder);
        require('./commands/addMemberAction').perform(ctx);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('thecore.addMigration', async (folder) => {
        const ctx = new ExecutionContext('Thecore: Add migration', folder);
        require('./commands/addMigration').perform(ctx);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('thecore.addModel', async (folder) => {
        const ctx = new ExecutionContext('Thecore: Add Model', folder);
        require('./commands/addModel').perform(ctx);
    }));
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}
