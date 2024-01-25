// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// The code you place here will be executed every time your command is executed
/**
 * Creates a Thecore 3 ATOM.
 */
function createATOM() {
    // Display a message box to the user
    vscode.window.showInformationMessage('Creating a Thecore 3 ATOM.');

    // Check if we are inside a workspace
    if (vscode.workspace.workspaceFolders === undefined) {
        vscode.window.showErrorMessage('No workspace is open. Please open a workspace and try again.');
        return;
    }

    // Check if the workspace root is a Ruby on Rails app
    const fs = require('fs');
    const path = require('path');
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const appDir = path.join(workspaceRoot, 'app');
    const binDir = path.join(workspaceRoot, 'bin');
    const configDir = path.join(workspaceRoot, 'config');
    const dbDir = path.join(workspaceRoot, 'db');
    const libDir = path.join(workspaceRoot, 'lib');
    const logDir = path.join(workspaceRoot, 'log');
    const publicDir = path.join(workspaceRoot, 'public');
    const storageDir = path.join(workspaceRoot, 'storage');
    const testDir = path.join(workspaceRoot, 'test');
    const tmpDir = path.join(workspaceRoot, 'tmp');
    const vendorDir = path.join(workspaceRoot, 'vendor');
    if (!fs.existsSync(appDir) || !fs.existsSync(binDir) || !fs.existsSync(configDir) || !fs.existsSync(dbDir) || !fs.existsSync(libDir) || !fs.existsSync(logDir) || !fs.existsSync(publicDir) || !fs.existsSync(storageDir) || !fs.existsSync(testDir) || !fs.existsSync(tmpDir) || !fs.existsSync(vendorDir)) {
        vscode.window.showErrorMessage('The workspace root is not a Ruby on Rails app. Please open a Ruby on Rails app and try again.');
        return;
    }

    // Check if `./vendor/submodules/` exists
    const submodulesDir = path.join(vendorDir, 'submodules');
    if (!fs.existsSync(submodulesDir)) {
        vscode.window.showErrorMessage('The workspace root is not a Ruby on Rails app with a Gemfile.base file in the root. Please open a Ruby on Rails app with a Gemfile.base file in the root and try again.');
        return;
    }

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
                            // Create the rails engine
                            createRailsEngine(submoduleName, submoduleNameDashcase, summary, description, author, email, url, submodulesDir, workspaceRoot);

                        });
                    });
                });
            });
        });
    });
}

