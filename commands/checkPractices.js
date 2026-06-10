'use strict';

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { CommandRunner } = require('../libs/commandRunner');
const { hasUnreplacedTokens, hasSkeletonMarker } = require('../libs/check');
const { renderTemplate } = require('../libs/templates');
const { snakeToClassName } = require('../libs/helpers');

function lineOf(content, marker) {
    const lines = content.split('\n');
    const idx = lines.findIndex(l => l.includes(marker));
    return idx >= 0 ? idx : 0;
}

function violation(filePath, line, message, severity, fix = null) {
    return { filePath, line, message, severity, fix };
}

function checkScaffoldFiles(ctx, violations) {
    const afterInitPath = ctx.workspace.initializerFile('after_initialize.rb');
    const assetsPath = ctx.workspace.assetsFile();

    if (!fs.existsSync(afterInitPath)) {
        violations.push(violation(afterInitPath, 0, 'Missing Scaffold File: after_initialize.rb', vscode.DiagnosticSeverity.Error));
    } else {
        const content = fs.readFileSync(afterInitPath, 'utf8');
        if (!hasSkeletonMarker(content, 'Rails.application.configure do')) {
            violations.push(violation(afterInitPath, 0, 'after_initialize.rb is missing the Rails.application.configure do marker', vscode.DiagnosticSeverity.Error));
        }
        if (hasUnreplacedTokens(content)) {
            violations.push(violation(afterInitPath, lineOf(content, '{{'), 'after_initialize.rb contains unreplaced template tokens', vscode.DiagnosticSeverity.Error));
        }
    }

    if (!fs.existsSync(assetsPath)) {
        violations.push(violation(assetsPath, 0, 'Missing Scaffold File: assets.rb', vscode.DiagnosticSeverity.Error));
    } else {
        const content = fs.readFileSync(assetsPath, 'utf8');
        if (!hasSkeletonMarker(content, 'Rails.application.config.assets.precompile')) {
            violations.push(violation(assetsPath, 0, 'assets.rb is missing the Rails.application.config.assets.precompile marker', vscode.DiagnosticSeverity.Error));
        }
    }
}

