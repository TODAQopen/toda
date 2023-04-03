#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { getArgs, getFileOrInput, formatInputs, writeToFile, write } from './util';

import { handleProcessException } from './helpers/process-exception';
import { authorize } from './helpers/capability';
import { verifyControl } from './helpers/control';
import { Atoms } from '../../core/atoms';
import { Abject } from '../../abject/abject';

/** Authorizes the specified capability
 * toda capability-authorize
 * [--capability CAPABILITY_TWIST]
 * [--url STRING]
 * [--verb STRING]
 * [--nonce STRING]
 * [--shield HEX]
 * [CAPABILITY_SRC]
 */
void async function () {
    try {
        let args = getArgs();
        let inputs = await formatInputs(args);

        if (!inputs.capability) {
            let bytes = await getFileOrInput();
            inputs.capability = Abject.parse(Atoms.fromBytes(bytes));
        }

        let abject = await verifyControl(inputs.capability, inputs.privateKey, inputs.poptop);
        let cap = await authorize(abject, inputs.url, inputs.verb, inputs.nonce, inputs.shield, inputs.tether, inputs.privateKey);

        if (!args.test) {
            writeToFile(cap, args.out);
        }

        write(cap);
    } catch (pe) {
        handleProcessException(pe);
    }
}();

