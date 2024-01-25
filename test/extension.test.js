const assert = require('assert');
const vscode = require('vscode');
const myExtension = require('../extension');

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension activation', () => {
		const context = {
			subscriptions: [],
			workspaceState: {
				get: () => {},
				update: () => {}
			},
			globalState: {
				get: () => {},
				update: () => {}
			},
			extensionPath: '',
			asAbsolutePath: () => {}
		};

		myExtension.activate(context);

		// Add your assertions here
	});

	test('Extension deactivation', () => {
		myExtension.deactivate();

		// Add your assertions here
	});
});
