// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// The code you place here will be executed every time your command is executed
function perform(context) {
    // Display a message box to the user
    vscode.window.showInformationMessage('Adding a member Action to the current ATOM.');

    // Check if we are inside a workspace
    if (!require('../libs/check').workspacePresence()) { return; }

    // Check if the folder right clicked which sent this command is a valid submodule of the Thecore 3 app, being a valid ATOM, which means having a gemspec and lib/member_actions folder
    const atomDir = path.dirname(context.fsPath);
    if (!fs.existsSync(atomDir)) {
        vscode.window.showErrorMessage('The selected folder does not exist. Please open a Thecore 3 app and try again.');
        return;
    }
    const atomName = path.basename(atomDir);
    const atomGemspec = path.join(atomDir, `${atomName}.gemspec`);
    const atommemberActionsDir = path.join(atomDir, 'lib', 'member_actions');
    if (!fs.existsSync(atomGemspec) || !fs.existsSync(atommemberActionsDir)) {
        vscode.window.showErrorMessage('The folder right clicked is not a valid Thecore 3 ATOM. Please select a Thecore 3 ATOM and try again.');
        return;
    }

    // Get the memberActionName from the user and check if it's snakecase, if it's not, show an error message and return
    const memberActionName = vscode.window.showInputBox({ prompt: 'Please enter the name of the member Action to add.' });
    if (!memberActionName) { return; }
    if (!memberActionName.match(/^[a-z0-9_]+$/)) {
        vscode.window.showErrorMessage('The member Action name must be snakecase. Please try again.');
        return;
    }
    // Check if the member Action already exists
    const memberActionFile = path.join(atommemberActionsDir, `${memberActionName}.rb`);
    if (fs.existsSync(memberActionFile)) {
        vscode.window.showErrorMessage(`The member Action ${memberActionName} already exists. Please try again.`);
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
    ].join('\n');
    fs.writeFileSync(memberActionFile, memberActionContent);

    // Using the same logic, add a file in app/views/rails_admin/main with the following content, replacing tcp_debug with the member Action name and creating the folders if they do not exists:
    const mainViewFile = path.join(atomDir, "app", 'views', 'rails_admin', 'main', `${memberActionName}.html.erb`);
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
    ].join('\n');
    fs.mkdirSync(path.dirname(mainViewFile), { recursive: true });
    fs.writeFileSync(mainViewFile, mainViewContent);

    // Add the member Action to the rails_admin initializer, if not already present, into after_initialize.rb file
    // Below the `config.after_initialize do` line add the `require 'member_actions/tcp_debug'` line, obviously replacing tcp_debug with the member Action name
    const afterInitializeFile = path.join(atomDir, "config", 'initializers', 'after_initialize.rb');
    const afterInitializeContent = fs.readFileSync(afterInitializeFile).toString();
    if (!afterInitializeContent.includes(`require 'member_actions/${memberActionName}'`)) {
        const afterInitializeLines = afterInitializeContent.split('\n');
        const afterInitializeIndex = afterInitializeLines.findIndex(line => line.includes('config.after_initialize do'));
        afterInitializeLines.splice(afterInitializeIndex + 1, 0, `        require 'member_actions/${memberActionName}'`);
        fs.writeFileSync(afterInitializeFile, afterInitializeLines.join('\n'));
    }

    // Using the same logic, add to the config/initializers/assets.rb file the following line, replacing tcp_debug with the member Action name
    // Rails.application.config.assets.precompile += %w( member_actions/main_tcp_debug.js member_actions/main_tcp_debug.css )
    const assetsFile = path.join(atomDir, "config", 'initializers', 'assets.rb');
    const assetsContent = fs.readFileSync(assetsFile).toString();
    if (!assetsContent.includes(`Rails.application.config.assets.precompile += %w( member_actions/main_${memberActionName}.js member_actions/main_${memberActionName}.css )`)) {
        const assetsLines = assetsContent.split('\n');
        const assetsIndex = assetsLines.findIndex(line => line.includes('Rails.application.config.assets.precompile += %w( rails_admin/rails_admin.js rails_admin/rails_admin.css )'));
        assetsLines.splice(assetsIndex + 1, 0, `Rails.application.config.assets.precompile += %w( member_actions/main_${memberActionName}.js member_actions/main_${memberActionName}.css )`);
        fs.writeFileSync(assetsFile, assetsLines.join('\n'));
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}