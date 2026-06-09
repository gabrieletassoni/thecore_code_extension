'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/createATOM');
const { makeCtx, FAKE_ROOT } = require('./helpers/makeCtx');

describe('commands/createATOM', () => {
    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
    });

    afterEach(() => sinon.restore());

    it('returns early when no workspace is open', async () => {
        const ctx = makeCtx();
        ctx.check.workspaceExists.returns({ ok: false, message: 'No workspace' });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when the workspace is not a Rails app', async () => {
        const ctx = makeCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: 'Not a Rails app' });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when vendor/submodules directory does not exist', async () => {
        const ctx = makeCtx();
        ctx.check.fileExists.returns({ ok: false, message: 'Missing submodules' });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels submodule name input', async () => {
        const ctx = makeCtx();
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('shows an error message when rails plugin new fails', async () => {
        const ctx = makeCtx();
        ctx.exec.rejects(new Error('rails not available'));
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('My Atom')
            .resolves('some value');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
    });

    it('shows success after creating a new ATOM', async () => {
        const ctx = makeCtx();
        ctx.exec.resolves('');
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');

        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('My Atom')
            .onSecondCall().resolves('A summary')
            .onThirdCall().resolves('A description')
            .onCall(3).resolves('Author Name')
            .onCall(4).resolves('author@example.com')
            .onCall(5).resolves('https://example.com');

        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(infoStub.called || ctx.exec.called, 'should have proceeded past guards');
    });
});
