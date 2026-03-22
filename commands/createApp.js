// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { execShell, mkDirP } = require('../libs/os');
const { workspaceExixtence, workspaceEmptiness, commandExistence, rubyOnRailsAppValidity } = require('../libs/check');
const { renderTemplate } = require('../libs/templates');
const { writeTextFile } = require('../libs/configs');

// The code you place here will be executed every time your command is executed
/**
 * Creates a new Thecore 3 app in the current workspace.
 */
async function perform() {
    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Create App');
    outputChannel.show();
    outputChannel.appendLine('Thecore 3 App creation started.');

    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const win = vscode.window;

    try {
        // Check if we are inside a workspace
        if (!workspaceExixtence(outputChannel)) { return; }
    
        // Check if the workspace is empty
        if (!workspaceEmptiness(outputChannel)) { return; }
    
        // Check if ruby, rails and bundle commands are available
        const commands = ['ruby', 'rails', 'bundle'];
        for (const command of commands) {
            outputChannel.appendLine(`Checking if the ${command} command is available.`);
            if (!commandExistence(command, outputChannel)) {
                outputChannel.appendLine(`The ${command} command is not available. Please install it and try again.`);
                return; 
            }
        }
        
        // Check if the workspace root is a Ruby on Rails app
        if (rubyOnRailsAppValidity(true, outputChannel)) { 
            return; 
        }
    
        // Inform all checks are OK, so we can proceed, and keep the information dialog on for al the execution of this script (it will be closed at the end)
        outputChannel.appendLine('All checks are OK, proceeding with the creation of the Thecore 3 App.');
    
        // This fixes the IDE to VS Code with remote devcontainers, TODO: check how to make it general
        await execShell("sudo chown -R vscode:vscode .", workspaceRoot, outputChannel);
        // Run the rails new command `rails new . --database=postgresql --asset-pipeline=sprockets --skip-git` being sure that it will be run from the workspace root and output the stdout and stderr to the ${workspaceRoot}/tmp/rails_new.log file
        await execShell(`rails new . --database=postgresql --asset-pipeline=sprockets --skip-git`, workspaceRoot, outputChannel);
    
        // Overwrite the .gitignore file with the string provided here
        require('../libs/configs').createGitignoreFile(workspaceRoot, outputChannel);
    
        // Initialize git with main branch and commit the initial files
        // execShell(`git init && git checkout -b main && git add . && git commit -m "Initial commit" && git branch -M main`, workspaceRoot);
        // Using exec instead of execShell because we need to redirect the output to outputChannel.appendLine
        await execShell(`git init && git checkout -b main && git add . && git commit -m "Initial commit" && git branch -M main`, workspaceRoot, outputChannel);
        
        outputChannel.appendLine('Git initialized and initial files committed successfully.');
    
        // Check if the file Gemfile exists and if it does, append the following gems to the Gemfile which is already in place: rails-erd, rails_admin, devise, cancancan
        const gemfile = path.join(workspaceRoot, 'Gemfile');
        if (fs.existsSync(gemfile)) {
            // Read the Gemfile
            const gemfileContent = fs.readFileSync(gemfile, 'utf8');
            // Append the gems to the Gemfile
            const gemDependencies = renderTemplate('createApp/Gemfile.gems1');
            const gemfileContentWithGems = gemfileContent + gemDependencies;
            // Write the Gemfile
            fs.writeFileSync(gemfile, gemfileContentWithGems);
    
            /* Run the following commands: */
            // message to inform the user
            const commands = [
                "bundle install",
                "rails generate devise:install",
                "rails g rails_admin:install app --asset=sprockets",
                // Remove the mount RailsAdmin::Engine => '/app', as: 'rails_admin' from the routes.rb file, since the thecore_ui_rails_admin gem will do it
                "sed -i \"/mount RailsAdmin::Engine => '\\/app', as: 'rails_admin'/d\" config/routes.rb",
                "bundle install",
                "rails active_storage:install",
                "rails action_text:install",
                "bundle install",
                "rails action_mailbox:install",
                "rails g cancan:ability",
                "rails g erd:install"
            ];
            await execShell(commands.join(" && "), workspaceRoot, outputChannel);
            outputChannel.appendLine('Bundle install and rails generate commands completed successfully.');
            
            const gemfileContentWithGems2 = gemfileContentWithGems + renderTemplate('createApp/Gemfile.gems2');
            // Write the Gemfile
            fs.writeFileSync(gemfile, gemfileContentWithGems2);
            // Run the bundle install command
            await execShell(`bundle install`, workspaceRoot, outputChannel);
    
            // Rename the Gemfile to Gemfile.base
            // fs.renameSync(gemfile, path.join(workspaceRoot, 'Gemfile.base'));
            // Create a new Gemfile with this content: eval File.read('Gemfile.base')
            // const gemfileContent3 = "eval File.read('Gemfile.base')";
            // Write the Gemfile
            // fs.writeFileSync(gemfile, gemfileContent3);
    
            // Add a gitlab-ci.yml file
            outputChannel.appendLine('Adding .gitlab-ci.yml file.');
            writeTextFile(workspaceRoot, '.gitlab-ci.yml', renderTemplate('createApp/gitlab-ci.yml'), outputChannel);
            outputChannel.appendLine('.gitlab-ci.yml file added successfully.');

            // Create a sample config/sidekiq.yml file
            outputChannel.appendLine('Adding config/sidekiq.yml file.');
            writeTextFile(workspaceRoot, 'config/sidekiq.yml', renderTemplate('createApp/sidekiq.yml'), outputChannel);
    
            // Create a version file
            writeTextFile(workspaceRoot, 'version', renderTemplate('createApp/version'), outputChannel);
    
            // Find if in the workspace directory config/development.rb a line with the following content: config.action_controller.raise_on_missing_callback_actions = true 
            // if it exists, replace true with false ath the end of the line
            const developmentConfig = path.join(workspaceRoot, 'config', 'environments', 'development.rb');
            const developmentConfigContent = fs.readFileSync(developmentConfig, 'utf8');
            const developmentConfigContentReplaced = developmentConfigContent.replace(/config.action_controller.raise_on_missing_callback_actions = true/, 'config.action_controller.raise_on_missing_callback_actions = false');
            fs.writeFileSync(developmentConfig, developmentConfigContentReplaced);

            // Run the command `rails thecore:db:init`
            await execShell(`rails db:drop ; rails db:create && rails db:migrate && rails thecore:db:seed`, workspaceRoot, outputChannel);
            outputChannel.appendLine('Rails thecore:db:init command completed successfully.');
    
            // Create empty .keep files into `vendor/custombuilds` and `vendor/deploytargets` directories after having created them if they don't exist
            const vendorDir = path.join(workspaceRoot, 'vendor');
            const custombuildsDir = path.join(vendorDir, 'custombuilds');
            const deploytargetsDir = path.join(vendorDir, 'deploytargets');
            const submodulesDir = path.join(vendorDir, 'submodules');
            // Cycle over the directories and create them if they don't exist using the mkDirP function
            const dirs = [custombuildsDir, deploytargetsDir, submodulesDir];
            dirs.forEach(dir => {
                mkDirP(dir, outputChannel);
            });

            // Remove .dockerignore file if it exists
            const dockerignoreFile = path.join(workspaceRoot, '.dockerignore');
            if (fs.existsSync(dockerignoreFile)) {
                fs.unlinkSync(dockerignoreFile);
            }
    
            // Add and commit the changes
            await execShell(`git add . -A && git commit -m "Add Thecore 3 gems and configuration"`, workspaceRoot, outputChannel);
    
            // If no errors occurred, show a success message
            outputChannel.appendLine('✅ Thecore 3 App created successfully.');
        }        
    } catch (error) {
        const errorMessage = `❌ An error occurred: ${error.message}`;
        outputChannel.appendLine(errorMessage);
        win.showErrorMessage(errorMessage);
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}