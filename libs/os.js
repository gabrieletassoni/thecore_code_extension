const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

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
            outputChannel.appendLine("\n Command finished, collecting output:");
            clearInterval(interval);

            if (err) {
                outputChannel.appendLine(` ❌ ${err}`);
                return reject(err);
            }
            outputChannel.appendLine(` ✅ ${out}`);
            return resolve(out);
        });
    });

/**
 * Creates a directory recursively.
 *  
 * @param {string} dir - The directory to create.
 * @param {vscode.OutputChannel} outputChannel - The output channel where the stdout and stderr will be redirected.
 * 
 * @returns {void}
 * 
 **/
const mkDirP = (dir, outputChannel) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true }, (err) => {
            if (err) {
                outputChannel.appendLine(` ❌ Error creating the ${dir} directory: ${err.message}`);
                throw err;
            }
        });
            
        // Directory created successfully, create an empty .keep file inside it if it's not already present
        const keepFile = path.join(dir, '.keep');
        if (!fs.existsSync(keepFile)) {
            fs.writeFileSync(keepFile, '');
        }
        outputChannel.appendLine(` ✅ ${dir} directory created successfully.`);
    }
}

module.exports = {
    execShell,
    mkDirP
}