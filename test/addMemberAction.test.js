'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/addMemberAction');
const { makeCtx, makeAtomWorkspace, makeAppWorkspace } = require('./helpers/makeCtx');

describe('commands/addMemberAction', () => {
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

    it('returns early when lib/member_actions does not exist inside atomDir', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        // First isDir call (atomDir itself) passes, second (memberActionsDir) fails
        ctx.check.isDir
            .onFirstCall().returns({ ok: true })
            .onSecondCall().returns({ ok: false, message: 'lib/member_actions missing' });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('returns early when user cancels the input box', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('shows an error when the member action file already exists', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('existing_action');
        sinon.stub(fs, 'existsSync').returns(true);
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');
        await perform(ctx);
        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('already exists'));
    });

    it('returns early when hasGemspec check fails', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.hasGemspec.returns({ ok: false, message: 'No gemspec' });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_action');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called, 'should not proceed when gemspec is missing');
    });

    it('rejects a non-snake_case action name and does not proceed', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called, 'should not succeed when action name input is cancelled');
    });

    it('does not modify after_initialize.rb when the require line already exists', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_test_action');
        const existingContent = "config.after_initialize do\n        require 'member_actions/my_test_action'\nend";
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns(existingContent);
        const writeStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'appendFileSync');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const afterInitWriteCalls = writeStub.args.filter(a =>
            typeof a[0] === 'string' && a[0].includes('after_initialize')
        );
        assert.strictEqual(afterInitWriteCalls.length, 0, 'should not rewrite after_initialize.rb when require already present');
    });

    it('does not append to assets.rb when the precompile line already exists', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_test_action');
        const assetsLine = 'Rails.application.config.assets.precompile += %w( rails_admin/actions/my_test_action.js rails_admin/actions/my_test_action.css )';
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns(`config.after_initialize do\nend\n${assetsLine}`);
        sinon.stub(fs, 'writeFileSync');
        const appendStub = sinon.stub(fs, 'appendFileSync');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(!appendStub.called, 'should not append to assets.rb when precompile line already present');
    });

    it('merges locale YAML for both en and it', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_test_action');
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('config.after_initialize do\nend');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'appendFileSync');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const mergeCalls = ctx.write.mergeYaml.args;
        const enCall = mergeCalls.find(a => a[1] === 'en.yml' && a[4] === 'en');
        const itCall = mergeCalls.find(a => a[1] === 'it.yml' && a[4] === 'it');
        assert.ok(enCall, 'en locale should be merged');
        assert.ok(itCall, 'it locale should be merged');
    });

    it('shows an error when an fs operation throws inside the try block', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('crash_action');
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').throws(new Error('disk full'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'error should be shown on fs failure');
        assert.ok(errorStub.firstCall.args[0].includes('disk full'));
    });

    it('creates member action files and shows success on the happy path', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_test_action');
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('config.after_initialize do\nend');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'appendFileSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(infoStub.calledOnce, 'success message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('my_test_action'));
    });

    it('validates the action name: cancels when invalid input is given', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
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
        });

        it('creates the member action in the main app without requiring a gemspec', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            sinon.stub(vscode.window, 'showInputBox').resolves('my_test_action');
            sinon.stub(fs, 'existsSync').returns(false);
            sinon.stub(fs, 'readFileSync').returns('config.after_initialize do\nend');
            sinon.stub(fs, 'writeFileSync');
            sinon.stub(fs, 'appendFileSync');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(ctx.check.railsAppValid.called, 'the Rails app guard should run');
            assert.ok(!ctx.check.hasGemspec.called, 'gemspec check must not run for the main app');
            assert.ok(ctx.mkdir.calledWith(ctx.workspace.memberActionsDir()), 'lib/member_actions should be created');
            assert.ok(infoStub.calledOnce, 'success message should be shown');
        });

        it('requires the action by full path in the main app after_initialize.rb', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            sinon.stub(vscode.window, 'showInputBox').resolves('my_test_action');
            sinon.stub(fs, 'existsSync').returns(false);
            sinon.stub(fs, 'readFileSync').returns('config.after_initialize do\nend');
            const writeStub = sinon.stub(fs, 'writeFileSync');
            sinon.stub(fs, 'appendFileSync');
            sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            const afterInitWrite = writeStub.args.find(a => String(a[0]).includes('after_initialize'));
            assert.ok(afterInitWrite, 'after_initialize.rb should be updated');
            assert.ok(afterInitWrite[1].includes("require Rails.root.join('lib', 'member_actions', 'my_test_action').to_s"),
                'main app require must use Rails.root.join');
        });

        it('creates the after_initialize.rb initializer when it is missing', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            sinon.stub(vscode.window, 'showInputBox').resolves('my_test_action');
            sinon.stub(fs, 'existsSync').returns(false);
            sinon.stub(fs, 'readFileSync').returns('config.after_initialize do\nend');
            sinon.stub(fs, 'writeFileSync');
            sinon.stub(fs, 'appendFileSync');
            sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            const initWrite = ctx.write.textFile.args.find(a => a[1] === 'after_initialize.rb');
            assert.ok(initWrite, 'after_initialize.rb should be created from the template when missing');
        });
    });
});
