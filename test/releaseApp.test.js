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
    let execShellStub;
    let workspaceExixtenceStub, rubyOnRailsAppValidityStub, fileExistenceStub;
    let perform;

    const FAKE_ROOT = '/fake/workspace';
    const ROR_DIRS = { workspaceRoot: FAKE_ROOT, vendorDir: FAKE_ROOT + '/vendor' };

    before(() => {
        execShellStub = sinon.stub();
        workspaceExixtenceStub = sinon.stub();
        rubyOnRailsAppValidityStub = sinon.stub();
        fileExistenceStub = sinon.stub();
        perform = proxyquire('../commands/releaseApp', {
            '../libs/os': { execShell: execShellStub },
            '../libs/check': {
                workspaceExixtence: workspaceExixtenceStub,
                rubyOnRailsAppValidity: rubyOnRailsAppValidityStub,
                fileExistence: fileExistenceStub,
            },
        }).perform;
    });

    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
        sinon.stub(vscode.window, 'createOutputChannel').returns(makeOutputChannel());
        sinon.stub(vscode.window, 'showInformationMessage');
        execShellStub.reset();
        workspaceExixtenceStub.reset();
        rubyOnRailsAppValidityStub.reset();
        fileExistenceStub.reset();
        // Default: all checks pass
        workspaceExixtenceStub.returns(true);
        rubyOnRailsAppValidityStub.returns(ROR_DIRS);
        fileExistenceStub.returns(true);
    });

    afterEach(() => sinon.restore());

    it('returns early when no workspace is open', async () => {
        workspaceExixtenceStub.returns(false);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('returns early when the workspace is not a Rails app', async () => {
        rubyOnRailsAppValidityStub.returns(false);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('returns early when vendor/custombuilds directory does not exist', async () => {
        fileExistenceStub.returns(false);
        sinon.stub(fs, 'readdirSync').returns([]);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('runs git and bundle commands for each Dockerfile found', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('1.0.0');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves('Release');
        execShellStub.resolves('');

        await perform();

        assert.ok(execShellStub.called, 'shell commands should be invoked for Dockerfile processing');
    });
});
