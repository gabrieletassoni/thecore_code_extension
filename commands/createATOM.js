'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../libs/templates');
const { snakeToClassName } = require('../libs/helpers');
const { CommandRunner } = require('../libs/commandRunner');

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

        await createRailsEngine(ctx, submoduleName, submoduleNameSnakeCase, summary, description, author, email, url, submodulesDir);

        const mainAppGemfile = path.join(rorResult.value.workspaceRoot, 'Gemfile');
        const gemfileContent = fs.readFileSync(mainAppGemfile, 'utf8');
        fs.writeFileSync(mainAppGemfile, gemfileContent + `\ngem "${submoduleNameSnakeCase}", path: "vendor/submodules/${submoduleNameSnakeCase}"`);
        ctx.log(`✅ Added the ${submoduleNameSnakeCase} gem to the main app Gemfile file.`);

        ctx.log(`✅ The submodule ${submoduleName} has been created succesfully.`);
        vscode.window.showInformationMessage(`The submodule ${submoduleName} has been created succesfully.`);
    } catch (error) {
        console.error(error);
        ctx.log(`❌ An error occurred: ${error.message}`);
        vscode.window.showErrorMessage('An error occurred while creating the Thecore 3 ATOM. Please check the output channel for more details.');
    }
}

function setupGemspecFile(ctx, submodulesDir, submoduleName, submoduleNameSnakeCase, summary, description, author, email, url) {
    const gemspecFile = path.join(submodulesDir, submoduleNameSnakeCase, `${submoduleNameSnakeCase}.gemspec`);
    let gemspec = fs.readFileSync(gemspecFile, 'utf8');
    let newGemspec = '';
    gemspec.split('\n').forEach((line) => {
        if (line.includes('.add_dependency')) {
            newGemspec += `  spec.add_dependency 'model_driven_api', '~> 3.1'\n  spec.add_dependency 'thecore_ui_rails_admin', '~> 3.2'\n`;
        } else if (line.includes('.authors')) {
            newGemspec += `  spec.authors = ["${author}"]\n`;
        } else if (line.includes('.email')) {
            newGemspec += `  spec.email = ["${email}"]\n`;
        } else if (line.includes('.homepage')) {
            newGemspec += `  spec.homepage = "${url}"\n`;
        } else if (line.includes('.summary')) {
            newGemspec += `  spec.summary = "${summary}"\n`;
        } else if (line.includes('.description')) {
            newGemspec += `  spec.description = "${description}"\n`;
        } else if (line.includes('source_code_uri')) {
            newGemspec += `  spec.metadata["source_code_uri"] = spec.homepage\n`;
        } else if (line.includes('metadata["allowed_push_host')) {
            newGemspec += `  spec.metadata["allowed_push_host"] = "https://rubygems.org"\n`;
        } else if (line.includes('changelog_uri')) {
            newGemspec += `  spec.metadata["changelog_uri"] = "#{spec.homepage}/blob/master/CHANGELOG.md"\n`;
        } else {
            newGemspec += `${line}\n`;
        }
    });
    fs.writeFileSync(gemspecFile, newGemspec);
    ctx.log(`Modified the ${submoduleName} gemspec file.`);
}

function createThecoreFolders(ctx, submodulesDir, submoduleNameSnakeCase) {
    const base = path.join(submodulesDir, submoduleNameSnakeCase);
    [
        path.join(base, 'db', 'migrate'),
        path.join(base, 'app', 'models', 'concerns', 'api'),
        path.join(base, 'app', 'models', 'concerns', 'rails_admin'),
        path.join(base, 'config', 'initializers'),
        path.join(base, 'config', 'locales'),
        path.join(base, 'lib', 'root_actions'),
        path.join(base, 'lib', 'member_actions'),
        path.join(base, 'lib', 'collection_actions'),
        path.join(base, 'app', 'assets', 'javascripts'),
        path.join(base, 'app', 'assets', 'stylesheets'),
        path.join(base, 'app', 'views', 'rails_admin', 'main'),
        path.join(base, '.github', 'workflows'),
    ].forEach(dir => ctx.mkdir(dir));
}

function addInitializers(ctx, submodulesDir, submoduleNameSnakeCase) {
    const configInitializersDir = path.join(submodulesDir, submoduleNameSnakeCase, 'config', 'initializers');
    ctx.write.textFile(configInitializersDir, 'after_initialize.rb', renderTemplate('createATOM/after_initialize.rb'));
    ctx.write.textFile(configInitializersDir, 'add_to_db_migration.rb',
        `Rails.application.config.paths['db/migrate'] << File.expand_path("../../db/migrate", __dir__)`);
    ctx.write.textFile(configInitializersDir, 'assets.rb', renderTemplate('createATOM/assets.rb'));
    ctx.write.textFile(configInitializersDir, 'abilities.rb',
        renderTemplate('createATOM/abilities.rb', { className: snakeToClassName(submoduleNameSnakeCase) }));
}

function addDBFiles(ctx, submodulesDir, submoduleNameSnakeCase) {
    ctx.write.textFile(
        path.join(submodulesDir, submoduleNameSnakeCase, 'db'),
        'seeds.rb',
        renderTemplate('createATOM/seeds.rb', { submoduleNameSnakeCase })
    );
}

