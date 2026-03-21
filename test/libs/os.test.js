'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { execShell, mkDirP } = require('../../libs/os');

function oc() {
    return { appendLine: () => {}, append: () => {} };
}

describe('libs/os', () => {
    afterEach(() => sinon.restore());

    // ── execShell ─────────────────────────────────────────────────────────────

    describe('execShell', () => {
        it('resolves with stdout when the command succeeds', async () => {
            const result = await execShell('echo thecore_test', os.tmpdir(), oc());
            assert.ok(result.includes('thecore_test'), `unexpected stdout: ${result}`);
        });

        it('rejects when the command exits with a non-zero code', async () => {
            await assert.rejects(
                execShell('node -e "process.exit(1)"', os.tmpdir(), oc()),
                (err) => err !== null
            );
        });
    });

    // ── mkDirP ────────────────────────────────────────────────────────────────

    describe('mkDirP', () => {
        let tmpDir;

        beforeEach(() => {
            tmpDir = path.join(os.tmpdir(), `thecore_mkdirp_${Date.now()}_${Math.random().toString(36).slice(2)}`);
        });

        afterEach(() => {
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
        });

        it('creates the directory when it does not exist', () => {
            mkDirP(tmpDir, oc());
            assert.ok(fs.existsSync(tmpDir), 'directory should exist after mkDirP');
            assert.ok(fs.statSync(tmpDir).isDirectory());
        });

        it('creates a .keep file inside the new directory', () => {
            mkDirP(tmpDir, oc());
            assert.ok(fs.existsSync(path.join(tmpDir, '.keep')), '.keep file should exist');
        });

        it('does not call mkdirSync when the directory already exists', () => {
            fs.mkdirSync(tmpDir, { recursive: true });
            const spy = sinon.spy(fs, 'mkdirSync');
            mkDirP(tmpDir, oc());
            assert.ok(!spy.called, 'mkdirSync should not be called for an existing directory');
        });
    });
});
