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
        const dirs = [dbMigrateDir, appModelsConcernsApiDir, appModelsConcernsRailsAdminDir, configInitializersDir, configLocalesDir];
        dirs.forEach((dir) => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, '.keep'), '');
            }
        });

        // add Thecore dependecies to the submodule Gemfile and gemspec, the two Thecore gems to add are: model_driven_api and thecore_ui_rails_admin both at version ~3.0
        const gemfile = path.join(submodulesDir, submoduleNameDashcase, 'Gemfile');
        let gemfileContent = fs.readFileSync(gemfile, 'utf8');
        gemfileContent += `\ngem 'model_driven_api', '~> 3.0'`;
        gemfileContent += `\ngem 'thecore_ui_rails_admin', '~> 3.0'`;
        fs.writeFileSync(gemfile, gemfileContent);
        // Also add the Thecore gems to the gemspec
        let gemspecContent = fs.readFileSync(gemspec, 'utf8');
        

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