'use strict';

const vscode = require('vscode');
const path = require('path');
const { CommandRunner } = require('../libs/commandRunner');
const { confirmAndAddThecoreGenerators } = require('../libs/thecoreGeneratorsGuard');

async function perform(ctx) {
    if (!ctx.workspace) {
        vscode.window.showErrorMessage('Please open a workspace and right click on an ATOM folder or a main app folder, then select Add collection action.');
        return;
    }

    ctx.show();

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

    const isAtom = ctx.workspace.type() === 'atom';

    // Same shape as addRootAction.js/addMemberAction.js (see CLAUDE.md's "try/catch scope"
    // note): only the initial workspaceExists check sits outside the try.
    try {
        if (isAtom) {
            ctx.log('Adding a collection action to the current ATOM.');
            const atomDir = ctx.workspace.atomDir;
            ctx.log(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);

            if (!runner.check(ctx.check.isDir(atomDir), showErr)) return;
            if (!runner.check(ctx.check.hasGemspec(atomDir, ctx.workspace.atomName), showErr)) return;
        } else {
            ctx.log('Adding a collection action to the main app.');
            ctx.log('🔍 Checking if the workspace root is a valid Ruby on Rails app.');
            if (!runner.check(ctx.check.railsAppValid(), showErr)) return;
        }

        // thecore_generators must be present for `rails g thecore:collection_action` to exist at
        // all — checked before collecting any input, like the other generator commands.
        const gemfilePath = path.join(ctx.workspace.appRoot(), 'Gemfile');
        if (!ctx.check.hasThecoreGenerators(gemfilePath).ok) {
            if (!(await confirmAndAddThecoreGenerators(ctx, gemfilePath))) return;
        }

        const collectionActionName = await runner.input({
            prompt: 'Please enter the snake_case name of the collection action.',
            validate: (v) => (!v || !v.match(/^[a-z0-9_]+$/)) ? '❌ The snake_case name is not valid. Please try again.' : null,
        });
        if (!collectionActionName) {
            ctx.log('❌ The collection action name is not valid. Please try again.');
            return;
        }

        const collectionActionFile = path.join(ctx.workspace.collectionActionsDir(), `${collectionActionName}.rb`);
        if (ctx.check.isFile(collectionActionFile).ok) {
            ctx.log(`❌ The collection action ${collectionActionName} already exists. Please try again.`);
            vscode.window.showErrorMessage(`The collection action ${collectionActionName} already exists. Please try again.`);
            return;
        }

        // thecore_generators (>= 3.9.0, thecore_generators#21) ships
        // `rails generate thecore:collection_action`: the action file, its view/JS/SCSS
        // companions, the after_initialize.rb require line, the assets.rb precompile line and
        // locale entries, with the same ATOM-aware placement as the root/member generators.
        const atomFlag = isAtom ? ` --atom=${ctx.workspace.atomName}` : '';
        const command = `bundle install && rails g thecore:collection_action "${collectionActionName}"${atomFlag} --non-interactive`;

        const output = await ctx.exec(command, ctx.workspace.appRoot());

        if (!output) {
            const msg = 'No output from rails g command exists, cannot go on';
            ctx.log(`❌ ${msg}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
            return;
        }

        ctx.log(`✅ The collection action ${collectionActionName} has been added successfully.`);
        vscode.window.showInformationMessage(`The collection action ${collectionActionName} has been added successfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while adding the collection action: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the collection action: ${error.message}`);
    }
}

module.exports = { perform };
