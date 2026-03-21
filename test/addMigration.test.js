'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const proxyquire = require('proxyquire');

const ATOM_DIR = path.resolve(__dirname, 'samples/atom');

function makeOutputChannel() {
    return { show: () => {}, appendLine: () => {}, append: () => {} };
}

describe('commands/addMigration', () => {
    let execShellStub, mkDirPStub, perform;

    before(() => {
        execShellStub = sinon.stub();
        mkDirPStub = sinon.stub();
        perform = proxyquire('../commands/addMigration', {
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

    it('shows an error when atomDir is undefined', async () => {
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');
        await perform(undefined);
        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('right click'));
    });

    it('returns early when no workspace is open', async () => {
        vscode.workspace.workspaceFolders = undefined;
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: ATOM_DIR });
        assert.ok(!infoStub.called);
    });

    it('returns early when atomDir is not a directory', async () => {
        const gemspecPath = path.join(ATOM_DIR, 'atom.gemspec');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: gemspecPath });
        assert.ok(!infoStub.called);
    });

    it('returns early when user cancels migration name input', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: ATOM_DIR });
        assert.ok(!infoStub.called);
    });

    it('shows an error when execShell produces no output', async () => {
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves('name:string');
        execShellStub.resolves(null);
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform({ fsPath: ATOM_DIR });

        assert.ok(errorStub.calledOnce);
    });

    it('moves migration files to the ATOM db/migrate folder on success', async () => {
        const migrationOutput = '      create  db/migrate/20240101000000_add_name_to_users.rb\n';
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves('name:string');
        execShellStub.resolves(migrationOutput);

        const renameSyncStub = sinon.stub(fs, 'renameSync');
        const existsSyncStub = sinon.stub(fs, 'existsSync').returns(false);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform({ fsPath: ATOM_DIR });

        assert.ok(renameSyncStub.calledOnce, 'migration file should be moved');
        assert.ok(infoStub.calledOnce, 'success message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('AddNameToUsers'));
    });
});
