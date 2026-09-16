'use strict';

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/addRootAction');
const { makeCtx, makeAtomWorkspace, makeAppWorkspace, FAKE_ROOT } = require('./helpers/makeCtx');

describe('commands/addRootAction', () => {
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
        assert.ok(!ctx.exec.called);
    });

    it('returns early when atomDir is not a directory', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.isDir.returns({ ok: false, message: 'Not a dir' });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when hasGemspec check fails', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.hasGemspec.returns({ ok: false, message: 'No gemspec' });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels the action name input', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called, 'should not exec when name input is cancelled');
    });

    it('returns early when the root action file already exists (main app context)', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.check.isFile.returns({ ok: true, value: '/some/file.rb' });
        sinon.stub(vscode.window, 'showInputBox').resolves('existing_root');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called, 'should not exec when the action already exists');
        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('already exists'));
    });

    it('returns early when the root action file already exists (ATOM context)', async () => {
        // Regression coverage: ctx.workspace.rootActionsDir() resolves to a different path
        // (lib/root_actions vs config/root_actions) depending on context — the "already exists"
        // guard must be exercised under both, not just the main-app one above.
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.isFile.returns({ ok: true, value: '/some/atom/lib/root_actions/existing_root.rb' });
        sinon.stub(vscode.window, 'showInputBox').resolves('existing_root');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called, 'should not exec when the action already exists');
        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('already exists'));
    });

    it('shows an error when execShell produces no output', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.resolves(null);
        sinon.stub(vscode.window, 'showInputBox').resolves('my_action');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
    });

    it('shows an error when an exec failure throws inside the try block', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.exec.rejects(new Error('rails g failed'));
        sinon.stub(vscode.window, 'showInputBox').resolves('my_action');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'error should be shown on exec failure');
        assert.ok(errorStub.firstCall.args[0].includes('rails g failed'));
    });

    it('shows an error (not an unhandled rejection) when the thecore_generators guard itself throws', async () => {
        // Regression coverage: the Gemfile guard runs real I/O (fs.readFileSync/writeFileSync,
        // `bundle install`) before the rest of the command — since extension.js never awaits or
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

    describe('main app context', () => {
        it('shells out to `rails g thecore:root_action` in the app root and trusts the result, with no --atom flag', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.exec.resolves('      create  config/root_actions/my_action.rb\n');
            sinon.stub(vscode.window, 'showInputBox').resolves('my_action');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(ctx.exec.calledOnce, 'should shell out exactly once');
            const [command, cwd] = ctx.exec.firstCall.args;
            assert.ok(command.includes('rails g thecore:root_action "my_action"'), 'command should invoke the thecore:root_action generator with the given name');
            assert.ok(!command.includes('--atom'), 'no --atom flag should be passed outside ATOM context');
            assert.ok(command.includes('--non-interactive'), 'command should match addModel/addMigration\'s non-interactive convention');
            assert.strictEqual(cwd, FAKE_ROOT, 'should run from the app root');
            assert.ok(ctx.check.railsAppValid.called, 'the Rails app guard should run');
            assert.ok(!ctx.check.hasGemspec.called, 'gemspec check must not run for the main app');
            assert.ok(infoStub.calledOnce, 'success message should be shown');
            assert.ok(infoStub.firstCall.args[0].includes('my_action'));
        });
    });

    describe('ATOM context', () => {
        it('passes --atom=<name>, runs from the app root, and trusts the result without writing any files itself', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            ctx.exec.resolves('      create  lib/root_actions/my_action.rb\n');
            sinon.stub(vscode.window, 'showInputBox').resolves('my_action');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(ctx.exec.calledOnce);
            const [command, cwd] = ctx.exec.firstCall.args;
            assert.ok(command.includes('--atom=my_atom'), 'command should target the ATOM by name');
            assert.strictEqual(cwd, FAKE_ROOT, 'still runs from the app root — the generator resolves ATOM placement itself');
            assert.ok(ctx.check.hasGemspec.called, 'gemspec guard should run for ATOM context');
            assert.ok(infoStub.calledOnce, 'success message should be shown');
            assert.ok(!ctx.write.textFile.called, 'no template rendering should happen in this command anymore');
        });
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
            sinon.stub(vscode.window, 'showInputBox').resolves('my_action');
            ctx.exec.onFirstCall().resolves('bundled');
            ctx.exec.onSecondCall().resolves('      create  config/root_actions/my_action.rb\n');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(writeStub.calledOnce, 'the Gemfile should be patched');
            assert.ok(writeStub.firstCall.args[1].includes('thecore_generators'));
            assert.strictEqual(ctx.exec.callCount, 2, 'bundle install then rails g should both run');
            assert.ok(ctx.exec.firstCall.args[0].includes('bundle install'));
            assert.strictEqual(ctx.exec.firstCall.args[1], FAKE_ROOT);
            assert.ok(ctx.exec.secondCall.args[0].includes('rails g thecore:root_action "my_action"'));
            assert.ok(infoStub.calledOnce, 'the root action creation should still succeed afterwards');
        });

        it('does not show a warning when thecore_generators is already present (regression)', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.check.hasThecoreGenerators.returns({ ok: true, value: path.join(FAKE_ROOT, 'Gemfile') });
            const warnStub = sinon.stub(vscode.window, 'showWarningMessage');
            sinon.stub(vscode.window, 'showInputBox').resolves('my_action');
            ctx.exec.resolves('      create  config/root_actions/my_action.rb\n');
            sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(!warnStub.called, 'no warning should appear when the gem is already present');
            assert.ok(ctx.exec.calledOnce, 'only the rails g command should run, no extra bundle install');
        });
    });
});
