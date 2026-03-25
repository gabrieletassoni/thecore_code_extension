'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');

const { perform } = require('../commands/setupDevContainer');

function makeOutputChannel() {
    return { show: () => {}, appendLine: () => {}, append: () => {} };
}

describe('commands/setupDevContainer', () => {
    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/fake/workspace' } }];
        sinon.stub(vscode.window, 'createOutputChannel').returns(makeOutputChannel());
    });

    afterEach(() => sinon.restore());

    it('returns early when no workspace is open', async () => {
        vscode.workspace.workspaceFolders = undefined;
        const mkdirSyncStub = sinon.stub(fs, 'mkdirSync');
        await perform();
        assert.ok(!mkdirSyncStub.called, 'should not attempt to create any directory');
    });

    it('shows a warning when .devcontainer already exists', async () => {
        sinon.stub(fs, 'existsSync').returns(true);
        const warnStub = sinon.stub(vscode.window, 'showWarningMessage');
        await perform();
        assert.ok(warnStub.calledOnce, 'showWarningMessage should be called once');
    });

    it('creates the .devcontainer directory and all required files when missing', async () => {
        sinon.stub(fs, 'existsSync').returns(false);
        const mkdirSyncStub = sinon.stub(fs, 'mkdirSync');
        const writeFileSyncStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform();

        assert.ok(mkdirSyncStub.calledOnce, '.devcontainer directory should be created');
        // devcontainer.json, docker-compose.yml, Dockerfile, create-db-user.sql, backend.code-workspace
        assert.ok(writeFileSyncStub.callCount >= 5, 'at least 5 files should be written');
    });

    it('shows an error message when directory creation throws', async () => {
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync').throws(new Error('Permission denied'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform();

        assert.ok(errorStub.calledOnce, 'showErrorMessage should be called on error');
        assert.ok(errorStub.firstCall.args[0].includes('Permission denied'));
    });

    it('writes a valid devcontainer.json', async () => {
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        const writeFileSyncStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform();

        const devcontainerCall = writeFileSyncStub.args.find(([p]) => p.includes('devcontainer.json'));
        assert.ok(devcontainerCall, 'devcontainer.json should be written');
        const parsed = JSON.parse(devcontainerCall[1]);
        assert.strictEqual(parsed.name, 'My Project');
        assert.strictEqual(parsed.service, 'app');
        assert.ok(Array.isArray(parsed.customizations.vscode.extensions));
    });

    it('writes a docker-compose.yml with the project name as the database name', async () => {
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        const writeFileSyncStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform();

        const composeCall = writeFileSyncStub.args.find(([p]) => p.endsWith('docker-compose.yml'));
        assert.ok(composeCall, 'docker-compose.yml should be written');
        // 'My Project' → railsStyleKey → 'my_project'
        assert.ok(composeCall[1].includes('my_project'), 'DATABASE_URL should contain the rails-style project key');
    });

    it('writes a Dockerfile with the expected base image', async () => {
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        const writeFileSyncStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform();

        const dockerfileCall = writeFileSyncStub.args.find(([p]) => p.endsWith('Dockerfile'));
        assert.ok(dockerfileCall, 'Dockerfile should be written');
        assert.ok(dockerfileCall[1].includes('gabrieletassoni/vscode-devcontainers-thecore:3'));
    });
});
