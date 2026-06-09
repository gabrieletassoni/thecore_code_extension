'use strict';

const sinon = require('sinon');

const FAKE_ROOT = '/fake/workspace';
const ATOM_DIR = `${FAKE_ROOT}/vendor/submodules/my_atom`;

function makeAtomWorkspace(overrides = {}) {
    return {
        type: () => 'atom',
        atomDir: ATOM_DIR,
        atomName: 'my_atom',
        targetDir: () => ATOM_DIR,
        appRoot: () => FAKE_ROOT,
        modelDir: () => `${ATOM_DIR}/app/models`,
        migrationDir: () => `${ATOM_DIR}/db/migrate`,
        concernsDir: (t) => `${ATOM_DIR}/app/models/concerns/${t}`,
        memberActionsDir: () => `${ATOM_DIR}/lib/member_actions`,
        rootActionsDir: () => `${ATOM_DIR}/lib/root_actions`,
        localesDir: () => `${ATOM_DIR}/config/locales`,
        viewsDir: () => `${ATOM_DIR}/app/views/rails_admin/main`,
        jsAssetsDir: () => `${ATOM_DIR}/app/assets/javascripts/rails_admin/actions`,
        cssAssetsDir: () => `${ATOM_DIR}/app/assets/stylesheets/rails_admin/actions`,
        initializerFile: (name) => `${ATOM_DIR}/config/initializers/${name}`,
        assetsFile: () => `${ATOM_DIR}/config/initializers/assets.rb`,
        ...overrides
    };
}

function makeAppWorkspace(overrides = {}) {
    return {
        type: () => 'app',
        root: FAKE_ROOT,
        targetDir: () => FAKE_ROOT,
        appRoot: () => FAKE_ROOT,
        modelDir: () => `${FAKE_ROOT}/app/models`,
        migrationDir: () => `${FAKE_ROOT}/db/migrate`,
        concernsDir: (t) => `${FAKE_ROOT}/app/models/concerns/${t}`,
        ...overrides
    };
}

function makeCtx(overrides = {}) {
    const FAKE_ROR_DIRS = {
        workspaceRoot: FAKE_ROOT,
        appDir: `${FAKE_ROOT}/app`,
        binDir: `${FAKE_ROOT}/bin`,
        configDir: `${FAKE_ROOT}/config`,
        dbDir: `${FAKE_ROOT}/db`,
        libDir: `${FAKE_ROOT}/lib`,
        logDir: `${FAKE_ROOT}/log`,
        publicDir: `${FAKE_ROOT}/public`,
        storageDir: `${FAKE_ROOT}/storage`,
        testDir: `${FAKE_ROOT}/test`,
        tmpDir: `${FAKE_ROOT}/tmp`,
        vendorDir: `${FAKE_ROOT}/vendor`,
    };

    return {
        show: sinon.stub(),
        log: sinon.stub(),
        exec: sinon.stub().resolves(''),
        mkdir: sinon.stub(),
        workspace: null,
        check: {
            workspaceExists: sinon.stub().returns({ ok: true, value: [{ uri: { fsPath: FAKE_ROOT } }] }),
            workspaceEmpty: sinon.stub().returns({ ok: true }),
            railsAppValid: sinon.stub().returns({ ok: true, value: FAKE_ROR_DIRS }),
            fileExists: sinon.stub().returns({ ok: true, value: `${FAKE_ROOT}/vendor/submodules` }),
            commandExists: sinon.stub().returns({ ok: true }),
            isDir: sinon.stub().returns({ ok: true }),
            isFile: sinon.stub().returns({ ok: false }),
            hasGemspec: sinon.stub().returns({ ok: true, value: `${ATOM_DIR}/my_atom.gemspec` }),
        },
        write: {
            textFile: sinon.stub(),
            yamlFile: sinon.stub(),
            jsonFile: sinon.stub(),
            gitignoreFile: sinon.stub(),
            mergeYaml: sinon.stub(),
        },
        ...overrides
    };
}

module.exports = { makeCtx, makeAtomWorkspace, makeAppWorkspace, FAKE_ROOT, ATOM_DIR };
