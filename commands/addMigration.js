'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { isPascalCase } = require('../libs/check');
const { CommandRunner } = require('../libs/commandRunner');

async function perform(ctx) {
    if (!ctx.workspace) {
        vscode.window.showErrorMessage('Please right click on the ATOM folder and select Add migration.');
        return;
    }

    ctx.show();
    ctx.log('Adding a migration to the current ATOM.');

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

    try {
        const atomDir = ctx.workspace.atomDir;
        ctx.log(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);

        if (!runner.check(ctx.check.isDir(atomDir), showErr)) return;
        if (!runner.check(ctx.check.hasGemspec(atomDir, ctx.workspace.atomName), showErr)) return;

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

        const output = await ctx.exec(
            `bundle install && rails g migration "${migrationName}" ${migrationDefinition || ''}`,
            ctx.workspace.appRoot()
        );

        if (!output) {
            const msg = 'No output from rails g command exists, cannot go on';
            ctx.log(`❌ ${msg}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
            return;
        }

        const migrationFiles = [...output.matchAll(/^\s+create\s+(db\/migrate\/.+\.rb)$/gm)];

        if (!migrationFiles.length) {
            const msg = 'No output from rails g command matches evidence of migration file creation, cannot go on';
            ctx.log(`❌ ${msg}, please inspect lines above.`);
            vscode.window.showErrorMessage(`${msg}, please inspect output window.`);
            return;
        }

        migrationFiles.forEach(el => {
            const srcPath = path.join(ctx.workspace.appRoot(), el[1]);
            const targetDir = ctx.workspace.migrationDir();
            if (!fs.existsSync(targetDir)) {
                ctx.log(`📁 Creating the migrations folder: ${targetDir}`);
                ctx.mkdir(targetDir);
            }
            ctx.log(`📄 Moving the migration file to the migrations folder: ${srcPath}`);
            fs.renameSync(srcPath, path.join(targetDir, path.basename(srcPath)));
        });

        ctx.log(`✅ The migration ${migrationName} has been added successfully.`);
        vscode.window.showInformationMessage(`The migration ${migrationName} has been added successfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while adding the migration: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the migration: ${error.message}`);
    }
}

module.exports = { perform };
