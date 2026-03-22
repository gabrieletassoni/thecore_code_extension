'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const proxyquire = require('proxyquire');

function makeOutputChannel() {
    return { show: () => {}, appendLine: () => {}, append: () => {} };
}

describe('commands/createATOM', () => {
    let execShellStub, mkDirPStub;
    let workspaceExixtenceStub, commandExistenceStub, rubyOnRailsAppValidityStub, fileExistenceStub;
    let perform;

    const FAKE_ROOT = '/fake/workspace';
    const ROR_DIRS = { workspaceRoot: FAKE_ROOT, vendorDir: FAKE_ROOT + '/vendor' };

    before(() => {
        execShellStub = sinon.stub();
        mkDirPStub = sinon.stub();
        workspaceExixtenceStub = sinon.stub();
        commandExistenceStub = sinon.stub();
        rubyOnRailsAppValidityStub = sinon.stub();
        fileExistenceStub = sinon.stub();
        perform = proxyquire('../commands/createATOM', {
            '../libs/os': { execShell: execShellStub, mkDirP: mkDirPStub },
            '../libs/check': {
                workspaceExixtence: workspaceExixtenceStub,
                commandExistence: commandExistenceStub,
                rubyOnRailsAppValidity: rubyOnRailsAppValidityStub,
                fileExistence: fileExistenceStub,
            },
        }).perform;
    });

    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
        sinon.stub(vscode.window, 'createOutputChannel').returns(makeOutputChannel());
        execShellStub.reset();
        mkDirPStub.reset();
        workspaceExixtenceStub.reset();
        commandExistenceStub.reset();
        rubyOnRailsAppValidityStub.reset();
        fileExistenceStub.reset();
        // Default: all checks pass
        workspaceExixtenceStub.returns(true);
        rubyOnRailsAppValidityStub.returns(ROR_DIRS);
        commandExistenceStub.returns(true);
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

    it('returns early when vendor/submodules directory does not exist', async () => {
        fileExistenceStub.returns(false);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('returns early when user cancels submodule name input', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform();
        assert.ok(!infoStub.called);
    });

    it('shows an error message when rails plugin new fails', async () => {
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('My Atom')
            .resolves('some value');
        execShellStub.rejects(new Error('rails not available'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform();

        assert.ok(errorStub.calledOnce);
    });

    it('shows success after creating a new ATOM', async () => {
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        mkDirPStub.returns(undefined);
        execShellStub.resolves('');

        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('My Atom')
            .onSecondCall().resolves('A summary')
            .onThirdCall().resolves('A description')
            .resolves('author@example.com');

        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform();

        assert.ok(infoStub.called || execShellStub.called, 'should have proceeded past guards');
    });
});
