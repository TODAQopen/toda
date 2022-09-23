#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getLead, submitHoist, getHoist } = require("./helpers/rigging");
const { getFileOrInput, getArgs, getConfig } = require("./util");
const { handleProcessException, ProcessException } = require("./helpers/process-exception");
const { logFormatted } = require("./helpers/formatters");
const { Atoms } = require("../../core/atoms");
const { Twist } = require("../../core/twist");

// Hoists the specified file up to the specified line
void async function () {
    try {
        let args = getArgs();
        let config = getConfig();
        let url = args["line-server"] || config.poptop;

        let bytes = await getFileOrInput(args["_"][0]);
        let meet = new Twist(Atoms.fromBytes(bytes));
        let lead = getLead(meet);

        if (args["verify"]) {
            let hh = await getHoist(lead, config.poptop);
            if (!hh) {
                throw new ProcessException(5, `No hitch hoist found for lead ${lead.getHash()}`);
            }

            return logFormatted(hh.getHash().toString());
        }

        return submitHoist(lead, meet.getHash(), url);
    } catch (pe) {
        handleProcessException(pe);
    }
}();
