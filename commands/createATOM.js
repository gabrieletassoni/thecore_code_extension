// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { commandExistence, workspaceExixtence, rubyOnRailsAppValidity, fileExistence } = require('../libs/check');
const { execShell } = require('../libs/os');
const { createGitignoreFile, writeTextFile, writeYAMLFile } = require('../libs/configs');

// The code you place here will be executed every time your command is executed
/**
 * Creates a Thecore 3 ATOM.
 */
function perform() {
    // Display a message box to the user
    vscode.window.showInformationMessage('Creating a Thecore 3 ATOM.');

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Create ATOM');
    outputChannel.show();
    outputChannel.appendLine('Creating a Thecore 3 ATOM.');

    // Check if we are inside a workspace
    if (!workspaceExixtence(outputChannel)) { return; }

    // Check if the workspace root is a Ruby on Rails app
    const rorDirs = rubyOnRailsAppValidity(false, outputChannel);
    if (!rorDirs) { return; }

    // Check if ruby, rails and bundle commands are available
    const commands = ['ruby', 'rails', 'bundle'];
    for (const command of commands) {
        outputChannel.appendLine(`Checking if the ${command} command is available.`);
        if (!commandExistence(command, outputChannel)) {
            outputChannel.appendLine(`The ${command} command is not available. Please install it and try again.`);
            return; 
        }
    }

    // Check if `./vendor/submodules/` exists
    const submodulesDir = path.join(rorDirs.vendorDir, 'submodules');
    if (!fileExistence(submodulesDir, outputChannel)) { return; }

    // Asking the user for the name of the submodule
    vscode.window.showInputBox({
        placeHolder: 'Enter the name of the submodule, i.e. TCP Debugger'
    }).then((submoduleName) => {
        // Make a constant with the dashcase version of the submodule name
        const submoduleNameDashcase = submoduleName.replace(/ /g, '-').toLowerCase();

        // Ask the user for some info useful for generating a rails engine:
        // - summary
        // - description
        // - author
        // - email
        // - url
        vscode.window.showInputBox({
            placeHolder: 'Enter a short summary of the submodule, i.e. A TCP debugger'
        }).then((summary) => {
            vscode.window.showInputBox({
                placeHolder: 'Enter a description of the submodule, i.e. This is a TCP debugger for Thecore 3'
            }).then((description) => {
                vscode.window.showInputBox({
                    placeHolder: 'Enter the name of the author, i.e. John Doe'
                }).then((author) => {
                    vscode.window.showInputBox({
                        placeHolder: 'Enter the email of the author, i.e. gabrieletassoni@alchemic.it'
                    }).then((email) => {
                        vscode.window.showInputBox({
                            placeHolder: 'Enter the url of the author, i.e. https://alchemic.it'
                        }).then((url) => {
                            // Check if the email is actualy an email, otherwise show an error and return
                            if (!email.includes('@')) {
                                vscode.window.showErrorMessage('The email is not valid. Please enter a valid email and try again.');
                                return;
                            }

                            // Check if the url is actualy an url, otherwise show an error and return
                            if (!url.includes('http')) {
                                vscode.window.showErrorMessage('The url is not valid. Please enter a valid url and try again.');
                                return;
                            }
                            // Create the rails engine
                            createRailsEngine(submoduleName, submoduleNameDashcase, summary, description, author, email, url, submodulesDir, rorDirs.workspaceRootmì, outputChannel);

                        });
                    });
                });
            });
        });
    });
    outputChannel.appendLine('Thecore 3 ATOM creation ended.');
    vscode.window.showInformationMessage('Thecore 3 ATOM creation ended.');
}

