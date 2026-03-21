'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const { perform } = require('../commands/addRootAction');

const ATOM_DIR = path.resolve(__dirname, 'samples/atom');

function makeOutputChannel() {
    return { show: () => {}, appendLine: () => {}, append: () => {} };
}

describe('commands/addRootAction', () => {
    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/fake/workspace' } }];
        sinon.stub(vscode.window, 'createOutputChannel').returns(makeOutputChannel());
    });

    afterEach(() => sinon.restore());

    it('shows an error when atomDir is undefined', async () => {
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');
        await perform(undefined);
        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('right click'));
    });

    it('returns early when no workspace is open', async () => {
        vscode.workspace.workspaceFolders = undefined;
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: ATOM_DIR });
        assert.ok(!infoStub.called);
    });

    it('returns early when atomDir is not a directory', async () => {
        const gemspecPath = path.join(ATOM_DIR, 'atom.gemspec');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: gemspecPath });
        assert.ok(!infoStub.called);
    });

    it('returns early when lib/root_actions does not exist inside atomDir', async () => {
        const configDir = path.join(ATOM_DIR, 'config');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: configDir });
        assert.ok(!infoStub.called);
    });

    it('returns early when user cancels the input box', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: ATOM_DIR });
        assert.ok(!infoStub.called);
    });

    it('returns early when the root action file already exists', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves('existing_root');
        const realExistsSync = fs.existsSync.bind(fs);
        sinon.stub(fs, 'existsSync').callsFake((p) => {
            if (p.endsWith('existing_root.rb')) return true;
            return realExistsSync(p);
        });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: ATOM_DIR });
        // isFile returns true → function returns early without success message
        assert.ok(!infoStub.called);
    });

    it('creates root action files and shows success on the happy path', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves('my_root_action');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'appendFileSync');
        sinon.stub(fs, 'mkdirSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform({ fsPath: ATOM_DIR });

        assert.ok(infoStub.calledOnce, 'success message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('my_root_action'));
    });

    it('shows an error message when an unexpected exception is thrown', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves('crash_action');
        sinon.stub(fs, 'writeFileSync').throws(new Error('disk full'));
        sinon.stub(fs, 'appendFileSync');
        sinon.stub(fs, 'mkdirSync');
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform({ fsPath: ATOM_DIR });

        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('disk full'));
    });
});
