'use strict';

const assert = require('assert');
const { snakeToClassName } = require('../../libs/helpers');

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
