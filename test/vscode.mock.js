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

class Position {
    constructor(line, character) {
        this.line = line;
        this.character = character;
    }
}

class Range {
    constructor(start, end) {
        this.start = start;
        this.end = end;
    }
}

class Diagnostic {
    constructor(range, message, severity) {
        this.range = range;
        this.message = message;
        this.severity = severity;
    }
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

    languages: {
        createDiagnosticCollection: (_name) => ({
            set: () => {},
            clear: () => {},
            delete: () => {},
            dispose: () => {},
        }),
    },

    Uri: {
        file: (p) => ({ fsPath: p }),
    },

    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
    },

    Position,
    Range,
    Diagnostic,
};

module.exports = mockVscode;
