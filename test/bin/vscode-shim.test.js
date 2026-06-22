'use strict';

const assert = require('assert');
const { createVscodeShim } = require('../../bin/vscode-shim');

function makeShim(overrides = {}) {
    const stderr = { written: '', write(s) { this.written += s; } };
    const stdout = { written: '', write(s) { this.written += s; } };
    const exits = [];
    return {
        shim: createVscodeShim({
            flags: {},
            fix: false,
            cwd: '/fake/cwd',
            stdout,
            stderr,
            exit: (code) => exits.push(code),
            ...overrides,
        }),
        stderr,
        stdout,
        exits,
    };
}

describe('bin/vscode-shim', () => {
    describe('showInputBox', () => {
        it('resolves the value from the flags map by prompt text', async () => {
            const { shim } = makeShim({ flags: { 'Model name (PascalCase)': 'Invoice' } });
            const result = await shim.window.showInputBox({ prompt: 'Model name (PascalCase)' });
            assert.strictEqual(result, 'Invoice');
        });

        it('calls exit(1) and writes to stderr when validateInput returns an error string', async () => {
            const { shim, stderr, exits } = makeShim({ flags: { 'Model name': 'bad name' } });
            await shim.window.showInputBox({
                prompt: 'Model name',
                validateInput: (v) => v.includes(' ') ? 'no spaces allowed' : null,
            });
            assert.ok(exits.includes(1), 'should exit 1');
            assert.ok(stderr.written.includes('no spaces allowed'), 'should write validation error to stderr');
        });

        it('resolves the value normally when validateInput returns null', async () => {
            const { shim, exits } = makeShim({ flags: { 'Model name': 'Invoice' } });
            const result = await shim.window.showInputBox({
                prompt: 'Model name',
                validateInput: () => null,
            });
            assert.strictEqual(result, 'Invoice');
            assert.strictEqual(exits.length, 0, 'should not exit');
        });
    });

    describe('workspace', () => {
        it('workspaceFolders[0].uri.fsPath equals the cwd provided at construction', () => {
            const { shim } = makeShim({ cwd: '/my/project' });
            assert.strictEqual(shim.workspace.workspaceFolders[0].uri.fsPath, '/my/project');
        });
    });

    describe('message methods', () => {
        it('showErrorMessage writes to stderr', async () => {
            const { shim, stderr } = makeShim();
            await shim.window.showErrorMessage('something went wrong');
            assert.ok(stderr.written.includes('something went wrong'));
        });

        it('showInformationMessage writes to stdout', async () => {
            const { shim, stdout } = makeShim();
            await shim.window.showInformationMessage('all good');
            assert.ok(stdout.written.includes('all good'));
        });

        it('showWarningMessage writes to stdout', async () => {
            const { shim, stdout } = makeShim();
            await shim.window.showWarningMessage('heads up');
            assert.ok(stdout.written.includes('heads up'));
        });
    });
});
