'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

// This test spawns the CLI as a REAL subprocess rather than requiring bin/thecore.js
// in-process, deliberately -- bin/thecore.js installs a process-wide Module._load
// override so commands/setupDevContainer.js's own require('vscode') resolves to
// bin/vscode-shim.js instead of failing outright. That override is a one-way,
// permanent change for the life of the process it's installed in: requiring
// bin/thecore.js in-process here would leave every *other* test file in this same
// mocha run (all of which rely on test/setup.js's own vscode mock) silently
// talking to the production shim instead, for the rest of the suite. A subprocess
// fully contains that side effect to a throwaway child process, the same reasoning
// thecore_generators' own app_template_test.rb already applies to its Open3-spawned
// `rails new -m` runs for an analogous process-boundary reason.
const CLI_PATH = path.join(__dirname, '..', '..', 'bin', 'thecore.js');

function runCli(args, cwd) {
    try {
        const stdout = execFileSync('node', [CLI_PATH, ...args], { cwd, encoding: 'utf8' });
        return { status: 0, stdout, stderr: '' };
    } catch (error) {
        // execFileSync throws on a non-zero exit; the actual status/stdout/stderr are
        // still available on the error object.
        return { status: error.status, stdout: error.stdout || '', stderr: error.stderr || '' };
    }
}

describe('bin/thecore.js (headless CLI)', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thecore-cli-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('exits 1 with a usage error on stderr when --name is missing', () => {
        const { status, stdout, stderr } = runCli(['setup-dev-container'], tmpDir);

        assert.strictEqual(status, 1);
        assert.strictEqual(stdout, '', 'no output should go to stdout on a usage error');
        assert.match(stderr, /--name/, 'the error should mention the missing flag');
        assert.ok(!fs.existsSync(path.join(tmpDir, '.devcontainer')), 'nothing should be written');
    });

    it('lists setup-dev-container in the top-level --help output', () => {
        const { status, stdout } = runCli(['--help'], tmpDir);

        assert.strictEqual(status, 0);
        assert.match(stdout, /setup-dev-container/);
    });

    it('lists --name as an option in the subcommand --help output', () => {
        const { status, stdout } = runCli(['setup-dev-container', '--help'], tmpDir);

        assert.strictEqual(status, 0);
        assert.match(stdout, /--name <name>/);
    });

    it('generates the full .devcontainer/ tree in cwd and exits 0', () => {
        const { status, stdout } = runCli(['setup-dev-container', '--name', 'My Project'], tmpDir);

        assert.strictEqual(status, 0, `expected a clean exit:\n${stdout}`);

        const devcontainerDir = path.join(tmpDir, '.devcontainer');
        for (const file of ['devcontainer.json', 'docker-compose.yml', 'Dockerfile', 'create-db-user.sql', 'backend.code-workspace', '.thecore-template-version']) {
            assert.ok(fs.existsSync(path.join(devcontainerDir, file)), `expected .devcontainer/${file} to be created`);
        }

        const devcontainerJson = fs.readFileSync(path.join(devcontainerDir, 'devcontainer.json'), 'utf8');
        assert.match(devcontainerJson, /My Project/, 'the --name value should flow through to the generated file, same as the VS Code dialog path');
    });

    it('shows a warning (not an error) and exits 0 when .devcontainer already exists', () => {
        fs.mkdirSync(path.join(tmpDir, '.devcontainer'));

        const { status, stdout, stderr } = runCli(['setup-dev-container', '--name', 'My Project'], tmpDir);

        assert.strictEqual(status, 0, 'an already-existing .devcontainer is a benign early return, not a failure');
        assert.match(stdout, /already exists/);
        assert.strictEqual(stderr, '', 'a warning is not an error -- nothing should go to stderr');
    });
});
