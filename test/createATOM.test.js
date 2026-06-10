'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { perform } = require('../commands/createATOM');
const { makeCtx, FAKE_ROOT } = require('./helpers/makeCtx');

const SUBMODULES_DIR = `${FAKE_ROOT}/vendor/submodules`;

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

function makeHappyCtx() {
    const ctx = makeCtx();
    ctx.exec.resolves('');
    return ctx;
}

describe('commands/createATOM', () => {
    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
    });

    afterEach(() => sinon.restore());

    // ── Guard checks ─────────────────────────────────────────────────────────

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

    // ── Input cancellation matrix ─────────────────────────────────────────────

    it('returns early when user cancels submodule name (input 1)', async () => {
        const ctx = makeCtx();
        stubAllInputs([undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels summary (input 2)', async () => {
        const ctx = makeCtx();
        stubAllInputs(['My Atom', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels description (input 3)', async () => {
        const ctx = makeCtx();
        stubAllInputs(['My Atom', 'A summary', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels author (input 4)', async () => {
        const ctx = makeCtx();
        stubAllInputs(['My Atom', 'A summary', 'A description', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels email (input 5)', async () => {
        const ctx = makeCtx();
        stubAllInputs(['My Atom', 'A summary', 'A description', 'Author', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when user cancels url (input 6)', async () => {
        const ctx = makeCtx();
        stubAllInputs(['My Atom', 'A summary', 'A description', 'Author', 'a@b.com', undefined]);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.exec.called);
    });

    // ── Error handling ────────────────────────────────────────────────────────

    it('shows an error message when rails plugin new fails', async () => {
        const ctx = makeCtx();
        ctx.exec.rejects(new Error('rails not available'));
        stubAllInputs(['My Atom', 'summary', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
    });

    it('shows an error when readFileSync throws during Gemfile append', async () => {
        const ctx = makeHappyCtx();
        stubAllInputs(['My Atom', 'summary', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(fs, 'readFileSync').throws(new Error('permission denied'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('error occurred'));
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it('shows success after creating a new ATOM', async () => {
        const ctx = makeHappyCtx();
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['My Atom', 'A summary', 'A description', 'Author Name', 'author@example.com', 'https://example.com']);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(infoStub.calledOnce, 'success info message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('My Atom'), 'message should include the ATOM name');
    });

    it('appends the gem entry to the main app Gemfile', async () => {
        const ctx = makeHappyCtx();
        const gemfileContent = '# Gemfile\n';
        sinon.stub(fs, 'readFileSync').returns(gemfileContent);
        const writeStub = sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['My Atom', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const gemfileWrite = writeStub.args.find(a => a[1] && a[1].includes('my_atom'));
        assert.ok(gemfileWrite, 'should write updated Gemfile with the new gem entry');
        assert.ok(gemfileWrite[1].includes('vendor/submodules/my_atom'), 'gem path should point to vendor/submodules');
    });

    it('converts submodule name with spaces to snake_case for the gem entry', async () => {
        const ctx = makeHappyCtx();
        sinon.stub(fs, 'readFileSync').returns('source "https://rubygems.org"\n');
        const writeStub = sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['TCP Debugger', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const gemfileWrite = writeStub.args.find(a => a[1] && a[1].includes('tcp_debugger'));
        assert.ok(gemfileWrite, 'snake_case gem name should appear in the Gemfile write');
    });

    it('calls ctx.exec with the rails plugin new command', async () => {
        const ctx = makeHappyCtx();
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['My Atom', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const railsCall = ctx.exec.args.find(a => a[0].includes('rails plugin new'));
        assert.ok(railsCall, 'rails plugin new should be called');
        assert.ok(railsCall[0].includes('my_atom'), 'command should include the snake_case name');
    });

    it('creates the gitignore file inside the new ATOM directory', async () => {
        const ctx = makeHappyCtx();
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['My Atom', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(ctx.write.gitignoreFile.calledOnce, 'gitignore should be created in the ATOM dir');
    });

    it('writes locale YAML files for en and it', async () => {
        const ctx = makeHappyCtx();
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['My Atom', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const yamlCalls = ctx.write.yamlFile.args;
        const enCall = yamlCalls.find(a => a[1] === 'en.yml');
        const itCall = yamlCalls.find(a => a[1] === 'it.yml');
        assert.ok(enCall, 'en.yml should be created');
        assert.ok(itCall, 'it.yml should be created');
    });

    it('writes the initializer files (after_initialize.rb, assets.rb, abilities.rb)', async () => {
        const ctx = makeHappyCtx();
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['My Atom', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const textCalls = ctx.write.textFile.args.map(a => a[1]);
        assert.ok(textCalls.includes('after_initialize.rb'), 'after_initialize.rb should be written');
        assert.ok(textCalls.includes('assets.rb'), 'assets.rb should be written');
        assert.ok(textCalls.includes('abilities.rb'), 'abilities.rb should be written');
    });

    it('writes seeds.rb in the db directory', async () => {
        const ctx = makeHappyCtx();
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['My Atom', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const seedsCall = ctx.write.textFile.args.find(a => a[1] === 'seeds.rb');
        assert.ok(seedsCall, 'seeds.rb should be written');
    });

    it('writes CI/CD YAML files (gempush.yml and .gitlab-ci.yml)', async () => {
        const ctx = makeHappyCtx();
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['My Atom', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const yamlCalls = ctx.write.yamlFile.args;
        const gempushCall = yamlCalls.find(a => a[1] === 'gempush.yml');
        const gitlabCall = yamlCalls.find(a => a[1] === '.gitlab-ci.yml');
        assert.ok(gempushCall, 'gempush.yml CI file should be created');
        assert.ok(gitlabCall, '.gitlab-ci.yml should be created');
    });

    it('calls ctx.mkdir for all required ATOM folder structure', async () => {
        const ctx = makeHappyCtx();
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        sinon.stub(fs, 'writeFileSync');
        stubAllInputs(['My Atom', 'sum', 'desc', 'Author', 'a@b.com', 'https://example.com']);
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        assert.ok(ctx.mkdir.callCount >= 5, `expected at least 5 mkdir calls, got ${ctx.mkdir.callCount}`);
        const mkdirPaths = ctx.mkdir.args.map(a => a[0]);
        assert.ok(mkdirPaths.some(p => p.includes('db/migrate')), 'db/migrate dir should be created');
        assert.ok(mkdirPaths.some(p => p.includes('config/initializers')), 'config/initializers dir should be created');
        assert.ok(mkdirPaths.some(p => p.includes('config/locales')), 'config/locales dir should be created');
    });
});
