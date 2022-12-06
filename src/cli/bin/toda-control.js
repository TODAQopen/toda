#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getArgs, formatInputs, getClient } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { Abject } = require("../../abject/abject");
const { Line } = require("../../core/line");
const { Twist } = require("../../core/twist");
const { Hash } = require("../../core/hash");
const chalk = require("chalk");
const DraftLog = require("draftlog").into(console);

// Verifies integrity and control of the specified Twist
void async function () {
    try {
        let args = getArgs();
        let inputs = await formatInputs(args);

        let toda = await getClient();
        let twist = toda.get(Hash.fromHex(args["_"][0]));
        let abject = Abject.fromTwist(twist);

        let status = console.draft();

        status(chalk.white("Determining local control..."));
        if (!(await toda.isSatisfiable(twist))) {
            console.error("Unable to establish local control of this file (verifying controller)\n");
            throw new Error("Unable to establish local control"); // make more specific
            return;
        }

        status(chalk.white("Pulling latest proof information..."));

        if (abject && abject.popTop) {
            inputs.poptop = abject.getAbject(abject.popTop()).thisUrl();
        }
        // FIXME(acg): "inputs.poptop" means the URL of something that might be a line.
        let popTop = await (await toda.getRelayFromString(inputs.poptop)).get();
        await toda.pull(twist, popTop);

        // perhaps provide an option about saving this?
        toda.inv.put(twist.getAtoms());

        status(chalk.white("Determining canonicity..."));

        // TODO(acg): This *STILL* doesn't tell us "up to when" this is actually
        // canonical, right?

        await toda.isCanonical(twist, popTop);
        status(chalk.white("Control check complete."));

        // Output
        let output = formatOutput(twist, popTop) //;, timestamp);
        console.log(chalk.green(output));
    } catch (pe) {
        //throw pe;
        handleProcessException(pe);
    }
}();

function formatOutput(twist, popTop, timestamp) {

    let output = "";
        output += "The Local Line integrity has been verified. "
    + `This system has control of this file as of ${popTop.getHash().toString()}.`;

    return output;
}

