'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const proxyquire = require('proxyquire');

function makeOutputChannel() {
    return { show: () => {}, appendLine: () => {}, append: () => {} };
}

describe('commands/createApp', () => {
    let execShellStub, mkDirPStub, perform;

    before(() => {
        execShellStub = sinon.stub();
        mkDirPStub = sinon.stub();
        perform = proxyquire('../commands/createApp', {
            '../libs/os': { execShell: execShellStub, mkDirP: mkDirPStub },
        }).perform;
    });

    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/fake/workspace' } }];
        sinon.stub(vscode.window, 'createOutputChannel').returns(makeOutputChannel());
        execShellStub.reset();
        mkDirPStub.reset();
    });

    afterEach(() => sinon.restore());

    it('returns early when no workspace is open', async () => {
        vscode.workspace.workspaceFolders = undefined;
        await perform();
        assert.ok(!execShellStub.called, 'no shell commands should run without a workspace');
    });

    it('returns early when workspace has more than one folder (not empty)', async () => {
        vscode.workspace.workspaceFolders = [
            { uri: { fsPath: '/ws1' } },
            { uri: { fsPath: '/ws2' } },
        ];
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('returns early when workspace is already a Rails app', async () => {
        // All RoR directories already exist → rubyOnRailsAppValidity returns dirs → early return
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'lstatSync').returns({ isDirectory: () => true });
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('runs shell commands and shows success when creating a new app', async () => {
        // workspace is empty: existsSync returns false for RoR dirs, true for Gemfile
        sinon.stub(fs, 'existsSync').callsFake((p) => p.endsWith('Gemfile'));
        sinon.stub(fs, 'lstatSync').returns({ isDirectory: () => false });
        const gemfileContent = '# Gemfile\nsource "https://rubygems.org"\n';
        sinon.stub(fs, 'readFileSync').returns(gemfileContent);
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'unlinkSync');
        execShellStub.resolves('');

        await perform();

        assert.ok(execShellStub.called, 'shell commands should have been invoked');
    });

    it('shows an error message when a shell command fails', async () => {
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'lstatSync').returns({ isDirectory: () => false });
        execShellStub.rejects(new Error('rails not found'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform();

        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('rails not found'));
    });
});
