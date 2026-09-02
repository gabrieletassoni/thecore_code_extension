'use strict';

const fs = require('fs');
const vscode = require('vscode');
const { insertGemIntoDevelopmentGroup } = require('./configs');

// Keep this version constraint in sync with the thecore_generators release this extension is
// tested against — see docs/adr/0002-thecore-generators-gem-and-generator-hook-mechanism.md in
// the thecore repo.
const GEM_LINE = 'gem "thecore_generators", "~> 3.2"';

const ACTION_LABEL = 'Add & Bundle Install';

const WARNING_MESSAGE =
    'thecore_generators is missing from this app\'s Gemfile. Without it, `rails generate model`/`migration` ' +
    'silently falls back to plain, un-hooked Rails behavior — no ATOM-aware file placement, no default-first ' +
    'concerns, and no inverse-association wiring — with no other indication anything is wrong.';

/**
 * Shown by addModel.js/addMigration.js after their existing guard checks pass and
 * ctx.check.hasThecoreGenerators(gemfilePath) came back not-ok, and before shelling out to
 * `rails generate`. Only on explicit confirmation does it patch the Gemfile (inside a
 * `group :development do ... end` block — thecore_generators is dev-tooling only, never a
 * runtime dependency) and run `bundle install`. Dismissing/cancelling the prompt aborts the
 * caller entirely: it returns false, and callers must not proceed to `rails generate` on false.
 *
 * @param {import('./executionContext').ExecutionContext} ctx
 * @param {string} gemfilePath
 * @returns {Promise<boolean>} true if the caller should proceed with the original command
 */
async function confirmAndAddThecoreGenerators(ctx, gemfilePath) {
    ctx.log('⚠️ thecore_generators is missing from the Gemfile.');

    const choice = await vscode.window.showWarningMessage(WARNING_MESSAGE, ACTION_LABEL);
    if (choice !== ACTION_LABEL) {
        ctx.log('❌ thecore_generators prompt was dismissed; aborting.');
        return false;
    }

    ctx.log('📝 Adding thecore_generators to the Gemfile (group :development).');
    const content = fs.existsSync(gemfilePath) ? fs.readFileSync(gemfilePath, 'utf8') : '';
    fs.writeFileSync(gemfilePath, insertGemIntoDevelopmentGroup(content, GEM_LINE));

    ctx.log('⌛ Running bundle install.');
    await ctx.exec('bundle install', ctx.workspace.appRoot());

    return true;
}

module.exports = { confirmAndAddThecoreGenerators, GEM_LINE, ACTION_LABEL };
