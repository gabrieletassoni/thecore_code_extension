'use strict';

const path = require('path');
const vscode = require('vscode');

class ATOMContext {
    constructor(atomDir, workspaceRoot) {
        this.atomDir = atomDir;
        this.atomName = path.basename(atomDir);
        this._workspaceRoot = workspaceRoot;
    }

    type() { return 'atom'; }
    targetDir() { return this.atomDir; }
    appRoot() { return this._workspaceRoot; }
    modelDir() { return path.join(this.atomDir, 'app', 'models'); }
    migrationDir() { return path.join(this.atomDir, 'db', 'migrate'); }
    concernsDir(type) { return path.join(this.atomDir, 'app', 'models', 'concerns', type); }
    memberActionsDir() { return path.join(this.atomDir, 'lib', 'member_actions'); }
    rootActionsDir() { return path.join(this.atomDir, 'lib', 'root_actions'); }
    localesDir() { return path.join(this.atomDir, 'config', 'locales'); }
    viewsDir() { return path.join(this.atomDir, 'app', 'views', 'rails_admin', 'main'); }
    jsAssetsDir() { return path.join(this.atomDir, 'app', 'assets', 'javascripts', 'rails_admin', 'actions'); }
    cssAssetsDir() { return path.join(this.atomDir, 'app', 'assets', 'stylesheets', 'rails_admin', 'actions'); }
    initializerFile(name) { return path.join(this.atomDir, 'config', 'initializers', name); }
    assetsFile() { return path.join(this.atomDir, 'config', 'initializers', 'assets.rb'); }
}

class AppContext {
    constructor(workspaceRoot) {
        this.root = workspaceRoot;
    }

    type() { return 'app'; }
    targetDir() { return this.root; }
    appRoot() { return this.root; }
    modelDir() { return path.join(this.root, 'app', 'models'); }
    migrationDir() { return path.join(this.root, 'db', 'migrate'); }
    concernsDir(type) { return path.join(this.root, 'app', 'models', 'concerns', type); }
}

function workspaceRootPath() {
    const folders = vscode.workspace.workspaceFolders;
    return folders ? folders[0].uri.fsPath : null;
}

function from(folder) {
    if (!folder) return null;
    const dirPath = folder.fsPath !== undefined ? folder.fsPath : folder;
    const workspaceRoot = workspaceRootPath() || dirPath;
    const parentPath = path.dirname(dirPath);
    const isAtomParent = /[/\\]vendor[/\\]submodules$/.test(parentPath);

    if (isAtomParent) {
        return new ATOMContext(dirPath, workspaceRoot);
    }
    return new AppContext(workspaceRoot);
}

module.exports = { from, ATOMContext, AppContext };
