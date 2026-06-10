'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const proxyquire = require('proxyquire');

const ATOM_PARENT = '/fake/workspace/vendor/submodules';
const ATOM_DIR = `${ATOM_PARENT}/my_atom`;
const APP_DIR = '/fake/workspace';

function makeFakeChannel() {
    return { show: sinon.stub(), appendLine: sinon.stub(), append: sinon.stub() };
}

describe('libs/executionContext — CheckContext', () => {
    let execCtxModule, channel;

    beforeEach(() => {
        channel = makeFakeChannel();
        sinon.stub(vscode.window, 'createOutputChannel').returns(channel);
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: APP_DIR } }];
        execCtxModule = require('../../libs/executionContext');
    });

    afterEach(() => sinon.restore());

    describe('check.workspaceExists()', () => {
        it('returns ok:true when workspace folders exist', () => {
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.workspaceExists();
            assert.ok(result.ok);
            assert.ok(result.value);
        });

        it('returns ok:false when no workspace folders', () => {
            vscode.workspace.workspaceFolders = undefined;
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.workspaceExists();
            assert.strictEqual(result.ok, false);
            assert.ok(result.message.includes('No workspace'));
        });
    });

    describe('check.workspaceEmpty()', () => {
        it('returns ok:true with a single folder', () => {
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            assert.ok(ctx.check.workspaceEmpty().ok);
        });

        it('returns ok:false with multiple folders', () => {
            vscode.workspace.workspaceFolders = [
                { uri: { fsPath: APP_DIR } },
                { uri: { fsPath: '/other' } }
            ];
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.workspaceEmpty();
            assert.strictEqual(result.ok, false);
            assert.ok(result.message.includes('not empty'));
        });
    });

    describe('check.railsAppValid()', () => {
        it('returns ok:false when Rails dirs are missing', () => {
            sinon.stub(fs, 'existsSync').returns(false);
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.railsAppValid();
            assert.strictEqual(result.ok, false);
            assert.ok(result.message.includes('Ruby on Rails'));
        });

        it('returns ok:true and dirsObject when all dirs exist', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.railsAppValid();
            assert.ok(result.ok);
            assert.ok(result.value.workspaceRoot);
        });

        it('returns empty message when hideError=true and invalid', () => {
            sinon.stub(fs, 'existsSync').returns(false);
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.railsAppValid(true);
            assert.strictEqual(result.ok, false);
            assert.strictEqual(result.message, '');
        });
    });

    describe('check.fileExists()', () => {
        it('returns ok:true when file exists', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            assert.ok(ctx.check.fileExists('/some/file').ok);
        });

        it('returns ok:false when file missing', () => {
            sinon.stub(fs, 'existsSync').returns(false);
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.fileExists('/missing/file');
            assert.strictEqual(result.ok, false);
        });
    });

    describe('check.isDir()', () => {
        it('returns ok:true for a real directory', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'lstatSync').returns({ isDirectory: () => true });
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            assert.ok(ctx.check.isDir('/some/dir').ok);
        });

        it('returns ok:false when path is a file', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'lstatSync').returns({ isDirectory: () => false });
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            assert.strictEqual(ctx.check.isDir('/some/file').ok, false);
        });
    });

    describe('check.isFile()', () => {
        it('returns ok:true for a real file', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'lstatSync').returns({ isFile: () => true });
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            assert.ok(ctx.check.isFile('/some/file').ok);
        });
    });

    describe('check.hasGemspec()', () => {
        it('returns ok:true when exact gemspec exists', () => {
            sinon.stub(fs, 'existsSync').callsFake(p => p.endsWith('my_atom.gemspec'));
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.hasGemspec(ATOM_DIR, 'my_atom');
            assert.ok(result.ok);
            assert.ok(result.value.endsWith('.gemspec'));
        });

        it('returns ok:true for dash-to-underscore variant', () => {
            sinon.stub(fs, 'existsSync').callsFake(p => p.endsWith('my_atom.gemspec'));
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.hasGemspec(ATOM_DIR, 'my-atom');
            assert.ok(result.ok);
        });

        it('returns ok:false when neither gemspec exists', () => {
            sinon.stub(fs, 'existsSync').returns(false);
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            const result = ctx.check.hasGemspec(ATOM_DIR, 'my_atom');
            assert.strictEqual(result.ok, false);
            assert.ok(result.message.includes('gemspec'));
        });
    });

    describe('workspace', () => {
        it('is null when no folder provided', () => {
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            assert.strictEqual(ctx.workspace, null);
        });

        it('is ATOMContext when folder is inside vendor/submodules', () => {
            const ctx = new execCtxModule.ExecutionContext('Test', { fsPath: ATOM_DIR });
            assert.strictEqual(ctx.workspace.type(), 'atom');
        });

        it('is AppContext when folder is workspace root', () => {
            const ctx = new execCtxModule.ExecutionContext('Test', { fsPath: APP_DIR });
            assert.strictEqual(ctx.workspace.type(), 'app');
        });
    });

    describe('log() and show()', () => {
        it('log() appends to the channel', () => {
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            ctx.log('hello');
            assert.ok(channel.appendLine.calledWith('hello'));
        });

        it('show() reveals the channel', () => {
            const ctx = new execCtxModule.ExecutionContext('Test', undefined);
            ctx.show();
            assert.ok(channel.show.calledOnce);
        });
    });

    describe('exec()', () => {
        it('delegates to execShell with the channel', async () => {
            const execShellStub = sinon.stub().resolves('output');
            const configs = require('../../libs/configs');
            const wc = require('../../libs/workspaceContext');
            const templates = require('../../libs/templates');
            const ExecCtxWithStub = proxyquire('../../libs/executionContext', {
                './os': { execShell: execShellStub, mkDirP: sinon.stub() },
            });
            const ctx = new ExecCtxWithStub.ExecutionContext('Test', undefined);
            const result = await ctx.exec('echo hi', '/tmp');
            assert.strictEqual(result, 'output');
            assert.ok(execShellStub.calledWith('echo hi', '/tmp', sinon.match.object));
        });
    });

    describe('mkdir()', () => {
        it('delegates to mkDirP with the channel', async () => {
            const mkDirPStub = sinon.stub().resolves();
            const ExecCtxWithStub = proxyquire('../../libs/executionContext', {
                './os': { execShell: sinon.stub(), mkDirP: mkDirPStub },
            });
            const ctx = new ExecCtxWithStub.ExecutionContext('Test', undefined);
            await ctx.mkdir('/some/dir');
            assert.ok(mkDirPStub.calledWith('/some/dir', sinon.match.object));
        });
    });
});