function checkActionFile(ctx, actionPath, actionName, actionType, violations) {
    const content = fs.readFileSync(actionPath, 'utf8');

    if (!hasSkeletonMarker(content, 'RailsAdmin::Config::Actions.add_action')) {
        violations.push(violation(actionPath, 0, `${actionName}: missing RailsAdmin::Config::Actions.add_action marker`, vscode.DiagnosticSeverity.Error));
    }
    if (!hasSkeletonMarker(content, 'http_methods')) {
        violations.push(violation(actionPath, 0, `${actionName}: missing http_methods marker`, vscode.DiagnosticSeverity.Error));
    }
    if (hasUnreplacedTokens(content)) {
        violations.push(violation(actionPath, lineOf(content, '{{'), `${actionName}: contains unreplaced template tokens`, vscode.DiagnosticSeverity.Error));
    }

    const viewPath = path.join(ctx.workspace.viewsDir(), `${actionName}.html.erb`);
    const jsPath = path.join(ctx.workspace.jsAssetsDir(), `${actionName}.js`);
    const scssPath = path.join(ctx.workspace.cssAssetsDir(), `${actionName}.scss`);
    const afterInitPath = ctx.workspace.initializerFile('after_initialize.rb');

    if (!fs.existsSync(viewPath)) {
        const templateName = actionType === 'root_actions' ? 'addRootAction/action.html.erb' : 'addMemberAction/action.html.erb';
        violations.push(violation(viewPath, 0, `${actionName}: missing companion view ${actionName}.html.erb`, vscode.DiagnosticSeverity.Error, {
            apply(c) {
                const dir = c.workspace.viewsDir();
                if (!fs.existsSync(path.join(dir, `${actionName}.html.erb`))) {
                    c.write.textFile(dir, `${actionName}.html.erb`, renderTemplate(templateName, { actionName }));
                }
            },
        }));
    } else {
        const viewContent = fs.readFileSync(viewPath, 'utf8');
        if (!hasSkeletonMarker(viewContent, 'stylesheet_link_tag')) {
            violations.push(violation(viewPath, 0, `${actionName}: view missing stylesheet_link_tag marker`, vscode.DiagnosticSeverity.Error));
        }
        if (!hasSkeletonMarker(viewContent, 'javascript_include_tag')) {
            violations.push(violation(viewPath, 0, `${actionName}: view missing javascript_include_tag marker`, vscode.DiagnosticSeverity.Error));
        }
        if (hasUnreplacedTokens(viewContent)) {
            violations.push(violation(viewPath, lineOf(viewContent, '{{'), `${actionName}: view contains unreplaced template tokens`, vscode.DiagnosticSeverity.Error));
        }
    }

    if (!fs.existsSync(jsPath)) {
        const templateName = actionType === 'root_actions' ? 'addRootAction/action.js' : 'addMemberAction/action.js';
        violations.push(violation(jsPath, 0, `${actionName}: missing companion JS asset ${actionName}.js`, vscode.DiagnosticSeverity.Error, {
            apply(c) {
                const dir = c.workspace.jsAssetsDir();
                if (!fs.existsSync(path.join(dir, `${actionName}.js`))) {
                    const camel = actionName.toLowerCase().replace(/[-_][a-z0-9]/g, g => g.slice(-1).toUpperCase());
                    c.write.textFile(dir, `${actionName}.js`, renderTemplate(templateName, { actionName, actionNameCamelCase: camel }));
                }
            },
        }));
    } else {
        const jsContent = fs.readFileSync(jsPath, 'utf8');
        if (!hasSkeletonMarker(jsContent, "document.addEventListener('turbo:load'")) {
            violations.push(violation(jsPath, 0, `${actionName}: JS file missing document.addEventListener('turbo:load' marker`, vscode.DiagnosticSeverity.Error));
        }
        if (hasUnreplacedTokens(jsContent)) {
            violations.push(violation(jsPath, lineOf(jsContent, '{{'), `${actionName}: JS file contains unreplaced template tokens`, vscode.DiagnosticSeverity.Error));
        }
    }

    if (!fs.existsSync(scssPath)) {
        violations.push(violation(scssPath, 0, `${actionName}: missing companion SCSS asset ${actionName}.scss`, vscode.DiagnosticSeverity.Error, {
            apply(c) {
                const dir = c.workspace.cssAssetsDir();
                if (!fs.existsSync(path.join(dir, `${actionName}.scss`))) {
                    c.write.textFile(dir, `${actionName}.scss`, renderTemplate('shared/action.scss', { actionName }));
                }
            },
        }));
    } else {
        const scssContent = fs.readFileSync(scssPath, 'utf8');
        if (!hasSkeletonMarker(scssContent, '@keyframes sk-bounce')) {
            violations.push(violation(scssPath, 0, `${actionName}: SCSS file missing @keyframes sk-bounce marker`, vscode.DiagnosticSeverity.Error));
        }
        if (hasUnreplacedTokens(scssContent)) {
            violations.push(violation(scssPath, lineOf(scssContent, '{{'), `${actionName}: SCSS file contains unreplaced template tokens`, vscode.DiagnosticSeverity.Error));
        }
    }

    const isAtom = ctx.workspace.type() === 'atom';
    const requireLine = isAtom
        ? `require '${actionType}/${actionName}'`
        : `require Rails.root.join('config', '${actionType}', '${actionName}').to_s`;

    if (fs.existsSync(afterInitPath)) {
        const afterInitContent = fs.readFileSync(afterInitPath, 'utf8');
        if (!afterInitContent.includes(requireLine)) {
            violations.push(violation(afterInitPath, 0, `${actionName}: missing require line in after_initialize.rb`, vscode.DiagnosticSeverity.Error, {
                apply(_c) {
                    const current = fs.readFileSync(afterInitPath, 'utf8');
                    if (!current.includes(requireLine)) {
                        fs.appendFileSync(afterInitPath, `\n        ${requireLine}\n`, 'utf8');
                    }
                },
            }));
        }
    }

    const localesDir = ctx.workspace.localesDir();
    let localeFiles = [];
    try { localeFiles = fs.readdirSync(localesDir).filter(f => f.endsWith('.yml')); } catch { /* no locales dir */ }

    for (const localeFile of localeFiles) {
        const localePath = path.join(localesDir, localeFile);
        const lang = path.basename(localeFile, '.yml');
        try {
            const localeContent = fs.readFileSync(localePath, 'utf8');
            if (!localeContent.includes(`${actionName}:`)) {
                const titleCase = actionName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                violations.push(violation(localePath, 0, `${actionName}: missing locale entry in ${localeFile}`, vscode.DiagnosticSeverity.Warning, {
                    apply(c) {
                        c.write.mergeYaml(localesDir, localeFile, actionName, titleCase, lang);
                    },
                }));
            }
        } catch { /* unreadable locale */ }
    }
}

