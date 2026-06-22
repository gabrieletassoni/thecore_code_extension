'use strict';

function createVscodeShim({ flags = {}, fix = false, cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr, exit = process.exit } = {}) {
    return {
        window: {
            showInputBox: async (opts) => {
                const value = flags[opts.prompt];
                if (opts.validateInput) {
                    const err = await opts.validateInput(value);
                    if (err) {
                        stderr.write(`error: ${err}\n`);
                        exit(1);
                        return undefined;
                    }
                }
                return value;
            },
            showErrorMessage: (msg) => { stderr.write(`${msg}\n`); return Promise.resolve(); },
            showInformationMessage: (msg) => { stdout.write(`${msg}\n`); return Promise.resolve(); },
            showWarningMessage: (msg) => { stdout.write(`${msg}\n`); return Promise.resolve(); },
            showQuickPick: (items) => fix ? Promise.resolve(items) : Promise.resolve(undefined),
            createOutputChannel: () => ({ show: () => {}, appendLine: () => {}, append: () => {} }),
        },
        workspace: {
            workspaceFolders: [{ uri: { fsPath: cwd } }],
        },
        languages: {
            createDiagnosticCollection: () => ({
                set: () => {},
                clear: () => {},
                delete: () => {},
                dispose: () => {},
            }),
        },
        DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2 },
        Position: class Position { constructor(l, c) { this.line = l; this.character = c; } },
        Range: class Range { constructor(s, e) { this.start = s; this.end = e; } },
        Diagnostic: class Diagnostic { constructor(r, m, s) { this.range = r; this.message = m; this.severity = s; } },
        Uri: { file: (p) => ({ fsPath: p }) },
        commands: { registerCommand: (_id, _handler) => ({ dispose: () => {} }) },
    };
}

module.exports = { createVscodeShim };
