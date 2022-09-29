#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getArgs, formatInputs, getFileOrInput, parseAbjectOrTwist, getDistinct, getAtomsFromPath, getLineURL } = require("./util");
const { control, refresh } = require("./helpers/control");
const { handleProcessException } = require("./helpers/process-exception");
const { Abject } = require("../../abject/abject");
const { Atoms } = require("../../core/atoms");
const { Line } = require("../../core/line");
const { Twist } = require("../../core/twist");
const chalk = require("chalk");
const DraftLog = require("draftlog").into(console);

// Verifies integrity and control of the specified Twist
void async function () {
    try {
        let args = getArgs();
        let inputs = await formatInputs(args);

        let atoms = Atoms.fromBytes(await getFileOrInput(args["_"][0]));
        let abject = parseAbjectOrTwist(atoms);

        let status = console.draft();
        status(chalk.white("Pulling latest proof information..."));

        if (abject.popTop) {
            inputs.poptop = getLineURL(abject.getAbject(abject.popTop()).thisUrl());
        }

        let pt = new Twist(await getAtomsFromPath(inputs.poptop));
        let poptop = Line.fromAtoms(pt.getAtoms()).first(pt.getHash());
        let refreshedAbject = await refresh(abject, poptop, args.refresh);
        status(chalk.white("Determining local control..."));

        await control(refreshedAbject, poptop, inputs.privateKey);
        status(chalk.white("Control check complete."));

        //HACK(mje): Support for local line as a poptop
        let timestamp;
        try {
            let poptopAbj = Abject.parse(await getAtomsFromPath(inputs.poptop));
            timestamp = poptopAbj.getAbject(poptop).timestamp();
        } catch(e) {
            timestamp = "";
        }

        // Output
        let output = formatOutput(refreshedAbject, poptop, timestamp);
        console.log(chalk.green(output));
    } catch (pe) {
        handleProcessException(pe);
    }
}();

// Get the twist history, log out all of the tethers that are not null, then show some nice green text
function formatOutput(abject, hash, timestamp) {
    let line = Line.fromAtoms(abject.getAtoms());
    let tethers = line.history(abject.getHash())
        .map(hash => line.twist(hash).tether())
        .filter(tether => !!tether)
        .map(tether => tether.getHash().toString());

    let output = getDistinct(tethers).reduce((acc, tether) => {
        acc += `${tether}\n`;
        return acc;
    }, "");

    output += "The Local Line integrity has been verified. "
    + `This system has control of this file as of ${hash} [${timestamp}].`;

    return output;
}