function checkActions(ctx, violations) {
    const dirs = [
        { dir: ctx.workspace.rootActionsDir(), type: 'root_actions' },
        { dir: ctx.workspace.memberActionsDir(), type: 'member_actions' },
    ];
    for (const { dir, type } of dirs) {
        let files = [];
        try { files = fs.readdirSync(dir).filter(f => f.endsWith('.rb')); } catch { continue; }
        for (const file of files) {
            checkActionFile(ctx, path.join(dir, file), path.basename(file, '.rb'), type, violations);
        }
    }
}

function checkModels(ctx, violations) {
    let files = [];
    try { files = fs.readdirSync(ctx.workspace.modelDir()).filter(f => f.endsWith('.rb')); } catch { return; }

    for (const file of files) {
        const modelPath = path.join(ctx.workspace.modelDir(), file);
        const modelName = snakeToClassName(path.basename(file, '.rb'));
        const content = fs.readFileSync(modelPath, 'utf8');

        if (!hasSkeletonMarker(content, `include Api::${modelName}`)) {
            violations.push(violation(modelPath, 0, `${modelName}: missing include Api::${modelName}`, vscode.DiagnosticSeverity.Error));
        }
        if (!hasSkeletonMarker(content, `include RailsAdmin::${modelName}`)) {
            violations.push(violation(modelPath, 0, `${modelName}: missing include RailsAdmin::${modelName}`, vscode.DiagnosticSeverity.Error));
        }

        const concernMarkers = {
            api: ['extend ActiveSupport::Concern', 'cattr_accessor :json_attrs'],
            rails_admin: ['extend ActiveSupport::Concern', 'rails_admin do'],
            endpoints: ['< NonCrudEndpoints'],
        };

        for (const [concernType, markers] of Object.entries(concernMarkers)) {
            const concernPath = path.join(ctx.workspace.concernsDir(concernType), file);
            if (!fs.existsSync(concernPath)) {
                violations.push(violation(concernPath, 0, `${modelName}: missing ${concernType} concern file`, vscode.DiagnosticSeverity.Error));
            } else {
                const concernContent = fs.readFileSync(concernPath, 'utf8');
                for (const marker of markers) {
                    if (!hasSkeletonMarker(concernContent, marker)) {
                        violations.push(violation(concernPath, 0, `${modelName}: ${concernType} concern missing '${marker}' marker`, vscode.DiagnosticSeverity.Error));
                    }
                }
                if (hasUnreplacedTokens(concernContent)) {
                    violations.push(violation(concernPath, lineOf(concernContent, '{{'), `${modelName}: ${concernType} concern contains unreplaced template tokens`, vscode.DiagnosticSeverity.Error));
                }
            }
        }
    }
}

function emitDiagnostics(collection, violations, ctx) {
    const byFile = new Map();
    for (const v of violations) {
        if (!byFile.has(v.filePath)) byFile.set(v.filePath, []);
        const pos = new vscode.Position(v.line, 0);
        byFile.get(v.filePath).push(new vscode.Diagnostic(new vscode.Range(pos, pos), v.message, v.severity));
        ctx.log(`${v.severity === vscode.DiagnosticSeverity.Error ? '❌' : '⚠️'} ${v.message}`);
    }
    for (const [filePath, diags] of byFile) {
        collection.set(vscode.Uri.file(filePath), diags);
    }
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

    try {
        const violations = [];

        if (ctx.workspace.type() === 'atom') {
            checkScaffoldFiles(ctx, violations);
        }

        checkActions(ctx, violations);
        checkModels(ctx, violations);

        emitDiagnostics(diagnosticCollection, violations, ctx);

        const fixable = violations.filter(v => v.fix !== null);

        if (violations.length === 0) {
            ctx.log('✅ No violations found.');
            vscode.window.showInformationMessage('Thecore practices audit complete: no violations found.');
            return;
        }

        if (fixable.length > 0) {
            const choice = await vscode.window.showQuickPick(
                ['Yes', 'No'],
                { placeHolder: `Fix ${fixable.length} fixable issue(s) of ${violations.length} total?` }
            );
            if (choice === 'Yes') {
                for (const v of fixable) v.fix.apply(ctx);
                ctx.log(`✅ Applied ${fixable.length} fix(es).`);
                vscode.window.showInformationMessage(`Thecore practices: applied ${fixable.length} fix(es).`);
            }
        }
    } catch (error) {
        ctx.log(`❌ Audit failed: ${error.message}`);
        vscode.window.showErrorMessage(`Thecore practices audit failed: ${error.message}`);
    }
}

module.exports = { perform };
