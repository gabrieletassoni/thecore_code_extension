// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const fs = require('fs');
const path = require('path');
// Add lodash merge
const deepMerge = require('lodash/merge');
const yaml = require('js-yaml');

function writeJSONFile(dir, jsonFile, jsonContentObject, outputChannel) {
    outputChannel.appendLine(`📝 Creating JSON file ${jsonFile} inside ${dir}.`);
    // Creating the json file inside the directory
    const targetFile = path.join(dir, jsonFile);
    // Writing the file
    fs.writeFileSync(targetFile, JSON.stringify(jsonContentObject, null, 4));
    outputChannel.appendLine(` - JSON file ${jsonFile} created successfully.`);
}

function writeYAMLFile(dir, yamlFile, yamlContentObject, outputChannel) {
    outputChannel.appendLine(`📝 Creating YAML file ${yamlFile} inside ${dir}.`);
    // Creating the yaml file inside the directory
    const targetFile = path.join(dir, yamlFile);
    // Writing the file
    const yamlContent = yaml.dump(yamlContentObject, {
        'styles': {
            '!!null': 'canonical' // dump null as ~
        },
        'sortKeys': false        // sort object keys
    });
    fs.writeFileSync(targetFile, yamlContent);
    outputChannel.appendLine(` - YAML file ${yamlFile} created successfully.`);
}


function mergeYmlContent(ymlDir, ymlFile, rootActionName, rootActionNameTitleCase, rootElement, outputChannel) {
    // Synchronicity used only for the example (it stops the Event Loop). 
    const data = fs.readFileSync(path.join(ymlDir, ymlFile), 'utf8');
    const parsedData = yaml.load(data);
    deepMerge(parsedData, {
        [rootElement]: {
            admin: {
                actions: {
                    [rootActionName]: {
                        menu: rootActionNameTitleCase,
                        title: rootActionNameTitleCase,
                        breadcrumb: rootActionNameTitleCase,
                    }
                }
            }
        }
    });
    writeYAMLFile(ymlDir, ymlFile, parsedData, outputChannel);
}

function writeTextFile(dir, textFile, textContent, outputChannel) {
    outputChannel.appendLine(`📝 Creating text file ${textFile} inside ${dir}.`);
    // Creating the text file inside the directory
    const targetFile = path.join(dir, textFile);
    // Writing the file
    // if the textContent is an array, we need to join it
    if (Array.isArray(textContent)) {
        textContent = textContent.join('\n');
    }
    fs.writeFileSync(targetFile, textContent);
    outputChannel.appendLine(` - Text file ${textFile} created successfully.`);
}

function createGitignoreFile(dir, outputChannel) {
    // Writing the file
    const textContent = [
        '# Created by https://www.toptal.com/developers/gitignore/api/osx,macos,ruby,linux,rails,windows',
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
    writeTextFile(dir, '.gitignore', textContent, outputChannel);
}

// Make the following code available to the extension.js file
module.exports = {
    writeJSONFile,
    writeYAMLFile,
    writeTextFile,
    createGitignoreFile,
    mergeYmlContent,
}