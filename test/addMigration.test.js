'use strict';

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/addMigration');
const { makeCtx, makeAtomWorkspace, makeAppWorkspace, FAKE_ROOT } = require('./helpers/makeCtx');

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
        assert.ok(!ctx.exec.called, 'should not exec when name input is cancelled');
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
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.resolves('      create  db/migrate/20240101000000_add_name_to_users.rb\n');
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves(''); // empty optional definition
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(ctx.exec.calledOnce, 'should execute rails g even with empty definition');
        assert.ok(ctx.exec.firstCall.args[0].includes('rails g migration'), 'command should include rails g migration');
    });

    it('shows an error when an exec failure throws inside the try block', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.exec.rejects(new Error('rename failed'));
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('AddNameToUsers')
            .onSecondCall().resolves('');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'error should be shown on exec failure');
        assert.ok(errorStub.firstCall.args[0].includes('rename failed'));
    });

    describe('thecore_generators guard', () => {
        it('shows a warning and does not run rails g when thecore_generators is missing and the prompt is dismissed', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            ctx.check.hasThecoreGenerators.returns({ ok: false, message: 'missing' });
            const warnStub = sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined);
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(warnStub.calledOnce, 'a warning should be shown');
            assert.ok(!ctx.exec.called, 'rails g / bundle install should never run when dismissed');
            assert.ok(!infoStub.called);
        });

        it('patches the Gemfile, runs bundle install, then proceeds with rails g when the prompt is confirmed', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            ctx.check.hasThecoreGenerators.returns({ ok: false, message: 'missing' });
            sinon.stub(vscode.window, 'showWarningMessage').resolves('Add & Bundle Install');
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
            const writeStub = sinon.stub(fs, 'writeFileSync');
            sinon.stub(vscode.window, 'showInputBox')
                .onFirstCall().resolves('AddNameToUsers')
                .onSecondCall().resolves('name:string');
            ctx.exec.onFirstCall().resolves('bundled');
            ctx.exec.onSecondCall().resolves('      create  db/migrate/20240101000000_add_name_to_users.rb\n');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(writeStub.calledOnce, 'the Gemfile should be patched');
            assert.ok(writeStub.firstCall.args[1].includes('thecore_generators'));
            assert.strictEqual(ctx.exec.callCount, 2, 'bundle install then rails g should both run');
            assert.ok(ctx.exec.firstCall.args[0].includes('bundle install'));
            assert.strictEqual(ctx.exec.firstCall.args[1], FAKE_ROOT);
            assert.ok(ctx.exec.secondCall.args[0].includes('rails g migration "AddNameToUsers"'));
            assert.ok(infoStub.calledOnce, 'the migration creation should still succeed afterwards');
        });

        it('does not show a warning when thecore_generators is already present (regression)', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            ctx.check.hasThecoreGenerators.returns({ ok: true, value: path.join(FAKE_ROOT, 'Gemfile') });
            const warnStub = sinon.stub(vscode.window, 'showWarningMessage');
            sinon.stub(vscode.window, 'showInputBox')
                .onFirstCall().resolves('AddNameToUsers')
                .onSecondCall().resolves('name:string');
            ctx.exec.resolves('      create  db/migrate/20240101000000_add_name_to_users.rb\n');
            sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(!warnStub.called, 'no warning should appear when the gem is already present');
            assert.ok(ctx.exec.calledOnce, 'only the rails g command should run, no extra bundle install');
        });
    });

    describe('ATOM context', () => {
        it('passes --atom=<name>, runs from the app root, and trusts the result without moving any files', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            ctx.exec.resolves('      create  db/migrate/20240101000000_add_name_to_users.rb\n');
            sinon.stub(vscode.window, 'showInputBox')
                .onFirstCall().resolves('AddNameToUsers')
                .onSecondCall().resolves('name:string');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(ctx.exec.calledOnce);
            const [command, cwd] = ctx.exec.firstCall.args;
            assert.ok(command.includes('rails g migration "AddNameToUsers" name:string'), 'command should invoke rails g migration with the given name/definition');
            assert.ok(command.includes('--atom=my_atom'), 'command should target the ATOM by name');
            assert.ok(command.includes('--non-interactive'), 'command should skip the interactive association prompt');
            assert.strictEqual(cwd, FAKE_ROOT, 'still runs from the app root — the generator resolves ATOM placement itself');
            assert.ok(ctx.check.hasGemspec.called, 'gemspec guard should run for ATOM context');
            assert.ok(!ctx.mkdir.called, 'no ATOM migration folder should be created by this command anymore');
            assert.ok(infoStub.calledOnce, 'success message should be shown');
            assert.ok(infoStub.firstCall.args[0].includes('AddNameToUsers'));
        });
    });

    describe('main app context', () => {
        it('returns early when the workspace root is not a valid Rails app', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.check.railsAppValid.returns({ ok: false, message: 'Not a Rails app' });
            const errorStub = sinon.stub(vscode.window, 'showErrorMessage');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(errorStub.calledOnce, 'error should be shown when the app is not a Rails app');
            assert.ok(!infoStub.called);
            assert.ok(!ctx.exec.called, 'rails g should not run when the guard fails');
        });

        it('shells out to `rails g migration` in the app root with no --atom flag', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.exec.resolves('      create  db/migrate/20240101000000_add_name_to_users.rb\n');
            sinon.stub(vscode.window, 'showInputBox')
                .onFirstCall().resolves('AddNameToUsers')
                .onSecondCall().resolves('name:string');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(ctx.check.railsAppValid.called, 'the Rails app guard should run');
            assert.ok(!ctx.check.hasGemspec.called, 'gemspec check must not run for the main app');
            const [command, cwd] = ctx.exec.firstCall.args;
            assert.ok(!command.includes('--atom'), 'no --atom flag should be passed outside ATOM context');
            assert.strictEqual(cwd, FAKE_ROOT, 'should run from the app root');
            assert.ok(!ctx.mkdir.called, 'no ATOM migration folder should be created');
            assert.ok(infoStub.calledOnce, 'success message should be shown');
        });
    });
});
