'use strict';

const assert = require('assert');
const path = require('path');
const vscode = require('vscode');
const { from, ATOMContext, AppContext } = require('../../libs/workspaceContext');

const ATOM_PARENT = '/fake/workspace/vendor/submodules';
const ATOM_DIR = `${ATOM_PARENT}/my_atom`;
const APP_DIR = '/fake/workspace';

describe('libs/workspaceContext', () => {
    beforeEach(() => {
        vscode.workspace.workspaceFolders = [{ uri: { fsPath: APP_DIR } }];
    });

    describe('from()', () => {
        it('returns null when folder is undefined', () => {
            assert.strictEqual(from(undefined), null);
        });

        it('returns ATOMContext when parent path ends with vendor/submodules', () => {
            const ctx = from({ fsPath: ATOM_DIR });
            assert.ok(ctx instanceof ATOMContext);
        });

        it('returns AppContext when folder is outside vendor/submodules', () => {
            const ctx = from({ fsPath: APP_DIR });
            assert.ok(ctx instanceof AppContext);
        });

        it('accepts a plain string path', () => {
            const ctx = from(ATOM_DIR);
            assert.ok(ctx instanceof ATOMContext);
        });
    });

    describe('ATOMContext', () => {
        let ctx;
        beforeEach(() => {
            ctx = new ATOMContext(ATOM_DIR, APP_DIR);
        });

        it('type() returns "atom"', () => assert.strictEqual(ctx.type(), 'atom'));
        it('targetDir() returns atomDir', () => assert.strictEqual(ctx.targetDir(), ATOM_DIR));
        it('appRoot() returns the workspace root', () => assert.strictEqual(ctx.appRoot(), APP_DIR));
        it('atomName is the basename of atomDir', () => assert.strictEqual(ctx.atomName, 'my_atom'));
        it('modelDir() is inside atomDir', () => assert.strictEqual(ctx.modelDir(), path.join(ATOM_DIR, 'app', 'models')));
        it('migrationDir() is inside atomDir', () => assert.strictEqual(ctx.migrationDir(), path.join(ATOM_DIR, 'db', 'migrate')));
        it('concernsDir(type) is inside atomDir/app/models/concerns', () => {
            assert.strictEqual(ctx.concernsDir('api'), path.join(ATOM_DIR, 'app', 'models', 'concerns', 'api'));
        });
        it('memberActionsDir() is inside atomDir/lib', () => {
            assert.strictEqual(ctx.memberActionsDir(), path.join(ATOM_DIR, 'lib', 'member_actions'));
        });
        it('rootActionsDir() is inside atomDir/lib', () => {
            assert.strictEqual(ctx.rootActionsDir(), path.join(ATOM_DIR, 'lib', 'root_actions'));
        });
        it('localesDir() is inside atomDir/config', () => {
            assert.strictEqual(ctx.localesDir(), path.join(ATOM_DIR, 'config', 'locales'));
        });
        it('viewsDir() is inside atomDir', () => {
            assert.strictEqual(ctx.viewsDir(), path.join(ATOM_DIR, 'app', 'views', 'rails_admin', 'main'));
        });
        it('jsAssetsDir() is inside atomDir', () => {
            assert.strictEqual(ctx.jsAssetsDir(), path.join(ATOM_DIR, 'app', 'assets', 'javascripts', 'rails_admin', 'actions'));
        });
        it('cssAssetsDir() is inside atomDir', () => {
            assert.strictEqual(ctx.cssAssetsDir(), path.join(ATOM_DIR, 'app', 'assets', 'stylesheets', 'rails_admin', 'actions'));
        });
        it('initializerFile(name) is inside atomDir/config/initializers', () => {
            assert.strictEqual(ctx.initializerFile('assets.rb'), path.join(ATOM_DIR, 'config', 'initializers', 'assets.rb'));
        });
        it('assetsFile() is the assets initializer', () => {
            assert.strictEqual(ctx.assetsFile(), path.join(ATOM_DIR, 'config', 'initializers', 'assets.rb'));
        });
    });

    describe('AppContext', () => {
        let ctx;
        beforeEach(() => {
            ctx = new AppContext(APP_DIR);
        });

        it('type() returns "app"', () => assert.strictEqual(ctx.type(), 'app'));
        it('targetDir() returns workspaceRoot', () => assert.strictEqual(ctx.targetDir(), APP_DIR));
        it('appRoot() returns workspaceRoot', () => assert.strictEqual(ctx.appRoot(), APP_DIR));
        it('modelDir() is inside root', () => assert.strictEqual(ctx.modelDir(), path.join(APP_DIR, 'app', 'models')));
        it('migrationDir() is inside root', () => assert.strictEqual(ctx.migrationDir(), path.join(APP_DIR, 'db', 'migrate')));
        it('concernsDir(type) is inside root/app/models/concerns', () => {
            assert.strictEqual(ctx.concernsDir('rails_admin'), path.join(APP_DIR, 'app', 'models', 'concerns', 'rails_admin'));
        });
    });
});
