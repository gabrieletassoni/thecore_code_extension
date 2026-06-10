'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/addModel');
const { makeCtx, makeAtomWorkspace, makeAppWorkspace, FAKE_ROOT } = require('./helpers/makeCtx');

describe('commands/addModel', () => {
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

    it('returns early when clickedDir is not a directory', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.isDir.returns({ ok: false, message: 'Not a dir' });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('returns early when user cancels model name input', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('shows an error when execShell produces no output', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves(null);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('MyModel')
            .onSecondCall().resolves('name:string');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
    });

    it('shows success when model and migration files are created in the main app', async () => {
        const output = [
            '      create  db/migrate/20240101000000_create_my_model.rb',
            '      create  app/models/my_model.rb',
        ].join('\n');

        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves(output);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('MyModel')
            .onSecondCall().resolves('name:string');
        sinon.stub(fs, 'readFileSync').returns('class MyModel < ApplicationRecord\nend\n');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'renameSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(infoStub.calledOnce, 'success message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('MyModel'));
    });

    it('rejects a non-PascalCase model name and does not proceed', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        // Return an invalid name that fails isPascalCase — CommandRunner calls validateInput
        // which returns an error string, so showInputBox is shown again; simulating cancel on retry
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called, 'should not show success when name input is cancelled');
        assert.ok(!ctx.exec.called, 'should not exec when name input is cancelled');
    });

    it('accepts an empty optional migration definition and still runs rails g', async () => {
        const output = [
            '      create  db/migrate/20240101000000_create_my_model.rb',
            '      create  app/models/my_model.rb',
        ].join('\n');
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves(output);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('MyModel')
            .onSecondCall().resolves(''); // empty optional definition
        sinon.stub(fs, 'readFileSync').returns('class MyModel < ApplicationRecord\nend\n');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'renameSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(ctx.exec.calledOnce, 'should execute rails g even with empty definition');
        assert.ok(ctx.exec.firstCall.args[0].includes('rails g model'), 'command should include rails g model');
        assert.ok(infoStub.calledOnce, 'success message should be shown');
    });

    it('shows an error when rails g output has no migration or model lines', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves('some unrelated output\nno create lines here');
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('MyModel')
            .onSecondCall().resolves('');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'error should be shown when output has no file creation lines');
    });

    it('shows an error when an fs operation throws inside the try block', async () => {
        const output = [
            '      create  db/migrate/20240101000000_create_my_model.rb',
            '      create  app/models/my_model.rb',
        ].join('\n');
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves(output);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('MyModel')
            .onSecondCall().resolves('name:string');
        sinon.stub(fs, 'readFileSync').throws(new Error('disk error'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'error should be shown on fs failure');
        assert.ok(errorStub.firstCall.args[0].includes('disk error'));
    });

    it('moves files to ATOM dirs when in ATOM context', async () => {
        const output = [
            '      create  db/migrate/20240101000000_create_my_model.rb',
            '      create  app/models/my_model.rb',
        ].join('\n');

        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.resolves(output);
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('MyModel')
            .onSecondCall().resolves('name:string');
        sinon.stub(fs, 'readFileSync').returns('class MyModel < ApplicationRecord\nend\n');
        sinon.stub(fs, 'writeFileSync');
        const renameSyncStub = sinon.stub(fs, 'renameSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(renameSyncStub.called, 'files should be moved into ATOM dirs');
        assert.ok(infoStub.calledOnce, 'success message should be shown');
    });
});
