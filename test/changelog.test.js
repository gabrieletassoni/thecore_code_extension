const assert = require('assert');
const fs = require('fs');
const path = require('path');

// The release step renames `## [Unreleased]` to the new version (PUBLISHING.md). Renaming every
// occurrence once produced two `## [3.11.0]` headings (#48): each version heads one section only.
describe('CHANGELOG.md', () => {
    const headings = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8')
        .split('\n')
        .filter(line => line.startsWith('## ['))
        .map(line => line.match(/^## \[([^\]]+)\]/)[1]);

    it('names each version in one heading only', () => {
        const duplicates = headings.filter((name, i) => headings.indexOf(name) !== i);
        assert.deepStrictEqual(duplicates, []);
    });

    it('has at most one Unreleased section, at the top', () => {
        const unreleased = headings.filter(name => name === 'Unreleased');
        assert.ok(unreleased.length <= 1, `${unreleased.length} Unreleased headings`);
        if (unreleased.length === 1) assert.strictEqual(headings[0], 'Unreleased');
    });
});
