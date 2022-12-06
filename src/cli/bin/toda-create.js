#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getArgs, formatInputs, getFileOrInput, getClient, write } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { Atoms } = require("../../core/atoms");

const DraftLog = require("draftlog");

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
