/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const chalk = require("chalk");

class ProcessException {
    constructor(exitCode, reason) {
        this.exitCode = exitCode;
        this.reason = reason;
    }

    getExitCode() {
        return this.exitCode;
    }

    getReason() {
        return this.reason;
    }
}

function handleProcessException(process, pe) {
    if (pe.getExitCode) {
        process.exitCode = pe.getExitCode();
        process.stderr.write(chalk.red(`${pe.getReason()}\n`));
    } else {
        process.exitCode = 1;
        process.stderr.write(chalk.red(`${pe}\n`));
    }
}

exports.ProcessException = ProcessException;
exports.handleProcessException = handleProcessException;
