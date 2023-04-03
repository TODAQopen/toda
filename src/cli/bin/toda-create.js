#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { getArgs, formatInputs, getFileOrInput, getClient, write } from './util.js';
import { handleProcessException } from './helpers/process-exception.js';
import { Atoms } from '../../core/atoms.js';

/** Creates a .toda file with the specified details.
 * toda create
 * [--secp256r1 PUBLIC_KEY_PATH]
 * [--ed25519 PUBLIC_KEY_PATH]
 * [--shield HEX]
 * [--tether URL]
 * {--cargo CARGO_PATH | --empty | CARGO_SRC}
 */
void async function () {
    try {
        let args = getArgs();
        let inputs = await formatInputs(args);

        if (!args.empty && !inputs.cargo) {
            inputs.cargo = Atoms.fromBytes(await getFileOrInput());
        }

        let toda = await getClient();
        let x = await toda.create(inputs.tether, inputs.req, inputs.cargo);
        write(x);

    } catch (pe) {
        //throw pe;
        handleProcessException(pe);
    }
}();
