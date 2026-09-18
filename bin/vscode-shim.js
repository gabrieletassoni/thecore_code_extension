'use strict';

// Production-time equivalent of test/setup.js's require('vscode') interception --
// that file mocks vscode for the test suite (in-process, mocha's own process);
// this one is the real thing, used by bin/thecore.js so the extension's own,
// unmodified command modules (commands/setupDevContainer.js today) can run outside
// VS Code entirely. Scoped to exactly the VS Code API surface those commands
// actually touch (verified against setupDevContainer.js/CommandRunner/
// ExecutionContext source directly, not assumed) -- see thecore#20's ADR 0007 and
// this ticket's own acceptance criteria for why the surface stays this narrow
// rather than reusing the original 8-command Headless CLI PRD's broader design.
//
// Touch points covered:
//   - window.createOutputChannel  (ExecutionContext's constructor calls this
//     unconditionally, for every command, not just this one)
//   - window.showErrorMessage / showInformationMessage / showWarningMessage
//   - window.showInputBox         (via CommandRunner.input)
//   - workspace.workspaceFolders  (derived from process.cwd(), not a clicked folder)

let inputAnswers = {};

// Called once by bin/thecore.js's action handler, before requiring any command
// module, so this shim already has the parsed CLI flags available by the time
// commands/*.js's own runner.input() calls showInputBox.
function setInputAnswers(answersByPrompt) {
    inputAnswers = answersByPrompt;
}

function createOutputChannel() {
    return {
        appendLine(message) {
            process.stdout.write(`${message}\n`);
        },
        show() {
            // No-op: there is no VS Code panel to reveal in a terminal -- the CLI
            // already writes everything to stdout/stderr as it happens.
        }
    };
}

function showErrorMessage(message) {
    process.stderr.write(`${message}\n`);
    // Every command in this codebase treats reaching showErrorMessage as the
    // "something went wrong" outcome (see CLAUDE.md's "Error Handling" convention)
    // -- commands/*.js's own try/catch swallows the underlying error and never lets
    // it propagate back out of perform(), so this is the one place a CLI-friendly
    // non-zero exit code can be set for a failure a command handled internally.
    process.exitCode = 1;
    return Promise.resolve(undefined);
}

function showInformationMessage(message) {
    process.stdout.write(`${message}\n`);
    return Promise.resolve(undefined);
}

function showWarningMessage(message) {
    process.stdout.write(`${message}\n`);
    return Promise.resolve(undefined);
}

async function showInputBox(options = {}) {
    const key = options.prompt || options.placeHolder;
    const hasAnswer = Object.prototype.hasOwnProperty.call(inputAnswers, key);
    const value = hasAnswer ? inputAnswers[key] : undefined;

    if (value !== undefined && typeof options.validateInput === 'function') {
        const validationError = options.validateInput(value);
        if (validationError) {
            process.stderr.write(`${validationError}\n`);
            return undefined;
        }
    }

    return value;
}

const vscode = {
    window: {
        createOutputChannel,
        showErrorMessage,
        showInformationMessage,
        showWarningMessage,
        showInputBox
    },
    workspace: {
        get workspaceFolders() {
            return [{ uri: { fsPath: process.cwd() } }];
        }
    }
};

module.exports = { vscode, setInputAnswers };
