'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode'); // resolved to test/vscode.mock.js via setup.js

const {
    workspaceExixtence,
    workspaceEmptiness,
    rubyOnRailsAppValidity,
    fileExistence,
    commandExistence,
    isPascalCase,
    hasGemspec,
    isDir,
    isFile,
    hasUnreplacedTokens,
    hasSkeletonMarker,
    hasThecoreGenerators,
} = require('../../libs/check');

const ATOM_DIR = path.resolve(__dirname, '../samples/atom');

describe('libs/check', () => {
    afterEach(() => sinon.restore());

    // ── workspaceExixtence ─────────────────────────────────────────────────────

    describe('workspaceExixtence', () => {
        it('returns true when workspace folders are defined', () => {
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/ws' } }];
            assert.strictEqual(workspaceExixtence(), true);
        });

        it('returns false when workspace folders are undefined', () => {
            vscode.workspace.workspaceFolders = undefined;
            assert.strictEqual(workspaceExixtence(), false);
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/ws' } }];
        });
    });

    // ── workspaceEmptiness ────────────────────────────────────────────────────

    describe('workspaceEmptiness', () => {
        afterEach(() => {
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/ws' } }];
        });

        it('returns true with exactly one workspace folder', () => {
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/ws' } }];
            assert.strictEqual(workspaceEmptiness(), true);
        });

        it('returns false with more than one workspace folder', () => {
            vscode.workspace.workspaceFolders = [
                { uri: { fsPath: '/ws1' } },
                { uri: { fsPath: '/ws2' } },
            ];
            assert.strictEqual(workspaceEmptiness(), false);
        });
    });

    // ── rubyOnRailsAppValidity ────────────────────────────────────────────────

    describe('rubyOnRailsAppValidity', () => {
        beforeEach(() => {
            vscode.workspace.workspaceFolders = [{ uri: { fsPath: '/ws' } }];
        });

        it('returns a dirs object when all required directories exist', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            const result = rubyOnRailsAppValidity(false);
            assert.ok(result, 'expected a truthy dirs object');
            assert.strictEqual(result.workspaceRoot, '/ws');
            assert.ok(result.appDir);
            assert.ok(result.vendorDir);
        });

        it('returns false when any required directory is missing', () => {
            sinon.stub(fs, 'existsSync').returns(false);
            assert.strictEqual(rubyOnRailsAppValidity(false), false);
        });

        it('returns false silently when hideErrorMessage is true', () => {
            sinon.stub(fs, 'existsSync').returns(false);
            const result = rubyOnRailsAppValidity(true);
            assert.strictEqual(result, false);
        });
    });

    // ── fileExistence ─────────────────────────────────────────────────────────

    describe('fileExistence', () => {
        it('returns true when the path exists', () => {
            sinon.stub(fs, 'existsSync').returns(true);
            assert.strictEqual(fileExistence('/some/file'), true);
        });

        it('returns false when the path does not exist', () => {
            sinon.stub(fs, 'existsSync').returns(false);
            assert.strictEqual(fileExistence('/missing'), false);
        });
    });

    // ── commandExistence ──────────────────────────────────────────────────────

    describe('commandExistence', () => {
        it('returns true for a command that is available (node)', () => {
            assert.strictEqual(commandExistence('node'), true);
        });

        it('returns false for a command that does not exist', () => {
            assert.strictEqual(
                commandExistence('definitely_not_a_real_command_xyz_999'),
                false
            );
        });
    });

    // ── isPascalCase ──────────────────────────────────────────────────────────

    describe('isPascalCase', () => {
        it('accepts a single capitalised word', () => assert.strictEqual(isPascalCase('Model'), true));
        it('accepts a compound PascalCase word', () => assert.strictEqual(isPascalCase('MyModel'), true));
        it('rejects snake_case', () => assert.strictEqual(isPascalCase('my_model'), false));
        it('rejects camelCase', () => assert.strictEqual(isPascalCase('myModel'), false));
        it('rejects ALL_CAPS', () => assert.strictEqual(isPascalCase('MY_MODEL'), false));
        it('rejects a leading-lowercase word', () => assert.strictEqual(isPascalCase('model'), false));
        it('rejects a word starting with a digit', () => assert.strictEqual(isPascalCase('1Model'), false));
        it('returns a string message for non-string input', () => {
            assert.strictEqual(typeof isPascalCase(42), 'string');
        });
    });

    // ── hasGemspec ────────────────────────────────────────────────────────────

    describe('hasGemspec', () => {
        it('returns the gemspec path when <atomName>.gemspec exists', () => {
            const result = hasGemspec(ATOM_DIR, 'atom');
            assert.ok(result, 'expected a truthy gemspec path');
            assert.ok(result.endsWith('atom.gemspec'));
        });

        it('returns false when no gemspec file can be found', () => {
            sinon.stub(fs, 'existsSync').returns(false);
            assert.strictEqual(hasGemspec('/no/gemspec', 'no_gemspec'), false);
        });

        it('finds the variant gemspec when the atom name contains dashes', () => {
            // First call: dash-named gemspec missing; second call: underscore variant present
            sinon.stub(fs, 'existsSync')
                .onFirstCall().returns(false)
                .onSecondCall().returns(true);
            const result = hasGemspec('/fake/my-atom', 'my-atom');
            assert.ok(result, 'expected variant gemspec to be found');
        });
    });

    // ── isDir ─────────────────────────────────────────────────────────────────

    describe('isDir', () => {
        it('returns true for an existing directory', () => {
            assert.strictEqual(isDir(ATOM_DIR), true);
        });

        it('returns false for a non-existent path', () => {
            assert.strictEqual(isDir('/definitely/not/there_xyz_999'), false);
        });

        it('returns false when the path points to a file', () => {
            const gemspecPath = path.join(ATOM_DIR, 'atom.gemspec');
            assert.strictEqual(isDir(gemspecPath), false);
        });
    });

    // ── hasUnreplacedTokens ───────────────────────────────────────────────────

    describe('hasUnreplacedTokens', () => {
        it('returns true when content contains a {{key}} token', () => {
            assert.strictEqual(hasUnreplacedTokens('Hello {{name}}!'), true);
        });

        it('returns true when multiple tokens are present', () => {
            assert.strictEqual(hasUnreplacedTokens('{{foo}} and {{bar}}'), true);
        });

        it('returns false when content has no tokens', () => {
            assert.strictEqual(hasUnreplacedTokens('No tokens here'), false);
        });

        it('returns false for an empty string', () => {
            assert.strictEqual(hasUnreplacedTokens(''), false);
        });
    });

    // ── hasSkeletonMarker ─────────────────────────────────────────────────────

    describe('hasSkeletonMarker', () => {
        it('returns true when the marker is present in content', () => {
            assert.strictEqual(hasSkeletonMarker('RailsAdmin::Config::Actions.add_action "foo"', 'RailsAdmin::Config::Actions.add_action'), true);
        });

        it('returns false when the marker is absent', () => {
            assert.strictEqual(hasSkeletonMarker('some other content', 'RailsAdmin::Config::Actions.add_action'), false);
        });

        it('returns false for an empty content string', () => {
            assert.strictEqual(hasSkeletonMarker('', 'http_methods'), false);
        });

        it('returns true for a multi-word marker found mid-content', () => {
            assert.strictEqual(hasSkeletonMarker('line1\nhttp_methods [:get]\nline3', 'http_methods'), true);
        });
    });

    // ── isFile ────────────────────────────────────────────────────────────────

    describe('isFile', () => {
        const gemspecPath = path.join(ATOM_DIR, 'atom.gemspec');

        it('returns true for an existing file', () => {
            assert.strictEqual(isFile(gemspecPath), true);
        });

        it('returns false for a non-existent path', () => {
            assert.strictEqual(isFile('/definitely/not/there_xyz_999'), false);
        });

        it('returns false when the path points to a directory', () => {
            assert.strictEqual(isFile(ATOM_DIR), false);
        });
    });

    // ── hasThecoreGenerators ──────────────────────────────────────────────────

    describe('hasThecoreGenerators', () => {
        it('detects a bare double-quoted gem line', () => {
            assert.strictEqual(hasThecoreGenerators('gem "thecore_generators", "~> 3.2"'), true);
        });

        it('detects a single-quoted gem line', () => {
            assert.strictEqual(hasThecoreGenerators("gem 'thecore_generators', '~> 3.2'"), true);
        });

        it('detects a gem line with no version constraint', () => {
            assert.strictEqual(hasThecoreGenerators('gem "thecore_generators"'), true);
        });

        it('detects the gem line inside a group block', () => {
            const gemfile = 'source "https://rubygems.org"\n\ngroup :development do\n  gem "thecore_generators", "~> 3.2"\nend\n';
            assert.strictEqual(hasThecoreGenerators(gemfile), true);
        });

        it('returns false when the gem is absent from the Gemfile', () => {
            assert.strictEqual(hasThecoreGenerators('source "https://rubygems.org"\ngem "rails"\n'), false);
        });

        it('returns false for an empty Gemfile', () => {
            assert.strictEqual(hasThecoreGenerators(''), false);
        });
    });
});
