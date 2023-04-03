#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { getLead, getHoist } from './helpers/rigging';

import { getFileOrInput, getArgs, getConfig } from './util';
import { logFormatted } from './helpers/formatters';
import { handleProcessException } from './helpers/process-exception';
import { Atoms } from '../../core/atoms';
import { Twist } from '../../core/twist';

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

