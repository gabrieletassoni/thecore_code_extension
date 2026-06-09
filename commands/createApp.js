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
        await ctx.exec('rails new . --database=postgresql --asset-pipeline=sprockets --skip-git', workspaceRoot);

        ctx.write.gitignoreFile(workspaceRoot);

        await ctx.exec('git init && git checkout -b main && git add . && git commit -m "Initial commit" && git branch -M main', workspaceRoot);
        ctx.log('Git initialized and initial files committed successfully.');

        const gemfile = path.join(workspaceRoot, 'Gemfile');
        if (fs.existsSync(gemfile)) {
            const gemfileContent = fs.readFileSync(gemfile, 'utf8');
            const gemDependencies = [
                "gem 'rails-erd', group: :development",
                "gem 'ruby-lsp', require: false, group: :development",
                "gem 'rubocop', require: false, group: :development",
                "gem 'rubocop-rails', require: false, group: :development",
                "gem 'sassc-rails'",
                "gem 'rails_admin'",
                "gem 'devise'",
                "gem 'cancancan'"
            ].join('\n');
            const gemfileContentWithGems = gemfileContent + '\n' + gemDependencies;
            fs.writeFileSync(gemfile, gemfileContentWithGems);

            const setupCommands = [
                'bundle install',
                'rails generate devise:install',
                "rails g rails_admin:install app --asset=sprockets",
                "sed -i \"/mount RailsAdmin::Engine => '\\/app', as: 'rails_admin'/d\" config/routes.rb",
                'bundle install',
                'rails active_storage:install',
                'rails action_text:install',
                'bundle install',
                'rails action_mailbox:install',
                'rails g cancan:ability',
                'rails g erd:install'
            ];
            await ctx.exec(setupCommands.join(' && '), workspaceRoot);
            ctx.log('Bundle install and rails generate commands completed successfully.');

            const gemfileContentWithGems2 = gemfileContentWithGems + "\ngem 'model_driven_api', '~> 3.1'\ngem 'thecore_ui_rails_admin', '~> 3.2'";
            fs.writeFileSync(gemfile, gemfileContentWithGems2);
            await ctx.exec('bundle install', workspaceRoot);

            ctx.log('Adding .gitlab-ci.yml file.');
            const gitlabCiObject = {
                image: 'gabrieletassoni/vscode-devcontainers-thecore:3',
                variables: { DISABLE_SPRING: 1 },
                stages: ['build', 'test', 'delivery', 'deploy'],
                cache: {
                    key: 'thecore3cache',
                    paths: ['vendor/bundle', 'app/assets', 'lib/assets', 'public/assets']
                },
                build: {
                    stage: 'build',
                    rules: [{ if: '$CI_COMMIT_TAG', when: 'never' }, { when: 'always' }],
                    script: ['sudo -E /usr/bin/app-compile.sh']
                },
                'to-dev': {
                    when: 'on_success',
                    stage: 'delivery',
                    cache: [],
                    variables: { TARGETENV: 'dev' },
                    script: ['/usr/bin/docker-deploy.sh']
                },
                'to-prod': {
                    when: 'manual',
                    allow_failure: false,
                    stage: 'deploy',
                    cache: [],
                    script: ['/usr/bin/docker-deploy.sh']
                }
            };
            ctx.write.yamlFile(workspaceRoot, '.gitlab-ci.yml', gitlabCiObject);

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

            [
                path.join(workspaceRoot, 'vendor', 'custombuilds'),
                path.join(workspaceRoot, 'vendor', 'deploytargets'),
                path.join(workspaceRoot, 'vendor', 'submodules')
            ].forEach(dir => ctx.mkdir(dir));

            const dockerignoreFile = path.join(workspaceRoot, '.dockerignore');
            if (fs.existsSync(dockerignoreFile)) { fs.unlinkSync(dockerignoreFile); }

            await ctx.exec('git add . -A && git commit -m "Add Thecore 3 gems and configuration"', workspaceRoot);
            ctx.log('✅ Thecore 3 App created successfully.');
        }
    } catch (error) {
        const errorMessage = `❌ An error occurred: ${error.message}`;
        ctx.log(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
    }
}

module.exports = { perform };
