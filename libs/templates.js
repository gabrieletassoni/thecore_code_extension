const fs = require('fs');
const path = require('path');

/**
 * Reads a template file and replaces {{key}} placeholders with the provided values.
 * @param {string} templateRelPath - Path relative to the templates/ directory (e.g. 'addRootAction/action.rb')
 * @param {Object} vars - Key/value pairs to substitute
 * @returns {string} Rendered content
 */
function renderTemplate(templateRelPath, vars = {}) {
    const templatePath = path.join(__dirname, '..', 'templates', templateRelPath);
    let content = fs.readFileSync(templatePath, 'utf8');
    for (const [key, value] of Object.entries(vars)) {
        content = content.replaceAll(`{{${key}}}`, value);
    }
    return content;
}

module.exports = { renderTemplate };
