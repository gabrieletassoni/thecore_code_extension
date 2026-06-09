'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/createApp');
const { makeCtx, FAKE_ROOT } = require('./helpers/makeCtx');

describe('commands/createApp', () => {
    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
    });

    afterEach(() => sinon.restore());

    it('returns early when no workspace is open', async () => {
        const ctx = makeCtx();
        ctx.check.workspaceExists.returns({ ok: false, message: 'No workspace' });
        await perform(ctx);
        assert.ok(!ctx.exec.called, 'no shell commands should run without a workspace');
    });

    it('returns early when workspace has more than one folder', async () => {
        const ctx = makeCtx();
        ctx.check.workspaceEmpty.returns({ ok: false, message: 'Not empty' });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when workspace is already a Rails app', async () => {
        const ctx = makeCtx();
        ctx.check.railsAppValid.returns({ ok: true, value: { workspaceRoot: FAKE_ROOT, vendorDir: `${FAKE_ROOT}/vendor` } });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    it('runs shell commands when creating a new app', async () => {
        const ctx = makeCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        sinon.stub(fs, 'existsSync').callsFake((p) => p.endsWith('Gemfile'));
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'unlinkSync');
        ctx.exec.resolves('');

        await perform(ctx);

        assert.ok(ctx.exec.called, 'shell commands should have been invoked');
    });

    it('shows an error message when a shell command fails', async () => {
        const ctx = makeCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        sinon.stub(fs, 'existsSync').returns(false);
        ctx.exec.rejects(new Error('rails not found'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('rails not found'));
    });
});
