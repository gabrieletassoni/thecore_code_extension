'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../libs/templates');
const { isPascalCase } = require('../libs/check');
const { CommandRunner } = require('../libs/commandRunner');

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
        const output = await ctx.exec(
            `bundle install && rails g model "${modelName}" ${modelDefinition || ''} --skip-test-framework`,
            ctx.workspace.appRoot()
        );

        if (!output) {
            const msg = 'No output from rails g command exists, cannot go on';
            ctx.log(`❌ ${msg}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
            return;
        }

        const migrationFiles = [...output.matchAll(/^\s+create\s+(db\/migrate\/.+\.rb)$/gm)];
        const modelFiles = [...output.matchAll(/^\s+create\s+(app\/models\/.+\.rb)$/gm)];

        if (!migrationFiles.length || !modelFiles.length) {
            const msg = 'No evidence of migration or model file creation in rails g output, cannot go on';
            ctx.log(`❌ ${msg}, please inspect lines above.`);
            vscode.window.showErrorMessage(`${msg}, please inspect output window.`);
            return;
        }

        migrationFiles.forEach(el => {
            const srcPath = path.join(ctx.workspace.appRoot(), el[1]);
            if (isAtom) {
                ctx.mkdir(ctx.workspace.migrationDir());
                ctx.log(`📄 Moving the migration file to: ${ctx.workspace.migrationDir()}`);
                fs.renameSync(srcPath, path.join(ctx.workspace.migrationDir(), path.basename(srcPath)));
            } else {
                ctx.log(`📄 Migration created at: ${srcPath}`);
            }
        });

        modelFiles.forEach(el => {
            const srcPath = path.join(ctx.workspace.appRoot(), el[1]);
            const basename = path.basename(srcPath);
            let finalModelFile;

            if (isAtom) {
                ctx.mkdir(ctx.workspace.modelDir());
                ctx.log(`📄 Moving the model file to: ${ctx.workspace.modelDir()}`);
                finalModelFile = path.join(ctx.workspace.modelDir(), basename);
                fs.renameSync(srcPath, finalModelFile);
            } else {
                finalModelFile = srcPath;
                ctx.log(`📄 Model created at: ${finalModelFile}`);
            }

            ['api', 'rails_admin', 'endpoints'].forEach(type => {
                ctx.mkdir(ctx.workspace.concernsDir(type));
            });

            ctx.write.textFile(ctx.workspace.concernsDir('api'), basename, renderTemplate('addModel/api_concern.rb', { modelName }));
            ctx.write.textFile(ctx.workspace.concernsDir('rails_admin'), basename, renderTemplate('addModel/rails_admin_concern.rb', { modelName }));
            ctx.write.textFile(ctx.workspace.concernsDir('endpoints'), basename, renderTemplate('addModel/endpoints_concern.rb', { modelName }));

            const concernIncluders = [
                `  include Api::${modelName}`,
                `  include RailsAdmin::${modelName}`
            ];
            const modelFileContent = fs.readFileSync(finalModelFile, 'utf8');
            if (!modelFileContent.includes(`include ${modelName}`)) {
                const updated = modelFileContent.replace(
                    / < ApplicationRecord/,
                    ` < ApplicationRecord\n${concernIncluders.join('\n')}`
                );
                fs.writeFileSync(finalModelFile, updated, 'utf8');
                ctx.log(`✅ Modified the ${modelName} RB file adding the concern's includes.`);
            }
        });

        ctx.log(`✅ The model ${modelName} has been added successfully.`);
        vscode.window.showInformationMessage(`The model ${modelName} has been added successfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while adding the model: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the model: ${error.message}`);
    }
}

module.exports = { perform };
