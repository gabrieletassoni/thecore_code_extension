'use strict';

const assert = require('assert');
const sinon = require('sinon');
const vscode = require('vscode');
const extension = require('../extension');

describe('Extension', () => {
    let registeredCommands;

    beforeEach(() => {
        registeredCommands = [];
        sinon.stub(vscode.commands, 'registerCommand').callsFake((id) => {
            registeredCommands.push(id);
            return { dispose: () => {} };
        });
    });

    afterEach(() => sinon.restore());

    // ── activate ──────────────────────────────────────────────────────────────

    describe('activate', () => {
        const EXPECTED_COMMANDS = [
            'thecore.setupDevcontainer',
            'thecore.createApp',
            'thecore.createATOM',
            'thecore.addRootAction',
            'thecore.addMemberAction',
            'thecore.addMigration',
            'thecore.addModel',
        ];

        it('registers all expected commands', () => {
            const context = { subscriptions: [] };
            extension.activate(context);

            for (const cmd of EXPECTED_COMMANDS) {
                assert.ok(
                    registeredCommands.includes(cmd),
                    `Command "${cmd}" was not registered`
                );
            }
        });

        it('pushes each registered command into context.subscriptions', () => {
            const context = { subscriptions: [] };
            extension.activate(context);
            assert.ok(context.subscriptions.length > 0, 'subscriptions should not be empty');
            assert.strictEqual(
                context.subscriptions.length,
                EXPECTED_COMMANDS.length,
                'one subscription per command'
            );
        });
    });

    // ── deactivate ────────────────────────────────────────────────────────────

    describe('deactivate', () => {
        it('runs without throwing', () => {
            assert.doesNotThrow(() => extension.deactivate());
        });
    });
});
