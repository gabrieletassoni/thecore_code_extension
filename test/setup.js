'use strict';

/**
 * Global test setup: intercepts require('vscode') and returns the mock.
 * This file is loaded by mocha via --require before any test file runs.
 */

const Module = require('module');
const path = require('path');

const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
    if (request === 'vscode') {
        return require(path.resolve(__dirname, 'vscode.mock'));
    }
    return originalLoad.apply(this, arguments);
};
