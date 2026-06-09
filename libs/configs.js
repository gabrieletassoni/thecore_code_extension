'use strict';

const fs = require('fs');
const path = require('path');
const deepMerge = require('lodash/merge');
const yaml = require('js-yaml');
const { renderTemplate } = require('./templates');

function writeJSONFile(dir, jsonFile, jsonContentObject) {
    const targetFile = path.join(dir, jsonFile);
    fs.writeFileSync(targetFile, JSON.stringify(jsonContentObject, null, 4));
}

function writeYAMLFile(dir, yamlFile, yamlContentObject) {
    const targetFile = path.join(dir, yamlFile);
    const yamlContent = yaml.dump(yamlContentObject, {
        'styles': { '!!null': 'canonical' },
        'sortKeys': false,
    });
    fs.writeFileSync(targetFile, yamlContent);
}

function mergeYmlContent(ymlDir, ymlFile, rootActionName, rootActionNameTitleCase, rootElement) {
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
    writeYAMLFile(ymlDir, ymlFile, parsedData);
}

function writeTextFile(dir, textFile, textContent) {
    const targetFile = path.join(dir, textFile);
    if (Array.isArray(textContent)) {
        textContent = textContent.join('\n');
    }
    fs.writeFileSync(targetFile, textContent);
}

function createGitignoreFile(dir) {
    writeTextFile(dir, '.gitignore', renderTemplate('shared/gitignore'));
}

module.exports = {
    writeJSONFile,
    writeYAMLFile,
    writeTextFile,
    createGitignoreFile,
    mergeYmlContent,
};
