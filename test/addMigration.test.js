'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/addMigration');
const { makeCtx, makeAtomWorkspace } = require('./helpers/makeCtx');

describe('commands/addMigration', () => {
    afterEach(() => sinon.restore());

    it('shows an error when no folder was clicked (workspace is null)', async () => {
        const ctx = makeCtx({ workspace: null });
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');
        await perform(ctx);
        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('right click'));
    });

    it('returns early when no workspace is open', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.workspaceExists.returns({ ok: false, message: 'No workspace' });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('returns early when atomDir is not a directory', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.isDir.returns({ ok: false, message: 'Not a dir' });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('returns early when user cancels migration name input', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('shows an error when execShell produces no output', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.resolves(null);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves('name:string');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
    });

    it('moves migration files to the ATOM db/migrate folder on success', async () => {
        const migrationOutput = '      create  db/migrate/20240101000000_add_name_to_users.rb\n';
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.resolves(migrationOutput);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves('name:string');
        sinon.stub(fs, 'existsSync').returns(false);
        const renameSyncStub = sinon.stub(fs, 'renameSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(renameSyncStub.calledOnce, 'migration file should be moved');
        assert.ok(infoStub.calledOnce, 'success message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('AddNameToUsers'));
    });
});
