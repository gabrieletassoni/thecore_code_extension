'use strict';

const vscode = require('vscode');
const path = require('path');
const { CommandRunner } = require('../libs/commandRunner');
const { confirmAndAddThecoreGenerators } = require('../libs/thecoreGeneratorsGuard');

async function perform(ctx) {
    if (!ctx.workspace) {
        vscode.window.showErrorMessage('Please open a workspace and right click on an ATOM folder or a main app folder, then select Add member action.');
        return;
    }

    ctx.show();

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

    const isAtom = ctx.workspace.type() === 'atom';

    // Everything below runs inside try/catch, matching addMigration.js/addRootAction.js (not
    // addModel.js — see CLAUDE.md's "try/catch scope" note): only the initial workspaceExists
    // check sits outside it, since perform() is never awaited/caught by extension.js and real
    // I/O starts as early as the thecore_generators guard below.
    try {
        if (isAtom) {
            ctx.log('Adding a member action to the current ATOM.');
            const atomDir = ctx.workspace.atomDir;
            ctx.log(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);

            if (!runner.check(ctx.check.isDir(atomDir), showErr)) return;
            if (!runner.check(ctx.check.hasGemspec(atomDir, ctx.workspace.atomName), showErr)) return;
        } else {
            ctx.log('Adding a member action to the main app.');
            ctx.log('🔍 Checking if the workspace root is a valid Ruby on Rails app.');
            if (!runner.check(ctx.check.railsAppValid(), showErr)) return;
        }

        // thecore_generators must be present for `rails g thecore:member_action` to exist at all
        // (see the comment further down) — check before collecting any input so a dismissed
        // prompt doesn't waste the user's typing. Same guard, same placement, as
        // addModel.js/addMigration.js/addRootAction.js.
        const gemfilePath = path.join(ctx.workspace.appRoot(), 'Gemfile');
        if (!ctx.check.hasThecoreGenerators(gemfilePath).ok) {
            if (!(await confirmAndAddThecoreGenerators(ctx, gemfilePath))) return;
        }

        const memberActionName = await runner.input({
            prompt: 'Please enter the snake_case name of the member action.',
            validate: (v) => (!v || !v.match(/^[a-z0-9_]+$/)) ? '❌ The snake_case name is not valid. Please try again.' : null,
        });
        if (!memberActionName) {
            ctx.log('❌ The member action name is not valid. Please try again.');
            return;
        }

        const memberActionFile = path.join(ctx.workspace.memberActionsDir(), `${memberActionName}.rb`);
        if (ctx.check.isFile(memberActionFile).ok) {
            ctx.log(`❌ The member action ${memberActionName} already exists. Please try again.`);
            vscode.window.showErrorMessage(`The member action ${memberActionName} already exists. Please try again.`);
            return;
        }

        // thecore_generators ships `rails generate thecore:member_action`
        // (thecore_generators#12): it creates the action file, its view/JS/SCSS companions, the
        // after_initialize.rb require line, the assets.rb precompile line, and locale entries,
        // with the same ATOM-aware placement addModel.js/addMigration.js/addRootAction.js
        // already delegate to — see CLAUDE.md's "addModel / addMigration / addRootAction /
        // addMemberAction — thin wrappers" section for the full rationale. This command's only
        // remaining job is to shell out and trust it.
        const atomFlag = isAtom ? ` --atom=${ctx.workspace.atomName}` : '';
        const command = `bundle install && rails g thecore:member_action "${memberActionName}"${atomFlag} --non-interactive`;

        const output = await ctx.exec(command, ctx.workspace.appRoot());

        if (!output) {
            const msg = 'No output from rails g command exists, cannot go on';
            ctx.log(`❌ ${msg}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
            return;
        }

        // "member Action" (capital A) is the exact wording the pre-delegation command always
        // used — kept verbatim so the AC's "same user-visible messages" holds literally.
        ctx.log(`✅ The member Action ${memberActionName} has been added successfully.`);
        vscode.window.showInformationMessage(`The member Action ${memberActionName} has been added successfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while adding the member action: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the member action: ${error.message}`);
    }
}

module.exports = { perform };
