'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const CLI = path.resolve(__dirname, '../../bin/thecore.js');

function run(...args) {
    return spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

describe('bin/thecore CLI', () => {
    it('--help exits 0', () => {
        const result = run('--help');
        assert.strictEqual(result.status, 0);
    });

    it('--version exits 0 and prints the package version', () => {
        const { version } = require('../../package.json');
        const result = run('--version');
        assert.strictEqual(result.status, 0);
        assert.ok(result.stdout.includes(version), `expected ${version} in output`);
    });

    it('unknown subcommand exits 1', () => {
        const result = run('not-a-command');
        assert.strictEqual(result.status, 1);
    });
});
