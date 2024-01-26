const vscode = require('vscode');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const jest = require('jest');
const { createApp } = require('../commands/createApp');
const assert = require('assert');
const { expect } = require('jest');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('createApp', () => {
		// Mock the vscode.window.showInformationMessage method
		vscode.window.showInformationMessage = jest.fn();

		// Mock the vscode.window.showErrorMessage method
		vscode.window.showErrorMessage = jest.fn();

		// Mock the child_process.exec method
		exec.mockImplementation((command, callback) => {
			if (command === 'ruby -v') {
				callback(null, 'ruby version 2.7.0');
			} else if (command === 'rails -v') {
				callback(null, 'rails version 6.0.3');
			} else if (command === 'bundle -v') {
				callback(null, 'Bundler version 2.1.4');
			} else if (command.startsWith('rails new')) {
				callback(null, '', '');
			} else if (command.startsWith('git')) {
				callback(null, '', '');
			}
		});

		// Mock the fs.existsSync method
		fs.existsSync.mockReturnValue(false);

		// Mock the fs.writeFileSync method
		fs.writeFileSync.mockImplementation(() => {});

		// Call the createApp function
		createApp();

		// Assert that the vscode.window.showInformationMessage method was called with the correct message
		assert(vscode.window.showInformationMessage).toHaveBeenCalledWith('Creating a Thecore 3 App.');

		// Assert that the vscode.window.showErrorMessage method was not called
		assert(vscode.window.showErrorMessage).not.toHaveBeenCalled();

		// Assert that the child_process.exec method was called with the correct commands
		assert(exec).toHaveBeenCalledWith('ruby -v', expect.any(Function));
		assert(exec).toHaveBeenCalledWith('rails -v', expect.any(Function));
		assert(exec).toHaveBeenCalledWith('bundle -v', expect.any(Function));
		assert(exec).toHaveBeenCalledWith('rails new . --database=postgresql --asset-pipeline=sprockets --skip-git', expect.any(Function));
		assert(exec).toHaveBeenCalledWith('git init', expect.any(Function));
		assert(exec).toHaveBeenCalledWith('git checkout -b main', expect.any(Function));
		assert(exec).toHaveBeenCalledWith('git add .', expect.any(Function));
		assert(exec).toHaveBeenCalledWith('git commit -m "Initial commit"', expect.any(Function));
		assert(exec).toHaveBeenCalledWith('git branch -M main', expect.any(Function));

		// Assert that the fs.existsSync method was called with the correct paths
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'app'));
		const workspaceRoot = '/path/to/workspace'; // Replace '/path/to/workspace' with the actual workspace root path

		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'bin'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'config'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'db'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'lib'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'log'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'public'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'storage'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'test'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'tmp'));
		expect(fs.existsSync).toHaveBeenCalledWith(path.join(workspaceRoot, 'vendor'));

		// Assert that the fs.writeFileSync method was called with the correct arguments
		expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(workspaceRoot, '.gitignore'), expect.any(String));

		// Assert that the exec method was called with the correct commands after writing the .gitignore file
		expect(exec).toHaveBeenCalledWith('bundle install', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('rails generate devise:install', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('rails g rails_admin:install app --asset=sprockets', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('bundle install', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('rails active_storage:install', expect.any(Function));
		expect(exec).toHaveBeenCalledWith('rails action_text:install', expect.any(Function));

		// Assert that the vscode.window.showErrorMessage method was not called after checking the Gemfile
		expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
	});
});