const assert = require('assert');
const vscode = require('vscode');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const expect = require('expect');
const { releaseApp } = require('../commands/releaseApp');
const jest = require('jest');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('releaseApp', () => {
		// Mock the vscode.window.showInformationMessage method
		vscode.window.showInformationMessage = jest.fn();

		// Mock the vscode.window.showErrorMessage method
		vscode.window.showErrorMessage = jest.fn();

		// Mock the child_process.exec method
		exec.mockImplementation((command, callback) => {
			if (command === 'git pull && git fetch --all --tags --prune && git add . -A') {
				callback(null, '', '');
			} else if (command.startsWith('chmod +x') && command.endsWith('pre-compile.sh')) {
				callback(null, '', '');
			} else if (command.startsWith('bundle update --gemfile')) {
				callback(null, '', '');
			} else if (command.startsWith('git commit -a -m')) {
				callback(null, '', '');
			} else if (command.startsWith('git tag -a')) {
				callback(null, '', '');
			} else if (command === 'git push && git push --tags') {
				callback(null, '', '');
			}
		});

		// Mock the fs.existsSync method
		fs.existsSync.mockReturnValue(true);

		// Mock the fs.readFileSync method
		fs.readFileSync.mockReturnValue('1.0.0');

		// Mock the fs.writeFileSync method
		// Call the releaseApp function
		releaseApp();

		// Assert that the vscode.window.showInformationMessage method was called with the correct message
		assert.expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Releasing this Thecore 3 App.');

		// Assert that the vscode.window.showErrorMessage method was not called
		assert.expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();

		// Assert that the child_process.exec method was called with the correct commands
		const workspaceRoot = '/path/to/workspace'; // Replace '/path/to/workspace' with the actual workspace root path

		assert.expect(exec).toHaveBeenCalledWith('git pull && git fetch --all --tags --prune && git add . -A', expect.any(Function));
		assert.expect(exec).toHaveBeenCalledWith('chmod +x ./vendor/custombuilds/pre-compile.sh && source ./vendor/custombuilds/pre-compile.sh', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('bundle update --gemfile ./vendor/custombuilds/Gemfile', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('git commit -a -m "Release"', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('git tag -a 1.0.0 -m "Release"', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('git push && git push --tags', expect.any(Function));

		// Assert that the fs.existsSync method was called with the correct paths
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'app'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'bin'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'config'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'db'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'lib'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'log'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'public'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'storage'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'test'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'tmp'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'vendor/custombuilds'));

		// Assert that the fs.readFileSync method was called with the correct arguments
		expect(fs.readFileSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'VERSION'), 'utf8');

		// Assert that the fs.writeFileSync method was called with the correct arguments
		expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'VERSION'), '1.0.1');

		// Assert that the exec method was called with the correct commands after writing the new version to the VERSION file
		expect(exec).toHaveBeenCalledWith('git commit -a -m "Release"', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('git tag -a 1.0.1 -m "Release"', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('git push && git push --tags', expect.any(Function));

		// Assert that the vscode.window.showErrorMessage method was not called after checking the custombuildsDir
		expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
	});
});