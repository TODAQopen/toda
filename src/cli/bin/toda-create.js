#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getArgs, formatInputs, getFileOrInput, write, writeToFile } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { create } = require("./helpers/twist");
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

        let tb = await create(inputs.shield, inputs.req, inputs.tether, inputs.privateKey, inputs.cargo);

        if (!args.test) {
            writeToFile(tb, args.out);
        }

        write(tb);
    } catch (pe) {
        handleProcessException(pe);
    }
}();
