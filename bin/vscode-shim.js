'use strict';

function createVscodeShim({ flags = {}, fix = false, cwd = process.cwd(), stdout = process.stdout, stderr = process.stderr, exit = process.exit } = {}) {
    let hasError = false;
    const allDiagnostics = [];
    const severityLabel = (s) => s === 0 ? 'Error' : 'Warning';
    const shim = {
        getExitCode: () => hasError ? 1 : 0,
        printDiagnostics: () => {
            if (allDiagnostics.length === 0) return 0;
            for (const { uri, diagnostic } of allDiagnostics) {
                const line = diagnostic.range ? diagnostic.range.start.line : 0;
                stdout.write(`${uri.fsPath}:${line}: [${severityLabel(diagnostic.severity)}] ${diagnostic.message}\n`);
            }
            return 1;
        },
        window: {
            showInputBox: async (opts) => {
                const value = flags[opts.prompt || opts.placeHolder];
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
            showErrorMessage: (msg) => { hasError = true; stderr.write(`${msg}\n`); return Promise.resolve(); },
            showInformationMessage: (msg) => { stdout.write(`${msg}\n`); return Promise.resolve(); },
            showWarningMessage: (msg) => { stdout.write(`${msg}\n`); return Promise.resolve(); },
            showQuickPick: (items) => fix ? Promise.resolve(items[0]) : Promise.resolve(undefined),
            createOutputChannel: () => ({
                show: () => {},
                appendLine: (msg) => { stdout.write(`${msg}\n`); },
                append: (msg) => { stdout.write(msg); },
            }),
        },
        workspace: {
            workspaceFolders: [{ uri: { fsPath: cwd } }],
        },
        languages: {
            createDiagnosticCollection: () => ({
                set: (uri, diagnostics) => {
                    for (const d of diagnostics) allDiagnostics.push({ uri, diagnostic: d });
                },
                clear: () => { allDiagnostics.length = 0; },
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
    return shim;
}

module.exports = { createVscodeShim };
