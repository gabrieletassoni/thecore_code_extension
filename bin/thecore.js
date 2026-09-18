#!/usr/bin/env node
'use strict';

const Module = require('module');
const { Command } = require('commander');
const { version } = require('../package.json');
const { vscode, setInputAnswers } = require('./vscode-shim');

// Intercept require('vscode') for the rest of this process -- the extension's own
// command modules (commands/setupDevContainer.js today) are required unmodified
// below, after this override is installed, so their own `require('vscode')` calls
// resolve to the shim instead of failing outright (there is no real vscode module
// outside the editor). Mirrors test/setup.js's interception mechanism; see
// bin/vscode-shim.js's own header comment for why this is a separate, production
// copy rather than a shared one -- this file is a real dependency for anyone who
// installs the CLI, while test/setup.js is mocha-only.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'vscode') return vscode;
    return originalLoad.apply(this, arguments);
};

const program = new Command();

program
    .name('thecore')
    .description('Headless CLI for Thecore extension commands with no Rails-native equivalent to delegate to.')
    .version(version);

program
    .command('setup-dev-container')
    .description('Generate .devcontainer/ configuration files in the current directory (equivalent to "Thecore 3: Setup Devcontainer")')
    .requiredOption('--name <name>', 'Name of this project, e.g. "Thecore Backend"')
    .action(async (options) => {
        setInputAnswers({
            'Please enter the name of this project, i.e. Thecore Backend.': options.name
        });

        const { ExecutionContext } = require('../libs/executionContext');
        const { perform } = require('../commands/setupDevContainer');

        const ctx = new ExecutionContext('Thecore: Setup Devcontainer', undefined);
        await perform(ctx);
    });

program.parseAsync(process.argv);
