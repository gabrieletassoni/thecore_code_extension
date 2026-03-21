'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const proxyquire = require('proxyquire');

function makeOutputChannel() {
    return { show: () => {}, appendLine: () => {}, append: () => {} };
}

describe('commands/releaseApp', () => {
    let execShellStub, perform;

    before(() => {
        execShellStub = sinon.stub();
        perform = proxyquire('../commands/releaseApp', {
            '../libs/os': { execShell: execShellStub },
        }).perform;
    });

    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/fake/workspace' } }];
        sinon.stub(vscode.window, 'createOutputChannel').returns(makeOutputChannel());
        sinon.stub(vscode.window, 'showInformationMessage');
        execShellStub.reset();
    });

    afterEach(() => sinon.restore());

    it('returns early when no workspace is open', async () => {
        vscode.workspace.workspaceFolders = undefined;
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('returns early when the workspace is not a Rails app', async () => {
        sinon.stub(fs, 'existsSync').returns(false);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('returns early when vendor/custombuilds directory does not exist', async () => {
        // All standard RoR dirs exist but custombuilds does not
        sinon.stub(fs, 'existsSync').callsFake((p) => !p.includes('custombuilds'));
        sinon.stub(fs, 'readdirSync').returns([]);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('runs git and bundle commands for each Dockerfile found', async () => {
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'readFileSync').returns('1.0.0');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves('Release');
        execShellStub.resolves('');

        await perform();

        assert.ok(execShellStub.called, 'shell commands should be invoked for Dockerfile processing');
    });
});
