const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

/**
 * Shared implementation behind execShell/execShellAllowNonZero - both stream progress dots to
 * outputChannel and resolve/reject the same way, differing only in which (err, out) outcomes
 * count as a rejection. Kept private (not exported) so the two public functions below stay the
 * only entry points and their doc comments stay the authoritative description of each contract.
 *
 * @param {string} cmd - The command to execute.
 * @param {string} workingDirectory - The working directory where the command will be executed.
 * @param {vscode.OutputChannel} outputChannel - The output channel where the stdout and stderr will be redirected.
 * @param {(err: Error|null, out: string) => boolean} shouldReject - Given the exec callback's
 *   (err, out), returns whether this outcome should reject the promise.
 */
const runShell = (cmd, workingDirectory, outputChannel, shouldReject) =>
    new Promise((resolve, reject) => {
        // Write to outputchannel an hourglass element followed by the description of what's happening
        outputChannel.appendLine(`⌛ Running command ${cmd}`);

        const interval = setInterval(() => {
            outputChannel.append('.');
        }, 800);

        exec(cmd, { cwd: workingDirectory }, (err, out) => {
            outputChannel.appendLine("\n Command finished, collecting output:");
            clearInterval(interval);

            if (shouldReject(err, out)) {
                outputChannel.appendLine(` ❌ ${err}`);
                return reject(err);
            }
            outputChannel.appendLine(` ✅ ${out}`);
            return resolve(out);
        });
    });

/**
 * Executes a shell command.
 *
 * @param {string} command - The command to execute.
 * @param {string} workingDirectory - The working directory where the command will be executed.
 * @param {vscode.OutputChannel} outputChannel - The output channel where the stdout and stderr will be redirected.
 */
const execShell = (cmd, workingDirectory, outputChannel) =>
    runShell(cmd, workingDirectory, outputChannel, (err) => !!err);

/**
 * Executes a shell command whose exit code alone does not indicate failure -
 * `rails thecore:check_practices --json` (checkPractices.js) exits non-zero
 * whenever it finds violations, which is its normal, expected reporting
 * convention (mirroring linters like RuboCop/ESLint), not an error. Verified
 * directly (`node -e "require('child_process').exec(...)"`) that Node's own
 * exec callback error object does *not* carry stdout in this runtime, so
 * `execShell`'s reject-on-any-error behavior would silently discard the
 * `--json` payload on every run that actually found something to report -
 * the overwhelmingly common case for an audit command. This variant only
 * rejects when nothing was captured at all (a genuine failure to run the
 * command, e.g. `bundle install` itself failing before check_practices ever
 * starts); any other outcome - success or a "violations found" non-zero
 * exit - resolves with whatever stdout was produced, leaving it to the
 * caller to validate the payload's shape.
 *
 * Deliberately a separate function rather than a behavior change to
 * `execShell` itself: every other caller (addModel.js, addMigration.js,
 * addRootAction.js, addMemberAction.js, ...) relies on `execShell` rejecting
 * on a genuine `rails g` failure (e.g. a real Ruby syntax error, which also
 * exits non-zero and prints output) to show that failure as an error rather
 * than a false "success" - changing that behavior process-wide would be a
 * regression for all of them, not just a fix for this one caller.
 *
 * @param {string} command - The command to execute.
 * @param {string} workingDirectory - The working directory where the command will be executed.
 * @param {vscode.OutputChannel} outputChannel - The output channel where the stdout and stderr will be redirected.
 */
const execShellAllowNonZero = (cmd, workingDirectory, outputChannel) =>
    runShell(cmd, workingDirectory, outputChannel, (err, out) => !!err && !out);

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
    execShellAllowNonZero,
    mkDirP
}