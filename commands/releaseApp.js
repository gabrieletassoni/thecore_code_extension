// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// The code you place here will be executed every time your command is executed
/**
 * Releases Thecore 3 App.
 */
function perform() {
    // Display a message box to the user
    vscode.window.showInformationMessage('Releasing this Thecore 3 App.');

    // Check if we are inside a workspace
    if (!require('../libs/check').workspacePresence()) { return; }

    // Check if the workspace root is a Ruby on Rails app
    const rorDirs = require('../libs/check').rubyOnRailsAppValidity();
    if (!rorDirs) { return; }

    // Check if `./vendor/custombuilds/` exists
    const custombuildsDir = path.join(rorDirs.vendorDir, 'custombuilds');
    if (!require('../libs/check').fileExists(custombuildsDir)) { return; }
    // Find all the `Dockerfile` files inside `./vendor/custombuilds/`
    const dockerfiles = fs.readdirSync(custombuildsDir).filter(file => file === 'Dockerfile');
    // Run the `docker build` command for each `Dockerfile` file
    dockerfiles.forEach(dockerfile => {
        // If in the same directory of the Dockerfile there's a pre-compile.sh file, run it catching the output as environment variables
        // If there's a Gemfile in the same directory of the Dockerfile, run `bundle install` to generate 
        // the `Gemfile.lock` file running `bundle update --gemfile {}`
        // the `pre-compile.sh` script if exists, is located in the same direcotry of the Dockerfile
        const precompileScript = path.join(custombuildsDir, dockerfile.replace('Dockerfile', 'pre-compile.sh'));
        const gemfile = path.join(custombuildsDir, dockerfile.replace('Dockerfile', 'Gemfile'));
        if (fs.existsSync(precompileScript)) {
            // Run the `pre-compile.sh` script
            if (!require('../libs/os').execOrReturnFalse(`chmod +x ${precompileScript} && source ${precompileScript} && bundle update --gemfile ${gemfile}`)) { return; };
        } else {
            // Run the `bundle install` command
            if (!require('../libs/os').execOrReturnFalse(`bundle update --gemfile ${gemfile}`)) { return; };
        }
        
        // Be sure to be aligned with remote repository, fecching the latest changes and tags
        if (!require('../libs/os').execOrReturnFalse(`git pull && git fetch --all --tags --prune && git add . -A`)) { return; };

        // Get the version from the VERSION file present in the root of the workspace
        const versionFile = path.join(rorDirs.workspaceRoot, 'VERSION');
        let version = fs.readFileSync(versionFile, 'utf8');
        // Print an informative message about the version that is going to be released
        vscode.window.showInformationMessage(`Releasing version ${version} of the app.`);
        // Ask The the user if he wants to increment the Major, Minor or Patch version
        vscode.window.showQuickPick(['Major', 'Minor', 'Patch']).then((versionIncrement) => {
            // Increment the version in the version variable accordingly to the selected Pick
            if (versionIncrement === 'Major') {
                version = version.split('.');
                version[0] = parseInt(version[0]) + 1;
                version[1] = 0;
                version[2] = 0;
                version = version.join('.');
            } else if (versionIncrement === 'Minor') {
                version = version.split('.');
                version[1] = parseInt(version[1]) + 1;
                version[2] = 0;
                version = version.join('.');
            } else if (versionIncrement === 'Patch') {
                version = version.split('.');
                version[2] = parseInt(version[2]) + 1;
                version = version.join('.');
            }
            // Write the new version to the VERSION file
            fs.writeFileSync(versionFile, version);
            // Commit the changes
            // Ask the user for the commit message for the release
            vscode.window.showInputBox({
                placeHolder: 'Enter the commit message for the release',
                value: 'Release'
            }).then((commitMessage) => {
                // Commit the changes
                if (!require('../libs/os').execOrReturnFalse(`git commit -a -m "${commitMessage}"`)) { return; }
                // Tag the commit with the version
                if (!require('../libs/os').execOrReturnFalse(`git tag -a ${version} -m "${commitMessage}"`)) { return; }
                // Push the commit and the tag to the remote repository
                if (!require('../libs/os').execOrReturnFalse(`git push && git push --tags`)) { return; }
            });
        });
    });
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}