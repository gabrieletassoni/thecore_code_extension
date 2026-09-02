'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const {
    writeJSONFile,
    writeYAMLFile,
    writeTextFile,
    createGitignoreFile,
    mergeYmlContent,
    insertGemIntoDevelopmentGroup,
} = require('../../libs/configs');

const LOCALES_DIR = path.resolve(__dirname, '../samples/atom/config/locales');

function oc() {
    return { appendLine: () => {}, append: () => {} };
}

describe('libs/configs', () => {
    let writeFileSyncStub;

    beforeEach(() => {
        writeFileSyncStub = sinon.stub(fs, 'writeFileSync');
    });

    afterEach(() => sinon.restore());

    // ── writeJSONFile ─────────────────────────────────────────────────────────

    describe('writeJSONFile', () => {
        it('writes to the correct path', () => {
            writeJSONFile('/some/dir', 'test.json', { a: 1 }, oc());
            const [filePath] = writeFileSyncStub.firstCall.args;
            assert.strictEqual(filePath, path.join('/some/dir', 'test.json'));
        });

        it('serialises the object as JSON', () => {
            const content = { name: 'test', value: 42 };
            writeJSONFile('/dir', 'f.json', content, oc());
            const fileContent = writeFileSyncStub.firstCall.args[1];
            assert.deepStrictEqual(JSON.parse(fileContent), content);
        });

        it('uses 4-space indentation', () => {
            writeJSONFile('/dir', 'f.json', { a: 1 }, oc());
            const fileContent = writeFileSyncStub.firstCall.args[1];
            assert.ok(fileContent.includes('    '), 'expected 4-space indentation');
        });
    });

    // ── writeYAMLFile ─────────────────────────────────────────────────────────

    describe('writeYAMLFile', () => {
        it('writes to the correct path', () => {
            writeYAMLFile('/some/dir', 'test.yml', { key: 'val' }, oc());
            const [filePath] = writeFileSyncStub.firstCall.args;
            assert.strictEqual(filePath, path.join('/some/dir', 'test.yml'));
        });

        it('produces valid YAML that round-trips to the original object', () => {
            const content = { name: 'test', nested: { key: 'value' } };
            writeYAMLFile('/dir', 't.yml', content, oc());
            const fileContent = writeFileSyncStub.firstCall.args[1];
            assert.deepStrictEqual(yaml.load(fileContent), content);
        });
    });

    // ── writeTextFile ─────────────────────────────────────────────────────────

    describe('writeTextFile', () => {
        it('writes a plain string to the correct path', () => {
            writeTextFile('/some/dir', 'test.txt', 'hello world', oc());
            const [filePath, fileContent] = writeFileSyncStub.firstCall.args;
            assert.strictEqual(filePath, path.join('/some/dir', 'test.txt'));
            assert.strictEqual(fileContent, 'hello world');
        });

        it('joins array content with newlines', () => {
            writeTextFile('/dir', 't.txt', ['line1', 'line2', 'line3'], oc());
            assert.strictEqual(writeFileSyncStub.firstCall.args[1], 'line1\nline2\nline3');
        });
    });

    // ── createGitignoreFile ───────────────────────────────────────────────────

    describe('createGitignoreFile', () => {
        it('writes a .gitignore file', () => {
            createGitignoreFile('/some/dir', oc());
            const [filePath] = writeFileSyncStub.firstCall.args;
            assert.strictEqual(filePath, path.join('/some/dir', '.gitignore'));
        });

        it('includes common ignore patterns', () => {
            createGitignoreFile('/some/dir', oc());
            const fileContent = writeFileSyncStub.firstCall.args[1];
            assert.ok(fileContent.includes('.DS_Store'));
            assert.ok(fileContent.includes('vendor/bundle'));
            assert.ok(fileContent.includes('node_modules/'));
            assert.ok(fileContent.includes('*.gem'));
        });
    });

    // ── mergeYmlContent ───────────────────────────────────────────────────────

    describe('mergeYmlContent', () => {
        it('merges an action entry into the YAML and writes the result back', () => {
            mergeYmlContent(LOCALES_DIR, 'en.yml', 'my_action', 'My Action', 'en', oc());
            assert.ok(writeFileSyncStub.called, 'writeFileSync should have been called');
            const written = writeFileSyncStub.lastCall.args[1];
            const parsed = yaml.load(written);
            assert.ok(parsed && parsed.en, 'expected "en" key in merged YAML');
            assert.strictEqual(
                parsed.en.admin.actions.my_action.menu,
                'My Action'
            );
        });

        it('supports a different root locale key', () => {
            mergeYmlContent(LOCALES_DIR, 'it.yml', 'azione', 'Azione', 'it', oc());
            const written = writeFileSyncStub.lastCall.args[1];
            const parsed = yaml.load(written);
            assert.ok(parsed && parsed.it);
            assert.strictEqual(parsed.it.admin.actions.azione.title, 'Azione');
        });
    });

    // ── insertGemIntoDevelopmentGroup ─────────────────────────────────────────

    describe('insertGemIntoDevelopmentGroup', () => {
        const GEM_LINE = 'gem "thecore_generators", "~> 3.2"';

        it('creates a new group :development block when none exists', () => {
            const result = insertGemIntoDevelopmentGroup('# Gemfile\n', GEM_LINE);
            assert.ok(result.includes('group :development do'));
            assert.ok(result.includes(`  ${GEM_LINE}`));
            assert.ok(result.includes('\nend'));
        });

        it('reuses an existing bare group :development block, appending the gem inside it', () => {
            const gemfile = [
                'source "https://rubygems.org"',
                'gem "rails"',
                '',
                'group :development do',
                '  gem "web-console"',
                'end',
                ''
            ].join('\n');
            const result = insertGemIntoDevelopmentGroup(gemfile, GEM_LINE);

            // Only one group :development block should exist afterwards.
            const blockCount = (result.match(/group :development do/g) || []).length;
            assert.strictEqual(blockCount, 1, 'should not create a second block');
            assert.ok(result.includes('gem "web-console"'), 'existing gem should be preserved');
            assert.ok(result.includes(`  ${GEM_LINE}`), 'new gem should be inserted');

            // The new gem line must appear before that block's `end`.
            const blockStart = result.indexOf('group :development do');
            const blockEnd = result.indexOf('\nend', blockStart);
            const gemIndex = result.indexOf(GEM_LINE);
            assert.ok(gemIndex > blockStart && gemIndex < blockEnd, 'gem line should be inside the block');
        });

        it('does not reuse a `group :development, :test do` block (test env must not get the gem)', () => {
            const gemfile = 'group :development, :test do\n  gem "debug"\nend\n';
            const result = insertGemIntoDevelopmentGroup(gemfile, GEM_LINE);

            // A brand-new bare :development block should be appended, the :test one left untouched.
            assert.ok(result.includes('group :development, :test do\n  gem "debug"\nend'));
            const blockCount = (result.match(/group :development do/g) || []).length;
            assert.strictEqual(blockCount, 1);
            assert.ok(result.includes(`  ${GEM_LINE}`));
        });
    });
});
