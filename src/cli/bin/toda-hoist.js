#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { getLead, submitHoist, getHoist } from './helpers/rigging';

import { getFileOrInput, getArgs, getConfig } from './util';
import { handleProcessException, ProcessException } from './helpers/process-exception';
import { logFormatted } from './helpers/formatters';
import { Atoms } from '../../core/atoms';
import { Twist } from '../../core/twist';

// Hoists the specified file up to the specified line
void async function () {
    try {
        let args = getArgs();
        let config = getConfig();
        let url = args["line-server"] || config.poptop;

        let bytes = await getFileOrInput(args["_"][0]);
        let meet = new Twist(Atoms.fromBytes(bytes));
        let lead = await getLead(meet);

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
