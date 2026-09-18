'use strict';

const vscode = require('vscode');
const path = require('path');
const { CommandRunner } = require('../libs/commandRunner');
const { confirmAndAddThecoreGenerators } = require('../libs/thecoreGeneratorsGuard');

async function perform(ctx) {
    ctx.show();
    ctx.log('Creating a Thecore 3 ATOM.');

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    try {
        if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

        const rorResult = ctx.check.railsAppValid();
        if (!runner.check(rorResult, showErr)) return;

        for (const command of ['ruby', 'rails', 'bundle']) {
            if (!runner.check(ctx.check.commandExists(command), showErr)) return;
        }

        const submodulesDir = path.join(rorResult.value.vendorDir, 'submodules');
        if (!runner.check(ctx.check.fileExists(submodulesDir), showErr)) return;

        // thecore_generators must be present for `rails g thecore:atom` to exist at all --
        // same guard, same placement (before collecting any input, so a dismissed prompt
        // doesn't waste the user's typing), as addModel.js/addMigration.js/addRootAction.js.
        const gemfilePath = path.join(rorResult.value.workspaceRoot, 'Gemfile');
        if (!ctx.check.hasThecoreGenerators(gemfilePath).ok) {
            if (!(await confirmAndAddThecoreGenerators(ctx, gemfilePath))) return;
        }

        const submoduleName = await runner.input({
            placeHolder: 'Enter the name of the submodule, i.e. TCP Debugger',
            validate: (v) => !v ? '❌ The ATOM name is not valid. Please try again.' : null,
        });
        if (!submoduleName) { ctx.log('❌ The ATOM name cannot be empty. Please try again.'); return; }

        const submoduleNameSnakeCase = submoduleName.replace(/ /g, '_').toLowerCase();

        const summary = await runner.input({
            placeHolder: 'Enter the summary of the submodule, i.e. TCP Debugger',
            validate: (v) => !v ? '❌ The summary is not valid. Please try again.' : null,
        });
        if (!summary) return;

        const description = await runner.input({
            placeHolder: 'Enter the description of the submodule, i.e. TCP Debugger',
            validate: (v) => !v ? '❌ The description is not valid. Please try again.' : null,
        });
        if (!description) return;

        const author = await runner.input({
            placeHolder: 'Enter the author of the submodule, i.e. Alchemic IT',
            validate: (v) => !v ? '❌ The author is not valid. Please try again.' : null,
        });
        if (!author) return;

        const email = await runner.input({
            placeHolder: 'Enter the email of the submodule author',
            validate: (v) => (!v || !v.includes('@')) ? '❌ The email is not valid. Please try again.' : null,
        });
        if (!email) return;

        const url = await runner.input({
            placeHolder: 'Enter the url of the submodule',
            validate: (v) => (!v || !v.startsWith('http')) ? '❌ The url is not valid. Please try again.' : null,
        });
        if (!url) return;

        // thecore_generators ships `rails generate thecore:atom` (thecore_generators 3.10.0/
        // 3.11.0, ADR 0006 in the thecore repo): it creates the Rails engine, Scaffold Files,
        // both CI files (GitHub Actions + GitLab, unconditionally -- git hosting is generic),
        // git init, and host-Gemfile wiring, with the same validation this command's own six
        // prompts already apply. `--skip-api-admin-deps` is deliberately never passed here --
        // this command has always added model_driven_api/thecore_ui_rails_admin unconditionally
        // (see the generator's own default), so omitting the flag preserves that exact behavior
        // rather than introducing a new choice VS Code users never had. This command's only
        // remaining job is to collect the same six inputs it always has and shell out.
        const atomCommand = `bundle install && rails g thecore:atom "${submoduleNameSnakeCase}" ` +
            `--non-interactive --summary="${summary}" --description="${description}" ` +
            `--author="${author}" --email="${email}" --url="${url}"`;

        const output = await ctx.exec(atomCommand, rorResult.value.workspaceRoot);

        if (!output) {
            const msg = 'No output from rails g command exists, cannot go on';
            ctx.log(`❌ ${msg}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
            return;
        }

        ctx.log(`✅ The submodule ${submoduleName} has been created succesfully.`);
        vscode.window.showInformationMessage(`The submodule ${submoduleName} has been created succesfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while creating the Thecore 3 ATOM: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while creating the Thecore 3 ATOM: ${error.message}`);
    }
}

module.exports = { perform };
