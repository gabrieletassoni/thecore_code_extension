const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { perform } = require('../commands/addRootAction');
const jest = require('jest');
const expect = require('expect');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('addRootAction', () => {
		// Mock the vscode.window.showInformationMessage method
		vscode.window.showInformationMessage = jest.fn();

		// Mock the vscode.window.showErrorMessage method
		vscode.window.showErrorMessage = jest.fn();

		// Mock the fs.existsSync method
		fs.existsSync.mockReturnValue(true);

		// Mock the fs.writeFileSync method
		fs.writeFileSync.mockImplementation(() => {});

		// Mock the vscode.window.showInputBox method
		vscode.window.showInputBox = jest.fn().mockResolvedValue('root_action');

		// Call the perform function
		perform({ fsPath: path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "test", "samples", "atom") });

		// Assert that the vscode.window.showInformationMessage method was called with the correct message
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Adding a root Action to the current ATOM.');

		// Assert that the vscode.window.showErrorMessage method was not called
		expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();

		// Assert that the fs.existsSync method was called with the correct paths
		expect(fs.existsSync).toHaveBeenCalledWith('/path/to/atom');
		expect(fs.existsSync).toHaveBeenCalledWith('/path/to/atom/root_action.gemspec');
		expect(fs.existsSync).toHaveBeenCalledWith('/path/to/atom/lib/root_actions');

		// Assert that the vscode.window.showInputBox method was called with the correct prompt
		expect(vscode.window.showInputBox).toHaveBeenCalledWith({ prompt: 'Please enter the name of the root action to add.' });

		// Assert that the fs.writeFileSync method was called with the correct arguments
		expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/atom/lib/root_actions/root_action.rb', expect.any(String));
		expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/atom/app/views/rails_admin/main/root_action.html.erb', expect.any(String));
		expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/atom/config/initializers/after_initialize.rb', expect.any(String));
		expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/atom/config/initializers/assets.rb', expect.any(String));
		expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/atom/vendor/submodules/thecore_tcp_debug/app/assets/stylesheets/main_root_action.scss', expect.any(String));
		expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/atom/vendor/submodules/thecore_tcp_debug/app/assets/javascripts/main_root_action.js', expect.any(String));
	});
});