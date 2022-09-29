#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getLead, getHoist } = require("./helpers/rigging");
const { getFileOrInput, getArgs, getConfig } = require("./util");
const { logFormatted } = require("./helpers/formatters");
const { handleProcessException } = require("./helpers/process-exception");
const { Atoms } = require("../../core/atoms");
const { Twist } = require("../../core/twist");

// Hoists the specified file up to the specified line
void async function () {
    try {
        let args = getArgs();
        let config = getConfig();

        let bytes = await getFileOrInput(args["_"][0]);
        let twist = new Twist(Atoms.fromBytes(bytes));
        let lead = await getLead(twist);
        let hh = await getHoist(lead, args["line-server"] || config.poptop);

        if (hh) {
            logFormatted(hh.getHash().toString());
        }
    } catch (pe) {
        handleProcessException(pe);
    }
}();

