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

// Matches a literal `group :development do ... end` block (not `group :development, :test do`,
// which loads in the test env too — see docs/adr/0002-thecore-generators-gem-and-generator-hook-mechanism.md
// in the thecore repo for why thecore_generators must stay dev-only). Non-greedy so a Gemfile with
// several `do...end` blocks after this one doesn't get swallowed.
const DEVELOPMENT_GROUP_REGEX = /group :development do\n([\s\S]*?)\nend/;

// Pure content transform (no fs I/O) so it can be reused both by createApp.js (which manages its
// own Gemfile read/write cycle directly) and by the addModel/addMigration guard-and-fix flow.
// Reuses an existing bare `group :development do` block when present (Rails' own default Gemfile
// already ships one, e.g. for `web-console`) rather than creating a redundant second one; creates
// a fresh block at the end of the file only when genuinely absent.
function insertGemIntoDevelopmentGroup(gemfileContent, gemLine) {
    const match = gemfileContent.match(DEVELOPMENT_GROUP_REGEX);
    if (match) {
        const [fullBlock, blockBody] = match;
        const patchedBlock = `group :development do\n${blockBody}\n  ${gemLine}\nend`;
        return gemfileContent.replace(fullBlock, patchedBlock);
    }
    const separator = gemfileContent.endsWith('\n') ? '' : '\n';
    return `${gemfileContent}${separator}\ngroup :development do\n  ${gemLine}\nend\n`;
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
    insertGemIntoDevelopmentGroup,
};
