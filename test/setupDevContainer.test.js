const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { expect } = require('jest');
const { setupDevContainer } = require('../commands/setupDevContainer');
const jest = require('jest');

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('setupDevContainer', () => {
        // Mock the vscode.window.showInformationMessage method
        vscode.window.showInformationMessage = jest.fn();

        // Mock the vscode.window.showErrorMessage method
        vscode.window.showErrorMessage = jest.fn();

        // Mock the vscode.window.showInputBox method
        vscode.window.showInputBox = jest.fn().mockResolvedValue('thecore-devcontainer');

        // Mock the fs.existsSync method
        fs.existsSync = jest.fn().mockReturnValue(false);

        // Mock the fs.mkdirSync method
        fs.mkdirSync = jest.fn();

        // Mock the fs.writeFileSync method
        fs.writeFileSync = jest.fn();

        // Mock the yaml.dump method
        yaml.dump = jest.fn().mockReturnValue('docker-compose-config-yml');

        // Call the setupDevContainer function
        setupDevContainer();

        // Assert that the vscode.window.showInformationMessage method was called with the correct message
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Setting up a Thecore 3 Devcontainer.');

        // Assert that the vscode.window.showErrorMessage method was not called
        expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();

        // Assert that the vscode.window.showInputBox method was called with the correct options
        expect(vscode.window.showInputBox).toHaveBeenCalledWith({
            placeHolder: 'Enter the name of the devcontainer, i.e. Thecore BE',
            value: 'thecore-devcontainer'
        });

        // Assert that the fs.existsSync method was called with the correct path
        expect(fs.existsSync).toHaveBeenCalledWith(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.devcontainer'));

        // Assert that the fs.mkdirSync method was called
        expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.devcontainer'));

        // Assert that the fs.writeFileSync method was called with the correct arguments for devcontainer.json
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.devcontainer', 'devcontainer.json'),
            JSON.stringify({
                "name": 'thecore-devcontainer',
                "dockerComposeFile": "docker-compose.yml",
                "service": "app",
                "workspaceFolder": "/workspaces/project/backend/",
                "customizations": {
                    "vscode": {
                        "extensions": [
                            "rebornix.Ruby",
                            "wingrunr21.vscode-ruby",
                            // ... other extensions
                        ]
                    }
                },
                "remoteUser": "vscode"
            }, null, 4)
        );

        // Assert that the fs.writeFileSync method was called with the correct arguments for docker-compose.yml
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.devcontainer', 'docker-compose.yml'),
            'docker-compose-config-yml'
        );

        // Assert that the fs.writeFileSync method was called with the correct arguments for Dockerfile
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.devcontainer', 'Dockerfile'),
            'FROM gabrieletassoni/vscode-devcontainers-thecore:3'
        );

        // Assert that the fs.writeFileSync method was called with the correct arguments for create-db-user.sql
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.devcontainer', 'create-db-user.sql'),
            'CREATE USER vscode CREATEDB;\nCREATE DATABASE vscode WITH OWNER vscode;\nGRANT ALL PRIVILEGES ON DATABASE vscode TO vscode;'
        );

        // Assert that the fs.writeFileSync method was called with the correct arguments for backend.code-workspace
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.devcontainer', 'backend.code-workspace'),
            JSON.stringify({
                "folders": [
                    {
                        "path": ".."
                    }
                ],
                "settings": {
                    "files.associations": {
                        "Gemfile.base": "gemfile"
                    }
                }
            }, null, 4)
        );

        // Assert that the vscode.window.showWarningMessage method was not called
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
    });
});