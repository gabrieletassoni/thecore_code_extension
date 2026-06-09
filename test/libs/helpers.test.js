'use strict';

const assert = require('assert');
const { snakeToClassName, railsStyleKey } = require('../../libs/helpers');

describe('helpers.snakeToClassName', () => {
    it('converts a single word', () => {
        assert.strictEqual(snakeToClassName('single'), 'Single');
    });

    it('converts two snake_case words', () => {
        assert.strictEqual(snakeToClassName('my_atom'), 'MyAtom');
    });

    it('converts tcp_debug', () => {
        assert.strictEqual(snakeToClassName('tcp_debug'), 'TcpDebug');
    });

    it('converts multiple underscore-separated words', () => {
        assert.strictEqual(snakeToClassName('thecore_ui_rails_admin'), 'ThecoreUiRailsAdmin');
    });
});

describe('helpers.railsStyleKey', () => {
    it('converts a two-word title to snake_case', () => {
        assert.strictEqual(railsStyleKey('My Project'), 'my_project');
    });

    it('converts a three-word title', () => {
        assert.strictEqual(railsStyleKey('Thecore Backend App'), 'thecore_backend_app');
    });

    it('handles a single word', () => {
        assert.strictEqual(railsStyleKey('Backend'), 'backend');
    });

    it('strips non-alphanumeric characters', () => {
        assert.strictEqual(railsStyleKey('My-Project!'), 'myproject');
    });
});
