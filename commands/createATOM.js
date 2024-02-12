// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { commandExistence, workspaceExixtence, rubyOnRailsAppValidity, fileExistence } = require('../libs/check');
const { execShell, mkDirP } = require('../libs/os');
const { createGitignoreFile, writeTextFile, writeYAMLFile } = require('../libs/configs');
const { snakeToClassName } = require('../libs/helpers');

// The code you place here will be executed every time your command is executed
/**
 * Creates a Thecore 3 ATOM.
 */
async function perform() {
    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Create ATOM');
    outputChannel.show();
    outputChannel.appendLine('Creating a Thecore 3 ATOM.');
    try {

        // Check if we are inside a workspace
        if (!workspaceExixtence(outputChannel)) { return; }

        // Check if the workspace root is a Ruby on Rails app
        const rorDirs = rubyOnRailsAppValidity(false, outputChannel);
        if (!rorDirs) { return; }

        // Check if ruby, rails and bundle commands are available
        const commands = ['ruby', 'rails', 'bundle'];
        for (const command of commands) {
            if (!commandExistence(command, outputChannel)) { return; }
        }

        // Check if `./vendor/submodules/` exists
        const submodulesDir = path.join(rorDirs.vendorDir, 'submodules');
        if (!fileExistence(submodulesDir, outputChannel)) { return; }

        /*
         * Asking the user some info useful for generating a rails engine, without setting a default value, but using only the placeholder:
         */

        // Asking the user for the name of the submodule
        const submoduleName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: 'Enter the name of the submodule, i.e. TCP Debugger',
            validateInput: (submoduleName) => {
                if (!submoduleName) {
                    return '❌ The ATOM name is not valid. Please try again.';
                }
                return null;
            }
        });
        if (!submoduleName) {
            outputChannel.appendLine('❌ The ATOM name cannot be empty. Please try again.');
            return; 
        }
        // Make a constant with the dashcase version of the submodule name
        const submoduleNameSnakeCase = submoduleName.replace(/ /g, '_').toLowerCase();

        // Ask the user for some info useful for generating a rails engine, without setting a default value, but using only the placeholder:
        // - summary
        // - description
        // - author
        // - email
        // - url
        // If each of the previous info is not valid, fail, in addition, if email is not an email, fail and if url is not an url, fail
        const summary = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: 'Enter the summary of the submodule, i.e. TCP Debugger',
            validateInput: (summary) => {
                if (!summary) {
                    return '❌ The summary is not valid. Please try again.';
                }
                return null;
            }
        });
        const description = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: 'Enter the description of the submodule, i.e. TCP Debugger',
            validateInput: (description) => {
                if (!description) {
                    return '❌ The description is not valid. Please try again.';
                }
                return null;
            }
        });
        const author = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: 'Enter the author of the submodule, i.e. Alchemic IT',
            validateInput: (author) => {
                if (!author) {
                    return '❌ The author is not valid. Please try again.';
                }
                return null;
            }
        });
        const email = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: 'Enter the email of the submodule author, i.e.',
            validateInput: (email) => {
                if (!email || !email.includes('@')) {
                    return '❌ The email is not valid. Please try again.';
                }
                return null;
            }
        });
        const url = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            placeHolder: 'Enter the url of the submodule, i.e.',
            validateInput: (url) => {
                if (!url || !url.startsWith('http')) {
                    return '❌ The url is not valid. Please try again.';
                }
                return null;
            }
        });

        // Create the rails engine
        // Only if all the previous info are valid, create the rails engine
        await createRailsEngine(submoduleName, submoduleNameSnakeCase, summary, description, author, email, url, submodulesDir, outputChannel);

        // Add to the main app Gemfile.base file the line `gem "${submoduleNameSnakeCase}", path: "vendor/submodules/${submoduleNameSnakeCase}"`
        const mainAppGemfile = path.join(rorDirs.appDir, 'Gemfile.base');
        const gemfileContent = fs.readFileSync(mainAppGemfile, 'utf8');
        const newGemfileContent = gemfileContent + `\ngem "${submoduleNameSnakeCase}", path: "vendor/submodules/${submoduleNameSnakeCase}"`;
        fs.writeFileSync(mainAppGemfile, newGemfileContent);
        outputChannel.appendLine(` - Added the ${submoduleNameSnakeCase} gem to the main app Gemfile.base file.`);

        // Inform the user the submodule has been created succesfully
        outputChannel.appendLine(`✅ The submodule ${submoduleName} has been created succesfully.`);
        vscode.window.showInformationMessage(`The submodule ${submoduleName} has been created succesfully.`);
    } catch (error) {
        console.error(error);
        outputChannel.appendLine(`❌ An error occurred: ${error.message}`);
        vscode.window.showErrorMessage('An error occurred while creating the Thecore 3 ATOM. Please check the output channel for more details.');
    }
}

