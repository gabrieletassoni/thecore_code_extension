'use strict';

/**
 * Minimal mock of the vscode module for unit testing.
 * Tests can mutate properties directly (e.g. vscode.workspace.workspaceFolders)
 * or use sinon to stub individual methods.
 */

function makeOutputChannel() {
    return {
        show: () => {},
        appendLine: () => {},
        append: () => {},
    };
}

const mockVscode = {
    workspace: {
        workspaceFolders: [
            { uri: { fsPath: '/fake/workspace' } },
        ],
    },

    window: {
        showInformationMessage: () => Promise.resolve(undefined),
        showErrorMessage: () => Promise.resolve(undefined),
        showWarningMessage: () => Promise.resolve(undefined),
        showInputBox: () => Promise.resolve(undefined),
        showQuickPick: () => Promise.resolve(undefined),
        createOutputChannel: () => makeOutputChannel(),
    },

    commands: {
        registerCommand: (_id, _handler) => ({ dispose: () => {} }),
    },
};

module.exports = mockVscode;
