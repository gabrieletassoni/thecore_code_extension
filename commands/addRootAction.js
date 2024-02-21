// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { writeTextFile, mergeYmlContent } = require('../libs/configs');
const { mkDirP } = require('../libs/os');
const { hasGemspec, workspaceExixtence, isDir, isFile } = require('../libs/check');

// The code you place here will be executed every time your command is executed
async function perform(atomDir) {
    if (!atomDir) {
        vscode.window.showErrorMessage('Please right click on the ATOM folder and select Add Root Action.');
        return;
    }

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Add Root Action');
    outputChannel.show();
    outputChannel.appendLine('Adding a root Action to the current ATOM.');

    // Check if we are inside a workspace
    if (!workspaceExixtence(outputChannel)) { return; }

    try {
        // Check if The right clicked folder which sent this command is a valid submodule of the Thecore 3 app, being a valid ATOM, which means having a gemspec and lib/root_actions folder
        outputChannel.appendLine(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);
        // Get only the full path without the file schema
        atomDir = atomDir.fsPath;
        if (!isDir(atomDir, outputChannel)) { return; }

        // Is the root_actons folder present?
        const atomRootActionsDir = path.join(atomDir, 'lib', 'root_actions');
        if (!isDir(atomRootActionsDir, outputChannel)) { return; }
        // Has a Gemspex file?
        const atomName = path.basename(atomDir);
        if (!hasGemspec(atomDir, atomName, outputChannel)) { return; }

        // Get the rootActionName from the user input and check if it's snakecase, if it's not, show an error message and return
        const rootActionName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Please enter the snake_case name of the root action.',
            validateInput: (rootActionName) => {
                // Validates if the input exists and is snakecase
                if (!rootActionName || !rootActionName.match(/^[a-z0-9_]+$/)) {
                    return '❌ The snake_case name is not valid. Please try again.';
                }
                return null;
            }
        });
        if (!rootActionName) {
            outputChannel.appendLine(`❌ The root action name is not valid. Please try again.`);
            return; 
        }
        // Check if the root action already exists
        const rootActionFile = path.join(atomRootActionsDir, `${rootActionName}.rb`);
        if (isFile(rootActionFile, outputChannel)) { return; }
        
        // Create the root action file with the following content, replacing tcp_debug with the root action name and using an array of strings to represent it, joind by a newline:
        const rootActionContent = [
            `RailsAdmin::Config::Actions.add_action "${rootActionName}", :base, :root do`,
            `    show_in_sidebar true`,
            `    show_in_navigation false`,
            `    breadcrumb_parent [nil]`,
            `    # This ensures the action only shows up for Users`,
            `    # visible? authorized?`,
            `    # Not a member action`,
            `    member false`,
            `    # Not a colleciton action`,
            `    collection false`,
            `    # Have a look at https://fontawesome.com/v5/search for available icons`,
            `    link_icon 'fas fa-file'`,
            `    # The controller which will be used to compute the action and the REST verbs it will respond to`,
            `    http_methods [:get]`,
            `    # Adding the controller which is needed to compute calls from the ui`,
            `    controller do`,
            `        proc do # This is needed because we need that this code is re-evaluated each time is called`,
            `            if request.xhr?`,
            `                # This is the code that is executed when the action is called`,
            `                # It is executed in the context of the controller`,
            `                # So you can access all the controller methods`,
            `                # and instance variables`,
            `                status = 200`,
            `                message = "Hello World!"`,
            `                ActionCable.server.broadcast("messages", { topic: :${rootActionName}, status: status, message: message})`,
            `                render json: message.to_json, status: status`,
            `            end`,
            `        end`,
            `    end`,
            `end`,
        ];
        writeTextFile(atomRootActionsDir, `${rootActionName}.rb`, rootActionContent, outputChannel);

        // Using the same logic, add a file in app/views/rails_admin/main with the following content, replacing tcp_debug with the root action name and creating the folders if they do not exists:
        const mainViewDir = path.join(atomDir, "app", 'views', 'rails_admin', 'main');
        mkDirP(mainViewDir, outputChannel);
        const mainViewContent = [
            `<div class="card mb-3">`,
            `  <div class="card-body">`,
            `    <div class="response ${rootActionName}-response" id="response">`,
            `    </div>`,
            `    <div class="loader">`,
            `      <div class="double-bounce1"></div>`,
            `      <div class="double-bounce2"></div>`,
            `    </div>`,
            `  </div>`,
            `</div>`
        ];
        writeTextFile(mainViewDir, `${rootActionName}.html.erb`, mainViewContent, outputChannel);

        // Add the root action to the rails_admin initializer, if not already present, into after_initialize.rb file
        // Below the `config.after_initialize do` line add the `require 'root_actions/tcp_debug'` line, obviously replacing tcp_debug with the root action name
        const afterInitializeFile = path.join(atomDir, "config", 'initializers', 'after_initialize.rb');
        const afterInitializeContent = fs.readFileSync(afterInitializeFile).toString();
        if (!afterInitializeContent.includes(`require 'root_actions/${rootActionName}'`)) {
            const afterInitializeLines = afterInitializeContent.split('\n');
            const afterInitializeIndex = afterInitializeLines.findIndex(line => line.includes('config.after_initialize do'));
            afterInitializeLines.splice(afterInitializeIndex + 1, 0, `        require 'root_actions/${rootActionName}'`);
            fs.writeFileSync(afterInitializeFile, afterInitializeLines.join('\n'));
            outputChannel.appendLine(`The root action require line has been added to the ${afterInitializeFile} file.`);
        } else {
            outputChannel.appendLine(`The root action require line is already present in the ${afterInitializeFile} file.`);
        }

        // Append to the file path.join(atomDir, "config", 'initializers', 'assets.rb') the string Rails.application.config.assets.precompile += %w( root_actions/main_${rootActionName}.js root_actions/main_${rootActionName}.css ) if it doesn't exist
        const assetsFile = path.join(atomDir, "config", 'initializers', 'assets.rb');
        const assetsContent = fs.readFileSync(assetsFile).toString();
        if (!assetsContent.includes(`Rails.application.config.assets.precompile += %w( root_actions/main_${rootActionName}.js root_actions/main_${rootActionName}.css )`)) {
            fs.appendFileSync(assetsFile, `\nRails.application.config.assets.precompile += %w( root_actions/main_${rootActionName}.js root_actions/main_${rootActionName}.css )`);
            outputChannel.appendLine(`The root action assets precompile line has been added to the ${assetsFile} file.`);
        } else {
            outputChannel.appendLine(`The root action assets precompile line is already present in the ${assetsFile} file.`);
        }

        // Add to vendor/submodules/thecore_tcp_debug/app/assets/stylesheets/main_tcp_debug.scss the following line, replacing tcp_debug with the root action name
        // .tcp-debug { background-color: #f00; }
        const mainScssContent = [
            `// Spinner`,
            `.loader {`,
            `    width: 40px;`,
            `    height: 40px;`,
            `    position: relative;`,
            `    margin: 0 auto;`,
            `}`,
            `.double-bounce1,`,
            `.double-bounce2 {`,
            `    width: 100%;`,
            `    height: 100%;`,
            `    border-radius: 50%;`,
            `    background-color: #333;`,
            `    opacity: 0.6;`,
            `    position: absolute;`,
            `    top: 0;`,
            `    left: 0;`,
            `    -webkit-animation: sk-bounce 2.0s infinite ease-in-out;`,
            `    animation: sk-bounce 2.0s infinite ease-in-out;`,
            `}`,
            `.double-bounce2 {`,
            `    -webkit-animation-delay: -1.0s;`,
            `    animation-delay: -1.0s;`,
            `}`,
            `@-webkit-keyframes sk-bounce {`,
            `    0%,`,
            `    100% {`,
            `        -webkit-transform: scale(0.0)`,
            `    }`,
            `    50% {`,
            `        -webkit-transform: scale(1.0)`,
            `    }`,
            `}`,
            `@keyframes sk-bounce {`,
            `    0%,`,
            `    100% {`,
            `        transform: scale(0.0);`,
            `        -webkit-transform: scale(0.0);`,
            `    }`,
            `    50% {`,
            `        transform: scale(1.0);`,
            `        -webkit-transform: scale(1.0);`,
            `    }`,
            `}`,
            `// End Spinner`,
            `.${rootActionName}-response {`,
            `    width: 100%;`,
            `    margin-left: 0.1em;`,
            `}`,
            `#response {`,
            `    border-radius: 1em;`,
            `    display: flex;`,
            `    flex-direction: column;`,
            `    justify-content: center;`,
            `}`,
        ];
        writeTextFile(path.join(atomDir, 'app', 'assets', 'stylesheets'), `main_${rootActionName}.scss`, mainScssContent, outputChannel);

        // Add to vendor/submodules/thecore_tcp_debug/app/assets/javascripts/main_tcp_debug.js the following line, replacing tcp_debug with the root action name
        // The content above to the main_js_file:
        const mainJsContent = [
            `$(document).on('turbo:load', function (event) {`,
            `    console.log('Hello from ${rootActionName}');`,
            `    // Action cable Websocket`,
            `    App.cable.subscriptions.create("ActivityLogChannel", {`,
            `        connected() {`,
            `            console.log("Connected to the channel:", this);`,
            `            this.send({ message: '${rootActionName} Client is connected', topic: "${rootActionName}", namespace: "subscriptions" });`,
            `        },`,
            `        disconnected() {`,
            `            console.log("${rootActionName} Client Disconnected");`,
            `        },`,
            `        received(data) {`,
            `            if(data["topic"] == "${rootActionName}") {`,
            `                console.log("${rootActionName}", data);`,
            `                $("#response").html(data["message"])`,
            `            }`,
            `        }`,
            `    });`,
            `});`,
        ];
        writeTextFile(path.join(atomDir, 'app', 'assets', 'javascripts'), `main_${rootActionName}.js`, mainJsContent, outputChannel);

        // Create a title case verson of the snake case rootActionName
        const rootActionNameTitleCase = rootActionName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const ymlDir = path.join(atomDir, "config", 'locales');
        mergeYmlContent(ymlDir, 'en.yml', rootActionName, rootActionNameTitleCase, "en", outputChannel);
        mergeYmlContent(ymlDir, 'it.yml', rootActionName, rootActionNameTitleCase, "it", outputChannel);

        // The command executed successfully, show a success message
        outputChannel.appendLine(`✅ The root action ${rootActionName} has been added successfully.`);
        vscode.window.showInformationMessage(`The root action ${rootActionName} has been added successfully.`);
    } catch (error) {
        outputChannel.appendLine(`❌ An error occurred while adding the root action: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the root action: ${error.message}`);
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}