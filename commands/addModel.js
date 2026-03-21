// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { mkDirP, execShell } = require('../libs/os');
const { isPascalCase, hasGemspec, workspaceExixtence, isDir, rubyOnRailsAppValidity } = require('../libs/check');
const { writeTextFile } = require('../libs/configs');

// The code you place here will be executed every time your command is executed
async function perform(clickedDir) {
    if (!clickedDir) {
        vscode.window.showErrorMessage('Please right click on a folder and select Add Model.');
        return;
    }

    // Switches the VS Code Window to Output panel like the user would do manually to the specific output channel called Thecore, if it does not exist, the channel will be created
    const outputChannel = vscode.window.createOutputChannel('Thecore: Add Model');
    outputChannel.show();

    // Check if we are inside a workspace
    if (!workspaceExixtence(outputChannel)) { return; }

    // get the root folder path of the workspace
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

    try {
        const dirPath = clickedDir.fsPath;
        if (!isDir(dirPath, outputChannel)) { return; }

        // Detect context: ATOM (parent folder is vendor/submodules) or main app
        const parentPath = path.dirname(dirPath);
        const isAtom = /[/\\]vendor[/\\]submodules$/.test(parentPath);
        let targetDir;

        if (isAtom) {
            outputChannel.appendLine(`🔍 ATOM context detected: ${dirPath}`);
            const atomName = path.basename(dirPath);
            if (!hasGemspec(dirPath, atomName, outputChannel)) { return; }
            targetDir = dirPath;
        } else {
            outputChannel.appendLine(`🔍 Main app context detected.`);
            if (!rubyOnRailsAppValidity(false, outputChannel)) { return; }
            targetDir = workspaceRoot;
        }

        // Get the model name from the user input and check if it's PascalCase
        const modelName = await vscode.window.showInputBox({
            ignoreFocusOut: true,
            prompt: 'Please enter the PascalCase name of the model.',
            validateInput: (modelName) => {
                // Validates if the input exists and is PascalCase
                if (!modelName || !isPascalCase(modelName)) {
                    return '❌ The PascalCase name is not valid. Please try again.';
                }
                return null;
            }
        });

        if (!modelName) { return; }

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

        // Run the rails g model command to create the migration and model files
        const output = await execShell(`bundle install && rails g model "${modelName}" ${modelDefinition || ''} --skip-test-framework`, workspaceRoot, outputChannel);

        if (!output) {
            const errorMessage = "No output from rails g command exists, cannot go on";
            outputChannel.appendLine(`❌ ${errorMessage}, please inspect the output window.`);
            vscode.window.showErrorMessage(`${errorMessage}, please inspect the output window.`);
            return;
        }

        const migrationFiles = [...output.matchAll(/^\s+create\s+(db\/migrate\/.+\.rb)$/gm)];
        const modelFiles = [...output.matchAll(/^\s+create\s+(app\/models\/.+\.rb)$/gm)];

        if (!migrationFiles.length || !modelFiles.length) {
            const errorMessage = "No evidence of migration or model file creation in rails g output, cannot go on";
            outputChannel.appendLine(`❌ ${errorMessage}, please inspect lines above.`);
            vscode.window.showErrorMessage(`${errorMessage}, please inspect output window.`);
            return;
        }

        // Handle migration files
        migrationFiles.forEach(el => {
            const migrationFilePath = path.join(workspaceRoot, el[1]);
            if (isAtom) {
                const targetMigrateDir = path.join(targetDir, 'db', 'migrate');
                mkDirP(targetMigrateDir, outputChannel);
                outputChannel.appendLine(`📄 Moving the migration file to: ${targetMigrateDir}`);
                fs.renameSync(migrationFilePath, path.join(targetMigrateDir, path.basename(migrationFilePath)));
            } else {
                outputChannel.appendLine(`📄 Migration created at: ${migrationFilePath}`);
            }
        });

        // Handle model files
        modelFiles.forEach(el => {
            const modelFilePath = path.join(workspaceRoot, el[1]);
            const modelFileBaseName = path.basename(modelFilePath);
            let finalModelFile;

            if (isAtom) {
                const targetModelDir = path.join(targetDir, 'app', 'models');
                mkDirP(targetModelDir, outputChannel);
                outputChannel.appendLine(`📄 Moving the model file to: ${targetModelDir}`);
                finalModelFile = path.join(targetModelDir, modelFileBaseName);
                fs.renameSync(modelFilePath, finalModelFile);
            } else {
                finalModelFile = modelFilePath;
                outputChannel.appendLine(`📄 Model created at: ${finalModelFile}`);
            }

            // Create the concerns folders for Thecore standard way of adding content to the fat model
            const apiDir = path.join(targetDir, 'app', 'models', 'concerns', 'api');
            mkDirP(apiDir, outputChannel);
            const railsAdminDir = path.join(targetDir, 'app', 'models', 'concerns', 'rails_admin');
            mkDirP(railsAdminDir, outputChannel);
            const endpointsDir = path.join(targetDir, 'app', 'models', 'concerns', 'endpoints');
            mkDirP(endpointsDir, outputChannel);

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
                    `    # Custom action callable by the API must be defined in /app/models/concerns/endpoints/`,
                    `  end`,
                    `end`
                ];
                writeTextFile(apiDir, modelFileBaseName, apiContent, outputChannel);

                const railsAdminContent = [
                    `module RailsAdmin::${modelName}`,
                    `  extend ActiveSupport::Concern`,
                    ``,
                    `  included do`,
                    `    rails_admin do`,
                    `      navigation_label I18n.t('admin.registries.label')`,
                    `      navigation_icon 'fa fa-file'`,
                    `    end`,
                    `  end`,
                    `end`
                ];
                writeTextFile(railsAdminDir, modelFileBaseName, railsAdminContent, outputChannel);

                const endpointsContent = [
                    `class Endpoints::${modelName} < NonCrudEndpoints`,
                    `  # self.desc '${modelName}', :test, {`,
                    `  #   # Define the action name using openapi swagger format`,
                    `  #   get: {`,
                    `  #     summary: "Test API Custom Action",`,
                    `  #     description: "This is a test API custom action",`,
                    `  #     operationId: "test",`,
                    `  #     tags: ["Test"],`,
                    `  #     parameters: [`,
                    `  #       {`,
                    `  #         name: "explain",`,
                    `  #         in: "query",`,
                    `  #         description: "Explain the action by returning this openapi schema",`,
                    `  #         required: true,`,
                    `  #         schema: {`,
                    `  #           type: "boolean"`,
                    `  #         }`,
                    `  #       }`,
                    `  #     ],`,
                    `  #     responses: {`,
                    `  #       200 => {`,
                    `  #         description: "The openAPI json schema for this action",`,
                    `  #         content: {`,
                    `  #           "application/json": {`,
                    `  #             schema: {`,
                    `  #               type: "object",`,
                    `  #               additionalProperties: true`,
                    `  #             }`,
                    `  #           }`,
                    `  #         }`,
                    `  #       },`,
                    `  #       501 => {`,
                    `  #         error: :string,`,
                    `  #       }`,
                    `  #     }`,
                    `  #   },`,
                    `  #   post: {`,
                    `  #     summary: "Test API Custom Action",`,
                    `  #     description: "This is a test API custom action",`,
                    `  #     operationId: "test",`,
                    `  #     tags: ["Test"],`,
                    `  #     requestBody: {`,
                    `  #       required: true,`,
                    `  #       content: {`,
                    `  #         "application/json": {}`,
                    `  #       }`,
                    `  #     },`,
                    `  #     responses: {`,
                    `  #       200 => {`,
                    `  #         description: "The openAPI json schema for this action",`,
                    `  #         # This will return the object with a message string and a params object`,
                    `  #         content: {`,
                    `  #           "application/json": {`,
                    `  #             schema: {`,
                    `  #               type: "object",`,
                    `  #               properties: {`,
                    `  #                 message: {`,
                    `  #                   type: "string"`,
                    `  #                 },`,
                    `  #                 params: {`,
                    `  #                   type: "object",`,
                    `  #                   additionalProperties: true`,
                    `  #                 }`,
                    `  #               }`,
                    `  #             }`,
                    `  #           }`,
                    `  #         }`,
                    `  #       },`,
                    `  #       501 => {`,
                    `  #         error: :string,`,
                    `  #       }`,
                    `  #     }`,
                    `  #   }`,
                    `  # }`,
                    `  # def test(params)`,
                    `  #   return { message: "Hello World From Test API Custom Action called test", params: params }, 200`,
                    `  # end`,
                    `end`
                ];
                writeTextFile(endpointsDir, modelFileBaseName, endpointsContent, outputChannel);

                // Add to the model file, the inclusion of the concerns
                const concernIncluders = [
                    `  include Api::${modelName}`,
                    `  include RailsAdmin::${modelName}`
                ];

                const modelFileContent = fs.readFileSync(finalModelFile, 'utf8');
                const includeLine = `include ${modelName}`;

                if (!modelFileContent.includes(includeLine)) {
                    const updatedModelFileContent = modelFileContent.replace(
                        / < ApplicationRecord/,
                        ` < ApplicationRecord\n${concernIncluders.join('\n')}`
                    );
                    fs.writeFileSync(finalModelFile, updatedModelFileContent, 'utf8');
                    outputChannel.appendLine(`✅ Modified the ${modelName} RB file adding the concern's includes.`);
                }
        });


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