async function createRailsEngine(submoduleName, submoduleNameDashcase, summary, description, author, email, url, submodulesDir, workspaceRoot, outputChannel) {
    // Creating the submodule using the `rails plugin new "$ENGINE_NAME" -fG --full` command from the submodulesDir
    outputChannel.appendLine(`Creating the submodule ${submoduleName} using the rails plugin new command.`);
    await execShell(`rails plugin new "${submoduleNameDashcase}" -fG --full`, submodulesDir, outputChannel);

    // In the gemspec file, replace the placeholders with the correct info provided by the user adding also the homepage
    const gemspecFile = path.join(submodulesDir, submoduleNameDashcase, `${submoduleNameDashcase}.gemspec`);
    let gemspec = fs.readFileSync(gemspecFile, 'utf8');
    gemspec = gemspec.replace(/TODO: Write your name/, author);
    gemspec = gemspec.replace(/TODO: Write your email address/, email);
    gemspec = gemspec.replace(/TODO: Write your summary/, summary);
    gemspec = gemspec.replace(/TODO: Write your description/, description);
    gemspec = gemspec.replace(/TODO: Write your website URL/, url);
    fs.writeFileSync(gemspecFile, gemspec);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With gemspec Author info in it.`);

    // Remove all spec.add_dependency  or spec.add_development_dependency lines from the gemspec file
    const lines = gemspec.split('\n');
    let newGemspec = '';
    lines.forEach((line) => {
        if (!line.includes('.add_dependency') && !line.includes('.add_development_dependency')) {
            newGemspec += `${line}\n`;
        }
    });
    fs.writeFileSync(gemspecFile, newGemspec);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With gemspec dependencies removed.`);

    // Overwrite the .gitignore file with the string provided here
    createGitignoreFile(path.join(submodulesDir, submoduleNameDashcase));

    // create all these folders in the submodule root, if they not already exist and in this case also add a .keep empty file: db/migrate app/models/concerns/api app/models/concerns/rails_admin config/initializers config/locales
    const dbMigrateDir = path.join(submodulesDir, submoduleNameDashcase, 'db', 'migrate');
    const appModelsConcernsApiDir = path.join(submodulesDir, submoduleNameDashcase, 'app', 'models', 'concerns', 'api');
    const appModelsConcernsRailsAdminDir = path.join(submodulesDir, submoduleNameDashcase, 'app', 'models', 'concerns', 'rails_admin');
    const configInitializersDir = path.join(submodulesDir, submoduleNameDashcase, 'config', 'initializers');
    const configLocalesDir = path.join(submodulesDir, submoduleNameDashcase, 'config', 'locales');
    // Also create a .keep file in lib/root_actions, creating the directory if it doesn't exist
    const libRootActionsDir = path.join(submodulesDir, submoduleNameDashcase, 'lib', 'root_actions');
    const libMemberActionsDir = path.join(submodulesDir, submoduleNameDashcase, 'lib', 'member_actions');
    const libCollectionActionsDir = path.join(submodulesDir, submoduleNameDashcase, 'lib', 'collection_actions');
    // Do the same for the folders in app/assets/javascripts and app/assets/stylesheets and views/rails_admin/main
    const appAssetsJavascriptsDir = path.join(submodulesDir, submoduleNameDashcase, 'app', 'assets', 'javascripts');
    const appAssetsStylesheetsDir = path.join(submodulesDir, submoduleNameDashcase, 'app', 'assets', 'stylesheets');
    const appViewsRailsAdminMainDir = path.join(submodulesDir, submoduleNameDashcase, 'app', 'views', 'rails_admin', 'main');
    const dirs = [libMemberActionsDir, libCollectionActionsDir, appViewsRailsAdminMainDir, appAssetsStylesheetsDir, appAssetsJavascriptsDir, libRootActionsDir, dbMigrateDir, appModelsConcernsApiDir, appModelsConcernsRailsAdminDir, configInitializersDir, configLocalesDir];
    dirs.forEach((dir) => {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, '.keep'), '');
    });
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With all the folders in it.`);

    // In the config/initializers add, only if it's not already existing, a file named after_initialize.rb with the following content:
    const afterInitializeTxt = [
        "Rails.application.configure do",
        "    config.after_initialize do",
        "        # For example, it can be used to load a root action defined in lib, for example:",
        "        # require 'root_actions/tcp_debug'",
        "    end",
        "end"
    ];
    writeTextFile(configInitializersDir, 'after_initialize.rb', afterInitializeTxt);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the after_initialize.rb file in it.`);

    // In the config/initializers, add a file named add_to_db_migration.rb with the following content:
    const addToDbMigrationFile = path.join(configInitializersDir, 'add_to_db_migration.rb');
    const addToDbMigrationTxt = `Rails.application.config.paths['db/migrate'] << File.expand_path("../../db/migrate", __dir__)`;
    fs.writeFileSync(addToDbMigrationFile, addToDbMigrationTxt);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the add_to_db_migration.rb file in it.`);

    // In the config/initializers, add a file named assets.rb with the following content:
    const assetsTxt = [
        "Rails.application.config.assets.precompile += %w(",
        "    # For Example, in the case there's a root action called tcp_debug, add the following lines to include css and javascripts for auto loading:",
        "    # main_tcp_debug.js",
        "    # main_tcp_debug.css",
        ")"
    ];
    writeTextFile(configInitializersDir, 'assets.rb', assetsTxt);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the assets.rb file in it.`);

    // Create a db folder in the submodule root, if it not already exist and in this case also add a seeds.rb file with the following content: puts "Seeding from Thecore TCP Debug"
    const dbDir = path.join(submodulesDir, submoduleNameDashcase, 'db');
    fs.mkdirSync(dbDir, { recursive: true });
    const seedsFile = path.join(dbDir, 'seeds.rb');
    const seedsTxt = `puts "Seeding from ${submoduleName}"`;
    fs.writeFileSync(seedsFile, seedsTxt);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the seeds.rb file in it.`);

    // Open the submodule version.rb file and replace the VERSION constant with the value 3.0.1
    const versionFile = path.join(submodulesDir, submoduleNameDashcase, 'lib', submoduleNameDashcase, 'version.rb');
    let version = fs.readFileSync(versionFile, 'utf8');
    version = version.replace(/VERSION = "0.1.0"/, 'VERSION = "3.0.1"');
    fs.writeFileSync(versionFile, version);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the version.rb file in it.`);

    // In the config/locales add, only if it's not already existing, a file named en.yml and another file named it.yml with the en: and it: keys respectively
    // and below them the admin -> actions key with the Dashcase version of the submodule name as value
    const commonObject = {
        admin: {
            actions: {
                [submoduleNameDashcase]: {
                    menu: submoduleNameDashcase,
                    title: submoduleNameDashcase,
                    breadcrumb: submoduleNameDashcase
                }
            }
        }
    }
    writeYAMLFile(configLocalesDir, 'en.yml', { en: commonObject });
    writeYAMLFile(configLocalesDir, 'it.yml', { it: commonObject });
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the en.yml and it.yml files in it.`);

    // Add to the config/initializers an abilities.rb file with the following content, the class name 
    // should be the camelcase version of the submodule name, i.e. ThecoreUiRailsAdmin:
    const abilitiesTxt = [
        "module Abilities",
        `    class ${submoduleName.replace(/ /g, '_').replace(/-/g, '_').replace(/\b\w/g, l => l.toUpperCase())}`,
        "        include CanCan::Ability",
        "        def initialize user",
        "            if user.present?",
        "                # Users' abilities",
        "                if user.admin?",
        "                    # Admins' abilities",
        "                end",
        "            end",
        "        end",
        "    end",
        "end"
    ];
    writeTextFile(configInitializersDir, 'abilities.rb', abilitiesTxt);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the abilities.rb file in it.`);

    // Add a github workflow action called gempush.yml with the following content:
    const gempushObject = {
        name: 'Ruby Gem',
        on: 'push',
        jobs: {
            build: {
                name: 'Build + Publish',
                'runs-on': 'ubuntu-latest',
                steps: [
                    {
                        uses: 'actions/checkout@v3'
                    },
                    {
                        name: 'Check if version already exists',
                        id: 'check_version',
                        run: [
                            'version=$(grep -oP \'VERSION = "\K[^"]+\' lib/*/version.rb | awk -F\'.\' \'{print $1"."$2"."$3})',
                            'git fetch --unshallow --tags',
                            'echo $?'
                        ]
                    },
                    {
                        name: 'Set git tag',
                        run: [
                            'git config --local user.email "noreply@alchemic.it"',
                            'git config --local user.name "AlchemicIT"',
                            'version=$(grep -oP \'VERSION = "\K[^"]+\' lib/*/version.rb | awk -F\'.\' \'{print $1"."$2"."$3})',
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
                            'printf -- "---\n:rubygems_api_key: ${GEM_HOST_API_KEY}\n" > $HOME/.gem/credentials',
                            'gem build *.gemspec',
                            'gem push *.gem'
                        ],
                        if: 'env.version_exists == \'false\'',
                        env: {
                            GEM_HOST_API_KEY: '${{secrets.RUBYGEMS_AUTH_TOKEN}}'
                        }
                    }
                ]
            }
        }
    };
    writeYAMLFile(path.join(submodulesDir, submoduleNameDashcase, '.github', 'workflows'), 'gempush.yml', gempushObject);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the gempush.yml file in it.`);

    // Also add a gitlab ci file suitable for building using the thecore devcontainer, it's content thus must be:
    const gitlabCiOject = {
        image: 'gabrieletassoni/vscode-devcontainers-thecore:3',
        variables: {
            GITLAB_EMAIL: email,
            GITLAB_USER_NAME: author,
            GITLAB_OAUTH_TARGET: 'https://oauth2:${GITLAB_PAT}@${GITLAB_HOST}/${CI_PROJECT_PATH}',
            GITLAB_GEM_REPO_TARGET: 'https://${GEM_HOST}/',
            GEM_HOST_API_KEY: '${GEMS_REPO_CREDENTIALS}'
        },
        stages: [
            'build',
            'release'
        ],
        build_gem: {
            rules: [
                {
                    if: '$CI_COMMIT_TAG',
                    when: 'never'
                },
                {
                    when: 'always'
                }
            ],
            stage: 'build',
            script: [
                '/usr/bin/gem-compile.sh'
            ]
        }
    };
    writeYAMLFile(path.join(submodulesDir, submoduleNameDashcase), '.gitlab-ci.yml', gitlabCiOject);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the .gitlab-ci.yml file in it.`);

    // add Thecore dependecies to the submodule Gemfile and gemspec, the two Thecore gems to add are: model_driven_api and thecore_ui_rails_admin both at version ~3.0
    const gemfile = path.join(submodulesDir, submoduleNameDashcase, 'Gemfile');
    let gemfileContent = fs.readFileSync(gemfile, 'utf8');
    gemfileContent += `\ngem 'model_driven_api', '~> 3.1'`;
    gemfileContent += `\ngem 'thecore_ui_rails_admin', '~> 3.2'`;
    fs.writeFileSync(gemfile, gemfileContent);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the Gemfile file in it.`);

    // Also add the Thecore gems to the gemspec, before the last `end` string found in the file
    let gemspecContent = fs.readFileSync(gemspec, 'utf8');
    // Add befor the last "end" string occurrence the two dependencies, in order not to break the validity of the gemspec file, keep in mind that there could be other "end" strings in the file, we have to find the last one
    const lastEndIndex = gemspecContent.lastIndexOf('end');
    gemspecContent = `${gemspecContent.substring(0, lastEndIndex)}  spec.add_dependency 'model_driven_api', '~> 3.1'\n  spec.add_dependency 'thecore_ui_rails_admin', '~> 3.2'\n${gemspecContent.substring(lastEndIndex)}`;
    fs.writeFileSync(gemspec, gemspecContent);
    outputChannel.appendLine(`The submodule ${submoduleName} has been created With the gemspec file in it.`);

    // Adding the submodule to the Gemfile.base
    const gemfileBase = path.join(workspaceRoot, 'Gemfile.base');
    fs.appendFileSync(gemfileBase, `\ngem '${submoduleNameDashcase}', path: 'vendor/submodules/${submoduleNameDashcase}'`);
    outputChannel.appendLine(`The submodule ${submoduleName} has been added to the Gemfile.base.`);
    vscode.window.showInformationMessage(`Submodule ${submoduleName} added to the Gemfile.base.`);
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}