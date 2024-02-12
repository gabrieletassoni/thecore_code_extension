// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { mkDirP, execShell } = require('../libs/os');
const { isPascalCase } = require('../libs/check');
const { writeTextFile } = require('../libs/configs');

// The code you place here will be executed every time your command is executed
async function perform(atomDir) {
    if (!atomDir) {
        vscode.window.showErrorMessage('Please right click on the ATOM folder and select Add Model.');
        return;
    }

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Add Model');
    outputChannel.show();
    outputChannel.appendLine('Adding a model to the current ATOM.');

    // Check if we are inside a workspace
    if (!require('../libs/check').workspaceExixtence(outputChannel)) { return; }

    // get the root folder path of the workspace
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

    try {
        // Check if the folder right clicked which sent this command is a valid submodule of the Thecore 3 app, being a valid ATOM, which means having a gemspec and db/migrate folder
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
        if (!fs.existsSync(atomGemspec)) {
            outputChannel.appendLine(`❌ The folder right clicked is not a valid Thecore 3 ATOM. Please select a Thecore 3 ATOM and try again.`);
            vscode.window.showErrorMessage('The folder right clicked is not a valid Thecore 3 ATOM. Please select a Thecore 3 ATOM and try again.');
            return;
        }

        // Get the Migration from the user input and check if it's PascalCase, if it's not, show an error message and return
        const modelName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Please enter the PascalCase name of the model.',
            validateInput: (modelName) => {
                // Validates if the input exists and is snakecase
                if (!modelName || !isPascalCase(modelName)) {
                    return '❌ The PascalCase name is not valid. Please try again.';
                }
                return null;
            }
        });

        // Get the migration definition, it must be a list of fields with their types, like "name:string age:integer"
        const modelDefinition = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Please enter the definition of the migration. Example: name:string age:integer',
            validateInput: (modelDefinition) => {
                // Validates the input, it can be empty, but if it's not, it must be a valid migration definition like "name:string age:integer"
                if (modelDefinition && !modelDefinition.match(/^(\w+:\w+\s?)+$/)) {
                    return '❌ The migration definition is not valid. Please try again.';
                }
                return null;
            }
        });
        
        // Run the rails g migration command to create the migration file
        const output = await execShell(`bundle install && rails g model "${modelName}" ${modelDefinition} --skip-test-framework`, workspaceRoot, outputChannel);
        // Parse the output to check if the migration was created successfully, if it's the case, move all the created files into ${atomDir}/db/migrate folder
        let migrationFiles = [];
        if(output) {
            migrationFiles = [...output.matchAll(/^\s+create\s+(db\/migrate\/.+\.rb)$/gm)];
        } else {
            const errorMessage = "No output from rails g command exists, cannot go on";
            outputChannel.appendLine(`❌ ${errorMessage}, please inspect theoutput window.`);
            vscode.window.showErrorMessage(`${errorMessage}, please inspect the output window.`);
            return;
        }

        let modelFiles = [];
        if(output) {
            modelFiles = [...output.matchAll(/^\s+create\s+(app\/models\/.+\.rb)$/gm)];
        } else {
            const errorMessage = "No output from rails g command exists, cannot go on";
            outputChannel.appendLine(`❌ ${errorMessage}, please inspect theoutput window.`);
            vscode.window.showErrorMessage(`${errorMessage}, please inspect the output window.`);
            return;
        }
        
        if (!migrationFiles || !modelFiles) {
            const errorMessage = "No output from rails g command matches evidence of migration or model file creation, cannot go on";
            outputChannel.appendLine(`❌ ${errorMessage}, please inspect lines above.`);
            vscode.window.showErrorMessage(`${errorMessage}, please inspect output window.`);
            return;
        } else {
            migrationFiles.forEach(el => {
                const migrationFilePath = path.join(workspaceRoot, el[1]);
                const targetAtomDir = path.join(atomDir, 'db', 'migrate');
                if (!fs.existsSync(targetAtomDir)) {
                    outputChannel.appendLine(`📁 Creating the migrations folder: ${targetAtomDir}`);
                    mkDirP(targetAtomDir,outputChannel);
                }
                outputChannel.appendLine(`📄 Moving the migration file to the migrations folder: ${migrationFilePath}`);
                fs.renameSync(migrationFilePath, path.join(targetAtomDir, path.basename(migrationFilePath)));
            });
            modelFiles.forEach(el => {
                const modelFilePath = path.join(workspaceRoot, el[1]);
                const targetAtomDir = path.join(atomDir, 'app', 'models');
                if (!fs.existsSync(targetAtomDir)) {
                    outputChannel.appendLine(`📁 Creating the models folder: ${targetAtomDir}`);
                    mkDirP(targetAtomDir,outputChannel);
                }
                outputChannel.appendLine(`📄 Moving the model file to the models folder: ${modelFilePath}`);
                const modelFileBaseName = path.basename(modelFilePath);
                fs.renameSync(modelFilePath, path.join(targetAtomDir, modelFileBaseName));

                // Creating the concerns folders for Thecore standard way of adding content to the fat model
                const apiDir = path.join(atomDir, 'app', 'models', 'concerns', 'api');
                mkDirP(apiDir, outputChannel);
                const railsAdminDir = path.join(atomDir, 'app', 'models', 'concerns', 'rails_admin');
                mkDirP(railsAdminDir, outputChannel);

                const apiContent = [
                    `module Api::${modelName}`,
                    `  extend ActiveSupport::Concern`,
                    ``,
                    `  included do`,
                    `    # Use self.json_attrs to drive json rendering for `,
                    `    # API model responses (index, show and update ones).`,
                    `    # For reference:`,
                    `    # https://api.rubyonrails.org/classes/ActiveModel/Serializers/JSON.html`,
                    `    # The object passed accepts only these keys:`,
                    `    # - only: list [] of model fields to be shown in JSON serialization`,
                    `    # - except: exclude these fields from the JSON serialization, is a list []`,
                    `    # - methods: include the result of some method defined in the model`,
                    `    # - include: include associated models, it's an object {} which also accepts the keys described here`,
                    `    cattr_accessor :json_attrs`,
                    `    self.json_attrs = ::ModelDrivenApi.smart_merge (json_attrs || {}), {}`,
                    ``,
                    `    # Here you can add custom actions to be called from the API`,
                    `    # The action must return an serializable (JSON) object.`,
                    `    # Here you can find an example, in the API could be called like:`,
                    `    # `,
                    `    # GET /api/v2/:model/:id?do=test&custom_parameter=hello`,
                    `    #`,
                    `    # Please uncomment it to test with a REST client.`,
                    `    # Please take note on the fact that, if the do params is test, the custom`,
                    `    # action definition must be, like below self.custom_action_test.`,
                    `    # def self.custom_action_test_action_name params`,
                    `    #     { test: [ :first, :second, :third ], id: params[:id], params: params}`,
                    `    # end`,
                    `  end`,
                    `end`
                ];
                writeTextFile(apiDir, modelFileBaseName, apiContent, outputChannel);

                const railsAdminContent = [
                    `module RailsAdmin::${modelName}`,
                    `    extend ActiveSupport::Concern`,
                    ``,
                    `    included do`,
                    `        rails_admin do`,
                    `            navigation_label I18n.t('admin.registries.label')`,
                    `            navigation_icon 'fa fa-file'`,
                    `        end`,
                    `    end`,
                    `end`
                ];
                writeTextFile(railsAdminDir, modelFileBaseName, railsAdminContent, outputChannel);

                // Add to the model file, the inclusion of the concerns
                const concernIncluders = [
                    `    include Api::${modelName}`,
                    `    include RailsAdmin::${modelName}`
                ];
                
                const modelFileContent = fs.readFileSync(modelFilePath, 'utf8');

                const includeLine = `include ${modelName}`;
                const includeLinesExist = modelFileContent.includes(includeLine);

                if (!includeLinesExist) {
                    const updatedModelFileContent = modelFileContent.replace(
                        / < ApplicationRecord/,
                        ` < ApplicationRecord\n${concernIncluders.join('\n')}`
                    );

                    fs.writeFileSync(modelFilePath, updatedModelFileContent, 'utf8');
                    outputChannel.appendLine(`✅ Modified the ${modelName} RB file adding the concern's includes.`);
                }
                
            });
        }

        // The command executed successfully, show a success message
        outputChannel.appendLine(`✅ The model ${modelName} has been added successfully.`);
        vscode.window.showInformationMessage(`The model ${modelName} has been added successfully.`);
    } catch (error) {
        outputChannel.appendLine(`❌ An error occurred while adding the model: ${error.message}`);
        vscode.window.showErrorMessage(`An error occurred while adding the model: ${error.message}`);
    }
}

// Make the following code available to the extension.js file
module.exports = {
    perform,
}