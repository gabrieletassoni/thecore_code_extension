'use strict';

const vscode = require('vscode');
const path = require('path');
const { isPascalCase } = require('../libs/check');
const { CommandRunner } = require('../libs/commandRunner');
const { confirmAndAddThecoreGenerators } = require('../libs/thecoreGeneratorsGuard');

async function perform(ctx) {
    if (!ctx.workspace) {
        vscode.window.showErrorMessage('Please right click on a folder and select Add Model.');
        return;
    }

    ctx.show();

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;
    if (!runner.check(ctx.check.isDir(ctx.workspace.targetDir()), showErr)) return;

    const isAtom = ctx.workspace.type() === 'atom';

    if (isAtom) {
        ctx.log(`🔍 ATOM context detected: ${ctx.workspace.atomDir}`);
        if (!runner.check(ctx.check.hasGemspec(ctx.workspace.atomDir, ctx.workspace.atomName), showErr)) return;
    } else {
        ctx.log('🔍 Main app context detected.');
        if (!runner.check(ctx.check.railsAppValid(), showErr)) return;
    }

    // thecore_generators must be present for plain `rails g model` to be Thecore-aware at all
    // (see the comment further down) — check before collecting any input so a dismissed prompt
    // doesn't waste the user's typing.
    const gemfilePath = path.join(ctx.workspace.appRoot(), 'Gemfile');
    if (!ctx.check.hasThecoreGenerators(gemfilePath).ok) {
        if (!(await confirmAndAddThecoreGenerators(ctx, gemfilePath))) return;
    }

    const modelName = await runner.input({
        prompt: 'Please enter the PascalCase name of the model.',
        validate: (v) => (!v || !isPascalCase(v)) ? '❌ The PascalCase name is not valid. Please try again.' : null,
    });
    if (!modelName) return;

    const modelDefinition = await runner.input({
        prompt: 'Please enter the definition of the migration. Example: name:string age:integer',
        validate: (v) => (v && !v.match(/^(\w+:\w+\s?)+$/)) ? '❌ The migration definition is not valid. Please try again.' : null,
        optional: true,
    });

    try {
        // thecore_generators registers `config.app_generators.orm :thecore` (see
        // docs/adr/0002-thecore-generators-gem-and-generator-hook-mechanism.md in the thecore
        // repo), so plain `rails g model` is already fully Thecore-aware: it places files in the
        // right ATOM/host-app location itself, no longer generates the Api::/RailsAdmin::/
        // Endpoints:: concern trio by default (ADR 0001), no longer needs `include` lines patched
        // into the model file, and generates real test files (no more --skip-test-framework — see
        // thecore_generators#4/#5). This command's only remaining job is to shell out and trust it.
        //
        // `--atom=<name>` is thecore_generators' explicit, cwd-independent override for exactly
        // this kind of scripted/non-interactive caller (Thecore::Generators::WorkspaceContext):
        // without it, ATOM detection reads the *generator process's* `Dir.pwd`, but plain `rails`
        // (unlike `bin/rails` invoked directly) re-execs itself after walking back up to the app
        // root looking for `bin/rails`, silently resetting `Dir.pwd` there before the generator
        // ever runs — so relying on cwd here would be fragile. Passing the ATOM name we already
        // know (from `ctx.workspace`) sidesteps that entirely. `--non-interactive` skips the
        // inverse-association cardinality prompt (ADR 0003) — there's no real TTY behind `ctx.exec`.
        const atomFlag = isAtom ? ` --atom=${ctx.workspace.atomName}` : '';
        const command = `bundle install && rails g model "${modelName}" ${modelDefinition || ''}${atomFlag} --non-interactive`;

        const output = await ctx.exec(command, ctx.workspace.appRoot());

        if (!output) {
            const msg = 'No output from rails g command exists, cannot go on';
            ctx.log(`❌ ${msg}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
            return;
        }

        ctx.log(`✅ The model ${modelName} has been added successfully.`);
        vscode.window.showInformationMessage(`The model ${modelName} has been added successfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while adding the model: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the model: ${error.message}`);
    }
}

module.exports = { perform };
