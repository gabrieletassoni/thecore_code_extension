// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

// The code you place here will be executed every time your command is executed
function releaseApp() {
    // Display a message box to the user
    vscode.window.showInformationMessage('Releasing this Thecore 3 App.');

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

    // Check if `./vendor/custombuilds/` exists
    const custombuildsDir = path.join(vendorDir, 'custombuilds');
    if (!fs.existsSync(custombuildsDir)) {
        vscode.window.showErrorMessage('Thecore deploy failed. Please check the output for more information.');
        return;
    }
    // Find all the `Dockerfile` files inside `./vendor/custombuilds/`
    const dockerfiles = fs.readdirSync(custombuildsDir).filter(file => file === 'Dockerfile');
    if (dockerfiles.length === 0) {
        vscode.window.showWarningMessage('Thecore deploy failed. Please check the output for more information.');
        return;
    } else {
        // Run the `docker build` command for each `Dockerfile` file
        const { exec } = require('child_process');
        dockerfiles.forEach(dockerfile => {
            // If in the same directory of the Dockerfile there's a pre-compile.sh file, run it catching the output as environment variables
            const precompileScript = path.join(custombuildsDir, 'pre-compile.sh');
            if (fs.existsSync(precompileScript)) {
                // Run the `pre-compile.sh` script
                exec(`chmod +x ${precompileScript} && source ${precompileScript}`, (err, stdout, stderr) => {
                    if (err) {
                        vscode.window.showErrorMessage('Thecore deploy failed. Please check the output for more information.');
                        return;
                    }
                });
            }
            // If there's a Gemfile in the same directory of the Dockerfile, run `bundle install` to generate 
            // the `Gemfile.lock` file running `bundle update --gemfile `
            const gemfile = path.join(custombuildsDir, 'Gemfile');
            // cd ${custombuildsDir} && 
            exec(`bundle update --gemfile ${gemfile}`, (err, stdout, stderr) => {
                if (err) {
                    vscode.window.showErrorMessage('Thecore deploy failed. Please check the output for more information.');
                    return;
                }
            });
            // Be sure to be aligned with remote repository, fecching the latest changes and tags
            exec(`git pull && git fetch --all --tags --prune && git add . -A`, (err, stdout, stderr) => {
                if (err) {
                    vscode.window.showErrorMessage('Thecore deploy failed. Please check the output for more information.');
                    return;
                }
            });

            // Get the version from the VERSION file present in the root of the workspace
            const versionFile = path.join(workspaceRoot, 'VERSION');
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
                    exec(`git commit -a -m "${commitMessage}"`, (err, stdout, stderr) => {
                        if (err) {
                            vscode.window.showErrorMessage('Thecore deploy failed. Please check the output for more information.');
                            return;
                        }
                    });
                    // Tag the commit with the version
                    exec(`git tag -a ${version} -m "${commitMessage}"`, (err, stdout, stderr) => {
                        if (err) {
                            vscode.window.showErrorMessage('Thecore deploy failed. Please check the output for more information.');
                            return;
                        }
                    });
                    // Push the commit and the tag to the remote repository
                    exec(`git push && git push --tags`, (err, stdout, stderr) => {
                        if (err) {
                            vscode.window.showErrorMessage('Thecore deploy failed. Please check the output for more information.');
                            return;
                        }
                    });
                });
            }
        });
    }
}

// Make the following code available to the extension.js file
module.exports = {
    releaseApp,
}