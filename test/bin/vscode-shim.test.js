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

        it('resolves the value by placeHolder when prompt is absent', async () => {
            const { shim } = makeShim({ flags: { 'Enter the name of the ATOM': 'my_atom' } });
            const result = await shim.window.showInputBox({ placeHolder: 'Enter the name of the ATOM' });
            assert.strictEqual(result, 'my_atom');
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

    describe('showQuickPick', () => {
        it('returns "Yes" when fix is true', async () => {
            const { shim } = makeShim({ fix: true });
            const result = await shim.window.showQuickPick(['Yes', 'No'], {});
            assert.strictEqual(result, 'Yes');
        });

        it('returns undefined when fix is false', async () => {
            const { shim } = makeShim({ fix: false });
            const result = await shim.window.showQuickPick(['Yes', 'No'], {});
            assert.strictEqual(result, undefined);
        });
    });

    describe('workspace', () => {
        it('workspaceFolders[0].uri.fsPath equals the cwd provided at construction', () => {
            const { shim } = makeShim({ cwd: '/my/project' });
            assert.strictEqual(shim.workspace.workspaceFolders[0].uri.fsPath, '/my/project');
        });
    });

    describe('createDiagnosticCollection + printDiagnostics', () => {
        it('printDiagnostics returns 0 and writes nothing when no violations are accumulated', () => {
            const { shim, stdout } = makeShim();
            const code = shim.printDiagnostics();
            assert.strictEqual(code, 0);
            assert.strictEqual(stdout.written, '');
        });

        it('printDiagnostics returns 1 and formats violations after collection.set() calls', () => {
            const { shim, stdout } = makeShim({ cwd: '/proj' });
            const coll = shim.languages.createDiagnosticCollection('thecore');
            const uri = shim.Uri.file('/proj/app/models/invoice.rb');
            const pos = new shim.Position(4, 0);
            const diag = new shim.Diagnostic(new shim.Range(pos, pos), 'missing include', shim.DiagnosticSeverity.Error);
            coll.set(uri, [diag]);
            const code = shim.printDiagnostics();
            assert.strictEqual(code, 1);
            assert.ok(stdout.written.includes('invoice.rb'));
            assert.ok(stdout.written.includes('missing include'));
            assert.ok(stdout.written.includes('[Error]'));
        });
    });

    describe('getExitCode', () => {
        it('returns 0 initially', () => {
            const { shim } = makeShim();
            assert.strictEqual(shim.getExitCode(), 0);
        });

        it('returns 1 after showErrorMessage is called', async () => {
            const { shim } = makeShim();
            await shim.window.showErrorMessage('oops');
            assert.strictEqual(shim.getExitCode(), 1);
        });
    });

    describe('createOutputChannel', () => {
        it('appendLine writes to stdout', () => {
            const { shim, stdout } = makeShim();
            const channel = shim.window.createOutputChannel('test');
            channel.appendLine('hello from log');
            assert.ok(stdout.written.includes('hello from log'));
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
