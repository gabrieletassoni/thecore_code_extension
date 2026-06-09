'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../libs/templates');
const { CommandRunner } = require('../libs/commandRunner');

async function perform(ctx) {
    if (!ctx.workspace) {
        vscode.window.showErrorMessage('Please right click on the ATOM folder and select Add member action.');
        return;
    }

    ctx.show();
    ctx.log('Adding a member action to the current ATOM.');

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

    try {
        const atomDir = ctx.workspace.atomDir;
        ctx.log(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);

        if (!runner.check(ctx.check.isDir(atomDir), showErr)) return;
        if (!runner.check(ctx.check.isDir(ctx.workspace.memberActionsDir()), showErr)) return;
        if (!runner.check(ctx.check.hasGemspec(atomDir, ctx.workspace.atomName), showErr)) return;

        const memberActionName = await runner.input({
            prompt: 'Please enter the snake_case name of the member action.',
            validate: (v) => (!v || !v.match(/^[a-z0-9_]+$/)) ? '❌ The snake_case name is not valid. Please try again.' : null,
        });
        if (!memberActionName) {
            ctx.log('❌ The member action name is not valid. Please try again.');
            return;
        }

        const memberActionFile = path.join(ctx.workspace.memberActionsDir(), `${memberActionName}.rb`);
        if (fs.existsSync(memberActionFile)) {
            ctx.log(`❌ The member action ${memberActionName} already exists. Please try again.`);
            vscode.window.showErrorMessage(`The member action ${memberActionName} already exists. Please try again.`);
            return;
        }

        const memberActionNameCamelCase = memberActionName.toLowerCase().replace(/[-_][a-z0-9]/g, (g) => g.slice(-1).toUpperCase());

        ctx.write.textFile(ctx.workspace.memberActionsDir(), `${memberActionName}.rb`,
            renderTemplate('addMemberAction/action.rb', { actionName: memberActionName }));

        ctx.mkdir(ctx.workspace.viewsDir());
        ctx.write.textFile(ctx.workspace.viewsDir(), `${memberActionName}.html.erb`,
            renderTemplate('addMemberAction/action.html.erb', { actionName: memberActionName }));

        const afterInitializeFile = ctx.workspace.initializerFile('after_initialize.rb');
        const afterInitializeContent = fs.readFileSync(afterInitializeFile).toString();
        if (!afterInitializeContent.includes(`require 'member_actions/${memberActionName}'`)) {
            const lines = afterInitializeContent.split('\n');
            const idx = lines.findIndex(l => l.includes('config.after_initialize do'));
            lines.splice(idx + 1, 0, `        require 'member_actions/${memberActionName}'`);
            fs.writeFileSync(afterInitializeFile, lines.join('\n'));
            ctx.log(`The member action require line has been added to the ${afterInitializeFile} file.`);
        } else {
            ctx.log(`The member action require line is already present in the ${afterInitializeFile} file.`);
        }

        const assetsFile = ctx.workspace.assetsFile();
        const assetsContent = fs.readFileSync(assetsFile).toString();
        const assetsLine = `Rails.application.config.assets.precompile += %w( rails_admin/actions/${memberActionName}.js rails_admin/actions/${memberActionName}.css )`;
        if (!assetsContent.includes(assetsLine)) {
            fs.appendFileSync(assetsFile, `\n${assetsLine}`);
            ctx.log(`The member action assets precompile line has been added to the ${assetsFile} file.`);
        } else {
            ctx.log(`The member action assets precompile line is already present in the ${assetsFile} file.`);
        }

        ctx.write.textFile(ctx.workspace.cssAssetsDir(), `${memberActionName}.scss`,
            renderTemplate('shared/action.scss', { actionName: memberActionName }));

        ctx.write.textFile(ctx.workspace.jsAssetsDir(), `${memberActionName}.js`,
            renderTemplate('addMemberAction/action.js', { actionName: memberActionName, actionNameCamelCase: memberActionNameCamelCase }));

        const memberActionNameTitleCase = memberActionName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const localesDir = ctx.workspace.localesDir();
        ctx.write.mergeYaml(localesDir, 'en.yml', memberActionName, memberActionNameTitleCase, 'en');
        ctx.write.mergeYaml(localesDir, 'it.yml', memberActionName, memberActionNameTitleCase, 'it');

        ctx.log(`✅ The member Action ${memberActionName} has been added successfully.`);
        vscode.window.showInformationMessage(`The member Action ${memberActionName} has been added successfully.`);
    } catch (error) {
        ctx.log(`❌ An error occurred while adding the member action: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the member action: ${error.message}`);
    }
}

module.exports = { perform };
