'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

// Load module once while fs is unmodified — subsequent calls use the cached module
const { renderTemplate } = require('../../libs/templates');

describe('libs/templates — renderTemplate', () => {
    afterEach(() => sinon.restore());

    it('reads a template from the templates/ directory', () => {
        const readStub = sinon.stub(fs, 'readFileSync').returns('hello');
        renderTemplate('shared/gitignore');
        assert.ok(readStub.calledOnce);
        const calledPath = readStub.firstCall.args[0];
        assert.ok(calledPath.includes(path.join('templates', 'shared', 'gitignore')), `expected templates/ path, got ${calledPath}`);
    });

    it('returns the template content unchanged when no vars are provided', () => {
        sinon.stub(fs, 'readFileSync').returns('static content');
        assert.strictEqual(renderTemplate('any/file'), 'static content');
    });

    it('substitutes a single {{key}} placeholder', () => {
        sinon.stub(fs, 'readFileSync').returns('Hello {{name}}!');
        assert.strictEqual(renderTemplate('any/file', { name: 'World' }), 'Hello World!');
    });

    it('substitutes multiple different placeholders', () => {
        sinon.stub(fs, 'readFileSync').returns('{{greeting}}, {{subject}}!');
        assert.strictEqual(
            renderTemplate('any/file', { greeting: 'Hi', subject: 'there' }),
            'Hi, there!'
        );
    });

    it('replaces all occurrences of the same placeholder', () => {
        sinon.stub(fs, 'readFileSync').returns('one and one');
        // Use a template with a repeated literal to verify replaceAll behaviour
        sinon.restore();
        sinon.stub(fs, 'readFileSync').returns('{{x}} and {{x}}');
        assert.strictEqual(renderTemplate('any/file', { x: 'Y' }), 'Y and Y');
    });

    it('ignores extra vars that do not match any placeholder', () => {
        sinon.stub(fs, 'readFileSync').returns('only {{a}}');
        assert.strictEqual(renderTemplate('any/file', { a: '1', b: '2' }), 'only 1');
    });

    it('leaves unmatched placeholders intact when the key is absent from vars', () => {
        sinon.stub(fs, 'readFileSync').returns('{{missing}}');
        assert.strictEqual(renderTemplate('any/file', {}), '{{missing}}');
    });

    it('handles empty string values without error', () => {
        sinon.stub(fs, 'readFileSync').returns('prefix{{val}}suffix');
        assert.strictEqual(renderTemplate('any/file', { val: '' }), 'prefixsuffix');
    });

    it('throws when the template file does not exist', () => {
        sinon.stub(fs, 'readFileSync').throws(new Error('ENOENT: no such file'));
        assert.throws(() => renderTemplate('nonexistent/file'), /ENOENT/);
    });

    it('uses the correct path separator when building the template path', () => {
        const readStub = sinon.stub(fs, 'readFileSync').returns('');
        renderTemplate('addRootAction/action.rb');
        const calledPath = readStub.firstCall.args[0];
        assert.ok(
            calledPath.endsWith(path.join('addRootAction', 'action.rb')),
            `path should end with addRootAction${path.sep}action.rb, got ${calledPath}`
        );
    });
});
