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
    let execShellStub, mkDirPStub;
    let workspaceExixtenceStub, workspaceEmptinessStub, commandExistenceStub, rubyOnRailsAppValidityStub;
    let perform;

    const FAKE_ROOT = '/fake/workspace';

    before(() => {
        execShellStub = sinon.stub();
        mkDirPStub = sinon.stub();
        workspaceExixtenceStub = sinon.stub();
        workspaceEmptinessStub = sinon.stub();
        commandExistenceStub = sinon.stub();
        rubyOnRailsAppValidityStub = sinon.stub();
        perform = proxyquire('../commands/createApp', {
            '../libs/os': { execShell: execShellStub, mkDirP: mkDirPStub },
            '../libs/check': {
                workspaceExixtence: workspaceExixtenceStub,
                workspaceEmptiness: workspaceEmptinessStub,
                commandExistence: commandExistenceStub,
                rubyOnRailsAppValidity: rubyOnRailsAppValidityStub,
            },
        }).perform;
    });

    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
        sinon.stub(vscode.window, 'createOutputChannel').returns(makeOutputChannel());
        execShellStub.reset();
        mkDirPStub.reset();
        workspaceExixtenceStub.reset();
        workspaceEmptinessStub.reset();
        commandExistenceStub.reset();
        rubyOnRailsAppValidityStub.reset();
        // Default: all checks pass, workspace is empty and not yet a Rails app
        workspaceExixtenceStub.returns(true);
        workspaceEmptinessStub.returns(true);
        commandExistenceStub.returns(true);
        rubyOnRailsAppValidityStub.returns(false);
    });

    afterEach(() => sinon.restore());

    it('returns early when no workspace is open', async () => {
        workspaceExixtenceStub.returns(false);
        await perform();
        assert.ok(!execShellStub.called, 'no shell commands should run without a workspace');
    });

    it('returns early when workspace has more than one folder (not empty)', async () => {
        workspaceEmptinessStub.returns(false);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('returns early when workspace is already a Rails app', async () => {
        rubyOnRailsAppValidityStub.returns({ workspaceRoot: FAKE_ROOT, vendorDir: FAKE_ROOT + '/vendor' });
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('runs shell commands when creating a new app', async () => {
        sinon.stub(fs, 'existsSync').callsFake((p) => p.endsWith('Gemfile') || p.endsWith('.dockerignore') === false);
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'unlinkSync');
        execShellStub.resolves('');

        await perform();

        assert.ok(execShellStub.called, 'shell commands should have been invoked');
    });

    it('shows an error message when a shell command fails', async () => {
        sinon.stub(fs, 'existsSync').returns(false);
        execShellStub.rejects(new Error('rails not found'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform();

        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('rails not found'));
    });
});