function setupGemspecFile(submodulesDir, submoduleName, submoduleNameSnakeCase, summary, description, author, email, url, outputChannel) {
    // In the gemspec file, replace the placeholders with the correct info provided by the user adding also the homepage
    const gemspecFile = path.join(submodulesDir, submoduleNameSnakeCase, `${submoduleNameSnakeCase}.gemspec`);
    let gemspec = fs.readFileSync(gemspecFile, 'utf8');
    // Remove all spec.add_dependency  or spec.add_development_dependency lines from the gemspec file
    const lines = gemspec.split('\n');
    let newGemspec = '';
    lines.forEach((line) => {
        if (line.includes('.add_dependency')) {
            newGemspec += `  spec.add_dependency 'model_driven_api', '~> 3.1'\n  spec.add_dependency 'thecore_ui_rails_admin', '~> 3.2'\n`
        } else if (line.includes('.authors')) {
            newGemspec += `  spec.authors = ["${author}"]\n`;
        } else if (line.includes('.email')) {
            newGemspec += `  spec.email = ["${email}"]\n`;
        } else if (line.includes('.homepage')) {
            newGemspec += `  spec.homepage = "${url}"\n`;
        } else if (line.includes('.summary')) {
            newGemspec += `  spec.summary = "${summary}"\n`;
        }else if (line.includes('.description')) {
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
    // Write the file, overwriting existing one
    fs.writeFileSync(gemspecFile, newGemspec);
    outputChannel.appendLine(`Modified the ${submoduleName} gemspec file.`);
}

function createThecoreFolders(submodulesDir, submoduleNameSnakeCase, outputChannel) {
    const dirs = [
        path.join(submodulesDir, submoduleNameSnakeCase, 'db', 'migrate'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'app', 'models', 'concerns', 'api'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'app', 'models', 'concerns', 'rails_admin'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'config', 'initializers'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'config', 'locales'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'lib', 'root_actions'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'lib', 'member_actions'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'lib', 'collection_actions'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'app', 'assets', 'javascripts'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'app', 'assets', 'stylesheets'),
        path.join(submodulesDir, submoduleNameSnakeCase, 'app', 'views', 'rails_admin', 'main'),
        path.join(submodulesDir, submoduleNameSnakeCase, '.github', 'workflows'),
    ];

    dirs.forEach((dir) => {
        mkDirP(dir, outputChannel);
    });
}

function addInitializers(submodulesDir, submoduleNameSnakeCase, outputChannel) {
    const configInitializersDir = path.join(submodulesDir, submoduleNameSnakeCase, 'config', 'initializers');

    // After initialize
    const afterInitializeTxt = [
        "Rails.application.configure do",
        "    config.after_initialize do",
        "        # For example, it can be used to load a root action defined in lib, for example:",
        "        # require 'root_actions/tcp_debug'",
        "    end",
        "end"
    ];
    writeTextFile(configInitializersDir, 'after_initialize.rb', afterInitializeTxt, outputChannel);

    // Add to db migration
    const addToDbMigrationTxt = `Rails.application.config.paths['db/migrate'] << File.expand_path("../../db/migrate", __dir__)`;
    writeTextFile(configInitializersDir, 'add_to_db_migration.rb', addToDbMigrationTxt, outputChannel);

    // Add to assets load path
    const assetsTxt = [
        "# PLEASE, uncomment if needed.",
        "# For Example: in the case there's a root action called tcp_debug, add the following lines to include css and javascripts for auto loading:",
        "# Rails.application.config.assets.precompile += %w(",
        "#   main_tcp_debug.js",
        "#   main_tcp_debug.css",
        "# )"
    ];
    writeTextFile(configInitializersDir, 'assets.rb', assetsTxt, outputChannel);

    // Abiliites File
    const abilitiesTxt = [
        "module Abilities",
        `    class ${snakeToClassName(submoduleNameSnakeCase)}`,
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
    writeTextFile(configInitializersDir, 'abilities.rb', abilitiesTxt, outputChannel);

}

function addDBFiles(submodulesDir, submoduleNameSnakeCase, outputChannel) {
    const dbDir = path.join(submodulesDir, submoduleNameSnakeCase, 'db');
    const seedsTxt = `puts "Seeding Data into DB from ${submoduleNameSnakeCase}"`;
    writeTextFile(dbDir, 'seeds.rb', seedsTxt, outputChannel);
}

function addLocaleFiles(submodulesDir, submoduleNameSnakeCase, outputChannel) {
    const configLocalesDir = path.join(submodulesDir, submoduleNameSnakeCase, 'config', 'locales');
    // In the config/locales add, only if it's not already existing, a file named en.yml and another file named it.yml with the en: and it: keys respectively
    // and below them the admin -> actions key with the Dashcase version of the submodule name as value
    writeYAMLFile(configLocalesDir, 'en.yml', { en: null }, outputChannel);
    writeYAMLFile(configLocalesDir, 'it.yml', { it: null }, outputChannel);
}

function addCICDFiles(email, author, submodulesDir, submoduleNameSnakeCase, outputChannel) {
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
    writeYAMLFile(path.join(submodulesDir, submoduleNameSnakeCase, '.github', 'workflows'), 'gempush.yml', gempushObject, outputChannel);

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
    writeYAMLFile(path.join(submodulesDir, submoduleNameSnakeCase), '.gitlab-ci.yml', gitlabCiOject, outputChannel);
}

function setupGemfile(submodulesDir, submoduleNameSnakeCase, outputChannel) {
    // add Thecore dependecies to the submodule Gemfile and gemspec, the two Thecore gems to add are: model_driven_api and thecore_ui_rails_admin both at version ~3.0
    const gemfile = path.join(submodulesDir, submoduleNameSnakeCase, 'Gemfile');
    let gemfileContent = fs.readFileSync(gemfile, 'utf8');
    gemfileContent += `\ngem 'pg'`;
    gemfileContent += `\ngem 'model_driven_api', '~> 3.1'`;
    gemfileContent += `\ngem 'thecore_ui_rails_admin', '~> 3.2'`;
    fs.writeFileSync(gemfile, gemfileContent);

    // Add the requires to the lib/${submoduleNameSnakeCase}.rb file
    const libFile = path.join(submodulesDir, submoduleNameSnakeCase, 'lib', `${submoduleNameSnakeCase}.rb`);
    let libFileContent = fs.readFileSync(libFile, 'utf8');
    libFileContent += `\nrequire 'model_driven_api'`;
    libFileContent += `\nrequire 'thecore_ui_rails_admin'`;
    fs.writeFileSync(libFile, libFileContent);
    
    outputChannel.appendLine(` - Added the thecore dependecies to ${submoduleNameSnakeCase} Gemfile file.`);
}

async function createRailsEngine(submoduleName, submoduleNameSnakeCase, summary, description, author, email, url, submodulesDir, outputChannel) {
    // Creating the submodule using the `rails plugin new "$ENGINE_NAME" -fG --full` command from the submodulesDir
    outputChannel.appendLine(`Creating the submodule ${submoduleName} using the rails plugin new command.`);
    
    try {
        await execShell(`rails plugin new "${path.join(submodulesDir, submoduleNameSnakeCase)}" -fG --skip-gemfile-entry --skip-hotwire --full`, submodulesDir, outputChannel);  

        // Overwrite the .gitignore file with the string provided here
        createGitignoreFile(path.join(submodulesDir, submoduleNameSnakeCase), outputChannel);

        // Create Thecore folders inside the submodule root
        createThecoreFolders(submodulesDir, submoduleNameSnakeCase, outputChannel);

        // Create intiaizer files inside the config/initializers folder
        addInitializers(submodulesDir, submoduleNameSnakeCase, outputChannel);

        addDBFiles(submodulesDir, submoduleNameSnakeCase, outputChannel);

        addLocaleFiles(submodulesDir, submoduleNameSnakeCase, outputChannel);

        addCICDFiles(email, author, submodulesDir, submoduleNameSnakeCase, outputChannel);

        setupGemfile(submodulesDir, submoduleNameSnakeCase, outputChannel);
        // Setup the gemspec file
        setupGemspecFile(submodulesDir, submoduleName, submoduleNameSnakeCase, summary, description, author, email, url, outputChannel);
    } catch (error) {
        throw error;
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}