function addLocaleFiles(ctx, submodulesDir, submoduleNameSnakeCase) {
    const localesDir = path.join(submodulesDir, submoduleNameSnakeCase, 'config', 'locales');
    ctx.write.yamlFile(localesDir, 'en.yml', { en: null });
    ctx.write.yamlFile(localesDir, 'it.yml', { it: null });
}

function addCICDFiles(ctx, email, author, submodulesDir, submoduleNameSnakeCase) {
    const gempushObject = {
        name: 'Ruby Gem',
        on: 'push',
        jobs: {
            build: {
                name: 'Build + Publish',
                'runs-on': 'ubuntu-latest',
                steps: [
                    { uses: 'actions/checkout@v3' },
                    {
                        name: 'Check if version already exists',
                        id: 'check_version',
                        run: [
                            'version=$(grep -oP \'VERSION = "\\K[^"]+\' lib/*/version.rb | awk -F\'.\' \'{print $1"."$2"."$3})',
                            'git fetch --unshallow --tags',
                            'echo $?'
                        ]
                    },
                    {
                        name: 'Set git tag',
                        run: [
                            'git config --local user.email "noreply@alchemic.it"',
                            'git config --local user.name "AlchemicIT"',
                            'version=$(grep -oP \'VERSION = "\\K[^"]+\' lib/*/version.rb | awk -F\'.\' \'{print $1"."$2"."$3})',
                            'git tag -a $version -m "Version $version"',
                            'git push --tags'
                        ],
                        if: 'env.version_exists == \'false\''
                    },
                    {
                        name: 'Publish to RubyGems',
                        run: [
                            'mkdir -p $HOME/.gem',
                            'touch $HOME/.gem/credentials',
                            'chmod 0600 $HOME/.gem/credentials',
                            'printf -- "---\\n:rubygems_api_key: ${GEM_HOST_API_KEY}\\n" > $HOME/.gem/credentials',
                            'gem build *.gemspec',
                            'gem push *.gem'
                        ],
                        if: 'env.version_exists == \'false\'',
                        env: { GEM_HOST_API_KEY: '${{secrets.RUBYGEMS_AUTH_TOKEN}}' }
                    }
                ]
            }
        }
    };
    ctx.write.yamlFile(path.join(submodulesDir, submoduleNameSnakeCase, '.github', 'workflows'), 'gempush.yml', gempushObject);

    const gitlabCiObject = {
        image: 'gabrieletassoni/vscode-devcontainers-thecore:3',
        variables: {
            GITLAB_EMAIL: email,
            GITLAB_USER_NAME: author,
            GITLAB_GEM_REPO_TARGET: 'https://${GEM_HOST}/',
            GEM_HOST_API_KEY: '${GEMS_REPO_CREDENTIALS}'
        },
        stages: ['build', 'release'],
        build_gem: {
            rules: [{ if: '$CI_COMMIT_TAG', when: 'never' }, { when: 'always' }],
            stage: 'build',
            script: ['/usr/bin/gem-compile.sh']
        }
    };
    ctx.write.yamlFile(path.join(submodulesDir, submoduleNameSnakeCase), '.gitlab-ci.yml', gitlabCiObject);
}

function setupGemfile(ctx, submodulesDir, submoduleNameSnakeCase) {
    const gemfile = path.join(submodulesDir, submoduleNameSnakeCase, 'Gemfile');
    let gemfileContent = fs.readFileSync(gemfile, 'utf8');
    gemfileContent += `\ngem 'pg'`;
    gemfileContent += `\ngem 'model_driven_api', '~> 3.1'`;
    gemfileContent += `\ngem 'thecore_ui_rails_admin', '~> 3.2'`;
    fs.writeFileSync(gemfile, gemfileContent);

    const libFile = path.join(submodulesDir, submoduleNameSnakeCase, 'lib', `${submoduleNameSnakeCase}.rb`);
    let libFileContent = fs.readFileSync(libFile, 'utf8');
    libFileContent += `\nrequire 'model_driven_api'`;
    libFileContent += `\nrequire 'thecore_ui_rails_admin'`;
    fs.writeFileSync(libFile, libFileContent);

    ctx.log(` - Added the thecore dependecies to ${submoduleNameSnakeCase} Gemfile file.`);
}

async function createRailsEngine(ctx, submoduleName, submoduleNameSnakeCase, summary, description, author, email, url, submodulesDir) {
    ctx.log(`Creating the submodule ${submoduleName} using the rails plugin new command.`);
    try {
        await ctx.exec(
            `rails plugin new "${path.join(submodulesDir, submoduleNameSnakeCase)}" -fG --skip-gemfile-entry --skip-hotwire --full`,
            submodulesDir
        );
        ctx.write.gitignoreFile(path.join(submodulesDir, submoduleNameSnakeCase));
        createThecoreFolders(ctx, submodulesDir, submoduleNameSnakeCase);
        addInitializers(ctx, submodulesDir, submoduleNameSnakeCase);
        addDBFiles(ctx, submodulesDir, submoduleNameSnakeCase);
        addLocaleFiles(ctx, submodulesDir, submoduleNameSnakeCase);
        addCICDFiles(ctx, email, author, submodulesDir, submoduleNameSnakeCase);
        setupGemfile(ctx, submodulesDir, submoduleNameSnakeCase);
        setupGemspecFile(ctx, submodulesDir, submoduleName, submoduleNameSnakeCase, summary, description, author, email, url);
    } catch (error) {
        throw error;
    }
}

module.exports = { perform };
