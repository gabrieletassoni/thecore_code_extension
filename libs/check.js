'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function workspaceExixtence() {
    return vscode.workspace.workspaceFolders !== undefined;
}

function workspaceEmptiness() {
    return vscode.workspace.workspaceFolders.length <= 1;
}

function rubyOnRailsAppValidity(hideErrorMessage = false) {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const dirNames = ['app', 'bin', 'config', 'db', 'lib', 'log', 'public', 'storage', 'test', 'tmp', 'vendor'];
    const allExist = dirNames.every(d => fs.existsSync(path.join(workspaceRoot, d)));
    if (!allExist) return false;
    const dirsObject = { workspaceRoot };
    dirNames.forEach(d => { dirsObject[`${d}Dir`] = path.join(workspaceRoot, d); });
    return dirsObject;
}

function fileExistence(filePath) {
    return fs.existsSync(filePath);
}

function commandExistence(command) {
    try {
        execSync(`${command} --version`, { encoding: 'utf8', stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

const isPascalCase = (word) => {
    if (typeof word !== 'string') return 'It must be a string.';
    return /^[A-Z][A-Za-z]*$/.test(word);
};

const hasGemspec = (atomDir, atomName) => {
    const atomGemspec = path.join(atomDir, `${atomName}.gemspec`);
    const variantName = atomName.replace(/-/g, '_');
    const atomGemspecVariant = path.join(atomDir, `${variantName}.gemspec`);
    if (fs.existsSync(atomGemspec)) return atomGemspec;
    if (fs.existsSync(atomGemspecVariant)) return atomGemspecVariant;
    return false;
};

const isDir = (dirPath) => {
    return fs.existsSync(dirPath) && fs.lstatSync(dirPath).isDirectory();
};

const isFile = (filePath) => {
    return fs.existsSync(filePath) && fs.lstatSync(filePath).isFile();
};

const hasUnreplacedTokens = (content) => /\{\{[^}]+\}\}/.test(content);

const hasSkeletonMarker = (content, marker) => content.includes(marker);

// Tolerant of quote style ('/"), version constraint presence/absence, and whether the gem
// line sits inside a `group` block or is bare — a full Ruby/Bundler parse is overkill for
// detecting "is this gem mentioned at all in the Gemfile".
const hasThecoreGenerators = (gemfileContent) => /gem\s+['"]thecore_generators['"]/.test(gemfileContent);

module.exports = {
    workspaceExixtence,
    rubyOnRailsAppValidity,
    fileExistence,
    workspaceEmptiness,
    commandExistence,
    isPascalCase,
    hasGemspec,
    isDir,
    isFile,
    hasUnreplacedTokens,
    hasSkeletonMarker,
    hasThecoreGenerators,
};
