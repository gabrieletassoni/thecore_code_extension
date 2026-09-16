'use strict';

const vscode = require('vscode');
const path = require('path');
const { CommandRunner } = require('../libs/commandRunner');
const { confirmAndAddThecoreGenerators } = require('../libs/thecoreGeneratorsGuard');

async function perform(ctx) {
    if (!ctx.workspace) {
        vscode.window.showErrorMessage('Please open a workspace and right click on an ATOM folder or a main app folder, then select Add Root Action.');
        return;
    }

    ctx.show();

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

    const isAtom = ctx.workspace.type() === 'atom';

    // Everything below runs inside try/catch, matching addMigration.js (not addModel.js, which
    // leaves its own guard checks/input collection outside try — see CLAUDE.md's "Command
    // Structure"/"Error Handling" conventions: only the initial workspaceExists check sits
    // outside it). perform() is never awaited/caught by extension.js, so anything thrown outside
    // this try would surface as a silent, un-logged rejection instead of the usual
    // ctx.log/showErrorMessage pair — real I/O happens as early as the thecore_generators guard
    // below (Gemfile read/write, `bundle install`), not just in the final `rails g` call.
    try {
        if (isAtom) {
            ctx.log('Adding a root action to the current ATOM.');
            const atomDir = ctx.workspace.atomDir;
            ctx.log(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);

            if (!runner.check(ctx.check.isDir(atomDir), showErr)) return;
            if (!runner.check(ctx.check.hasGemspec(atomDir, ctx.workspace.atomName), showErr)) return;
        } else {
            ctx.log('Adding a root action to the main app.');
            ctx.log('🔍 Checking if the workspace root is a valid Ruby on Rails app.');
            if (!runner.check(ctx.check.railsAppValid(), showErr)) return;
        }

        // thecore_generators must be present for `rails g thecore:root_action` to exist at all
        // (see the comment further down) — check before collecting any input so a dismissed
        // prompt doesn't waste the user's typing. Same guard, same placement, as
        // addModel.js/addMigration.js.
        const gemfilePath = path.join(ctx.workspace.appRoot(), 'Gemfile');
        if (!ctx.check.hasThecoreGenerators(gemfilePath).ok) {
            if (!(await confirmAndAddThecoreGenerators(ctx, gemfilePath))) return;
        }

        const rootActionName = await runner.input({
            prompt: 'Please enter the snake_case name of the root action.',
            validate: (v) => (!v || !v.match(/^[a-z0-9_]+$/)) ? '❌ The snake_case name is not valid. Please try again.' : null,
        });
        if (!rootActionName) {
            ctx.log('❌ The root action name is not valid. Please try again.');
            return;
        }

        const rootActionFile = path.join(ctx.workspace.rootActionsDir(), `${rootActionName}.rb`);
        if (ctx.check.isFile(rootActionFile).ok) {
            vscode.window.showErrorMessage(`The root action ${rootActionName} already exists. Please try again.`);
            return;
        }

        // thecore_generators ships `rails generate thecore:root_action` (thecore_generators#11):
        // it creates the action file, its view/JS/SCSS companions, the after_initialize.rb
        // require line, the assets.rb precompile line, and locale entries, with the same
        // ATOM-aware placement addModel.js/addMigration.js already delegate to — see CLAUDE.md's
        // "addModel / addMigration / addRootAction — thin wrappers" section for the full
        // rationale (including why `--non-interactive` is passed even though this generator
        // declares no option by that name). This command's only remaining job is to shell out
        // and trust it.
        const atomFlag = isAtom ? ` --atom=${ctx.workspace.atomName}` : '';
        const command = `bundle install && rails g thecore:root_action "${rootActionName}"${atomFlag} --non-interactive`;

        const output = await ctx.exec(command, ctx.workspace.appRoot());

        if (!output) {
            const msg = 'No output from rails g command exists, cannot go on';
            ctx.log(`❌ ${msg}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
            return;
        }

        ctx.log(`✅ The root action ${rootActionName} has been added successfully.`);
        vscode.window.showInformationMessage(`The root action ${rootActionName} has been added successfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while adding the root action: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the root action: ${error.message}`);
    }
}

module.exports = { perform };
