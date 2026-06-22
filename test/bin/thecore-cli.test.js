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

    const subcommands = [
        'setup-dev-container',
        'create-app',
        'create-atom',
        'add-model',
        'add-migration',
        'add-root-action',
        'add-member-action',
        'check-practices',
    ];

    for (const sub of subcommands) {
        it(`${sub} --help exits 0`, () => {
            const result = run(sub, '--help');
            assert.strictEqual(result.status, 0, `${sub} --help should exit 0, got:\n${result.stderr}`);
        });
    }

    const requiredFlagSubcommands = [
        { sub: 'setup-dev-container', flag: '--name' },
        { sub: 'create-atom', flag: '--name' },
        { sub: 'add-model', flag: '--name' },
        { sub: 'add-migration', flag: '--name' },
        { sub: 'add-root-action', flag: '--name' },
        { sub: 'add-member-action', flag: '--name' },
    ];

    for (const { sub, flag } of requiredFlagSubcommands) {
        it(`${sub} without ${flag} exits 1`, () => {
            const result = run(sub);
            assert.strictEqual(result.status, 1, `${sub} without ${flag} should exit 1`);
        });
    }
});
