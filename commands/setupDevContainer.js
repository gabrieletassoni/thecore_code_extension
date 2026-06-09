'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../libs/templates');
const { railsStyleKey } = require('../libs/helpers');
const { CommandRunner } = require('../libs/commandRunner');

async function perform(ctx) {
    ctx.show();
    ctx.log('Setting up a Thecore 3 Devcontainer.');

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const devcontainerDir = path.join(workspaceRoot, '.devcontainer');

    if (!fs.existsSync(devcontainerDir)) {
        try {
            fs.mkdirSync(devcontainerDir);
            ctx.log('.devcontainer directory not exists, creating it right now.');

            const devcontainerName = await runner.input({
                prompt: 'Please enter the name of this project, i.e. Thecore Backend.',
            });

            ctx.write.textFile(devcontainerDir, 'devcontainer.json',
                renderTemplate('setupDevContainer/devcontainer.json', { name: devcontainerName }));

            ctx.write.textFile(devcontainerDir, 'docker-compose.yml',
                renderTemplate('setupDevContainer/docker-compose.yml', { name: railsStyleKey(devcontainerName) }));

            ctx.write.textFile(devcontainerDir, 'Dockerfile',
                renderTemplate('setupDevContainer/Dockerfile'));

            ctx.write.textFile(devcontainerDir, 'create-db-user.sql',
                renderTemplate('setupDevContainer/create-db-user.sql'));

            ctx.write.textFile(devcontainerDir, 'backend.code-workspace',
                renderTemplate('setupDevContainer/backend.code-workspace'));

            ctx.log('✅ .devcontainer directory created successfully.');
            vscode.window.showInformationMessage('✅ .devcontainer directory created successfully.');
        } catch (error) {
            ctx.log(`❌ Error while creating the .devcontainer directory: ${error}`);
            vscode.window.showErrorMessage(`Error while creating the .devcontainer directory: ${error}`);
        }
    } else {
        ctx.log('❌ .devcontainer directory already exists. I won\'t create it again since there could be a working configuration already setup.');
        vscode.window.showWarningMessage('❌ .devcontainer directory already exists. I won\'t create it again since there could be a working configuration already setup.');
    }
}

module.exports = { perform };
