// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const fs = require('fs');
const path = require('path');
// Add lodash merge
const deepMerge = require('lodash/merge');
const yaml = require('js-yaml');
const { renderTemplate } = require('./templates');

function writeJSONFile(dir, jsonFile, jsonContentObject, outputChannel) {
    outputChannel.appendLine(`📝 Creating JSON file ${jsonFile} inside ${dir}.`);
    // Creating the json file inside the directory
    const targetFile = path.join(dir, jsonFile);
    // Writing the file
    fs.writeFileSync(targetFile, JSON.stringify(jsonContentObject, null, 4));
    outputChannel.appendLine(` - JSON file ${jsonFile} created successfully.`);
}

function writeYAMLFile(dir, yamlFile, yamlContentObject, outputChannel) {
    outputChannel.appendLine(`📝 Creating YAML file ${yamlFile} inside ${dir}.`);
    // Creating the yaml file inside the directory
    const targetFile = path.join(dir, yamlFile);
    // Writing the file
    const yamlContent = yaml.dump(yamlContentObject, {
        'styles': {
            '!!null': 'canonical' // dump null as ~
        },
        'sortKeys': false        // sort object keys
    });
    fs.writeFileSync(targetFile, yamlContent);
    outputChannel.appendLine(` - YAML file ${yamlFile} created successfully.`);
}


function mergeYmlContent(ymlDir, ymlFile, rootActionName, rootActionNameTitleCase, rootElement, outputChannel) {
    // Synchronicity used only for the example (it stops the Event Loop). 
    const data = fs.readFileSync(path.join(ymlDir, ymlFile), 'utf8');
    const parsedData = yaml.load(data);
    deepMerge(parsedData, {
        [rootElement]: {
            admin: {
                actions: {
                    [rootActionName]: {
                        menu: rootActionNameTitleCase,
                        title: rootActionNameTitleCase,
                        breadcrumb: rootActionNameTitleCase,
                    }
                }
            }
        }
    });
    writeYAMLFile(ymlDir, ymlFile, parsedData, outputChannel);
}

function writeTextFile(dir, textFile, textContent, outputChannel) {
    outputChannel.appendLine(`📝 Creating text file ${textFile} inside ${dir}.`);
    // Creating the text file inside the directory
    const targetFile = path.join(dir, textFile);
    // Writing the file
    // if the textContent is an array, we need to join it
    if (Array.isArray(textContent)) {
        textContent = textContent.join('\n');
    }
    fs.writeFileSync(targetFile, textContent);
    outputChannel.appendLine(` - Text file ${textFile} created successfully.`);
}

function createGitignoreFile(dir, outputChannel) {
    writeTextFile(dir, '.gitignore', renderTemplate('shared/gitignore'), outputChannel);
}

function railsStyleKey(str) {
  // Step 1: titleize — capitalize first letter of each word
  const titleized = str
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Step 2: gsub(/[^0-9a-z]/i, '') — remove non-alphanumeric characters
  const stripped = titleized.replace(/[^0-9a-zA-Z]/g, '');

  // Step 3: underscore — CamelCase → snake_case
  const underscored = stripped
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase();

  return underscored;
}

// Make the following code available to the extension.js file
module.exports = {
    writeJSONFile,
    writeYAMLFile,
    writeTextFile,
    createGitignoreFile,
    mergeYmlContent,
    railsStyleKey
}