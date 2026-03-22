'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const proxyquire = require('proxyquire');

const ATOM_DIR = path.resolve(__dirname, 'samples/atom');
// A directory that looks like vendor/submodules/<atom> (ATOM context)
// We simulate this by using ATOM_DIR as the clicked dir while its parent
// path ends with vendor/submodules (stubbed through the regex in addModel.js).

function makeOutputChannel() {
    return { show: () => {}, appendLine: () => {}, append: () => {} };
}

describe('commands/addModel', () => {
    let execShellStub, mkDirPStub, perform;

    before(() => {
        execShellStub = sinon.stub();
        mkDirPStub = sinon.stub();
        perform = proxyquire('../commands/addModel', {
            '../libs/os': { execShell: execShellStub, mkDirP: mkDirPStub },
        }).perform;
    });

    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/fake/workspace' } }];
        sinon.stub(vscode.window, 'createOutputChannel').returns(makeOutputChannel());
        execShellStub.reset();
        mkDirPStub.reset();
    });

    afterEach(() => sinon.restore());

    it('shows an error when clickedDir is undefined', async () => {
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

    it('returns early when clickedDir is not a directory', async () => {
        const filePath = path.join(ATOM_DIR, 'atom.gemspec');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform({ fsPath: filePath });
        assert.ok(!infoStub.called);
    });

    it('returns early when user cancels model name input', async () => {
        sinon.stub(vscode.window, 'showInputBox').resolves(undefined);
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        // Use the workspace root so RoR validity is tested (stub existsSync to pass)
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'lstatSync').returns({ isDirectory: () => true });
        await perform({ fsPath: '/fake/workspace' });
        assert.ok(!infoStub.called);
    });

    it('shows an error when execShell produces no output', async () => {
        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('MyModel')
            .onSecondCall().resolves('name:string');
        execShellStub.resolves(null);
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'lstatSync').returns({ isDirectory: () => true });
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform({ fsPath: '/fake/workspace' });

        assert.ok(errorStub.calledOnce);
    });

    it('shows success when model and migration files are created in the main app', async () => {
        const output = [
            '      create  db/migrate/20240101000000_create_my_model.rb',
            '      create  app/models/my_model.rb',
        ].join('\n');

        sinon.stub(vscode.window, 'showInputBox')
            .onFirstCall().resolves('MyModel')
            .onSecondCall().resolves('name:string');
        execShellStub.resolves(output);
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'lstatSync').returns({ isDirectory: () => true });
        sinon.stub(fs, 'readFileSync').returns('class MyModel < ApplicationRecord\nend\n');
        sinon.stub(fs, 'writeFileSync');
        sinon.stub(fs, 'renameSync');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');

        await perform({ fsPath: '/fake/workspace' });

        assert.ok(infoStub.calledOnce, 'success message should be shown');
        assert.ok(infoStub.firstCall.args[0].includes('MyModel'));
    });
});