function createRailsEngine(submoduleName, submoduleNameDashcase, summary, description, author, email, url, submodulesDir, workspaceRoot) {

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

    // Creating the submodule using the `rails plugin new "$ENGINE_NAME" -fG --full` command from the submodulesDir
    const exec = require('child_process').exec;
    const fs = require('fs');
    const path = require('path');
    exec(`cd ${submodulesDir} && rails plugin new "${submoduleNameDashcase}" -fG --full`, (err, stdout, stderr) => {
        if (err) {
            vscode.window.showErrorMessage('The submodule creation failed. Please check the output for more information.');
            return;
        }

        // In the gemspec file, replace the placeholders with the correct info provided by the user adding also the homepage
        const gemspecFile = path.join(submodulesDir, submoduleNameDashcase, `${submoduleNameDashcase}.gemspec`);
        let gemspec = fs.readFileSync(gemspecFile, 'utf8');
        gemspec = gemspec.replace(/TODO: Write your name/, author);
        gemspec = gemspec.replace(/TODO: Write your email address/, email);
        gemspec = gemspec.replace(/TODO: Write your summary/, summary);
        gemspec = gemspec.replace(/TODO: Write your description/, description);
        gemspec = gemspec.replace(/TODO: Write your website URL/, url);
        fs.writeFileSync(gemspecFile, gemspec);

        // Remove all spec.add_dependency  or spec.add_development_dependency lines from the gemspec file
        const lines = gemspec.split('\n');
        let newGemspec = '';
        lines.forEach((line) => {
            if (!line.includes('.add_dependency') && !line.includes('.add_development_dependency')) {
                newGemspec += `${line}\n`;
            }
        });
        fs.writeFileSync(gemspecFile, newGemspec);

        // Overwrite the .gitignore file with the string provided here
        const gitignore = ['# Created by https://www.toptal.com/developers/gitignore/api/osx,macos,ruby,linux,rails,windows',
            '# Edit at https://www.toptal.com/developers/gitignore?templates=osx,macos,ruby,linux,rails,windows',
            '### Linux ###',
            '*~',
            '# temporary files which can be created if a process still has a handle open of a deleted file',
            '.fuse_hidden*',
            '# KDE directory preferences',
            '.directory',
            '# Linux trash folder which might appear on any partition or disk',
            '.Trash-*',
            '# .nfs files are created when an open file is removed but is still being accessed',
            '.nfs*',
            '### macOS ###',
            '# General',
            '.DS_Store',
            '.AppleDouble',
            '.LSOverride',
            '# Icon must end with two \r',
            'Icon',
            '# Thumbnails',
            '._*',
            '# Files that might appear in the root of a volume',
            '.DocumentRevisions-V100',
            '.fseventsd',
            '.Spotlight-V100',
            '.TemporaryItems',
            '.Trashes',
            '.VolumeIcon.icns',
            '.com.apple.timemachine.donotpresent',
            '# Directories potentially created on remote AFP share',
            '.AppleDB',
            '.AppleDesktop',
            'Network Trash Folder',
            'Temporary Items',
            '.apdisk',
            '### OSX ###',
            '# General',
            '# Icon must end with two \r',
            '# Thumbnails',
            '# Files that might appear in the root of a volume',
            '# Directories potentially created on remote AFP share',
            '### Rails ###',
            '*.rbc',
            'capybara-*.html',
            '.rspec',
            '/db/*.sqlite3',
            '/db/*.sqlite3-journal',
            '/db/*.sqlite3-[0-9]*',
            '/public/system',
            '/coverage/',
            '/spec/tmp',
            '*.orig',
            'rerun.txt',
            'pickle-email-*.html',
            '# Ignore all logfiles and tempfiles.',
            '/log/*',
            '/tmp/*',
            '!/log/.keep',
            '!/tmp/.keep',
            '# TODO Comment out this rule if you are OK with secrets being uploaded to the repo',
            'config/initializers/secret_token.rb',
            'config/master.key',
            '# Only include if you have production secrets in this file, which is no longer a Rails default',
            '# config/secrets.yml',
            '# dotenv, dotenv-rails',
            '# TODO Comment out these rules if environment variables can be committed',
            '.env',
            '.env.*',
            '## Environment normalization:',
            '/.bundle',
            'vendor/bundle',
            '# these should all be checked in to normalize the environment:',
            '# Gemfile.lock, .ruby-version, .ruby-gemset',
            '# unless supporting rvm < 1.11.0 or doing something fancy, ignore this:',
            '.rvmrc',
            '# if using bower-rails ignore default bower_components path bower.json files',
            '/vendor/assets/bower_components',
            '*.bowerrc',
            'bower.json',
            '# Ignore pow environment settings',
            '.powenv',
            '# Ignore Byebug command history file.',
            '.byebug_history',
            '# Ignore node_modules',
            'node_modules/',
            '# Ignore precompiled javascript packs',
            '/public/packs',
            '/public/packs-test',
            '/public/assets',
            '# Ignore yarn files',
            '/yarn-error.log',
            'yarn-debug.log*',
            '.yarn-integrity',
            '# Ignore uploaded files in development',
            '/storage/*',
            '!/storage/.keep',
            '/public/uploads',
            '### Ruby ###',
            '*.gem',
            '/.config',
            '/InstalledFiles',
            '/pkg/',
            '/spec/reports/',
            '/spec/examples.txt',
            '/test/tmp/',
            '/test/version_tmp/',
            '/tmp/',
            '# Used by dotenv library to load environment variables.',
            '# .env',
            '# Ignore Byebug command history file.',
            '## Specific to RubyMotion:',
            '.dat*',
            '.repl_history',
            'build/',
            '*.bridgesupport',
            'build-iPhoneOS/',
            'build-iPhoneSimulator/',
            '## Specific to RubyMotion (use of CocoaPods):',
            '#',
            '# We recommend against adding the Pods directory to your .gitignore. However',
            '# you should judge for yourself, the pros and cons are mentioned at:',
            '# https://guides.cocoapods.org/using/using-cocoapods.html#should-i-check-the-pods-directory-into-source-control',
            '# vendor/Pods/',
            '## Documentation cache and generated files:',
            '/.yardoc/',
            '/_yardoc/',
            '/doc/',
            '/rdoc/',
            '/.bundle/',
            '/lib/bundler/man/',
            '# for a library or gem, you might want to ignore these files since the code is',
            '# intended to run in multiple environments; otherwise, check them in:',
            '# Gemfile.lock',
            '# .ruby-version',
            '# .ruby-gemset',
            '# unless supporting rvm < 1.11.0 or doing something fancy, ignore this:',
            '# Used by RuboCop. Remote config files pulled in from inherit_from directive.',
            '# .rubocop-https?--*',
            '### Windows ###',
            '# Windows thumbnail cache files',
            'Thumbs.db',
            'Thumbs.db:encryptable',
            'ehthumbs.db',
            'ehthumbs_vista.db',
            '# Dump file',
            '*.stackdump',
            '# Folder config file',
            '[Dd]esktop.ini',
            '# Recycle Bin used on file shares',
            '$RECYCLE.BIN/',
            '# Windows Installer files',
            '*.cab',
            '*.msi',
            '*.msix',
            '*.msm',
            '*.msp',
            '# Windows shortcuts',
            '*.lnk',
            '# End of https://www.toptal.com/developers/gitignore/api/osx,macos,ruby,linux,rails,windows',
            '.passwords',
            'vendor/bundle',
            'config/database.yml',
            '/app/assets/builds/*',
            '!/app/assets/builds/.keep',
            '/node_modules'
        ];
        fs.writeFileSync(path.join(workspaceRoot, '.gitignore'), gitignore.join('\n'));

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
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, '.keep'), '');
            }
        });

        // In the config/initializers add, only if it's not already existing, a file named after_initialize.rb with the following content:
        const afterInitializeFile = path.join(configInitializersDir, 'after_initialize.rb');
        if (!fs.existsSync(afterInitializeFile)) {
            const afterInitializeTxt = [
                "Rails.application.configure do",
                "    config.after_initialize do",
                "        # For example, it can be used to load a root action defined in lib, for example:",
                "        # require 'root_actions/tcp_debug'",
                "    end",
                "end"
            ].join('\n');
            fs.writeFileSync(afterInitializeFile, afterInitializeTxt);
        }

        // In the config/initializers, add a file named add_to_db_migration.rb with the following content:
        const addToDbMigrationFile = path.join(configInitializersDir, 'add_to_db_migration.rb');
        const addToDbMigrationTxt = `Rails.application.config.paths['db/migrate'] << File.expand_path("../../db/migrate", __dir__)`;
        fs.writeFileSync(addToDbMigrationFile, addToDbMigrationTxt);

        // In the config/initializers, add a file named assets.rb with the following content:
        const assetsFile = path.join(configInitializersDir, 'assets.rb');
        const assetsTxt = [
            "Rails.application.config.assets.precompile += %w(",
            "    # For Example, in the case there's a root action called tcp_debug, add the following lines to include css and javascripts for auto loading:",
            "    # main_tcp_debug.js",
            "    # main_tcp_debug.css",
            ")"
        ].join('\n');
        fs.writeFileSync(assetsFile, assetsTxt);

        // Create a db folder in the submodule root, if it not already exist and in this case also add a seeds.rb file with the following content: puts "Seeding from Thecore TCP Debug"
        const dbDir = path.join(submodulesDir, submoduleNameDashcase, 'db');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
            const seedsFile = path.join(dbDir, 'seeds.rb');
            const seedsTxt = `puts "Seeding from ${submoduleName}"`;
            fs.writeFileSync(seedsFile, seedsTxt);
        }

        // Open the submodule version.rb file and replace the VERSION constant with the value 3.0.1
        const versionFile = path.join(submodulesDir, submoduleNameDashcase, 'lib', submoduleNameDashcase, 'version.rb');
        let version = fs.readFileSync(versionFile, 'utf8');
        version = version.replace(/VERSION = "0.1.0"/, 'VERSION = "3.0.1"');
        fs.writeFileSync(versionFile, version);

        // In the config/locales add, only if it's not already existing, a file named en.yml and another file named it.yml with the en: and it: keys respectively
        // and below them the admin -> actions key with the Dashcase version of the submodule name as value
        const enFile = path.join(configLocalesDir, 'en.yml');
        const itFile = path.join(configLocalesDir, 'it.yml');
        if (!fs.existsSync(enFile)) {
            const enObject = {
                en: {
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
            };
            // Transform the object to yaml and write it to the file
            const yaml = require('js-yaml');
            const enYaml = yaml.dump(enObject, {
                'styles': {
                    '!!null': 'canonical' // dump null as ~
                },
                'sortKeys': false        // sort object keys
            });
            fs.writeFileSync(enFile, enYaml);
            // Write the same object to the it.yml file, replacing en with it
            const itObject = {
                it: {
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
            };
            const itYaml = yaml.dump(itObject, {
                'styles': {
                    '!!null': 'canonical' // dump null as ~
                },
                'sortKeys': false        // sort object keys
            });

            fs.writeFileSync(itFile, itYaml);

        }

        // Add to the config/initializers an abilities.rb file with the following content, the class name 
        // should be the camelcase version of the submodule name, i.e. ThecoreUiRailsAdmin:
        const abilitiesFile = path.join(configInitializersDir, 'abilities.rb');
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
        ].join('\n');
        fs.writeFileSync(abilitiesFile, abilitiesTxt);

        // Add a github workflow action called gempush.yml with the following content:
        const gempushFile = path.join(submodulesDir, submoduleNameDashcase, '.github', 'workflows', 'gempush.yml');
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
        // Transform the object to yaml and write it to the file
        const yaml = require('js-yaml');
        const gempushYaml = yaml.dump(gempushObject, {
            'styles': {
                '!!null': 'canonical' // dump null as ~
            },
            'sortKeys': false        // sort object keys
        });
        fs.writeFileSync(gempushFile, gempushYaml);

        // Also add a gitlab ci file suitable for building using the thecore devcontainer, it's content thus must be:
        const gitlabCiFile = path.join(submodulesDir, submoduleNameDashcase, '.gitlab-ci.yml');
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
        // Transform the object to yaml and write it to the file
        const gitlabCiYaml = yaml.dump(gitlabCiOject, {
            'styles': {
                '!!null': 'canonical' // dump null as ~
            },
            'sortKeys': false        // sort object keys
        });
        fs.writeFileSync(gitlabCiFile, gitlabCiYaml);

        // add Thecore dependecies to the submodule Gemfile and gemspec, the two Thecore gems to add are: model_driven_api and thecore_ui_rails_admin both at version ~3.0
        const gemfile = path.join(submodulesDir, submoduleNameDashcase, 'Gemfile');
        let gemfileContent = fs.readFileSync(gemfile, 'utf8');
        gemfileContent += `\ngem 'model_driven_api', '~> 3.1'`;
        gemfileContent += `\ngem 'thecore_ui_rails_admin', '~> 3.2'`;
        fs.writeFileSync(gemfile, gemfileContent);
        // Also add the Thecore gems to the gemspec, before the last `end` string found in the file
        let gemspecContent = fs.readFileSync(gemspec, 'utf8');
        // Add befor the last "end" string occurrence the two dependencies, in order not to break the validity of the gemspec file, keep in mind that there could be other "end" strings in the file, we have to find the last one
        const lastEndIndex = gemspecContent.lastIndexOf('end');
        gemspecContent = `${gemspecContent.substring(0, lastEndIndex)}  spec.add_dependency 'model_driven_api', '~> 3.1'\n  spec.add_dependency 'thecore_ui_rails_admin', '~> 3.2'\n${gemspecContent.substring(lastEndIndex)}`;
        fs.writeFileSync(gemspec, gemspecContent);

        // Adding the submodule to the Gemfile.base
        const gemfileBase = path.join(workspaceRoot, 'Gemfile.base');
        fs.appendFileSync(gemfileBase, `\ngem '${submoduleNameDashcase}', path: 'vendor/submodules/${submoduleNameDashcase}'`);
        vscode.window.showInformationMessage(`Submodule ${submoduleName} added to the Gemfile.base.`);
    });
}

// Make the following code available to the extension.js file
module.exports = {
    createATOM,
}