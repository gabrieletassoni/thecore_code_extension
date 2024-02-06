// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { writeTextFile, mergeYmlContent } = require('../libs/configs');
const { mkDirP } = require('../libs/os');

// The code you place here will be executed every time your command is executed
async function perform(atomDir) {
    if (!atomDir) {
        vscode.window.showErrorMessage('Please right click on the ATOM folder and select Add member action.');
        return;
    }

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Add member action');
    outputChannel.show();
    outputChannel.appendLine('Adding a member action to the current ATOM.');

    // Check if we are inside a workspace
    if (!require('../libs/check').workspaceExixtence(outputChannel)) { return; }
    try {
        // Check if the folder right clicked which sent this command is a valid submodule of the Thecore 3 app, being a valid ATOM, which means having a gemspec and lib/member_actions folder
        outputChannel.appendLine(`🔍 Checking if the right clicked folder is a valid Thecore 3 ATOM: ${atomDir}`);
        // Get only the full path without the file schema
        atomDir = atomDir.fsPath;
        if (!fs.existsSync(atomDir)) {
            outputChannel.appendLine(`❌ The selected folder does not exist. Please open a Thecore 3 app and try again.`);
            vscode.window.showErrorMessage('The selected folder does not exist. Please open a Thecore 3 app and try again.');
            return;
        }
        const atomName = path.basename(atomDir);
        const atomGemspec = path.join(atomDir, `${atomName}.gemspec`);
        const atomMemberActionsDir = path.join(atomDir, 'lib', 'member_actions');
        if (!fs.existsSync(atomGemspec) || !fs.existsSync(atomMemberActionsDir)) {
            outputChannel.appendLine(`❌ The folder right clicked is not a valid Thecore 3 ATOM. Please select a Thecore 3 ATOM and try again.`);
            vscode.window.showErrorMessage('The folder right clicked is not a valid Thecore 3 ATOM. Please select a Thecore 3 ATOM and try again.');
            return;
        }

        // Get the memberActionName from the user input and check if it's snakecase, if it's not, show an error message and return
        const memberActionName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Please enter the snake_case name of the member action.',
            validateInput: (memberActionName) => {
                // Validates if the input exists and is snakecase
                if (!memberActionName || !memberActionName.match(/^[a-z0-9_]+$/)) {
                    return '❌ The snake_case name is not valid. Please try again.';
                }
                return null;
            }
        });
        if (!memberActionName) {
            outputChannel.appendLine(`❌ The member action name is not valid. Please try again.`);
            return; 
        }
        // Check if the member action already exists
        const memberActionFile = path.join(atomMemberActionsDir, `${memberActionName}.rb`);
        if (fs.existsSync(memberActionFile)) {
            outputChannel.appendLine(`❌ The member action ${memberActionName} already exists. Please try again.`);
            vscode.window.showErrorMessage(`The member action ${memberActionName} already exists. Please try again.`);
            return;
        }
                
        // Create the member Action file with the following content, replacing tcp_debug with the member Action name and using an array of strings to represent it, joind by a newline:
        const memberActionContent = [
            `RailsAdmin::Config::Actions.add_action "${memberActionName}", :base, :member do`,
            `    link_icon 'fas fa-file'`,
            `    http_methods [:get, :patch]`,
            `    # Visible only for the User model`,
            `    visible do`,
            `        bindings[:object].is_a?(::User)`,
            `    end`,
            `    # Adding the controller which is needed to compute calls from the ui`,
            `    controller do`,
            `        proc do`,
            `            # if it's a form submission, then update the password`,
            `            if request.patch?`,
            `                flash[:success] = I18n.t("Succesfully clicked on sample action")`,
            `                # Redirect to the object`,
            `                redirect_to index_path(model_name: @abstract_model.to_param)`,
            `            end`,
            `        end`,
            `    end`,
            `end`,
        ];
        writeTextFile(atomMemberActionsDir, `${memberActionName}.rb`, memberActionContent, outputChannel);

        // Using the same logic, add a file in app/views/rails_admin/main with the following content, replacing tcp_debug with the member Action name and creating the folders if they do not exists:
        const mainViewDir = path.join(atomDir, "app", 'views', 'rails_admin', 'main');
        mkDirP(mainViewDir, outputChannel);
        const mainViewContent = [
            `<%= form_for(@object, url: ${memberActionName}_path, html: { method: :patch }, class: "main") do |f| %>`,
            `    <div class="form-actions row justify-content-end my-3">`,
            `        <div class="col-sm-10">`,
            `            <input name="return_to" type="hidden" value="<%=edit_path(@abstract_model, @object.id)%>">`,
            `            <button class="btn btn-primary" data-disable-with="Save" name="_save" type="submit">`,
            `            <i class="fas fa-check"></i>`,
            `            Test`,
            `            </button>`,
            `        </div>`,
            `    </div>`,
            `<% end %>`
        ];
        writeTextFile(mainViewDir, `${memberActionName}.html.erb`, mainViewContent, outputChannel);

        // Add the member action to the rails_admin initializer, if not already present, into after_initialize.rb file
        // Below the `config.after_initialize do` line add the `require 'member_actions/tcp_debug'` line, obviously replacing tcp_debug with the member action name
        const afterInitializeFile = path.join(atomDir, "config", 'initializers', 'after_initialize.rb');
        const afterInitializeContent = fs.readFileSync(afterInitializeFile).toString();
        if (!afterInitializeContent.includes(`require 'member_actions/${memberActionName}'`)) {
            const afterInitializeLines = afterInitializeContent.split('\n');
            const afterInitializeIndex = afterInitializeLines.findIndex(line => line.includes('config.after_initialize do'));
            afterInitializeLines.splice(afterInitializeIndex + 1, 0, `        require 'member_actions/${memberActionName}'`);
            fs.writeFileSync(afterInitializeFile, afterInitializeLines.join('\n'));
            outputChannel.appendLine(`The member action require line has been added to the ${afterInitializeFile} file.`);
        } else {
            outputChannel.appendLine(`The member action require line is already present in the ${afterInitializeFile} file.`);
        }

        // Append to the file path.join(atomDir, "config", 'initializers', 'assets.rb') the string Rails.application.config.assets.precompile += %w( member_actions/main_${memberActionName}.js member_actions/main_${memberActionName}.css ) if it doesn't exist
        const assetsFile = path.join(atomDir, "config", 'initializers', 'assets.rb');
        const assetsContent = fs.readFileSync(assetsFile).toString();
        if (!assetsContent.includes(`Rails.application.config.assets.precompile += %w( member_actions/main_${memberActionName}.js member_actions/main_${memberActionName}.css )`)) {
            fs.appendFileSync(assetsFile, `\nRails.application.config.assets.precompile += %w( member_actions/main_${memberActionName}.js member_actions/main_${memberActionName}.css )`);
            outputChannel.appendLine(`The member action assets precompile line has been added to the ${assetsFile} file.`);
        } else {
            outputChannel.appendLine(`The member action assets precompile line is already present in the ${assetsFile} file.`);
        }

        // Add to vendor/submodules/thecore_tcp_debug/app/assets/stylesheets/main_tcp_debug.scss the following line, replacing tcp_debug with the member action name
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
            `.${memberActionName}-response {`,
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
        writeTextFile(path.join(atomDir, 'app', 'assets', 'stylesheets'), `main_${memberActionName}.scss`, mainScssContent, outputChannel);

        // Add to vendor/submodules/thecore_tcp_debug/app/assets/javascripts/main_tcp_debug.js the following line, replacing tcp_debug with the member action name
        // The content above to the main_js_file:
        const mainJsContent = [
            `$(document).on('turbo:load', function (event) {`,
            `    console.log('Hello from ${memberActionName}');`,
            `    // Action cable Websocket`,
            `    App.cable.subscriptions.create("ActivityLogChannel", {`,
            `        connected() {`,
            `            console.log("Connected to the channel:", this);`,
            `            this.send({ message: '${memberActionName} Client is connected', topic: "${memberActionName}", namespace: "subscriptions" });`,
            `        },`,
            `        disconnected() {`,
            `            console.log("${memberActionName} Client Disconnected");`,
            `        },`,
            `        received(data) {`,
            `            if(data["topic"] == "${memberActionName}") {`,
            `                console.log("${memberActionName}", data);`,
            `                $("#response").html(data["message"])`,
            `            }`,
            `        }`,
            `    });`,
            `});`,
        ];
        writeTextFile(path.join(atomDir, 'app', 'assets', 'javascripts'), `main_${memberActionName}.js`, mainJsContent, outputChannel);

        // Create a title case verson of the snake case memberActionName
        const memberActionNameTitleCase = memberActionName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const ymlDir = path.join(atomDir, "config", 'locales');
        mergeYmlContent(ymlDir, 'en.yml', memberActionName, memberActionNameTitleCase, "en", outputChannel);
        mergeYmlContent(ymlDir, 'it.yml', memberActionName, memberActionNameTitleCase, "it", outputChannel);

        // Success message
        outputChannel.appendLine(`✅ The member Action ${memberActionName} has been added successfully.`);
        vscode.window.showInformationMessage(`The member Action ${memberActionName} has been added successfully.`);
    } catch (error) {
        outputChannel.appendLine(`❌ An error occurred while adding the member action: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the member action: ${error.message}`);
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}