'use strict';

const vscode = require('vscode');

class CommandRunner {
    constructor(ctx) {
        this._ctx = ctx;
    }

    check(result, onFail) {
        if (!result.ok) {
            if (typeof onFail === 'function') onFail(result.message);
            return false;
        }
        return true;
    }

    async input({ prompt, placeHolder, validate, optional = false }) {
        const value = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt,
            placeHolder,
            validateInput: validate,
        });
        if (value === undefined) return null;
        if (!optional && value === '') return null;
        return value;
    }
}

module.exports = { CommandRunner };
