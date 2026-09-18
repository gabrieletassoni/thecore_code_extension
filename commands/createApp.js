'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { CommandRunner } = require('../libs/commandRunner');

async function perform(ctx) {
    ctx.show();
    ctx.log('Thecore 3 App creation started.');

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);

    try {
        if (!runner.check(ctx.check.workspaceExists(), showErr)) return;
        if (!runner.check(ctx.check.workspaceEmpty(), showErr)) return;

        for (const command of ['ruby', 'rails', 'bundle']) {
            ctx.log(`Checking if the ${command} command is available.`);
            if (!runner.check(ctx.check.commandExists(command), showErr)) return;
        }

        const rorCheck = ctx.check.railsAppValid(true);
        if (rorCheck.ok) { return; }

        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        ctx.log('All checks are OK, proceeding with the creation of the Thecore 3 App.');

        await ctx.exec('sudo chown -R vscode:vscode .', workspaceRoot);

        // thecore_generators ships a real App application template (`rails new -m <url>`,
        // ADR 0005/0007 in the thecore repo): it owns the Rails app skeleton, Gemfile stack,
        // both CI files, devcontainer/CLAUDE.md assets, vendor/{submodules,external}
        // placeholders, and -- via the env vars below -- the installer chain (devise/
        // rails_admin/active_storage/action_text/action_mailbox/cancan/erd), all with the
        // same content this command used to hand-roll in JS. `--skip-git` is kept: the
        // template itself never touches git (verified against its source), so this
        // command's own git init/commit below is unchanged, not delegated.
        // THECORE_APP_TEMPLATE_NON_INTERACTIVE=1 + THECORE_APP_TEMPLATE_RUN_INSTALLERS=true
        // (thecore_generators#23) preserve this command's own always-zero-prompt,
        // always-installs-everything contract exactly -- no regression for existing users.
        const templateUrl = 'https://raw.githubusercontent.com/gabrieletassoni/thecore_generators/release/3/lib/templates/app_template.rb';
        const templateCommand = 'THECORE_APP_TEMPLATE_NON_INTERACTIVE=1 THECORE_APP_TEMPLATE_RUN_INSTALLERS=true ' +
            `rails new . --database=postgresql --asset-pipeline=sprockets --skip-git -m ${templateUrl}`;

        const output = await ctx.exec(templateCommand, workspaceRoot);

        if (!output) {
            const msg = 'No output from rails new command exists, cannot go on';
            ctx.log(`❌ ${msg}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
            return;
        }

        ctx.write.gitignoreFile(workspaceRoot);

        // App-specific runtime config the App template deliberately doesn't own (it's
        // scoped to Gemfile/CI/devcontainer/CLAUDE.md/the installer chain, per ADR 0005) --
        // unchanged from before delegation.
        ctx.log('Adding config/sidekiq.yml file.');
        const sidekiqYmlObject = {
            ':concurrency': "<%= ENV.fetch('RAILS_MAX_THREADS') { 5 } %>",
            ':verbose': false,
            ':queues': [
                "<%= \"#{ENV['COMPOSE_PROJECT_NAME'] || 'notset'}_default\" %>",
                "<%= \"#{ENV['COMPOSE_PROJECT_NAME'] || 'notset'}_mailers\" %>",
                "<%= \"#{ENV['COMPOSE_PROJECT_NAME'] || 'notset'}_storage_analysis\" %>",
                "<%= \"#{ENV['COMPOSE_PROJECT_NAME'] || 'notset'}_storage_purge\" %>",
                "<%= \"#{ENV['COMPOSE_PROJECT_NAME'] || 'notset'}_mailbox_incinerate\" %>",
                "<%= \"#{ENV['COMPOSE_PROJECT_NAME'] || 'notset'}_mailbox_routing\" %>"
            ],
            ':scheduler': { ':dynamic': true, ':enabled': true }
        };
        ctx.write.yamlFile(workspaceRoot, 'config/sidekiq.yml', sidekiqYmlObject);

        fs.writeFileSync(path.join(workspaceRoot, 'version'), '3.0.1');

        const developmentConfig = path.join(workspaceRoot, 'config', 'environments', 'development.rb');
        const devConfigContent = fs.readFileSync(developmentConfig, 'utf8');
        fs.writeFileSync(developmentConfig, devConfigContent.replace(
            /config.action_controller.raise_on_missing_callback_actions = true/,
            'config.action_controller.raise_on_missing_callback_actions = false'
        ));

        await ctx.exec('rails db:drop ; rails db:create && rails db:migrate && rails thecore:db:seed', workspaceRoot);
        ctx.log('Rails thecore:db:init command completed successfully.');

        // vendor/submodules is already created by the App template itself -- not duplicated
        // here. custombuilds/deploytargets are this command's own, still undelegated
        // (releaseApp.js depends on vendor/custombuilds existing).
        [
            path.join(workspaceRoot, 'vendor', 'custombuilds'),
            path.join(workspaceRoot, 'vendor', 'deploytargets')
        ].forEach(dir => ctx.mkdir(dir));

        const dockerignoreFile = path.join(workspaceRoot, '.dockerignore');
        if (fs.existsSync(dockerignoreFile)) { fs.unlinkSync(dockerignoreFile); }

        // A single commit, not the old two-commit "Initial commit" / "Add Thecore 3 gems
        // and configuration" split -- delegation means the Gemfile/CI content is already
        // complete by the time git ever runs (unlike the old JS flow, which staged gems
        // into the Gemfile in three separate passes across the two commits), so there's no
        // more "before gems, after gems" distinction to preserve. Matches thecore:atom's
        // own "one initial commit" precedent (ADR 0006).
        await ctx.exec('git init && git checkout -b main && git add . && git commit -m "Initial commit" && git branch -M main', workspaceRoot);
        ctx.log('Git initialized and initial files committed successfully.');

        ctx.log('✅ Thecore 3 App created successfully.');
        vscode.window.showInformationMessage('Thecore 3 App created successfully.');
    } catch (error) {
        const errorMessage = `❌ An error occurred: ${error.message}`;
        ctx.log(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
    }
}

module.exports = { perform };
