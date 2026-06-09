'use strict';

const vscode = require('vscode');
const check = require('./check');
const configs = require('./configs');
const { execShell, mkDirP } = require('./os');
const { renderTemplate } = require('./templates');
const workspaceContext = require('./workspaceContext');

class CheckContext {
    workspaceExists() {
        if (!check.workspaceExixtence()) {
            return { ok: false, message: 'No workspace is open. Please open a workspace and try again.' };
        }
        return { ok: true, value: vscode.workspace.workspaceFolders };
    }

    workspaceEmpty() {
        if (!check.workspaceEmptiness()) {
            return { ok: false, message: 'The workspace is not empty. Please open an empty workspace and try again.' };
        }
        return { ok: true, value: vscode.workspace.workspaceFolders };
    }

    railsAppValid(hideError = false) {
        const result = check.rubyOnRailsAppValidity(hideError);
        if (!result) {
            return {
                ok: false,
                message: hideError ? '' : 'The workspace root is not a Ruby on Rails app. Please open a Ruby on Rails app and try again.'
            };
        }
        return { ok: true, value: result };
    }

    fileExists(filePath) {
        if (!check.fileExistence(filePath)) {
            return { ok: false, message: `The file ${filePath} does not exist.` };
        }
        return { ok: true, value: filePath };
    }

    commandExists(command) {
        if (!check.commandExistence(command)) {
            return { ok: false, message: `The command ${command} is not available. Please install it and try again.` };
        }
        return { ok: true };
    }

    isDir(dirPath) {
        if (!check.isDir(dirPath)) {
            return { ok: false, message: `The folder ${dirPath} does not exist or is a file.` };
        }
        return { ok: true, value: dirPath };
    }

    isFile(filePath) {
        if (!check.isFile(filePath)) {
            return { ok: false, message: `The file ${filePath} does not exist or is a directory.` };
        }
        return { ok: true, value: filePath };
    }

    hasGemspec(atomDir, atomName) {
        const result = check.hasGemspec(atomDir, atomName);
        if (!result) {
            return { ok: false, message: 'Cannot find a valid gemspec file. Please select a Thecore 3 ATOM and try again.' };
        }
        return { ok: true, value: result };
    }
}

class WriteContext {
    constructor(ctx) {
        this._ctx = ctx;
    }

    jsonFile(dir, filename, content) {
        this._ctx.log(`📝 Creating JSON file ${filename} inside ${dir}.`);
        configs.writeJSONFile(dir, filename, content);
        this._ctx.log(` - JSON file ${filename} created successfully.`);
    }

    yamlFile(dir, filename, content) {
        this._ctx.log(`📝 Creating YAML file ${filename} inside ${dir}.`);
        configs.writeYAMLFile(dir, filename, content);
        this._ctx.log(` - YAML file ${filename} created successfully.`);
    }

    textFile(dir, filename, content) {
        this._ctx.log(`📝 Creating text file ${filename} inside ${dir}.`);
        configs.writeTextFile(dir, filename, content);
        this._ctx.log(` - Text file ${filename} created successfully.`);
    }

    gitignoreFile(dir) {
        this.textFile(dir, '.gitignore', renderTemplate('shared/gitignore'));
    }

    mergeYaml(ymlDir, ymlFile, actionName, actionNameTitleCase, rootElement) {
        configs.mergeYmlContent(ymlDir, ymlFile, actionName, actionNameTitleCase, rootElement);
    }
}

class ExecutionContext {
    constructor(channelName, folder) {
        this._channel = vscode.window.createOutputChannel(channelName);
        this.workspace = workspaceContext.from(folder);
        this.check = new CheckContext();
        this.write = new WriteContext(this);
    }

    log(message) { this._channel.appendLine(message); }
    show() { this._channel.show(); }

    async exec(cmd, cwd) {
        return execShell(cmd, cwd, this._channel);
    }

    mkdir(dir) {
        return mkDirP(dir, this._channel);
    }
}

module.exports = { ExecutionContext, CheckContext, WriteContext };
