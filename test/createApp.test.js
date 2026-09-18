'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/createApp');
const { makeCtx, FAKE_ROOT } = require('./helpers/makeCtx');

function makeHappyCtx() {
    const ctx = makeCtx();
    ctx.exec.resolves('output');
    return ctx;
}

describe('commands/createApp', () => {
    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
    });

    afterEach(() => sinon.restore());

    // ── Guard checks ─────────────────────────────────────────────────────────

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

    it('returns early when a required command (ruby/rails/bundle) is missing', async () => {
        const ctx = makeCtx();
        ctx.check.commandExists.returns({ ok: false, message: 'ruby not found' });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    it('returns early when workspace is already a Rails app', async () => {
        const ctx = makeCtx();
        ctx.check.railsAppValid.returns({ ok: true, value: { workspaceRoot: FAKE_ROOT, vendorDir: `${FAKE_ROOT}/vendor` } });
        await perform(ctx);
        assert.ok(!ctx.exec.called);
    });

    // ── Error handling ────────────────────────────────────────────────────────

    it('shows an error when the rails new / app template command produces no output', async () => {
        const ctx = makeCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        ctx.exec.onFirstCall().resolves(''); // chown
        ctx.exec.onSecondCall().resolves(null); // rails new -m <template>
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('No output'));
    });

    it('shows an error (not an unhandled rejection) when a shell command throws', async () => {
        const ctx = makeCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        ctx.exec.rejects(new Error('rails not found'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('rails not found'));
    });

    // ── Happy path: delegates to the App application template ──────────────────

    it('shells out to `rails new -m <app_template.rb URL>` with the non-interactive env vars', async () => {
        const ctx = makeHappyCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('config.action_controller.raise_on_missing_callback_actions = true\n');
        sinon.stub(fs, 'writeFileSync');

        await perform(ctx);

        // Calls: chown, rails new -m <template>, db setup, git init+commit.
        const templateCall = ctx.exec.getCalls().find(c => c.args[0].includes('rails new'));
        assert.ok(templateCall, 'rails new should be invoked');
        const [command, cwd] = templateCall.args;
        assert.ok(command.includes('THECORE_APP_TEMPLATE_NON_INTERACTIVE=1'), 'non-interactive trigger');
        assert.ok(command.includes('THECORE_APP_TEMPLATE_RUN_INSTALLERS=true'), 'preserves always-installs-everything behavior');
        assert.ok(command.includes('-m https://raw.githubusercontent.com/gabrieletassoni/thecore_generators/release/3/lib/templates/app_template.rb'), 'points at the App template');
        assert.ok(command.includes('--skip-git'), 'git stays this command\'s own responsibility, not the template\'s');
        assert.ok(command.includes('--database=postgresql'));
        assert.ok(command.includes('--asset-pipeline=sprockets'));
        assert.strictEqual(cwd, FAKE_ROOT);
    });

    it('writes the gitignore, sidekiq.yml, version file, and patches development.rb', async () => {
        const ctx = makeHappyCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('config.action_controller.raise_on_missing_callback_actions = true\n');
        const writeStub = sinon.stub(fs, 'writeFileSync');

        await perform(ctx);

        assert.ok(ctx.write.gitignoreFile.calledOnceWith(FAKE_ROOT));
        assert.ok(ctx.write.yamlFile.calledOnceWith(FAKE_ROOT, 'config/sidekiq.yml'));

        const versionWrite = writeStub.getCalls().find(c => c.args[0].endsWith('/version'));
        assert.ok(versionWrite, 'the version file should be written');
        assert.strictEqual(versionWrite.args[1], '3.0.1');

        const devConfigWrite = writeStub.getCalls().find(c => c.args[0].endsWith('development.rb'));
        assert.ok(devConfigWrite, 'development.rb should be patched');
        assert.ok(devConfigWrite.args[1].includes('raise_on_missing_callback_actions = false'));
    });

    it('runs the db setup command', async () => {
        const ctx = makeHappyCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('config.action_controller.raise_on_missing_callback_actions = true\n');
        sinon.stub(fs, 'writeFileSync');

        await perform(ctx);

        const dbCall = ctx.exec.getCalls().find(c => c.args[0].includes('rails db:create'));
        assert.ok(dbCall, 'db:create/migrate/thecore:db:seed should run');
        assert.ok(dbCall.args[0].includes('rails thecore:db:seed'));
    });

    it('creates vendor/custombuilds and vendor/deploytargets, but not vendor/submodules (the App template already creates that)', async () => {
        const ctx = makeHappyCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('config.action_controller.raise_on_missing_callback_actions = true\n');
        sinon.stub(fs, 'writeFileSync');

        await perform(ctx);

        const mkdirPaths = ctx.mkdir.getCalls().map(c => c.args[0]);
        assert.ok(mkdirPaths.some(p => p.endsWith('vendor/custombuilds')));
        assert.ok(mkdirPaths.some(p => p.endsWith('vendor/deploytargets')));
        assert.ok(!mkdirPaths.some(p => p.endsWith('vendor/submodules')), 'the App template already creates vendor/submodules');
    });

    it('removes .dockerignore when present', async () => {
        const ctx = makeHappyCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        sinon.stub(fs, 'existsSync').callsFake((p) => p.endsWith('.dockerignore'));
        sinon.stub(fs, 'readFileSync').returns('config.action_controller.raise_on_missing_callback_actions = true\n');
        sinon.stub(fs, 'writeFileSync');
        const unlinkStub = sinon.stub(fs, 'unlinkSync');

        await perform(ctx);

        assert.ok(unlinkStub.calledOnce);
        assert.ok(unlinkStub.firstCall.args[0].endsWith('.dockerignore'));
    });

    it('initializes git with a single "Initial commit" after everything else is in place', async () => {
        const ctx = makeHappyCtx();
        ctx.check.railsAppValid.returns({ ok: false, message: '' });
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('config.action_controller.raise_on_missing_callback_actions = true\n');
        sinon.stub(fs, 'writeFileSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const gitCalls = ctx.exec.getCalls().filter(c => c.args[0].includes('git init'));
        assert.strictEqual(gitCalls.length, 1, 'exactly one git init -- no separate "before/after gems" commits anymore, the template already wrote everything by the time git runs');
        assert.ok(gitCalls[0].args[0].includes('git commit -m "Initial commit"'));
        assert.ok(infoStub.calledOnce, 'success message should be shown');
    });
});
