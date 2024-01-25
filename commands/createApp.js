// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// The code you place here will be executed every time your command is executed
function createApp() {
    // Display a message box to the user
    vscode.window.showInformationMessage('Creating a Thecore 3 App.');

    // Check if we are inside a workspace
    if (vscode.workspace.workspaceFolders === undefined) {
        vscode.window.showErrorMessage('No workspace is open. Please open a workspace and try again.');
        return;
    }

    // Check if the workspace is empty
    if (vscode.workspace.workspaceFolders.length > 1) {
        vscode.window.showErrorMessage('The workspace is not empty. Please open an empty workspace and try again.');
        return;
    }

    // Check if we are in the root of the workspace
    if (vscode.workspace.workspaceFolders[0].uri.fsPath !== vscode.workspace.workspaceFolders[0].uri.fsPath) {
        vscode.window.showErrorMessage('Please open the workspace root and try again.');
        return;
    }

    // Check if ruby, rails and bundle commands are available
    const { exec } = require('child_process');
    exec('ruby -v', (err, stdout, stderr) => {
        if (err) {
            vscode.window.showErrorMessage('Ruby is not installed. Please install it and try again.');
            return;
        }
        exec('rails -v', (err, stdout, stderr) => {
            if (err) {
                vscode.window.showErrorMessage('Rails is not installed. Please install it and try again.');
                return;
            }
            exec('bundle -v', (err, stdout, stderr) => {
                if (err) {
                    vscode.window.showErrorMessage('Bundler is not installed. Please install it and try again.');
                    return;
                }
            });
        });
    });

    // IF we are here, this is a valid workspace, so we can create the app
    // Run the rails new command
    const fs = require('fs');
    const path = require('path');
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const appName = path.basename(workspaceRoot);
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
    if (fs.existsSync(appDir) || fs.existsSync(binDir) || fs.existsSync(configDir) || fs.existsSync(dbDir) || fs.existsSync(libDir) || fs.existsSync(logDir) || fs.existsSync(publicDir) || fs.existsSync(storageDir) || fs.existsSync(testDir) || fs.existsSync(tmpDir) || fs.existsSync(vendorDir)) {
        vscode.window.showErrorMessage('The workspace is not empty. Please open an empty workspace and try again.');
        return;
    }

    // Run the rails new command
    exec(`rails new . --database=postgresql --asset-pipeline=sprockets --skip-git`);

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

    // Initialize git with main branch and commit the initial files
    exec(`git init`);
    exec(`git checkout -b main`);
    exec(`git add .`);
    exec(`git commit -m "Initial commit"`);
    exec(`git branch -M main`);

    // Check if the file Gemfile exists and if it does, append the following gems to the Gemfile which is already in place: rails-erd, rails_admin, devise, cancancan
    const gemfile = path.join(workspaceRoot, 'Gemfile');
    if (fs.existsSync(gemfile)) {
        // Read the Gemfile
        const gemfileContent = fs.readFileSync(gemfile, 'utf8');
        // Append the gems to the Gemfile
        const gemfileContentWithGems = gemfileContent + "\ngem 'rails-erd', group: :development\ngem 'rails_admin'\ngem 'devise'\ngem 'cancancan'";
        // Write the Gemfile
        fs.writeFileSync(gemfile, gemfileContentWithGems);

        /* Run the following commands:
            # Install the gems
            bundle install
            rails generate devise:install
            rails g rails_admin:install app --asset=sprockets
            # Rails Admin added sassc gem, so I need to bundle install before going on
            bundle install
            rails active_storage:install
            rails action_text:install
            # To setup newly added imge_processing gem
            bundle install
            rails action_mailbox:install
            rails g cancan:ability
            rails g erd:install
        */
        exec(`bundle install`);
        exec(`rails generate devise:install`);
        exec(`rails g rails_admin:install app --asset=sprockets`);
        exec(`bundle install`);
        exec(`rails active_storage:install`);
        exec(`rails action_text:install`);
        exec(`bundle install`);
        exec(`rails action_mailbox:install`);
        exec(`rails g cancan:ability`);
        exec(`rails g erd:install`);

        /* Add to the gemfileContent the following lines:
            gem 'model_driven_api', '~> 3.0'
            gem 'thecore_ui_rails_admin', '~> 3.0'
        */
        const gemfileContentWithGems2 = gemfileContentWithGems + "\ngem 'model_driven_api', '~> 3.0'\ngem 'thecore_ui_rails_admin', '~> 3.0'";
        // Write the Gemfile
        fs.writeFileSync(gemfile, gemfileContentWithGems2);
        // Run the bundle install command
        exec(`bundle install`);

        // Rename the Gemfile to Gemfile.base
        fs.renameSync(gemfile, path.join(workspaceRoot, 'Gemfile.base'));
        // Create a new Gemfile with this content: eval File.read('Gemfile.base')
        const gemfileContent3 = "eval File.read('Gemfile.base')";
        // Write the Gemfile
        fs.writeFileSync(gemfile, gemfileContent3);

        // Add a gitlab-ci.yml file with the following content:
        const gitlabCiObject = {
            "image": "gabrieletassoni/vscode-devcontainers-thecore:3",
            "variables": {
                "DISABLE_SPRING": 1
            },
            "stages": [
                "build",
                "test",
                "delivery",
                "deploy"
            ],
            "cache": {
                "key": "thecore3cache",
                "paths": [
                    "vendor/bundle",
                    "app/assets",
                    "lib/assets",
                    "public/assets"
                ]
            },
            "build": {
                "stage": "build",
                "only": [
                    "tags"
                ],
                "except": [
                    "branches"
                ],
                "script": [
                    "sudo -E /usr/bin/app-compile.sh"
                ]
            },
            "to-dev": {
                "when": "on_success",
                "stage": "delivery",
                "cache": [],
                "only": [
                    "tags"
                ],
                "except": [
                    "branches"
                ],
                "variables": {
                    "TARGETENV": "dev"
                },
                "script": [
                    "/usr/bin/docker-deploy.sh"
                ]
            },
            "to-prod": {
                "when": "manual",
                "stage": "deploy",
                "cache": [],
                "only": [
                    "tags"
                ],
                "except": [
                    "branches"
                ],
                "script": [
                    "/usr/bin/docker-deploy.sh"
                ]
            }
        };

        // Transform the JSON to YAML and write it to the file
        const yaml = require('js-yaml');
        const gitlabCiYML = yaml.dump(gitlabCiObject, {
            'styles': {
                '!!null': 'canonical' // dump null as ~
            },
            'sortKeys': false        // sort object keys
        });
        fs.writeFileSync(path.join(workspaceRoot, '.gitlab-ci.yml'), gitlabCiYML);

        // Create a similar business logic for the .gitlab-ci.yml file also for Github Actions
        const githubActionsObject = {
            "name": "CI",
            "on": [
                "push",
                "pull_request"
            ],
            "jobs": {
                "build": {
                    "runs-on": "ubuntu-latest",
                    "steps": [
                        {
                            "uses": "actions/checkout@v2"
                        },
                        {
                            "name": "Set up Ruby 3.3",
                            "uses": "ruby/setup-ruby@v1",
                            "with": {
                                "ruby-version": "3.3"
                            }
                        },
                        {
                            "name": "Install dependencies",
                            "run": "bundle install --jobs 4 --retry 3"
                        },
                        {
                            "name": "Run tests",
                            "run": "bundle exec rake"
                        }
                    ]
                }
            }
        };

        // Transform the JSON to YAML and write it to the file
        const githubActionsYML = yaml.dump(githubActionsObject, {
            'styles': {
                '!!null': 'canonical' // dump null as ~
            },
            'sortKeys': false        // sort object keys
        });
        fs.writeFileSync(path.join(workspaceRoot, '.github', 'workflows', 'ci.yml'), githubActionsYML);

        // Create a version file with the following content: 3.0.1
        fs.writeFileSync(path.join(workspaceRoot, 'VERSION'), '3.0.1');

        // Run the command `rails thecore:db:init`
        exec(`rails thecore:db:init`);

        // Create empty .keep files into `vendor/custombuilds` and `vendor/deploytargets` directories after having created them if they don't exist
        const vendorDir = path.join(workspaceRoot, 'vendor');
        const custombuildsDir = path.join(vendorDir, 'custombuilds');
        const deploytargetsDir = path.join(vendorDir, 'deploytargets');
        if (!fs.existsSync(custombuildsDir)) {
            fs.mkdirSync(custombuildsDir, { recursive: true }, (err) => {
                if (err) {
                    vscode.window.showErrorMessage(`Error creating the ${custombuildsDir} directory: ${err.message}`);
                    return;
                }
            });
        }
        if (!fs.existsSync(deploytargetsDir)) {
            fs.mkdirSync(deploytargetsDir);
        }
        // If the .keep files are already present, don't create them again
        const keepFile = path.join(custombuildsDir, '.keep');
        if (!fs.existsSync(keepFile)) {
            fs.writeFileSync(keepFile, '');
        }
        const keepFile2 = path.join(deploytargetsDir, '.keep');
        if (!fs.existsSync(keepFile2)) {
            fs.writeFileSync(keepFile2, '');
        } 

        // Add and commit the changes
        exec(`git add .`);
        exec(`git commit -m "Added Thecore 3 gems and configuration"`);

        // If no errors occurred, show a success message
        vscode.window.showInformationMessage('Thecore 3 App created successfully.');
    }

}

// Make the following code available to the extension.js file
module.exports = {
    createApp,
}