'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const proxyquire = require('proxyquire');

function makeOutputChannel() {
    return { show: () => {}, appendLine: () => {}, append: () => {} };
}

// releaseApp guards each execShell call with `if (!result) return`, so stubs must
// return a truthy value. An empty string '' is falsy and causes early exit.
const SHELL_OK = 'ok';

// releaseApp uses .then() chains inside forEach (not awaited), so we must wait
// for the macrotask queue to drain before asserting on inner callbacks.
function flushPromises() {
    return new Promise(resolve => setTimeout(resolve, 0));
}

describe('commands/releaseApp', () => {
    let execShellStub;
    let workspaceExixtenceStub, rubyOnRailsAppValidityStub, fileExistenceStub;
    let perform;

    const FAKE_ROOT = '/fake/workspace';
    const ROR_DIRS = { workspaceRoot: FAKE_ROOT, vendorDir: FAKE_ROOT + '/vendor' };

    before(() => {
        execShellStub = sinon.stub();
        workspaceExixtenceStub = sinon.stub();
        rubyOnRailsAppValidityStub = sinon.stub();
        fileExistenceStub = sinon.stub();
        perform = proxyquire('../commands/releaseApp', {
            '../libs/os': { execShell: execShellStub },
            '../libs/check': {
                workspaceExixtence: workspaceExixtenceStub,
                rubyOnRailsAppValidity: rubyOnRailsAppValidityStub,
                fileExistence: fileExistenceStub,
            },
        }).perform;
    });

    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
        sinon.stub(vscode.window, 'createOutputChannel').returns(makeOutputChannel());
        sinon.stub(vscode.window, 'showInformationMessage');
        execShellStub.reset();
        workspaceExixtenceStub.reset();
        rubyOnRailsAppValidityStub.reset();
        fileExistenceStub.reset();
        workspaceExixtenceStub.returns(true);
        rubyOnRailsAppValidityStub.returns(ROR_DIRS);
        fileExistenceStub.returns(true);
    });

    afterEach(() => sinon.restore());

    // ── Guard checks ─────────────────────────────────────────────────────────

    it('returns early when no workspace is open', async () => {
        workspaceExixtenceStub.returns(false);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('returns early when the workspace is not a Rails app', async () => {
        rubyOnRailsAppValidityStub.returns(false);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('returns early when vendor/custombuilds directory does not exist', async () => {
        fileExistenceStub.returns(false);
        sinon.stub(fs, 'readdirSync').returns([]);
        await perform();
        assert.ok(!execShellStub.called);
    });

    it('runs git and bundle commands for each Dockerfile found', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('1.0.0');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves('Release');
        execShellStub.resolves(SHELL_OK);

        await perform();

        assert.ok(execShellStub.called, 'shell commands should be invoked for Dockerfile processing');
    });

    // ── Dockerfile filtering ─────────────────────────────────────────────────

    it('only processes files named exactly "Dockerfile", not other files', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile', 'README.md', 'docker-compose.yml']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('2.0.0');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves('my commit');
        execShellStub.resolves(SHELL_OK);

        await perform();
        await flushPromises();

        // bundle update command should only appear once (for the single Dockerfile)
        const bundleUpdateCalls = execShellStub.args.filter(a => a[0].includes('bundle update'));
        assert.strictEqual(bundleUpdateCalls.length, 1);
    });

    it('skips processing when no Dockerfiles are present', async () => {
        sinon.stub(fs, 'readdirSync').returns(['README.md', 'Gemfile']);
        execShellStub.resolves(SHELL_OK);

        await perform();

        assert.ok(!execShellStub.called, 'no shell commands should run when no Dockerfiles found');
    });

    // ── Version increment logic ──────────────────────────────────────────────

    it('increments the Patch version correctly', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('1.2.3');
        const writeStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves('bump patch');
        execShellStub.resolves(SHELL_OK);

        await perform();
        await flushPromises();

        const versionWrite = writeStub.args.find(a => a[1] === '1.2.4');
        assert.ok(versionWrite, 'VERSION file should be written with 1.2.4');
    });

    it('increments the Minor version correctly and resets patch to 0', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('1.2.9');
        const writeStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Minor');
        sinon.stub(vscode.window, 'showInputBox').resolves('bump minor');
        execShellStub.resolves(SHELL_OK);

        await perform();
        await flushPromises();

        const versionWrite = writeStub.args.find(a => a[1] === '1.3.0');
        assert.ok(versionWrite, 'VERSION file should be written with 1.3.0');
    });

    it('increments the Major version correctly and resets minor and patch to 0', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('3.5.7');
        const writeStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Major');
        sinon.stub(vscode.window, 'showInputBox').resolves('major release');
        execShellStub.resolves(SHELL_OK);

        await perform();
        await flushPromises();

        const versionWrite = writeStub.args.find(a => a[1] === '4.0.0');
        assert.ok(versionWrite, 'VERSION file should be written with 4.0.0');
    });

    // ── Cancellation flows ───────────────────────────────────────────────────

    it('does not write the VERSION file or commit when the user cancels the version pick', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('1.0.0');
        const writeStub = sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves(undefined);
        sinon.stub(vscode.window, 'showInputBox');
        execShellStub.resolves(SHELL_OK);

        await perform();
        await flushPromises();

        assert.ok(!writeStub.called, 'VERSION file should not be written when version pick is cancelled');
        const gitCommitCalls = execShellStub.args.filter(a => a[0].includes('git commit'));
        assert.strictEqual(gitCommitCalls.length, 0, 'git commit should not run when version pick is cancelled');
    });

    it('does not commit when the user cancels the commit message input', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('1.0.0');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined); // cancel commit message
        execShellStub.resolves(SHELL_OK);

        await perform();
        await flushPromises();

        const gitCommitCalls = execShellStub.args.filter(a => a[0].includes('git commit'));
        assert.strictEqual(gitCommitCalls.length, 0, 'git commit should not run when commit message is cancelled');
    });

    // ── pre-compile.sh branching ─────────────────────────────────────────────

    it('runs pre-compile.sh + bundle update when pre-compile.sh exists', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(true); // pre-compile.sh exists
        sinon.stub(fs, 'readFileSync').returns('1.0.0');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves('release');
        execShellStub.resolves(SHELL_OK);

        await perform();
        await flushPromises();

        const preCompileCall = execShellStub.args.find(a => a[0].includes('pre-compile.sh'));
        assert.ok(preCompileCall, 'pre-compile.sh should be sourced when it exists');
    });

    it('runs bundle update directly when no pre-compile.sh exists', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('1.0.0');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves('release');
        execShellStub.resolves(SHELL_OK);

        await perform();
        await flushPromises();

        const bundleCall = execShellStub.args.find(a => a[0].includes('bundle update') && !a[0].includes('pre-compile'));
        assert.ok(bundleCall, 'bundle update should be called directly when no pre-compile.sh');
    });

    // ── Git command sequencing ───────────────────────────────────────────────

    it('executes git pull/fetch before reading the VERSION file', async () => {
        const callOrder = [];
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').callsFake(() => { callOrder.push('readFileSync'); return '1.0.0'; });
        sinon.stub(fs, 'writeFileSync');
        execShellStub.callsFake((cmd) => { callOrder.push(cmd); return Promise.resolve(SHELL_OK); });
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves('release');

        await perform();
        await flushPromises();

        const gitPullIdx = callOrder.findIndex(e => typeof e === 'string' && e.includes('git pull'));
        const readIdx = callOrder.findIndex(e => e === 'readFileSync');
        assert.ok(gitPullIdx !== -1, 'git pull should be called');
        assert.ok(readIdx !== -1, 'readFileSync should be called');
        assert.ok(gitPullIdx < readIdx, 'git pull should happen before reading VERSION');
    });

    it('includes git commit, tag, and push commands in the shell calls', async () => {
        sinon.stub(fs, 'readdirSync').returns(['Dockerfile']);
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'readFileSync').returns('0.0.1');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(vscode.window, 'showQuickPick').resolves('Patch');
        sinon.stub(vscode.window, 'showInputBox').resolves('my release');
        execShellStub.resolves(SHELL_OK);

        await perform();
        await flushPromises();

        const allCmds = execShellStub.args.map(a => a[0]);
        assert.ok(allCmds.some(c => c.includes('git commit')), 'should run git commit');
        assert.ok(allCmds.some(c => c.includes('git tag')), 'should run git tag');
        assert.ok(allCmds.some(c => c.includes('git push')), 'should run git push');
    });
});
