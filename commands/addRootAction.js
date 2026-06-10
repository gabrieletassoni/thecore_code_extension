'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../libs/templates');
const { CommandRunner } = require('../libs/commandRunner');

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

    try {
        if (isAtom) {
            ctx.log('Adding a root action to the current ATOM.');
            const atomDir = ctx.workspace.atomDir;
            ctx.log(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);

            if (!runner.check(ctx.check.isDir(atomDir), showErr)) return;
            if (!runner.check(ctx.check.isDir(ctx.workspace.rootActionsDir()), showErr)) return;
            if (!runner.check(ctx.check.hasGemspec(atomDir, ctx.workspace.atomName), showErr)) return;
        } else {
            ctx.log('Adding a root action to the main app.');
            ctx.log('🔍 Checking if the workspace root is a valid Ruby on Rails app.');
            if (!runner.check(ctx.check.railsAppValid(), showErr)) return;
            ctx.mkdir(ctx.workspace.rootActionsDir());
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

        const rootActionNameCamelCase = rootActionName.toLowerCase().replace(/[-_][a-z0-9]/g, (g) => g.slice(-1).toUpperCase());

        ctx.write.textFile(ctx.workspace.rootActionsDir(), `${rootActionName}.rb`,
            renderTemplate('addRootAction/action.rb', { actionName: rootActionName }));

        ctx.mkdir(ctx.workspace.viewsDir());
        ctx.write.textFile(ctx.workspace.viewsDir(), `${rootActionName}.html.erb`,
            renderTemplate('addRootAction/action.html.erb', { actionName: rootActionName }));

        const afterInitializeFile = ctx.workspace.initializerFile('after_initialize.rb');
        if (!fs.existsSync(afterInitializeFile)) {
            ctx.write.textFile(path.dirname(afterInitializeFile), 'after_initialize.rb',
                renderTemplate('createATOM/after_initialize.rb'));
        }
        // The main app's lib folder is not on the load path, so require by full path there.
        const requireLine = isAtom
            ? `require 'root_actions/${rootActionName}'`
            : `require Rails.root.join('lib', 'root_actions', '${rootActionName}').to_s`;
        const afterInitializeContent = fs.readFileSync(afterInitializeFile).toString();
        if (!afterInitializeContent.includes(requireLine)) {
            const lines = afterInitializeContent.split('\n');
            const idx = lines.findIndex(l => l.includes('config.after_initialize do'));
            lines.splice(idx + 1, 0, `        ${requireLine}`);
            fs.writeFileSync(afterInitializeFile, lines.join('\n'));
            ctx.log(`The root action require line has been added to the ${afterInitializeFile} file.`);
        } else {
            ctx.log(`The root action require line is already present in the ${afterInitializeFile} file.`);
        }

        const assetsFile = ctx.workspace.assetsFile();
        if (!fs.existsSync(assetsFile)) {
            ctx.write.textFile(path.dirname(assetsFile), 'assets.rb', renderTemplate('createATOM/assets.rb'));
        }
        const assetsContent = fs.readFileSync(assetsFile).toString();
        const assetsLine = `Rails.application.config.assets.precompile += %w( rails_admin/actions/${rootActionName}.js rails_admin/actions/${rootActionName}.css )`;
        if (!assetsContent.includes(assetsLine)) {
            fs.appendFileSync(assetsFile, `\n${assetsLine}`);
            ctx.log(`The root action assets precompile line has been added to the ${assetsFile} file.`);
        } else {
            ctx.log(`The root action assets precompile line is already present in the ${assetsFile} file.`);
        }

        ctx.mkdir(ctx.workspace.cssAssetsDir());
        ctx.write.textFile(ctx.workspace.cssAssetsDir(), `${rootActionName}.scss`,
            renderTemplate('shared/action.scss', { actionName: rootActionName }));

        ctx.mkdir(ctx.workspace.jsAssetsDir());
        ctx.write.textFile(ctx.workspace.jsAssetsDir(), `${rootActionName}.js`,
            renderTemplate('addRootAction/action.js', { actionName: rootActionName, actionNameCamelCase: rootActionNameCamelCase }));

        const rootActionNameTitleCase = rootActionName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const localesDir = ctx.workspace.localesDir();
        [['en.yml', 'en'], ['it.yml', 'it']].forEach(([file, lang]) => {
            if (!fs.existsSync(path.join(localesDir, file))) {
                ctx.write.yamlFile(localesDir, file, { [lang]: null });
            }
        });
        ctx.write.mergeYaml(localesDir, 'en.yml', rootActionName, rootActionNameTitleCase, 'en');
        ctx.write.mergeYaml(localesDir, 'it.yml', rootActionName, rootActionNameTitleCase, 'it');

        ctx.log(`✅ The root action ${rootActionName} has been added successfully.`);
        vscode.window.showInformationMessage(`The root action ${rootActionName} has been added successfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while adding the root action: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the root action: ${error.message}`);
    }
}

module.exports = { perform };
