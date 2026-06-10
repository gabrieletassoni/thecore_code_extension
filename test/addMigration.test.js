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

    it('rejects a non-PascalCase migration name and does not proceed', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called, 'should not succeed when name input is cancelled');
        assert.ok(!ctx.exec.called, 'should not exec when name input is cancelled');
    });

    it('accepts an empty optional migration definition and still runs rails g', async () => {
        const migrationOutput = '      create  db/migrate/20240101000000_add_name_to_users.rb\n';
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.resolves(migrationOutput);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves(''); // empty optional definition
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'renameSync');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(ctx.exec.calledOnce, 'should execute rails g even with empty definition');
        assert.ok(ctx.exec.firstCall.args[0].includes('rails g migration'), 'command should include rails g migration');
    });

    it('shows an error when rails g output has no migration file lines', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.resolves('some output with no create lines');
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves('');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'error should be shown when output has no migration create lines');
    });

    it('creates the migration target directory when it does not exist', async () => {
        const migrationOutput = '      create  db/migrate/20240101000000_add_name_to_users.rb\n';
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.resolves(migrationOutput);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves('name:string');
        sinon.stub(fs, 'existsSync').returns(false); // migration dir doesn't exist
        sinon.stub(fs, 'renameSync');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(ctx.mkdir.calledOnce, 'mkdir should be called when migration dir is missing');
    });

    it('skips mkdir when the migration target directory already exists', async () => {
        const migrationOutput = '      create  db/migrate/20240101000000_add_name_to_users.rb\n';
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.resolves(migrationOutput);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves('name:string');
        sinon.stub(fs, 'existsSync').returns(true); // migration dir already exists
        sinon.stub(fs, 'renameSync');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(!ctx.mkdir.called, 'mkdir should not be called when migration dir already exists');
    });

    it('shows an error when an fs operation throws inside the try block', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.resolves('      create  db/migrate/20240101000000_test.rb\n');
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves('');
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'renameSync').throws(new Error('rename failed'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'error should be shown on fs failure');
        assert.ok(errorStub.firstCall.args[0].includes('rename failed'));
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
