#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getArgs, getFileOrInput, formatInputs, writeToFile, getFileOrHash, write } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { append } = require("./helpers/twist");
const { verifyControl } = require("./helpers/control");
const { Atoms } = require("../../core/atoms");
const { Twist } = require("../../core/twist");

if (process.stdout.isTTY) {
    const DraftLog = require("draftlog").into(console);
}

/** Creates a .toda file with the specified details that is a successor to prev
 * toda append PREV
 * [--secp256r1 PUBLIC_KEY_PATH]
 * [--ed25519 PUBLIC_KEY_PATH]
 * [--shield HEX]
 * [--tether URL]
 * [--poptop URL]
 * {--prev PREV_PATH | PREV_SRC}
 * {--cargo CARGO_PATH | --empty | CARGO_SRC}
 */
void async function () {
    try {
        let args = getArgs();
        let inputs = await formatInputs(args);

        if (!args.empty && !inputs.cargo) {
            inputs.cargo = Atoms.fromBytes(await getFileOrInput());
        }

        let prev = new Twist(Atoms.fromBytes(getFileOrHash(args["_"][0])));
        let abject = await verifyControl(prev, inputs.privateKey, inputs.poptop);
        let tb = await append(abject, inputs.shield, inputs.req, inputs.tether, inputs.privateKey, () => {}, inputs.cargo);

        if (!args.test) {
            writeToFile(tb, args.out);
        }

        write(tb);
    } catch (pe) {
        handleProcessException(pe);
    }
}();