describe('libs/executionContext — WriteContext', () => {
    let execCtxModule, channel, configsStub;

    beforeEach(() => {
        channel = { show: sinon.stub(), appendLine: sinon.stub(), append: sinon.stub() };
        sinon.stub(vscode.window, 'createOutputChannel').returns(channel);
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: APP_DIR } }];

        configsStub = {
            writeJSONFile: sinon.stub(),
            writeYAMLFile: sinon.stub(),
            writeTextFile: sinon.stub(),
            createGitignoreFile: sinon.stub(),
            mergeYmlContent: sinon.stub(),
        };

        execCtxModule = proxyquire('../../libs/executionContext', {
            './configs': configsStub,
            './templates': { renderTemplate: sinon.stub().returns('gitignore-content') },
        });
    });

    afterEach(() => sinon.restore());

    it('write.jsonFile() logs and delegates to configs.writeJSONFile', () => {
        const ctx = new execCtxModule.ExecutionContext('Test', undefined);
        ctx.write.jsonFile('/dir', 'file.json', { a: 1 });
        assert.ok(configsStub.writeJSONFile.calledWith('/dir', 'file.json', { a: 1 }));
        assert.ok(channel.appendLine.called);
    });

    it('write.yamlFile() logs and delegates to configs.writeYAMLFile', () => {
        const ctx = new execCtxModule.ExecutionContext('Test', undefined);
        ctx.write.yamlFile('/dir', 'file.yml', { key: 'val' });
        assert.ok(configsStub.writeYAMLFile.calledWith('/dir', 'file.yml', { key: 'val' }));
        assert.ok(channel.appendLine.called);
    });

    it('write.textFile() logs and delegates to configs.writeTextFile', () => {
        const ctx = new execCtxModule.ExecutionContext('Test', undefined);
        ctx.write.textFile('/dir', 'file.txt', 'content');
        assert.ok(configsStub.writeTextFile.calledWith('/dir', 'file.txt', 'content'));
        assert.ok(channel.appendLine.called);
    });

    it('write.gitignoreFile() writes the rendered shared/gitignore template', () => {
        const ctx = new execCtxModule.ExecutionContext('Test', undefined);
        ctx.write.gitignoreFile('/dir');
        assert.ok(configsStub.writeTextFile.calledWith('/dir', '.gitignore', 'gitignore-content'));
    });

    it('write.mergeYaml() delegates to configs.mergeYmlContent', () => {
        const ctx = new execCtxModule.ExecutionContext('Test', undefined);
        ctx.write.mergeYaml('/dir', 'en.yml', 'my_action', 'My Action', 'en');
        assert.ok(configsStub.mergeYmlContent.calledWith('/dir', 'en.yml', 'my_action', 'My Action', 'en'));
    });

    it('write.jsonFile() logs both start and completion messages', () => {
        const ctx = new execCtxModule.ExecutionContext('Test', undefined);
        ctx.write.jsonFile('/dir', 'f.json', {});
        assert.strictEqual(channel.appendLine.callCount, 2);
        assert.ok(channel.appendLine.firstCall.args[0].includes('Creating JSON'));
        assert.ok(channel.appendLine.secondCall.args[0].includes('created successfully'));
    });
});
