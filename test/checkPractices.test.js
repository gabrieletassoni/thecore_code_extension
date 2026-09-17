'use strict';

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/checkPractices');
const { makeCtx, makeAtomWorkspace, makeAppWorkspace, FAKE_ROOT } = require('./helpers/makeCtx');

function makeCollection() {
    return { set: sinon.stub(), clear: sinon.stub(), delete: sinon.stub(), dispose: sinon.stub() };
}

function jsonOutput(violations) {
    return JSON.stringify({ violations });
}

// `rails thecore:check_practices -- --json` always prints Rails/RailsAdmin/Sidekiq boot noise
// to stdout before the actual JSON line — this wraps a canned violations payload in a realistic
// noisy preamble, matching what a real invocation's captured stdout looks like.
function noisyJsonOutput(violations) {
    return [
        'Settings Concern from ThecoreBackgroundJobs',
        'Loading CORS',
        'ThecoreUiRailsAdmin after_initialize',
        jsonOutput(violations),
    ].join('\n');
}

describe('commands/checkPractices', () => {
    let collection;

    beforeEach(() => {
        collection = makeCollection();
        sinon.stub(vscode.languages, 'createDiagnosticCollection').returns(collection);
    });

    afterEach(() => sinon.restore());

    it('shows an error and returns when workspace is null', async () => {
        const ctx = makeCtx({ workspace: null });
        const errStub = sinon.stub(vscode.window, 'showErrorMessage');
        await perform(ctx);
        assert.ok(errStub.calledOnce);
        assert.ok(errStub.firstCall.args[0].includes('right click'));
        assert.ok(!ctx.show.called, 'output channel must not open when workspace is null');
    });

    it('returns early when workspaceExists check fails', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.workspaceExists.returns({ ok: false, message: 'No workspace' });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
        assert.ok(!ctx.execAllowNonZero.called);
    });

    describe('thecore_generators guard', () => {
        it('shows a warning and does not run rails when thecore_generators is missing and the prompt is dismissed', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.check.hasThecoreGenerators.returns({ ok: false, message: 'missing' });
            const warnStub = sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined);

            await perform(ctx);

            assert.ok(warnStub.calledOnce, 'a warning should be shown');
            assert.ok(!ctx.execAllowNonZero.called, 'rails / bundle install should never run when dismissed');
        });

        it('patches the Gemfile, runs bundle install, then proceeds when the prompt is confirmed', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.check.hasThecoreGenerators.returns({ ok: false, message: 'missing' });
            sinon.stub(vscode.window, 'showWarningMessage').resolves('Add & Bundle Install');
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
            sinon.stub(fs, 'writeFileSync');
            ctx.exec.resolves('bundled');
            ctx.execAllowNonZero.resolves(jsonOutput([]));
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(ctx.exec.calledOnce, 'the guard\'s own bundle install should run via ctx.exec');
            assert.ok(ctx.execAllowNonZero.calledOnce, 'check_practices itself should still run afterwards');
            assert.ok(infoStub.calledOnce);
        });

        it('does not show a warning when thecore_generators is already present (regression)', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.check.hasThecoreGenerators.returns({ ok: true, value: path.join(FAKE_ROOT, 'Gemfile') });
            const warnStub = sinon.stub(vscode.window, 'showWarningMessage');
            ctx.execAllowNonZero.resolves(jsonOutput([]));
            sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(!warnStub.called);
            assert.ok(ctx.execAllowNonZero.calledOnce);
        });
    });

    describe('shelled command', () => {
        it('does not pass --atom outside ATOM context, and runs from the app root', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.execAllowNonZero.resolves(jsonOutput([]));
            sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(ctx.execAllowNonZero.calledOnce);
            const [command, cwd] = ctx.execAllowNonZero.firstCall.args;
            assert.ok(command.includes('rails thecore:check_practices -- --json'), 'command should invoke check_practices with --json after the Rake `--` separator');
            assert.ok(command.startsWith('bundle install && '), 'the first invocation of a perform() run should ensure gems are installed');
            assert.ok(!command.includes('--atom'), 'no --atom flag should be passed outside ATOM context');
            assert.strictEqual(cwd, FAKE_ROOT);
        });

        it('passes --atom=<name> in ATOM context', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            ctx.execAllowNonZero.resolves(jsonOutput([]));
            sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            const [command] = ctx.execAllowNonZero.firstCall.args;
            assert.ok(command.includes('--atom=my_atom'));
        });
    });

    describe('diagnostics rendering', () => {
        it('shows "no violations" and sets no diagnostics when the audit is clean', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.execAllowNonZero.resolves(jsonOutput([]));
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.ok(infoStub.calledOnce);
            assert.ok(infoStub.firstCall.args[0].includes('no violations'));
            assert.ok(!collection.set.called);
        });

        it('groups diagnostics by file and maps severity strings to vscode.DiagnosticSeverity', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.execAllowNonZero.resolves(jsonOutput([
                { file: '/app/a.rb', line: 3, message: 'first', severity: 'error', fixable: false, code: 'x' },
                { file: '/app/a.rb', line: 5, message: 'second', severity: 'warning', fixable: false, code: 'y' },
                { file: '/app/b.rb', line: 0, message: 'third', severity: 'error', fixable: false, code: 'z' },
            ]));
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');

            await perform(ctx);

            assert.strictEqual(collection.set.callCount, 2, 'one collection.set call per distinct file');
            const aCall = collection.set.args.find(a => a[0].fsPath === '/app/a.rb');
            assert.strictEqual(aCall[1].length, 2, 'both violations for a.rb should be grouped together');
            assert.strictEqual(aCall[1][0].severity, vscode.DiagnosticSeverity.Error);
            assert.strictEqual(aCall[1][1].severity, vscode.DiagnosticSeverity.Warning);
        });

        it('correctly parses the JSON line out of realistic Rails/RailsAdmin boot noise on stdout', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.execAllowNonZero.resolves(noisyJsonOutput([
                { file: '/app/a.rb', line: 0, message: 'noisy', severity: 'error', fixable: false, code: 'x' },
            ]));
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');

            await perform(ctx);

            assert.strictEqual(collection.set.callCount, 1);
        });

        it('skips a trailing JSON-shaped noise line lacking a violations array and finds the real payload further back', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            // Simulates a gem/initializer emitting its own single-line JSON to stdout (e.g.
            // structured logging) *after* the real check_practices payload — extractJson must not
            // stop at the first JSON-parseable line found scanning backward, only at one shaped
            // like { "violations": [...] }.
            ctx.execAllowNonZero.resolves([
                jsonOutput([{ file: '/app/a.rb', line: 0, message: 'real one', severity: 'error', fixable: false, code: 'x' }]),
                '{"level":"info","msg":"request completed"}',
            ].join('\n'));
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');

            await perform(ctx);

            assert.ok(!infoStub.called, 'the real payload has a violation, so "no violations" must not be shown');
            assert.strictEqual(collection.set.callCount, 1, 'the real violation should still be rendered');
        });

        it('shows an error and sets no diagnostics when the output cannot be parsed as JSON at all', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.execAllowNonZero.resolves('Settings Concern from ThecoreBackgroundJobs\nsomething went wrong, no JSON here\n');
            const errStub = sinon.stub(vscode.window, 'showErrorMessage');

            await perform(ctx);

            assert.ok(errStub.calledOnce);
            assert.ok(!collection.set.called);
        });
    });

    describe('auto-fix', () => {
        it('does not show a QuickPick when there are violations but none are fixable', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.execAllowNonZero.resolves(jsonOutput([
                { file: '/app/a.rb', line: 0, message: 'not fixable', severity: 'error', fixable: false, code: 'x' },
            ]));
            const qpStub = sinon.stub(vscode.window, 'showQuickPick');

            await perform(ctx);

            assert.ok(!qpStub.called);
            assert.ok(ctx.execAllowNonZero.calledOnce, 'no --fix re-invocation should happen');
        });

        it('shows the QuickPick with the fixable-of-total count when some violations are fixable', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.execAllowNonZero.resolves(jsonOutput([
                { file: '/app/a.rb', line: 0, message: 'fixable one', severity: 'error', fixable: true, code: 'x' },
                { file: '/app/b.rb', line: 0, message: 'not fixable', severity: 'error', fixable: false, code: 'y' },
            ]));
            const qpStub = sinon.stub(vscode.window, 'showQuickPick').resolves('No');

            await perform(ctx);

            assert.ok(qpStub.calledOnce);
            assert.deepStrictEqual(qpStub.firstCall.args[0], ['Yes', 'No']);
            assert.strictEqual(qpStub.firstCall.args[1].placeHolder, 'Fix 1 fixable issue(s) of 2 total?');
        });

        it('does not re-invoke check_practices when the QuickPick is dismissed/declined', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.execAllowNonZero.resolves(jsonOutput([
                { file: '/app/a.rb', line: 0, message: 'fixable one', severity: 'error', fixable: true, code: 'x' },
            ]));
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');

            await perform(ctx);

            assert.ok(ctx.execAllowNonZero.calledOnce, 'only the initial scan should run');
        });

        it('re-invokes with --fix appended when the QuickPick is confirmed, and re-renders diagnostics from what remains', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            ctx.execAllowNonZero.onFirstCall().resolves(jsonOutput([
                { file: '/app/a.rb', line: 0, message: 'fixable one', severity: 'error', fixable: true, code: 'x' },
                { file: '/app/b.rb', line: 0, message: 'not fixable', severity: 'error', fixable: false, code: 'y' },
            ]));
            ctx.execAllowNonZero.onSecondCall().resolves(jsonOutput([
                { file: '/app/b.rb', line: 0, message: 'not fixable', severity: 'error', fixable: false, code: 'y' },
            ]));
            sinon.stub(vscode.window, 'showQuickPick').resolves('Yes');
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

            await perform(ctx);

            assert.strictEqual(ctx.execAllowNonZero.callCount, 2, 'a second, --fix invocation should run');
            const [firstCommand] = ctx.execAllowNonZero.firstCall.args;
            const [fixCommand] = ctx.execAllowNonZero.secondCall.args;
            assert.ok(firstCommand.startsWith('bundle install && '), 'the initial scan should still ensure gems are installed');
            assert.ok(fixCommand.includes('--fix'), 'the second invocation should append --fix');
            assert.ok(fixCommand.includes('--json'), 'the second invocation should still ask for --json so the remaining violations can be parsed');
            assert.ok(!fixCommand.includes('bundle install'), 'the --fix re-invocation should not redundantly re-run bundle install right after the initial scan already did');
            assert.ok(collection.clear.calledTwice, 'diagnostics should be cleared once up front and once before re-rendering post-fix');
            // Pre-fix render: 2 distinct files (a.rb, b.rb) → 2 `set` calls. Post-fix render:
            // only b.rb remains → 1 more `set` call. Total 3.
            assert.strictEqual(collection.set.callCount, 3);
            assert.ok(infoStub.calledOnce);
            assert.ok(infoStub.firstCall.args[0].includes('1 violation(s) remain'));
        });
    });

    it('shows an error message when an unexpected exception is thrown', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        ctx.execAllowNonZero.rejects(new Error('bundle install failed'));
        const errStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errStub.calledOnce);
        assert.ok(errStub.firstCall.args[0].includes('bundle install failed'));
    });
});
