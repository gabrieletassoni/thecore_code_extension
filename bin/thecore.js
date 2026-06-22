#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const Module = require('module');
const { version } = require('../package.json');
const { createVscodeShim } = require('./vscode-shim');

const program = new Command();

program
    .name('thecore')
    .description('Headless CLI for scaffolding Thecore 3 Rails applications and ATOMs')
    .version(version);

function installShim(shim) {
    const original = Module._load;
    Module._load = function (request, parent, isMain) {
        if (request === 'vscode') return shim;
        return original.apply(this, arguments);
    };
}

async function runCommand(commandName, flags, fix = false) {
    const shim = createVscodeShim({ flags, fix, cwd: process.cwd() });
    installShim(shim);
    const { ExecutionContext } = require('../libs/executionContext');
    const { perform } = require(`../commands/${commandName}`);
    const ctx = new ExecutionContext(`Thecore: ${commandName}`, { fsPath: process.cwd() });
    await perform(ctx);
    return shim;
}

// setup-dev-container
program
    .command('setup-dev-container')
    .description('Generate .devcontainer configuration for the current workspace')
    .requiredOption('--name <name>', 'Project name, e.g. "Thecore Backend"')
    .action(async (opts) => {
        const shim = await runCommand('setupDevContainer', {
            'Please enter the name of this project, i.e. Thecore Backend.': opts.name,
        });
        process.exit(shim.getExitCode());
    });

// create-app
program
    .command('create-app')
    .description('Scaffold a new Thecore 3 Rails application in the current directory')
    .action(async () => {
        const shim = await runCommand('createApp', {});
        process.exit(shim.getExitCode());
    });

// create-atom
program
    .command('create-atom')
    .description('Create a new ATOM (Rails engine) under vendor/submodules/')
    .requiredOption('--name <name>', 'ATOM name, e.g. "TCP Debugger"')
    .requiredOption('--summary <summary>', 'One-line summary of the ATOM')
    .requiredOption('--description <description>', 'Full description of the ATOM')
    .requiredOption('--author <author>', 'Author name, e.g. "Alchemic IT"')
    .requiredOption('--email <email>', 'Author email address')
    .requiredOption('--url <url>', 'Homepage URL (must start with http)')
    .action(async (opts) => {
        const shim = await runCommand('createATOM', {
            'Enter the name of the submodule, i.e. TCP Debugger': opts.name,
            'Enter the summary of the submodule, i.e. TCP Debugger': opts.summary,
            'Enter the description of the submodule, i.e. TCP Debugger': opts.description,
            'Enter the author of the submodule, i.e. Alchemic IT': opts.author,
            'Enter the email of the submodule author': opts.email,
            'Enter the url of the submodule': opts.url,
        });
        process.exit(shim.getExitCode());
    });

// add-model
program
    .command('add-model')
    .description('Generate a Rails model with migration and Thecore concern structure')
    .requiredOption('--name <name>', 'Model name in PascalCase, e.g. Invoice')
    .option('--fields <fields>', 'Field definitions, e.g. "amount:decimal due_date:date"')
    .action(async (opts) => {
        const shim = await runCommand('addModel', {
            'Please enter the PascalCase name of the model.': opts.name,
            'Please enter the definition of the migration. Example: name:string age:integer': opts.fields,
        });
        process.exit(shim.getExitCode());
    });

// add-migration
program
    .command('add-migration')
    .description('Generate a database migration')
    .requiredOption('--name <name>', 'Migration name in PascalCase, e.g. AddDueDateToInvoices')
    .option('--fields <fields>', 'Field definitions, e.g. "due_date:date"')
    .action(async (opts) => {
        const shim = await runCommand('addMigration', {
            'Please enter the PascalCase name of the migration.': opts.name,
            'Please enter the definition of the migration. Example: name:string age:integer': opts.fields,
        });
        process.exit(shim.getExitCode());
    });

// add-root-action
program
    .command('add-root-action')
    .description('Generate a Root Action with all Action Companions')
    .requiredOption('--name <name>', 'Action name in snake_case, e.g. my_dashboard')
    .action(async (opts) => {
        const shim = await runCommand('addRootAction', {
            'Please enter the snake_case name of the root action.': opts.name,
        });
        process.exit(shim.getExitCode());
    });

// add-member-action
program
    .command('add-member-action')
    .description('Generate a Member Action with all Action Companions')
    .requiredOption('--name <name>', 'Action name in snake_case, e.g. approve')
    .action(async (opts) => {
        const shim = await runCommand('addMemberAction', {
            'Please enter the snake_case name of the member action.': opts.name,
        });
        process.exit(shim.getExitCode());
    });

// check-practices
program
    .command('check-practices')
    .description('Audit the target for Thecore structural conventions and report Violations')
    .option('--fix', 'Automatically apply all Fixable Violations without prompting')
    .action(async (opts) => {
        const shim = await runCommand('checkPractices', {}, opts.fix || false);
        const exitCode = shim.printDiagnostics();
        process.exit(exitCode);
    });

program.on('command:*', () => {
    process.stderr.write(`error: unknown subcommand '${program.args[0]}'\n`);
    process.stderr.write(`Run 'thecore --help' for available subcommands.\n`);
    process.exit(1);
});

program.parse(process.argv);
