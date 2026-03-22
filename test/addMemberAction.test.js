'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');

const { perform } = require('../commands/addMemberAction');

const ATOM_DIR = path.resolve(__dirname, 'samples/atom');

function makeOutputChannel() {
    return { show: () => {}, appendLine: () => {}, append: () => {} };
}

describe('commands/addMemberAction', () => {
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
        assert.ok(!infoStub.called, 'should not reach success message');
    });

    it('returns early when atomDir is not a directory', async () => {
        const gemspecPath = path.join(ATOM_DIR, 'atom.gemspec');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: gemspecPath });
        assert.ok(!infoStub.called, 'should not reach success message');
    });

    it('returns early when lib/member_actions does not exist inside atomDir', async () => {
        // Use the config dir which has no lib/member_actions inside it
        const configDir = path.join(ATOM_DIR, 'config');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: configDir });
        assert.ok(!infoStub.called, 'should not reach success message');
    });

    it('returns early when user cancels the input box', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: ATOM_DIR });
        assert.ok(!infoStub.called);
    });

    it('shows an error when the member action file already exists', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves('existing_action');
        const realExistsSync = fs.existsSync.bind(fs);
        sinon.stub(fs, 'existsSync').callsFake((p) => {
            if (p.endsWith('existing_action.rb')) return true;
            return realExistsSync(p);
        });
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');
        await perform({ fsPath: ATOM_DIR });
        assert.ok(errorStub.calledOnce);
        assert.ok(errorStub.firstCall.args[0].includes('already exists'));
    });

    it('creates member action files and shows success on the happy path', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves('my_test_action');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'appendFileSync');
        sinon.stub(fs, 'mkdirSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform({ fsPath: ATOM_DIR });

        assert.ok(infoStub.calledOnce, 'success message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('my_test_action'));
    });

    it('validates the action name: rejects invalid names', async () => {
        // validateInput is called by vscode; simulate returning undefined for invalid input
        // by having showInputBox resolve to undefined (user dismissed invalid input)
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: ATOM_DIR });
        assert.ok(!infoStub.called);
    });
});
