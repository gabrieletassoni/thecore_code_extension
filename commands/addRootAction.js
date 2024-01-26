// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// The code you place here will be executed every time your command is executed
/**
 * Creates a new Thecore 3 app in the current workspace.
 */
function perform(context) {
    // Display a message box to the user
    vscode.window.showInformationMessage('Adding a root Action to the current ATOM.');

    // Check if we are inside a workspace
    if (!require('../libs/check').workspacePresence()) { return; }

    // Check if the folder right clicked which sent this command is a valid submodule of the Thecore 3 app, being a valid ATOM, which means having a gemspec and lib/root_actions folder
    const atomDir = path.dirname(context.fsPath);
    if (!fs.existsSync(atomDir)) {
        vscode.window.showErrorMessage('The selected folder does not exist. Please open a Thecore 3 app and try again.');
        return;
    }
    const atomName = path.basename(atomDir);
    const atomGemspec = path.join(atomDir, `${atomName}.gemspec`);
    const atomRootActionsDir = path.join(atomDir, 'lib', 'root_actions');
    if (!fs.existsSync(atomGemspec) || !fs.existsSync(atomRootActionsDir)) {
        vscode.window.showErrorMessage('The folder right clicked is not a valid Thecore 3 ATOM. Please select a Thecore 3 ATOM and try again.');
        return;
    }

    // Get the rootActionName from the user and check if it's snakecase, if it's not, show an error message and return
    const rootActionName = vscode.window.showInputBox({ prompt: 'Please enter the name of the root action to add.' });
    if (!rootActionName) { return; }
    if (!rootActionName.match(/^[a-z0-9_]+$/)) {
        vscode.window.showErrorMessage('The root action name must be snakecase. Please try again.');
        return;
    }
    // Check if the root action already exists
    const rootActionFile = path.join(atomRootActionsDir, `${rootActionName}.rb`);
    if (fs.existsSync(rootActionFile)) {
        vscode.window.showErrorMessage(`The root action ${rootActionName} already exists. Please try again.`);
        return;
    }
    
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
    ].join('\n');
    fs.writeFileSync(rootActionFile, rootActionContent);

    // Using the same logic, add a file in app/views/rails_admin/main with the following content, replacing tcp_debug with the root action name and creating the folders if they do not exists:
    const mainViewFile = path.join(atomDir, "app", 'views', 'rails_admin', 'main', `${rootActionName}.html.erb`);
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
    ].join('\n');
    fs.mkdirSync(path.dirname(mainViewFile), { recursive: true });
    fs.writeFileSync(mainViewFile, mainViewContent);

    // Add the root action to the rails_admin initializer, if not already present, into after_initialize.rb file
    // Below the `config.after_initialize do` line add the `require 'root_actions/tcp_debug'` line, obviously replacing tcp_debug with the root action name
    const afterInitializeFile = path.join(atomDir, "config", 'initializers', 'after_initialize.rb');
    const afterInitializeContent = fs.readFileSync(afterInitializeFile).toString();
    if (!afterInitializeContent.includes(`require 'root_actions/${rootActionName}'`)) {
        const afterInitializeLines = afterInitializeContent.split('\n');
        const afterInitializeIndex = afterInitializeLines.findIndex(line => line.includes('config.after_initialize do'));
        afterInitializeLines.splice(afterInitializeIndex + 1, 0, `        require 'root_actions/${rootActionName}'`);
        fs.writeFileSync(afterInitializeFile, afterInitializeLines.join('\n'));
    }

    // Using the same logic, add to the config/initializers/assets.rb file the following line, replacing tcp_debug with the root action name
    // Rails.application.config.assets.precompile += %w( root_actions/main_tcp_debug.js root_actions/main_tcp_debug.css )
    const assetsFile = path.join(atomDir, "config", 'initializers', 'assets.rb');
    const assetsContent = fs.readFileSync(assetsFile).toString();
    if (!assetsContent.includes(`Rails.application.config.assets.precompile += %w( root_actions/main_${rootActionName}.js root_actions/main_${rootActionName}.css )`)) {
        const assetsLines = assetsContent.split('\n');
        const assetsIndex = assetsLines.findIndex(line => line.includes('Rails.application.config.assets.precompile += %w( rails_admin/rails_admin.js rails_admin/rails_admin.css )'));
        assetsLines.splice(assetsIndex + 1, 0, `Rails.application.config.assets.precompile += %w( root_actions/main_${rootActionName}.js root_actions/main_${rootActionName}.css )`);
        fs.writeFileSync(assetsFile, assetsLines.join('\n'));
    }

    // Add to vendor/submodules/thecore_tcp_debug/app/assets/stylesheets/main_tcp_debug.scss the following line, replacing tcp_debug with the root action name
    // .tcp-debug { background-color: #f00; }
    const mainScssFile = path.join(atomDir, "vendor", 'submodules', 'thecore_tcp_debug', 'app', 'assets', 'stylesheets', `main_${rootActionName}.scss`);
    const mainScssContent = [
        `// Spinner`,
        `.loader {`,
        `    width: 40px;`,
        `    height: 40px;`,
        ``,
        `    position: relative;`,
        `    margin: 0 auto;`,
        `}`,
        ``,
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
        ``,
        `    -webkit-animation: sk-bounce 2.0s infinite ease-in-out;`,
        `    animation: sk-bounce 2.0s infinite ease-in-out;`,
        `}`,
        ``,
        `.double-bounce2 {`,
        `    -webkit-animation-delay: -1.0s;`,
        `    animation-delay: -1.0s;`,
        `}`,
        ``,
        `@-webkit-keyframes sk-bounce {`,
        ``,
        `    0%,`,
        `    100% {`,
        `        -webkit-transform: scale(0.0)`,
        `    }`,
        ``,
        `    50% {`,
        `        -webkit-transform: scale(1.0)`,
        `    }`,
        `}`,
        ``,
        `@keyframes sk-bounce {`,
        ``,
        `    0%,`,
        `    100% {`,
        `        transform: scale(0.0);`,
        `        -webkit-transform: scale(0.0);`,
        `    }`,
        ``,
        `    50% {`,
        `        transform: scale(1.0);`,
        `        -webkit-transform: scale(1.0);`,
        `    }`,
        `}`,
        ``,
        `// End Spinner`,
        `.${rootActionName}-response {`,
        `    width: 100%;`,
        `    margin-left: 0.1em;`,
        `}`,
        ``,
        `#response {`,
        `    border-radius: 1em;`,
        `    display: flex;`,
        `    flex-direction: column;`,
        `    justify-content: center;`,
        `}`,
    ].join('\n');
    fs.writeFileSync(mainScssFile, mainScssContent);

    // Add to vendor/submodules/thecore_tcp_debug/app/assets/javascripts/main_tcp_debug.js the following line, replacing tcp_debug with the root action name
    const mainJsFile = path.join(atomDir, "vendor", 'submodules', 'thecore_tcp_debug', 'app', 'assets', 'javascripts', `main_${rootActionName}.js`);
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
        `                $("#response").html(data["message"])`
        `            }`,
        `        }`,
        `    });`,
        `});`,
    ].join('\n');
    fs.writeFileSync(mainJsFile, mainJsContent);
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}