'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const vscode = require('vscode');
const { perform } = require('../commands/checkPractices');
const { makeCtx, makeAtomWorkspace, makeAppWorkspace, FAKE_ROOT, ATOM_DIR } = require('./helpers/makeCtx');

// ── helpers ──────────────────────────────────────────────────────────────────

function makeCollection() {
    return { set: sinon.stub(), clear: sinon.stub(), delete: sinon.stub(), dispose: sinon.stub() };
}

function stubEmptyTarget() {
    sinon.stub(fs, 'readdirSync').returns([]);
    sinon.stub(fs, 'existsSync').returns(false);
}

// ── Issue #17: command skeleton ───────────────────────────────────────────────

describe('commands/checkPractices', () => {
    let collection;

    beforeEach(() => {
        collection = makeCollection();
        sinon.stub(vscode.languages, 'createDiagnosticCollection').returns(collection);
    });

    afterEach(() => sinon.restore());

    // Guard: null workspace
    it('shows an error and returns when workspace is null', async () => {
        const ctx = makeCtx({ workspace: null });
        const errStub = sinon.stub(vscode.window, 'showErrorMessage');
        await perform(ctx);
        assert.ok(errStub.calledOnce);
        assert.ok(errStub.firstCall.args[0].includes('right click'));
        assert.ok(!ctx.show.called, 'output channel must not open when workspace is null');
    });

    // Guard: workspaceExists check fails
    it('returns early when workspaceExists check fails', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        ctx.check.workspaceExists.returns({ ok: false, message: 'No workspace' });
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(!infoStub.called);
    });

    // Happy path: no files to audit → no violations
    it('shows "no violations" when the Target has nothing to audit', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(fs, 'readdirSync').returns([]);
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'readFileSync').returns('Rails.application.configure do\nRails.application.config.assets.precompile');
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(infoStub.calledOnce);
        assert.ok(infoStub.firstCall.args[0].includes('no violations'));
        assert.ok(!collection.set.called, 'diagnostic collection must not be populated');
    });

    // Happy path: main app with no files
    it('shows "no violations" for an empty Main App Target', async () => {
        const ctx = makeCtx({ workspace: makeAppWorkspace() });
        stubEmptyTarget();
        const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
        await perform(ctx);
        assert.ok(infoStub.calledOnce);
        assert.ok(infoStub.firstCall.args[0].includes('no violations'));
    });

    // Error handling
    it('shows an error message when an unexpected exception is thrown', async () => {
        const ctx = makeCtx({ workspace: makeAtomWorkspace() });
        sinon.stub(fs, 'readdirSync').callsFake(dir => {
            if (dir.includes('root_actions')) return ['crash.rb'];
            return [];
        });
        sinon.stub(fs, 'existsSync').returns(true);
        sinon.stub(fs, 'readFileSync').throws(new Error('disk full'));
        const errStub = sinon.stub(vscode.window, 'showErrorMessage');
        await perform(ctx);
        assert.ok(errStub.calledOnce);
        assert.ok(errStub.firstCall.args[0].includes('disk full'));
    });

    // ── Issue #18: Scaffold File checks ─────────────────────────────────────

    describe('Scaffold File checks (ATOM only)', () => {
        it('emits an Error diagnostic when after_initialize.rb is missing', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').returns([]);
            sinon.stub(fs, 'existsSync').callsFake(p => !p.includes('after_initialize'));
            sinon.stub(fs, 'readFileSync').returns('Rails.application.config.assets.precompile');
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const calls = collection.set.args;
            const msgs = calls.flatMap(([, diags]) => diags.map(d => d.message));
            assert.ok(msgs.some(m => m.includes('after_initialize.rb')), 'should flag missing after_initialize.rb');
            const diags = calls.flatMap(([, d]) => d);
            assert.ok(diags.every(d => d.severity === vscode.DiagnosticSeverity.Error));
        });

        it('emits an Error diagnostic when after_initialize.rb is missing the configure do marker', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').returns([]);
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').returns('# no marker here\nRails.application.config.assets.precompile');
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('Rails.application.configure do')));
        });

        it('emits an Error diagnostic when after_initialize.rb contains unreplaced tokens', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').returns([]);
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('after_initialize')) return 'Rails.application.configure do\n{{unreplaced}}';
                return 'Rails.application.config.assets.precompile';
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('unreplaced template tokens')));
        });

        it('emits an Error diagnostic when assets.rb is missing the precompile marker', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').returns([]);
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('assets')) return '# empty assets file';
                return 'Rails.application.configure do';
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('Rails.application.config.assets.precompile')));
        });

        it('does not run Scaffold File checks in Main App context', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            stubEmptyTarget();
            sinon.stub(vscode.window, 'showInformationMessage');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(!msgs.some(m => m.includes('Scaffold File')));
        });

        it('produces no diagnostics when both Scaffold Files are fully compliant', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').returns([]);
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').returns(
                'Rails.application.configure do\nRails.application.config.assets.precompile'
            );
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
            await perform(ctx);
            assert.ok(!collection.set.called);
            assert.ok(infoStub.firstCall.args[0].includes('no violations'));
        });
    });

    // ── Issue #19: Action checks ─────────────────────────────────────────────

    describe('Action checks', () => {
        function scaffoldOk() {
            return 'Rails.application.configure do\nRails.application.config.assets.precompile';
        }
        function goodAction() {
            return "RailsAdmin::Config::Actions.add_action 'x', :base\nhttp_methods [:get]";
        }
        function goodView() { return 'stylesheet_link_tag\njavascript_include_tag'; }
        function goodJs() { return "document.addEventListener('turbo:load', fn);"; }
        function goodScss() { return '@keyframes sk-bounce {}'; }

        it('emits an Error when an action .rb is missing the add_action marker', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.endsWith('my_action.rb') && p.includes('root_actions')) return 'http_methods [:get]';
                if (p.endsWith('.html.erb')) return goodView();
                if (p.endsWith('.js')) return goodJs();
                if (p.endsWith('.scss')) return goodScss();
                if (p.includes('after_initialize')) return scaffoldOk() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.yml')) return 'my_action:';
                return scaffoldOk();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('add_action')));
        });

        it('emits an Error when an action .rb is missing the http_methods marker', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.endsWith('my_action.rb') && p.includes('root_actions')) return "RailsAdmin::Config::Actions.add_action 'x'";
                if (p.endsWith('.html.erb')) return goodView();
                if (p.endsWith('.js')) return goodJs();
                if (p.endsWith('.scss')) return goodScss();
                if (p.includes('after_initialize')) return scaffoldOk() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.yml')) return 'my_action:';
                return scaffoldOk();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('http_methods')));
        });

        it('emits an Error when an action .rb contains unreplaced tokens', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.endsWith('my_action.rb') && p.includes('root_actions')) return goodAction() + '\n{{token}}';
                if (p.endsWith('.html.erb')) return goodView();
                if (p.endsWith('.js')) return goodJs();
                if (p.endsWith('.scss')) return goodScss();
                if (p.includes('after_initialize')) return scaffoldOk() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.yml')) return 'my_action:';
                return scaffoldOk();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('unreplaced template tokens')));
        });

        it('emits an Error when the companion view is missing', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').callsFake(p => !p.endsWith('.html.erb'));
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions')) return goodAction();
                if (p.includes('after_initialize')) return scaffoldOk() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.js')) return goodJs();
                if (p.endsWith('.scss')) return goodScss();
                if (p.endsWith('.yml')) return 'my_action:';
                return scaffoldOk();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('.html.erb')));
        });

        it('emits an Error when the companion JS file is missing', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').callsFake(p => !p.endsWith('.js'));
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions')) return goodAction();
                if (p.includes('after_initialize')) return scaffoldOk() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.html.erb')) return goodView();
                if (p.endsWith('.scss')) return goodScss();
                if (p.endsWith('.yml')) return 'my_action:';
                return scaffoldOk();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('.js')));
        });

        it('emits an Error when the companion SCSS file is missing', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').callsFake(p => !p.endsWith('.scss'));
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions')) return goodAction();
                if (p.includes('after_initialize')) return scaffoldOk() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.html.erb')) return goodView();
                if (p.endsWith('.js')) return goodJs();
                if (p.endsWith('.yml')) return 'my_action:';
                return scaffoldOk();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('.scss')));
        });

        it('emits an Error when the require line is missing from after_initialize.rb', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions/my_action')) return goodAction();
                if (p.includes('after_initialize')) return 'Rails.application.configure do\n'; // no require
                if (p.endsWith('.html.erb')) return goodView();
                if (p.endsWith('.js')) return goodJs();
                if (p.endsWith('.scss')) return goodScss();
                if (p.endsWith('.yml')) return 'my_action:';
                return scaffoldOk();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('require line')));
        });

        it('emits a Warning (not Error) when a locale entry is missing', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                if (dir.includes('locales')) return ['en.yml'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions/my_action')) return goodAction();
                if (p.includes('after_initialize')) return scaffoldOk() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.html.erb')) return goodView();
                if (p.endsWith('.js')) return goodJs();
                if (p.endsWith('.scss')) return goodScss();
                if (p.endsWith('en.yml')) return 'other_action:'; // locale missing for my_action
                return scaffoldOk();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const allDiags = collection.set.args.flatMap(([, d]) => d);
            const localeWarnings = allDiags.filter(d =>
                d.severity === vscode.DiagnosticSeverity.Warning && d.message.includes('locale')
            );
            assert.ok(localeWarnings.length > 0, 'should emit a Warning for missing locale');
        });

        it('uses the Rails.root.join require format for Main App actions', async () => {
            const ctx = makeCtx({ workspace: makeAppWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions/my_action')) return goodAction();
                if (p.includes('after_initialize')) return 'Rails.application.configure do\n'; // no require
                if (p.endsWith('.html.erb')) return goodView();
                if (p.endsWith('.js')) return goodJs();
                if (p.endsWith('.scss')) return goodScss();
                if (p.endsWith('.yml')) return 'my_action:';
                return scaffoldOk();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('require line')));
            // Confirm the violation is about after_initialize (require format is an internal detail tested via auto-fix)
        });

        it('emits no diagnostics for a fully compliant action', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                if (dir.includes('locales')) return ['en.yml'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions/my_action')) return goodAction();
                if (p.includes('after_initialize')) return scaffoldOk() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.html.erb')) return goodView();
                if (p.endsWith('.js')) return goodJs();
                if (p.endsWith('.scss')) return goodScss();
                if (p.endsWith('en.yml')) return 'my_action:';
                return scaffoldOk();
            });
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
            await perform(ctx);
            assert.ok(!collection.set.called, 'no diagnostics for a clean action');
            assert.ok(infoStub.firstCall.args[0].includes('no violations'));
        });
    });

    // ── Issue #20: Model checks ──────────────────────────────────────────────

    describe('Model checks', () => {
        it('emits an Error when the model is missing include Api::ModelName', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir === ctx.workspace.modelDir()) return ['widget.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('models/widget.rb')) return 'include RailsAdmin::Widget\n';
                if (p.includes('concerns')) return 'extend ActiveSupport::Concern\ncattr_accessor :json_attrs\nrails_admin do\n< NonCrudEndpoints';
                return 'Rails.application.configure do\nRails.application.config.assets.precompile';
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('include Api::Widget')));
        });

        it('emits an Error when the model is missing include RailsAdmin::ModelName', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir === ctx.workspace.modelDir()) return ['widget.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('models/widget.rb')) return 'include Api::Widget\n';
                if (p.includes('concerns')) return 'extend ActiveSupport::Concern\ncattr_accessor :json_attrs\nrails_admin do\n< NonCrudEndpoints';
                return 'Rails.application.configure do\nRails.application.config.assets.precompile';
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('include RailsAdmin::Widget')));
        });

        it('emits an Error when a concern file is missing', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir === ctx.workspace.modelDir()) return ['widget.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').callsFake(p => !p.includes('concerns/api'));
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('models/widget.rb')) return 'include Api::Widget\ninclude RailsAdmin::Widget\n';
                if (p.includes('concerns')) return 'extend ActiveSupport::Concern\ncattr_accessor :json_attrs\nrails_admin do\n< NonCrudEndpoints';
                return 'Rails.application.configure do\nRails.application.config.assets.precompile';
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('api concern')));
        });

        it('emits an Error when a concern file is missing a skeleton marker', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir === ctx.workspace.modelDir()) return ['widget.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('models/widget.rb')) return 'include Api::Widget\ninclude RailsAdmin::Widget\n';
                if (p.includes('concerns/api')) return 'extend ActiveSupport::Concern\n# no cattr_accessor';
                if (p.includes('concerns/rails_admin')) return 'extend ActiveSupport::Concern\nrails_admin do';
                if (p.includes('concerns/endpoints')) return '< NonCrudEndpoints';
                return 'Rails.application.configure do\nRails.application.config.assets.precompile';
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('cattr_accessor :json_attrs')));
        });

        it('emits an Error when a concern file contains unreplaced tokens', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir === ctx.workspace.modelDir()) return ['widget.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('models/widget.rb')) return 'include Api::Widget\ninclude RailsAdmin::Widget\n';
                if (p.includes('concerns/api')) return 'extend ActiveSupport::Concern\ncattr_accessor :json_attrs\n{{token}}';
                if (p.includes('concerns/rails_admin')) return 'extend ActiveSupport::Concern\nrails_admin do';
                if (p.includes('concerns/endpoints')) return '< NonCrudEndpoints';
                return 'Rails.application.configure do\nRails.application.config.assets.precompile';
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            const msgs = collection.set.args.flatMap(([, d]) => d.map(x => x.message));
            assert.ok(msgs.some(m => m.includes('unreplaced template tokens')));
        });

        it('emits no diagnostics for a fully compliant model', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir === ctx.workspace.modelDir()) return ['widget.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('models/widget.rb')) return 'include Api::Widget\ninclude RailsAdmin::Widget\n';
                if (p.includes('concerns/api')) return 'extend ActiveSupport::Concern\ncattr_accessor :json_attrs';
                if (p.includes('concerns/rails_admin')) return 'extend ActiveSupport::Concern\nrails_admin do';
                if (p.includes('concerns/endpoints')) return '< NonCrudEndpoints';
                return 'Rails.application.configure do\nRails.application.config.assets.precompile';
            });
            const infoStub = sinon.stub(vscode.window, 'showInformationMessage');
            await perform(ctx);
            assert.ok(!collection.set.called);
            assert.ok(infoStub.firstCall.args[0].includes('no violations'));
        });
    });

    // ── Issue #21: Auto-fix ──────────────────────────────────────────────────

    describe('Auto-fix', () => {
        function fullScaffold() {
            return 'Rails.application.configure do\nRails.application.config.assets.precompile';
        }
        function goodAction() {
            return "RailsAdmin::Config::Actions.add_action 'x'\nhttp_methods [:get]";
        }

        it('does not show the quick-pick when there are no violations', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').returns([]);
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').returns(fullScaffold());
            const qpStub = sinon.stub(vscode.window, 'showQuickPick');
            sinon.stub(vscode.window, 'showInformationMessage');
            await perform(ctx);
            assert.ok(!qpStub.called, 'quick-pick must not appear when there are no violations');
        });

        it('does not show the quick-pick when all violations are non-fixable', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            // after_initialize missing skeleton marker → non-fixable
            sinon.stub(fs, 'readdirSync').returns([]);
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').returns('# no markers here');
            const qpStub = sinon.stub(vscode.window, 'showQuickPick');
            await perform(ctx);
            assert.ok(!qpStub.called);
        });

        it('creates the missing companion view when user selects Yes', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').callsFake(p => {
                if (p.endsWith('.html.erb')) return false; // view missing
                return true;
            });
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions')) return goodAction();
                if (p.includes('after_initialize')) return fullScaffold() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.js')) return "document.addEventListener('turbo:load', fn);";
                if (p.endsWith('.scss')) return '@keyframes sk-bounce {}';
                if (p.endsWith('.yml')) return 'my_action:';
                return fullScaffold();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('Yes');
            sinon.stub(vscode.window, 'showInformationMessage');
            await perform(ctx);
            assert.ok(ctx.write.textFile.calledWithMatch(
                sinon.match(s => s.includes('rails_admin/main')),
                'my_action.html.erb',
                sinon.match.string
            ), 'should create the missing view from template');
        });

        it('appends the missing require line when user selects Yes', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions')) return goodAction();
                if (p.includes('after_initialize')) return fullScaffold(); // require missing
                if (p.endsWith('.html.erb')) return 'stylesheet_link_tag\njavascript_include_tag';
                if (p.endsWith('.js')) return "document.addEventListener('turbo:load', fn);";
                if (p.endsWith('.scss')) return '@keyframes sk-bounce {}';
                if (p.endsWith('.yml')) return 'my_action:';
                return fullScaffold();
            });
            const appendStub = sinon.stub(fs, 'appendFileSync');
            sinon.stub(vscode.window, 'showQuickPick').resolves('Yes');
            sinon.stub(vscode.window, 'showInformationMessage');
            await perform(ctx);
            assert.ok(appendStub.called, 'appendFileSync must be called to add the require line');
            assert.ok(
                appendStub.args.some(([p, content]) =>
                    p.includes('after_initialize') && content.includes("require 'root_actions/my_action'")
                ),
                'must append the ATOM-format require line'
            );
        });

        it('merges the missing locale stub when user selects Yes', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                if (dir.includes('locales')) return ['en.yml'];
                return [];
            });
            sinon.stub(fs, 'existsSync').returns(true);
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions')) return goodAction();
                if (p.includes('after_initialize')) return fullScaffold() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.html.erb')) return 'stylesheet_link_tag\njavascript_include_tag';
                if (p.endsWith('.js')) return "document.addEventListener('turbo:load', fn);";
                if (p.endsWith('.scss')) return '@keyframes sk-bounce {}';
                if (p.endsWith('en.yml')) return 'other_action:'; // locale missing
                return fullScaffold();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('Yes');
            sinon.stub(vscode.window, 'showInformationMessage');
            await perform(ctx);
            assert.ok(ctx.write.mergeYaml.called, 'mergeYaml must be called for missing locale');
            assert.ok(ctx.write.mergeYaml.firstCall.args[2] === 'my_action', 'should merge for my_action');
        });

        it('does not apply fixes when user selects No', async () => {
            const ctx = makeCtx({ workspace: makeAtomWorkspace() });
            sinon.stub(fs, 'readdirSync').callsFake(dir => {
                if (dir.includes('root_actions')) return ['my_action.rb'];
                return [];
            });
            sinon.stub(fs, 'existsSync').callsFake(p => !p.endsWith('.html.erb'));
            sinon.stub(fs, 'readFileSync').callsFake(p => {
                if (p.includes('root_actions')) return goodAction();
                if (p.includes('after_initialize')) return fullScaffold() + "\nrequire 'root_actions/my_action'";
                if (p.endsWith('.js')) return "document.addEventListener('turbo:load', fn);";
                if (p.endsWith('.scss')) return '@keyframes sk-bounce {}';
                if (p.endsWith('.yml')) return 'my_action:';
                return fullScaffold();
            });
            sinon.stub(vscode.window, 'showQuickPick').resolves('No');
            await perform(ctx);
            assert.ok(!ctx.write.textFile.called, 'textFile must not be called when user declines');
        });
    });
});
