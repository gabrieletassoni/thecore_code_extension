'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { parse: parseJsonc } = require('jsonc-parser');
const { perform } = require('../commands/setupDevContainer');
const { makeCtx, FAKE_ROOT } = require('./helpers/makeCtx');

describe('commands/setupDevContainer', () => {
    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
    });

    afterEach(() => sinon.restore());

    it('returns early when no workspace is open', async () => {
        const ctx = makeCtx();
        ctx.check.workspaceExists.returns({ ok: false, message: 'No workspace' });
        const mkdirSyncStub = sinon.stub(fs, 'mkdirSync');
        await perform(ctx);
        assert.ok(!mkdirSyncStub.called, 'should not attempt to create any directory');
    });

    it('shows a warning when .devcontainer already exists', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(true);
        const warnStub = sinon.stub(vscode.window, 'showWarningMessage');
        await perform(ctx);
        assert.ok(warnStub.calledOnce, 'showWarningMessage should be called once');
    });

    it('creates the .devcontainer directory and all required files when missing', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        // devcontainer.json, docker-compose.yml, Dockerfile, create-db-user.sql,
        // backend.code-workspace, .thecore-template-version
        assert.ok(ctx.write.textFile.callCount >= 6, 'at least 6 files should be written');
    });

    it('stamps .thecore-template-version with the extension version', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const call = ctx.write.textFile.args.find(([, name]) => name === '.thecore-template-version');
        assert.ok(call, '.thecore-template-version should be written');
        assert.strictEqual(call[2], require('../package.json').version);
    });

    it('shows an error message when directory creation throws', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync').throws(new Error('Permission denied'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'showErrorMessage should be called on error');
        assert.ok(errorStub.firstCall.args[0].includes('Permission denied'));
    });

    it('writes a valid devcontainer.json', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const call = ctx.write.textFile.args.find(([, name]) => name === 'devcontainer.json');
        assert.ok(call, 'devcontainer.json should be written');
        const parsed = parseJsonc(call[2]);
        assert.strictEqual(parsed.name, 'My Project');
        assert.strictEqual(parsed.service, 'app');
        assert.ok(Array.isArray(parsed.customizations.vscode.extensions));
    });

    it('writes a docker-compose.yml with the rails-style project name', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const call = ctx.write.textFile.args.find(([, name]) => name === 'docker-compose.yml');
        assert.ok(call, 'docker-compose.yml should be written');
        assert.ok(call[2].includes('my_project'), 'should contain the rails-style project key');
    });

    it('writes a Dockerfile with the expected base image', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const call = ctx.write.textFile.args.find(([, name]) => name === 'Dockerfile');
        assert.ok(call, 'Dockerfile should be written');
        assert.ok(call[2].includes('gabrieletassoni/vscode-devcontainers-thecore:3'));
    });

    it('wires prune-deleted-skills.sh (bundled globally in the image) into postCreateCommand', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        // prune-deleted-skills.sh ships in scripts/ (copied to /usr/bin/ in Dockerfile.common),
        // not scaffolded per-project, so there is no ctx.write.textFile call for it.
        const scriptCall = ctx.write.textFile.args.find(([, name]) => name === 'prune-deleted-skills.sh');
        assert.ok(!scriptCall, 'prune-deleted-skills.sh should not be scaffolded into the project');

        const devcontainerCall = ctx.write.textFile.args.find(([, name]) => name === 'devcontainer.json');
        const parsed = parseJsonc(devcontainerCall[2]);
        assert.ok(parsed.postCreateCommand.includes('prune-deleted-skills.sh'));
    });
});
