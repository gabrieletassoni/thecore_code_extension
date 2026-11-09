'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { parse: parseJsonc } = require('jsonc-parser');
const { perform } = require('../commands/setupDevContainer');
const { makeCtx, FAKE_ROOT } = require('./helpers/makeCtx');
const path = require('path');

// Runs Setup Devcontainer with "My Project" as name and returns what it wrote,
// as { fileName: content }.
async function scaffold() {
    const ctx = makeCtx();
    sinon.stub(fs, 'existsSync').returns(false);
    sinon.stub(fs, 'mkdirSync');
    sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
    sinon.stub(vscode.window, 'showInformationMessage');
    await perform(ctx);
    return Object.fromEntries(ctx.write.textFile.args.map(([, name, content]) => [name, content]));
}

// The bind mounts every Thecore devcontainer has active (thecore samples/devcontainer,
// spec #5 in thecore_devcontainer). gh/glab stay commented out (thecore ADR 0005).
const ACTIVE_MOUNTS = ['.bundle', '.gem', '.claude', '.claude.json'];

describe('commands/setupDevContainer', () => {
    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: FAKE_ROOT } }];
    });

    afterEach(() => sinon.restore());

    it('returns early when no workspace is open', async () => {
        const ctx = makeCtx();
        ctx.check.workspaceExists.returns({ ok: false, message: 'No workspace' });
        const mkdirSyncStub = sinon.stub(fs, 'mkdirSync');
        await perform(ctx);
        assert.ok(!mkdirSyncStub.called, 'should not attempt to create any directory');
    });

    it('shows a warning when .devcontainer already exists', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(true);
        const warnStub = sinon.stub(vscode.window, 'showWarningMessage');
        await perform(ctx);
        assert.ok(warnStub.calledOnce, 'showWarningMessage should be called once');
    });

    it('creates the .devcontainer directory and all required files when missing', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        // devcontainer.json, docker-compose.yml, Dockerfile, create-db-user.sql,
        // backend.code-workspace, .thecore-template-version
        assert.ok(ctx.write.textFile.callCount >= 6, 'at least 6 files should be written');
    });

    it('stamps .thecore-template-version with the extension version', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const call = ctx.write.textFile.args.find(([, name]) => name === '.thecore-template-version');
        assert.ok(call, '.thecore-template-version should be written');
        assert.strictEqual(call[2], require('../package.json').version);
    });

    it('shows an error message when directory creation throws', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync').throws(new Error('Permission denied'));
        const errorStub = sinon.stub(vscode.window, 'showErrorMessage');

        await perform(ctx);

        assert.ok(errorStub.calledOnce, 'showErrorMessage should be called on error');
        assert.ok(errorStub.firstCall.args[0].includes('Permission denied'));
    });

    it('writes a valid devcontainer.json', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const call = ctx.write.textFile.args.find(([, name]) => name === 'devcontainer.json');
        assert.ok(call, 'devcontainer.json should be written');
        const parsed = parseJsonc(call[2]);
        assert.strictEqual(parsed.name, 'My Project');
        assert.strictEqual(parsed.service, 'app');
        assert.ok(Array.isArray(parsed.customizations.vscode.extensions));
    });

    it('writes a docker-compose.yml with the rails-style project name', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const call = ctx.write.textFile.args.find(([, name]) => name === 'docker-compose.yml');
        assert.ok(call, 'docker-compose.yml should be written');
        assert.ok(call[2].includes('my_project'), 'should contain the rails-style project key');
    });

    it('writes a Dockerfile with the expected base image', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const call = ctx.write.textFile.args.find(([, name]) => name === 'Dockerfile');
        assert.ok(call, 'Dockerfile should be written');
        assert.ok(call[2].includes('gabrieletassoni/vscode-devcontainers-thecore:3'));
    });

    it('takes Claude Code skills from the host plugin, never vendored (no npx skills, no prune)', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        for (const script of ['link-host-home.sh', 'check-plugins.sh']) {
            assert.ok(ctx.write.textFile.args.find(([, name]) => name === script), `${script} should be scaffolded`);
        }

        const devcontainerCall = ctx.write.textFile.args.find(([, name]) => name === 'devcontainer.json');
        const { postCreateCommand } = parseJsonc(devcontainerCall[2]);
        assert.ok(postCreateCommand.includes(`bash .devcontainer/link-host-home.sh '\${localEnv:USER}'`));
        assert.ok(postCreateCommand.includes('bash .devcontainer/check-plugins.sh'));
        assert.ok(!postCreateCommand.includes('npx skills'), 'skills must not be vendored into the project');
        assert.ok(!postCreateCommand.includes('prune-deleted-skills.sh'), 'the image no longer ships prune-deleted-skills.sh');
    });

    it('heals containers left on a deleted network before compose starts them (initializeCommand)', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        const script = ctx.write.textFile.args.find(([, name]) => name === 'heal-stale-containers.sh');
        assert.ok(script, 'heal-stale-containers.sh should be scaffolded');
        assert.ok(script[2].includes('docker rm'), 'heal-stale-containers.sh should be the real script, not an empty file');

        const devcontainerCall = ctx.write.textFile.args.find(([, name]) => name === 'devcontainer.json');
        const { initializeCommand } = parseJsonc(devcontainerCall[2]);
        assert.ok(
            (initializeCommand || '').includes(`bash .devcontainer/heal-stale-containers.sh '\${localWorkspaceFolder}'`),
            `initializeCommand should run heal-stale-containers.sh on the workspace folder (got: ${initializeCommand})`,
        );
    });

    it('does not run a bare `bundle update --bundler` in postCreateCommand', async () => {
        const ctx = makeCtx();
        sinon.stub(fs, 'existsSync').returns(false);
        sinon.stub(fs, 'mkdirSync');
        sinon.stub(vscode.window, 'showInputBox').resolves('My Project');
        sinon.stub(vscode.window, 'showInformationMessage');

        await perform(ctx);

        // A bare `bundle update --bundler` (no explicit version) always resolves to the
        // newest version published to the gem source, prereleases included — it ignores
        // whatever stable Bundler/RubyGems version was pinned into the image (see
        // Dockerfile.dev/Dockerfile.deploy in thecore_devcontainer). That silently installs
        // a prerelease Bundler (e.g. 4.1.0.beta1) into the project's own vendor/bundle,
        // which then loads its own vendored copy of RubyGems' `uri` library alongside the
        // system one and floods every subsequent `bundle` invocation with "already
        // initialized constant Gem::URI::*" warnings.
        const devcontainerCall = ctx.write.textFile.args.find(([, name]) => name === 'devcontainer.json');
        const parsed = parseJsonc(devcontainerCall[2]);
        assert.ok(
            !/bundle update\s+--bundler(?!\S)/.test(parsed.postCreateCommand),
            'postCreateCommand should not run a bare `bundle update --bundler`'
        );
    });

    describe('the same devcontainer as the thecore samples', () => {
        it('mounts the host ~/.bundle, ~/.gem, ~/.claude and ~/.claude.json, and not the gh/glab config', async () => {
            const { mounts } = parseJsonc((await scaffold())['devcontainer.json']);
            assert.ok(Array.isArray(mounts), 'mounts should be active, not commented out');
            for (const entry of ACTIVE_MOUNTS) {
                assert.ok(
                    mounts.includes(`source=\${localEnv:HOME}/${entry},target=/home/vscode/${entry},type=bind`),
                    `~/${entry} should be bind-mounted (got: ${JSON.stringify(mounts)})`,
                );
            }
            assert.ok(!mounts.some(m => /\.config\/(gh|glab-cli)/.test(m)), 'gh/glab config mounts stay commented out');
        });

        it('creates every mounted host path in initializeCommand before healing stale containers', async () => {
            const { initializeCommand, mounts } = parseJsonc((await scaffold())['devcontainer.json']);
            const heal = initializeCommand.indexOf('bash .devcontainer/heal-stale-containers.sh');
            assert.ok(heal > 0, `initializeCommand should end by healing stale containers (got: ${initializeCommand})`);
            const prep = initializeCommand.slice(0, heal);
            for (const mount of mounts) {
                const source = mount.match(/source=([^,]+)/)[1];
                assert.ok(prep.includes(`"${source}"`), `initializeCommand should create ${source} before the heal`);
            }
            assert.ok(/mkdir -p /.test(prep), 'directories are created with mkdir -p');
            assert.ok(
                prep.includes(`[ -e "\${localEnv:HOME}/.claude.json" ] || echo '{}' > "\${localEnv:HOME}/.claude.json"`),
                '~/.claude.json is created as a JSON file, never overwritten',
            );
        });

        it('runs the app container as vscode', async () => {
            const compose = (await scaffold())['docker-compose.yml'];
            assert.match(compose, /^ {4}user: vscode$/m);
        });

        it('mounts the project at the devcontainer workspace folder', async () => {
            const files = await scaffold();
            const { workspaceFolder } = parseJsonc(files['devcontainer.json']);
            assert.strictEqual(workspaceFolder, '/workspaces/project/backend');
            assert.ok(files['docker-compose.yml'].includes(`- ..:${workspaceFolder}:cached`));
        });

        it('runs the postCreateCommand chain of the samples, multi-account script included, without --all', async () => {
            const { postCreateCommand } = parseJsonc((await scaffold())['devcontainer.json']);
            assert.strictEqual(
                postCreateCommand,
                "sudo chown -R vscode:vscode /usr/local/bundle && bundle update && bash .devcontainer/link-host-home.sh '${localEnv:USER}' && bash .devcontainer/github-accounts.sh && bash .devcontainer/check-plugins.sh",
            );
        });

        it('scaffolds every script the devcontainer runs', async () => {
            const files = await scaffold();
            const { initializeCommand, postCreateCommand } = parseJsonc(files['devcontainer.json']);
            const scripts = [...`${initializeCommand} ${postCreateCommand}`.matchAll(/\.devcontainer\/([\w-]+\.sh)/g)].map(m => m[1]);
            assert.deepStrictEqual(
                [...new Set(scripts)].sort(),
                ['check-plugins.sh', 'github-accounts.sh', 'heal-stale-containers.sh', 'link-host-home.sh'],
            );
            for (const script of scripts) {
                assert.ok(files[script], `${script} should be scaffolded`);
                assert.ok(files[script].startsWith('#!'), `${script} should be the real script`);
            }
        });

        // Byte-level parity with a local thecore checkout, like thecore_generators' S1 test:
        // runs only when THECORE_SAMPLES_DIR names a thecore `samples/` folder.
        const samplesDir = process.env.THECORE_SAMPLES_DIR;
        (samplesDir ? it : it.skip)('matches thecore samples/devcontainer except for the project name and workspace folder', async () => {
            const files = await scaffold();
            const sampleDir = path.join(samplesDir, 'devcontainer');
            const sampleFiles = fs.readdirSync(sampleDir);
            fs.existsSync.restore();
            for (const name of sampleFiles) {
                assert.ok(files[name] !== undefined, `${name} should be scaffolded`);
                const actual = files[name]
                    .replaceAll('/workspaces/project/backend', '/workspaces/app')
                    .replace('"name": "My Project"', '"name": "Thecore App"')
                    .replace('/my_project?', '/app_dev?');
                assert.strictEqual(actual, fs.readFileSync(path.join(sampleDir, name), 'utf8'), `${name} differs from the samples`);
            }
        });
    });
});
