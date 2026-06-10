'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/addRootAction');
const { makeCtx, makeAtomWorkspace } = require('./helpers/makeCtx');

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
    });

    it('returns early when atomDir is not a directory', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.isDir.returns({ ok: false, message: 'Not a dir' });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('returns early when lib/root_actions does not exist inside atomDir', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.isDir
            .onFirstCall().returns({ ok: true })
            .onSecondCall().returns({ ok: false, message: 'lib/root_actions missing' });
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

    it('returns early when the root action file already exists', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.isFile.returns({ ok: true, value: '/some/file.rb' });
        sinon.stub(vscode.window, 'showInputBox').resolves('existing_root');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    it('rejects a non-snake_case action name and does not proceed', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        // Cancel after validation failure — showInputBox returns undefined
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called, 'should not succeed when action name input is cancelled');
    });

    it('returns early when hasGemspec check fails', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.hasGemspec.returns({ ok: false, message: 'No gemspec' });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_action');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called, 'should not proceed when gemspec is missing');
    });

    it('does not modify after_initialize.rb when the require line already exists', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_root_action');
        const existingContent = "config.after_initialize do\n        require 'root_actions/my_root_action'\nend";
        sinon.stub(fs, 'existsSync').returns(false);
        const readStub = sinon.stub(fs, 'readFileSync').returns(existingContent);
        const writeStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'appendFileSync');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        // writeFileSync should not be called to update after_initialize.rb since the line exists
        const afterInitWriteCalls = writeStub.args.filter(a =>
            typeof a[0] === 'string' && a[0].includes('after_initialize')
        );
        assert.strictEqual(afterInitWriteCalls.length, 0, 'should not rewrite after_initialize.rb when require already present');
    });

    it('does not append to assets.rb when the precompile line already exists', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_root_action');
        const assetsLine = 'Rails.application.config.assets.precompile += %w( rails_admin/actions/my_root_action.js rails_admin/actions/my_root_action.css )';
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns(`config.after_initialize do\nend\n${assetsLine}`);
        sinon.stub(fs, 'writeFileSync');
        const appendStub = sinon.stub(fs, 'appendFileSync');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(!appendStub.called, 'should not append to assets.rb when precompile line already present');
    });

    it('converts snake_case action name to camelCase correctly', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_root_action');
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('config.after_initialize do\nend');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'appendFileSync');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        // JS file should be written with camelCase in its content (via renderTemplate)
        const jsCall = ctx.write.textFile.args.find(a => a[1] && a[1].endsWith('.js'));
        assert.ok(jsCall, 'JS asset file should be written');
    });

    it('merges locale YAML for both en and it', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_root_action');
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

    it('creates root action files and shows success on the happy path', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('my_root_action');
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('config.after_initialize do\nend');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'appendFileSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(infoStub.calledOnce, 'success message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('my_root_action'));
    });

    it('shows an error message when an unexpected exception is thrown', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(vscode.window, 'showInputBox').resolves('crash_action');
        sinon.stub(fs, 'readFileSync').throws(new Error('disk full'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('disk full'));
    });
});
