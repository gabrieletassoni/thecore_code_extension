'use strict';

const vscode = require('vscode');
const path = require('path');
const { isPascalCase } = require('../libs/check');
const { CommandRunner } = require('../libs/commandRunner');
const { confirmAndAddThecoreGenerators } = require('../libs/thecoreGeneratorsGuard');

async function perform(ctx) {
    if (!ctx.workspace) {
        vscode.window.showErrorMessage('Please open a workspace and right click on an ATOM folder or a main app folder, then select Add migration.');
        return;
    }

    ctx.show();

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

    const isAtom = ctx.workspace.type() === 'atom';

    try {
        if (isAtom) {
            ctx.log('Adding a migration to the current ATOM.');
            const atomDir = ctx.workspace.atomDir;
            ctx.log(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);

            if (!runner.check(ctx.check.isDir(atomDir), showErr)) return;
            if (!runner.check(ctx.check.hasGemspec(atomDir, ctx.workspace.atomName), showErr)) return;
        } else {
            ctx.log('Adding a migration to the main app.');
            ctx.log('🔍 Checking if the workspace root is a valid Ruby on Rails app.');
            if (!runner.check(ctx.check.railsAppValid(), showErr)) return;
        }

        // thecore_generators must be present for plain `rails g migration` to be Thecore-aware
        // at all (see the comment further down) — check before collecting any input so a
        // dismissed prompt doesn't waste the user's typing.
        const gemfilePath = path.join(ctx.workspace.appRoot(), 'Gemfile');
        if (!ctx.check.hasThecoreGenerators(gemfilePath).ok) {
            if (!(await confirmAndAddThecoreGenerators(ctx, gemfilePath))) return;
        }

        const migrationName = await runner.input({
            prompt: 'Please enter the PascalCase name of the migration.',
            validate: (v) => (!v || !isPascalCase(v)) ? '❌ The PascalCase name is not valid. Please try again.' : null,
        });
        if (!migrationName) return;

        const migrationDefinition = await runner.input({
            prompt: 'Please enter the definition of the migration. Example: name:string age:integer',
            validate: (v) => (v && !v.match(/^(\w+:\w+\s?)+$/)) ? '❌ The migration definition is not valid. Please try again.' : null,
            optional: true,
        });

        // thecore_generators registers `config.app_generators.orm :thecore` (see
        // docs/adr/0002-thecore-generators-gem-and-generator-hook-mechanism.md in the thecore
        // repo), so plain `rails g migration` now places the migration file in the right ATOM/
        // host-app db/migrate itself — this command's only remaining job is to shell out and
        // trust it, no more `fs.renameSync` relocation step.
        //
        // See addModel.js for the `--atom=<name>`/`--non-interactive` rationale — identical here.
        const atomFlag = isAtom ? ` --atom=${ctx.workspace.atomName}` : '';
        const command = `bundle install && rails g migration "${migrationName}" ${migrationDefinition || ''}${atomFlag} --non-interactive`;

        const output = await ctx.exec(command, ctx.workspace.appRoot());

        if (!output) {
            const msg = 'No output from rails g command exists, cannot go on';
            ctx.log(`❌ ${msg}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
            return;
        }

        ctx.log(`✅ The migration ${migrationName} has been added successfully.`);
        vscode.window.showInformationMessage(`The migration ${migrationName} has been added successfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while adding the migration: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the migration: ${error.message}`);
    }
}

module.exports = { perform };
