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
    // Main app actions live under config/, not lib/: Rails 7.1+ autoload_lib would
    // eager-load lib/ via Zeitwerk and crash on constant-less action files
    // (see docs/adr/0001-main-app-actions-live-in-config.md).
    memberActionsDir() { return path.join(this.root, 'config', 'member_actions'); }
    rootActionsDir() { return path.join(this.root, 'config', 'root_actions'); }
    localesDir() { return path.join(this.root, 'config', 'locales'); }
    viewsDir() { return path.join(this.root, 'app', 'views', 'rails_admin', 'main'); }
    jsAssetsDir() { return path.join(this.root, 'app', 'assets', 'javascripts', 'rails_admin', 'actions'); }
    cssAssetsDir() { return path.join(this.root, 'app', 'assets', 'stylesheets', 'rails_admin', 'actions'); }
    initializerFile(name) { return path.join(this.root, 'config', 'initializers', name); }
    assetsFile() { return path.join(this.root, 'config', 'initializers', 'assets.rb'); }
}

function workspaceRootPath() {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length ? folders[0].uri.fsPath : null;
}

function atomRootOf(dirPath) {
    let current = dirPath;
    let parent = path.dirname(current);
    while (parent !== current) {
        if (/[/\\]vendor[/\\]submodules$/.test(parent)) return current;
        current = parent;
        parent = path.dirname(current);
    }
    return null;
}

function from(folder) {
    const dirPath = folder ? (folder.fsPath !== undefined ? folder.fsPath : folder) : null;
    const workspaceRoot = workspaceRootPath() || dirPath;
    // No clicked folder and no open workspace: nothing to operate on.
    if (!workspaceRoot) return null;

    if (dirPath) {
        // Any folder inside an ATOM's tree targets that ATOM, not the main app.
        const atomRoot = atomRootOf(dirPath);
        if (atomRoot) return new ATOMContext(atomRoot, workspaceRoot);
    }
    // Folders outside vendor/submodules and command palette invocations
    // (no folder argument) both target the main app.
    return new AppContext(workspaceRoot);
}

module.exports = { from, ATOMContext, AppContext };
