'use strict';

const vscode = require('vscode');
const path = require('path');
const { CommandRunner } = require('../libs/commandRunner');
const { confirmAndAddThecoreGenerators } = require('../libs/thecoreGeneratorsGuard');

const SEVERITY_MAP = {
    error: vscode.DiagnosticSeverity.Error,
    warning: vscode.DiagnosticSeverity.Warning,
};

// `rails thecore:check_practices -- --json` prints Rails/RailsAdmin/Sidekiq boot noise to
// stdout before the actual payload (verified directly against a real invocation - none of it
// goes to stderr, so `ctx.exec`-style output can't just be trusted as pure JSON). The task
// itself always `puts`s the JSON as a single line, last, via Thecore::CheckPractices::Reporter.json
// - scan from the end of the captured output for the last brace-delimited line that actually
// parses, rather than assuming the whole payload is clean JSON.
//
// A candidate line must both parse AND have the expected `violations` array shape before it's
// accepted - not just successfully JSON.parse. Some initializer/gem (e.g. structured request
// logging) could in principle emit its own single-line JSON object to stdout after the real
// payload (boot noise is only guaranteed to precede it, not to never follow); requiring the
// shape match means such a line is skipped and the scan keeps looking further back for the
// actual check_practices payload instead of surfacing a false "unexpected output" error.
function extractJson(output) {
    const lines = String(output || '').split('\n').map(l => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith('{') && lines[i].endsWith('}')) {
            try {
                const parsed = JSON.parse(lines[i]);
                if (parsed && Array.isArray(parsed.violations)) return parsed;
            } catch (_e) {
                // Not the line we're after (or malformed) - keep scanning further back.
            }
        }
    }
    return null;
}

function emitDiagnostics(collection, violations, ctx) {
    const byFile = new Map();
    for (const v of violations) {
        if (!byFile.has(v.file)) byFile.set(v.file, []);
        const pos = new vscode.Position(v.line || 0, 0);
        // Not `||`: DiagnosticSeverity.Error is 0, a falsy value that `||` would
        // incorrectly skip past. ESLint here is pinned to ecmaVersion 2018 (no `??`).
        const mapped = SEVERITY_MAP[v.severity];
        const severity = mapped === undefined ? vscode.DiagnosticSeverity.Error : mapped;
        byFile.get(v.file).push(new vscode.Diagnostic(new vscode.Range(pos, pos), v.message, severity));
        ctx.log(`${severity === vscode.DiagnosticSeverity.Error ? '❌' : '⚠️'} ${v.message}`);
    }
    for (const [file, diags] of byFile) {
        collection.set(vscode.Uri.file(file), diags);
    }
}

// Shells out to `rails thecore:check_practices -- --json[ --atom=NAME][ --fix]` and returns the
// parsed `violations` array, or `null` (after showing an error) when the output couldn't be
// understood at all. Uses `ctx.execAllowNonZero`, not `ctx.exec`: check_practices exits non-zero
// whenever it finds violations - its normal, expected reporting convention (mirroring
// RuboCop/ESLint), not a failure - so `ctx.exec`'s reject-on-any-error behavior would discard
// the JSON payload on every run that actually found something to report. See
// `execShellAllowNonZero`'s own doc comment (libs/os.js) for the full rationale.
//
// `withBundleInstall` defaults to true (needed so the gem is actually resolvable on the first
// call of a given `perform()` invocation) but is passed false for the `--fix` re-invocation:
// nothing in between the two calls can have changed the Gemfile/lockfile, so re-running
// `bundle install` a second time in the same audit-then-fix flow would just be wasted work.
async function runCheckPractices(ctx, isAtom, extraFlags, withBundleInstall = true) {
    const atomFlag = isAtom ? ` --atom=${ctx.workspace.atomName}` : '';
    const bundlePrefix = withBundleInstall ? 'bundle install && ' : '';
    const command = `${bundlePrefix}rails thecore:check_practices -- --json${atomFlag}${extraFlags}`;

    const output = await ctx.execAllowNonZero(command, ctx.workspace.appRoot());
    const data = extractJson(output);

    if (!data || !Array.isArray(data.violations)) {
        const msg = 'Unexpected output from rails thecore:check_practices, cannot go on';
        ctx.log(`❌ ${msg}, please inspect the output window.`);
        vscode.window.showErrorMessage(`${msg}, please inspect the output window.`);
        return null;
    }

    return data.violations;
}

async function perform(ctx) {
    if (!ctx.workspace) {
        vscode.window.showErrorMessage('Please right click on a folder and select Check Practices.');
        return;
    }

    ctx.show();
    ctx.log('🔍 Starting Thecore practices audit...');

    const runner = new CommandRunner(ctx);
    const showErr = msg => vscode.window.showErrorMessage(msg);
    if (!runner.check(ctx.check.workspaceExists(), showErr)) return;

    const diagnosticCollection = vscode.languages.createDiagnosticCollection('thecore-practices');
    diagnosticCollection.clear();

    const isAtom = ctx.workspace.type() === 'atom';

    try {
        // thecore_generators must be present for `rails thecore:check_practices` to exist at
        // all (see runCheckPractices) — same guard, same placement, as
        // addModel.js/addMigration.js/addRootAction.js/addMemberAction.js.
        const gemfilePath = path.join(ctx.workspace.appRoot(), 'Gemfile');
        if (!ctx.check.hasThecoreGenerators(gemfilePath).ok) {
            if (!(await confirmAndAddThecoreGenerators(ctx, gemfilePath))) return;
        }

        const violations = await runCheckPractices(ctx, isAtom, '');
        if (violations === null) return;

        emitDiagnostics(diagnosticCollection, violations, ctx);

        if (violations.length === 0) {
            ctx.log('✅ No violations found.');
            vscode.window.showInformationMessage('Thecore practices audit complete: no violations found.');
            return;
        }

        const fixable = violations.filter(v => v.fixable);
        if (fixable.length === 0) return;

        const choice = await vscode.window.showQuickPick(
            ['Yes', 'No'],
            { placeHolder: `Fix ${fixable.length} fixable issue(s) of ${violations.length} total?` }
        );
        if (choice !== 'Yes') return;

        // The rake task applies every fixable violation itself and reports whatever remains in
        // the same pass (see thecore_generators' own ADR 0004) — no separate client-side
        // "apply, then re-scan" round trip needed, and no confirmation of its own on the --fix
        // side: the QuickPick above is the one and only confirmation.
        const remaining = await runCheckPractices(ctx, isAtom, ' --fix', false);
        if (remaining === null) return;

        diagnosticCollection.clear();
        emitDiagnostics(diagnosticCollection, remaining, ctx);

        ctx.log(`✅ Fixes applied; ${remaining.length} violation(s) remain.`);
        vscode.window.showInformationMessage(`Thecore practices: fixes applied; ${remaining.length} violation(s) remain.`);
    } catch (error) {
        ctx.log(`❌ Audit failed: ${error.message}`);
        vscode.window.showErrorMessage(`Thecore practices audit failed: ${error.message}`);
    }
}

module.exports = { perform };
