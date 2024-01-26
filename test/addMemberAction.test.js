const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { perform } = require('../commands/addMemberAction');
const jest = require('jest');
const expect = require('expect');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('perform', () => {
		// Mock the vscode.window.showInformationMessage method
		vscode.window.showInformationMessage = jest.fn();

		// Mock the vscode.window.showErrorMessage method
		vscode.window.showErrorMessage = jest.fn();

		// Mock the fs.existsSync method
		fs.existsSync.mockReturnValue(true);

		// Mock the fs.writeFileSync method
		fs.writeFileSync.mockImplementation(() => {});

		// Mock the vscode.window.showInputBox method
		vscode.window.showInputBox.mockResolvedValue('test_action');

		// Call the perform function
		perform({ fsPath: path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, "test", "samples", "atom") });

		// Assert that the vscode.window.showInformationMessage method was called with the correct message
		expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('Adding a member Action to the current ATOM.');

		// Assert that the vscode.window.showErrorMessage method was not called
		expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();

		// Assert that the fs.existsSync method was called with the correct paths
		expect(fs.existsSync).toHaveBeenCalledWith('/workspaces/thecore/commands');

		// Assert that the fs.writeFileSync method was called with the correct arguments
		expect(fs.writeFileSync).toHaveBeenCalledWith('/workspaces/thecore/commands/lib/member_actions/test_action.rb', expect.any(String));
		expect(fs.writeFileSync).toHaveBeenCalledWith('/workspaces/thecore/commands/app/views/rails_admin/main/test_action.html.erb', expect.any(String));

		// Assert that the vscode.window.showInputBox method was called
		expect(vscode.window.showInputBox).toHaveBeenCalled();

		// Assert that the vscode.window.showErrorMessage method was not called after checking the member Action name
		expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
	});
});