'use strict';

const assert = require('assert');
const sinon = require('sinon');
const vscode = require('vscode');
const { CommandRunner } = require('../../libs/commandRunner');

describe('libs/commandRunner', () => {
    afterEach(() => sinon.restore());

    // ── check() ───────────────────────────────────────────────────────────────

    describe('check()', () => {
        it('returns true when result.ok is true', () => {
            const runner = new CommandRunner({});
            assert.strictEqual(runner.check({ ok: true }), true);
        });

        it('returns false when result.ok is false', () => {
            const runner = new CommandRunner({});
            assert.strictEqual(runner.check({ ok: false, message: 'err' }, () => {}), false);
        });

        it('calls onFail with the message when result is not ok', () => {
            const runner = new CommandRunner({});
            const onFail = sinon.stub();
            runner.check({ ok: false, message: 'something went wrong' }, onFail);
            assert.ok(onFail.calledOnceWith('something went wrong'));
        });

        it('does not call onFail when result is ok', () => {
            const runner = new CommandRunner({});
            const onFail = sinon.stub();
            runner.check({ ok: true }, onFail);
            assert.ok(!onFail.called);
        });

        it('handles missing onFail without throwing', () => {
            const runner = new CommandRunner({});
            assert.doesNotThrow(() => runner.check({ ok: false, message: 'err' }));
        });
    });

    // ── input() ───────────────────────────────────────────────────────────────

    describe('input()', () => {
        it('returns the value when user provides a non-empty string', async () => {
            sinon.stub(vscode.window, 'showInputBox').resolves('MyValue');
            const runner = new CommandRunner({});
            const value = await runner.input({ prompt: 'Enter something' });
            assert.strictEqual(value, 'MyValue');
        });

        it('returns null when user cancels (showInputBox resolves undefined)', async () => {
            sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
            const runner = new CommandRunner({});
            const value = await runner.input({ prompt: 'Enter something' });
            assert.strictEqual(value, null);
        });

        it('returns null for empty input when not optional', async () => {
            sinon.stub(vscode.window, 'showInputBox').resolves('');
            const runner = new CommandRunner({});
            const value = await runner.input({ prompt: 'Enter something' });
            assert.strictEqual(value, null);
        });

        it('returns empty string for empty input when optional', async () => {
            sinon.stub(vscode.window, 'showInputBox').resolves('');
            const runner = new CommandRunner({});
            const value = await runner.input({ prompt: 'Enter something', optional: true });
            assert.strictEqual(value, '');
        });

        it('passes ignoreFocusOut, prompt, placeHolder, and validateInput to showInputBox', async () => {
            const stub = sinon.stub(vscode.window, 'showInputBox').resolves('ok');
            const validate = () => null;
            const runner = new CommandRunner({});
            await runner.input({ prompt: 'My prompt', placeHolder: 'hint', validate });
            assert.ok(stub.calledOnce);
            const [opts] = stub.firstCall.args;
            assert.strictEqual(opts.ignoreFocusOut, true);
            assert.strictEqual(opts.prompt, 'My prompt');
            assert.strictEqual(opts.placeHolder, 'hint');
            assert.strictEqual(opts.validateInput, validate);
        });
    });
});
