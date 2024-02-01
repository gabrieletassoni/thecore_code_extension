// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { execShell } = require('../libs/os');
const { workspaceExixtence, rubyOnRailsAppValidity, fileExistence } = require('../libs/check');

// The code you place here will be executed every time your command is executed
/**
 * Releases Thecore 3 App.
 */
async function perform() {
    // Display a message box to the user
    vscode.window.showInformationMessage('Releasing this Thecore 3 App.');

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Release App');
    outputChannel.show();
    outputChannel.appendLine('Releasing this Thecore 3 App.');

    // Check if we are inside a workspace
    if (!workspaceExixtence(outputChannel)) { return; }

    // Check if the workspace root is a Ruby on Rails app
    const rorDirs = rubyOnRailsAppValidity(false, outputChannel);
    if (!rorDirs) { return; }

    // Check if `./vendor/custombuilds/` exists
    const custombuildsDir = path.join(rorDirs.vendorDir, 'custombuilds');
    if (!fileExistence(custombuildsDir)) { return; }
    // Find all the `Dockerfile` files inside `./vendor/custombuilds/`
    const dockerfiles = fs.readdirSync(custombuildsDir).filter(file => file === 'Dockerfile');
    // Run the `docker build` command for each `Dockerfile` file
    dockerfiles.forEach(async dockerfile => {
        // If in the same directory of the Dockerfile there's a pre-compile.sh file, run it catching the output as environment variables
        // If there's a Gemfile in the same directory of the Dockerfile, run `bundle install` to generate 
        // the `Gemfile.lock` file running `bundle update --gemfile {}`
        // the `pre-compile.sh` script if exists, is located in the same direcotry of the Dockerfile
        const precompileScript = path.join(custombuildsDir, dockerfile.replace('Dockerfile', 'pre-compile.sh'));
        const gemfile = path.join(custombuildsDir, dockerfile.replace('Dockerfile', 'Gemfile'));
        if (fs.existsSync(precompileScript)) {
            // Run the `pre-compile.sh` script
            if (!await execShell(`chmod +x ${precompileScript} && source ${precompileScript} && bundle update --gemfile ${gemfile}`, custombuildsDir, outputChannel)) { return; };
        } else {
            // Run the `bundle install` command
            if (!await execShell(`bundle update --gemfile ${gemfile}`, custombuildsDir, outputChannel)) { return; };
        }
        
        // Be sure to be aligned with remote repository, fecching the latest changes and tags
        if (!await execShell(`git pull && git fetch --all --tags --prune && git add . -A`, custombuildsDir, outputChannel)) { return; };

        // Get the version from the VERSION file present in the root of the workspace
        const versionFile = path.join(rorDirs.workspaceRoot, 'VERSION');
        let version = fs.readFileSync(versionFile, 'utf8');
        // Print an informative message about the version that is going to be released
        outputChannel.appendLine(`Releasing version ${version} of the app.`);
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
            }).then(async (commitMessage) => {
                // Commit the changes
                if (!await execShell(`git commit -a -m "${commitMessage}"`, custombuildsDir, outputChannel)) { return; }
                // Tag the commit with the version
                if (!await execShell(`git tag -a ${version} -m "${commitMessage}"`, custombuildsDir, outputChannel)) { return; }
                // Push the commit and the tag to the remote repository
                if (!await execShell(`git push && git push --tags`, custombuildsDir, outputChannel)) { return; }
            });
        });
    });
    outputChannel.appendLine('Thecore 3 App released successfully.');
    vscode.window.showInformationMessage('Thecore 3 App released successfully.');
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}