'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');

const {
    confirmAndAddThecoreGenerators,
    GEM_LINE,
    ACTION_LABEL,
} = require('../../libs/thecoreGeneratorsGuard');

const GEMFILE_PATH = '/fake/workspace/Gemfile';

function makeCtx(overrides = {}) {
    return {
        log: sinon.stub(),
        exec: sinon.stub().resolves('bundled'),
        workspace: { appRoot: () => '/fake/workspace' },
        ...overrides,
    };
}

describe('libs/thecoreGeneratorsGuard', () => {
    afterEach(() => sinon.restore());

    it('returns false and does not touch the Gemfile or bundle install when the prompt is dismissed', async () => {
        sinon.stub(vscode.window, 'showWarningMessage').resolves(undefined);
        const writeStub = sinon.stub(fs, 'writeFileSync');
        const ctx = makeCtx();

        const result = await confirmAndAddThecoreGenerators(ctx, GEMFILE_PATH);

        assert.strictEqual(result, false);
        assert.ok(!writeStub.called, 'Gemfile should not be patched when dismissed');
        assert.ok(!ctx.exec.called, 'bundle install should not run when dismissed');
    });

    it('patches the Gemfile inside a new group :development block and runs bundle install on confirmation', async () => {
        sinon.stub(vscode.window, 'showWarningMessage').resolves(ACTION_LABEL);
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'readFileSync').returns('# Gemfile\n');
        const writeStub = sinon.stub(fs, 'writeFileSync');
        const ctx = makeCtx();

        const result = await confirmAndAddThecoreGenerators(ctx, GEMFILE_PATH);

        assert.strictEqual(result, true);
        assert.ok(writeStub.calledOnce);
        const [writtenPath, writtenContent] = writeStub.firstCall.args;
        assert.strictEqual(writtenPath, GEMFILE_PATH);
        assert.ok(writtenContent.includes('group :development do'));
        assert.ok(writtenContent.includes(GEM_LINE));
        assert.ok(ctx.exec.calledOnceWith('bundle install', '/fake/workspace'));
    });

    it('reuses an existing group :development block instead of creating a second one', async () => {
        sinon.stub(vscode.window, 'showWarningMessage').resolves(ACTION_LABEL);
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'readFileSync').returns('group :development do\n  gem "web-console"\nend\n');
        const writeStub = sinon.stub(fs, 'writeFileSync');
        const ctx = makeCtx();

        await confirmAndAddThecoreGenerators(ctx, GEMFILE_PATH);

        const writtenContent = writeStub.firstCall.args[1];
        const blockCount = (writtenContent.match(/group :development do/g) || []).length;
        assert.strictEqual(blockCount, 1);
        assert.ok(writtenContent.includes('gem "web-console"'));
        assert.ok(writtenContent.includes(GEM_LINE));
    });

    it('treats a missing Gemfile as empty content rather than throwing', async () => {
        sinon.stub(vscode.window, 'showWarningMessage').resolves(ACTION_LABEL);
        sinon.stub(fs, 'existsSync').returns(false);
        const writeStub = sinon.stub(fs, 'writeFileSync');
        const ctx = makeCtx();

        const result = await confirmAndAddThecoreGenerators(ctx, GEMFILE_PATH);

        assert.strictEqual(result, true);
        assert.ok(writeStub.calledOnce);
    });
});
