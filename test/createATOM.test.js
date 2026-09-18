'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { perform } = require('../commands/createATOM');
const { makeCtx, makeAppWorkspace, FAKE_ROOT } = require('./helpers/makeCtx');

function stubAllInputs(stubs) {
    const stub = sinon.stub(vscode.window, 'showInputBox');
    stubs.forEach((val, i) => {
        if (i === 0) stub.onFirstCall().resolves(val);
        else if (i === 1) stub.onSecondCall().resolves(val);
        else if (i === 2) stub.onThirdCall().resolves(val);
        else stub.onCall(i).resolves(val);
    });
    return stub;
}

const HAPPY_INPUTS = ['My Atom', 'A summary', 'A description', 'Author Name', 'author@example.com', 'https://example.com'];

describe('commands/createATOM', () => {
    afterEach(() => sinon.restore());

    // ── Guard checks ─────────────────────────────────────────────────────────

    it('returns early when no workspace is open', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.check.workspaceExists.returns({ ok: false, message: 'No workspace' });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when the workspace is not a Rails app', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.check.railsAppValid.returns({ ok: false, message: 'Not a Rails app' });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when a required command (ruby/rails/bundle) is missing', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.check.commandExists.returns({ ok: false, message: 'ruby not found' });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when vendor/submodules directory does not exist', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.check.fileExists.returns({ ok: false, message: 'Missing submodules' });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    // ── Input cancellation matrix ─────────────────────────────────────────────

    it('returns early when user cancels submodule name (input 1)', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        stubAllInputs([undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels summary (input 2)', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        stubAllInputs(['My Atom', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels description (input 3)', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        stubAllInputs(['My Atom', 'A summary', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels author (input 4)', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        stubAllInputs(['My Atom', 'A summary', 'A description', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels email (input 5)', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        stubAllInputs(['My Atom', 'A summary', 'A description', 'Author', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels url (input 6)', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        stubAllInputs(['My Atom', 'A summary', 'A description', 'Author', 'a@b.com', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    // ── Error handling ────────────────────────────────────────────────────────

    it('shows an error when execShell produces no output', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves(null);
        stubAllInputs(HAPPY_INPUTS);
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
    });

    it('shows an error (not an unhandled rejection) when ctx.exec throws', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.rejects(new Error('rails not available'));
        stubAllInputs(HAPPY_INPUTS);
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('rails not available'));
    });

    it('shows an error (not an unhandled rejection) when the thecore_generators guard itself throws', async () => {
        // Regression coverage: the Gemfile guard runs real I/O (fs.readFileSync/writeFileSync,
        // `bundle install`) before the rest of the command -- since extension.js never awaits or
        // catches perform(), any throw here must be caught locally or it becomes silent.
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.check.hasThecoreGenerators.returns({ ok: false, message: 'missing' });
        sinon.stub(vscode.window, 'showWarningMessage').resolves('Add & Bundle Install');
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'readFileSync').throws(new Error('disk full'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'the guard failure should be caught and surfaced, not thrown past perform()');
        assert.ok(errorStub.firstCall.args[0].includes('disk full'));
    });

    // ── Happy path: delegates to `rails g thecore:atom` ─────────────────────────

    it('shells out to `rails g thecore:atom` in the app root with all six inputs as flags', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves('      create  vendor/submodules/my_atom/my_atom.gemspec\n');
        stubAllInputs(HAPPY_INPUTS);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(ctx.exec.calledOnce, 'should shell out exactly once');
        const [command, cwd] = ctx.exec.firstCall.args;
        assert.ok(command.includes('rails g thecore:atom "my_atom"'), 'command should invoke the thecore:atom generator with the snake_case name');
        assert.ok(command.includes('--non-interactive'), 'command should pass --non-interactive since inputs were already collected via VS Code dialogs');
        assert.ok(command.includes('--summary="A summary"'), 'summary flag');
        assert.ok(command.includes('--description="A description"'), 'description flag');
        assert.ok(command.includes('--author="Author Name"'), 'author flag');
        assert.ok(command.includes('--email="author@example.com"'), 'email flag');
        assert.ok(command.includes('--url="https://example.com"'), 'url flag');
        assert.ok(!command.includes('--skip-api-admin-deps'), 'should never skip API/admin deps -- matches this command\'s own long-standing always-add behavior');
        assert.strictEqual(cwd, FAKE_ROOT, 'should run from the app root');
        assert.ok(infoStub.calledOnce, 'success message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('My Atom'), 'message should include the ATOM name as typed');
    });

    it('converts submodule name with spaces to snake_case for the generator name argument', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves('created');
        stubAllInputs(['TCP Debugger', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const [command] = ctx.exec.firstCall.args;
        assert.ok(command.includes('thecore:atom "tcp_debugger"'), 'snake_case name should be passed to the generator');
    });

    it('writes no files itself anymore -- all placement is delegated to the generator', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves('created');
        stubAllInputs(HAPPY_INPUTS);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(!ctx.write.textFile.called, 'no template rendering should happen in this command anymore');
        assert.ok(!ctx.write.yamlFile.called, 'no CI YAML files should be written by this command anymore');
        assert.ok(!ctx.mkdir.called, 'no ATOM folder structure should be created by this command anymore');
        assert.ok(!ctx.write.gitignoreFile.called, 'gitignore is now the generator\'s own responsibility (git init)');
    });

    describe('thecore_generators guard', () => {
        it('shows a warning and does not run rails g when thecore_generators is missing and the prompt is dismissed', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.check.hasThecoreGenerators.returns({ ok: false, message: 'missing' });
            const warnStub = sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined);
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(warnStub.calledOnce, 'a warning should be shown');
            assert.ok(!ctx.exec.called, 'rails g / bundle install should never run when dismissed');
            assert.ok(!infoStub.called);
        });

        it('patches the Gemfile, runs bundle install, then proceeds with rails g when the prompt is confirmed', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.check.hasThecoreGenerators.returns({ ok: false, message: 'missing' });
            sinon.stub(vscode.window, 'showWarningMessage').resolves('Add & Bundle Install');
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
            const writeStub = sinon.stub(fs, 'writeFileSync');
            stubAllInputs(HAPPY_INPUTS);
            ctx.exec.onFirstCall().resolves('bundled');
            ctx.exec.onSecondCall().resolves('created');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(writeStub.calledOnce, 'the Gemfile should be patched');
            assert.ok(writeStub.firstCall.args[1].includes('thecore_generators'));
            assert.strictEqual(ctx.exec.callCount, 2, 'bundle install then rails g should both run');
            assert.ok(infoStub.calledOnce);
        });
    });
});
