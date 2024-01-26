const exec = require('child_process').exec;

/**
 * Executes a shell command.
 * 
 * @param {string} command - The command to execute.
 * @param {string} workingDirectory - The working directory where the command will be executed.
 * @param {vscode.OutputChannel} outputChannel - The output channel where the stdout and stderr will be redirected.
 */
const execShell = (cmd, workingDirectory, outputChannel) =>
    new Promise((resolve, reject) => {
        // Write to outputchannel an hourglass element followed by the description of what's happening
        outputChannel.appendLine(`⌛ Running command ${cmd}`);

        const interval = setInterval(() => {
            outputChannel.append('.');
        }, 800);

        exec(cmd, { cwd: workingDirectory }, (err, out) => {
            clearInterval(interval);

            if (err) {
                outputChannel.appendLine(err.stdout.toString());
                return reject(err);
            }
            outputChannel.appendLine(out.toString());
            return resolve(out);
        });
    });

module.exports = {
    execShell
}