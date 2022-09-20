#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { getArgs, getFileOrInput, getConfig, formatInputs, writeToFile, parseAbjectOrTwist, write, getAtomsFromPath } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { append } = require("./helpers/twist");
const { control, refresh } = require("./helpers/control");
const { Atoms } = require("../../core/atoms");
const { Twist } = require("../../core/twist");
const { Line } = require("../../core/line");

if (process.stdout.isTTY) {
    const DraftLog = require("draftlog").into(console);
}

/** Creates a .toda file with the specified details that is a successor to prev
 * toda append
 * [--secp256r1 PUBLIC_KEY_PATH]
 * [--ed25519 PUBLIC_KEY_PATH]
 * [--shield HEX]
 * [--tether URL]
 * [--poptop URL]
 * {--prev PREV_PATH | PREV_SRC}
 * {--cargo CARGO_PATH}
 */
void async function () {
    try {
        let args = getArgs(process);
        let config = getConfig(args["config"]);
        let inputs = await formatInputs(args);

        if (!inputs.prev) {
            let atoms = Atoms.fromBytes(await getFileOrInput(process));
            inputs.prev = parseAbjectOrTwist(atoms);
        }

        let pt = new Twist(await getAtomsFromPath(inputs.poptop));
        let poptop = Line.fromAtoms(pt.getAtoms()).first(pt.getHash());
        let abject = await refresh(inputs.prev, poptop, config, false, null);
        await control(abject, poptop, inputs.privateKey);

        let tb = await append(abject, inputs.shield, inputs.req, inputs.tether, inputs.privateKey, () => {}, inputs.cargo, config);

        if (!args.test) {
            writeToFile(config, tb, args.out);
        }

        write(process, tb);
    } catch (pe) {
        handleProcessException(process, pe);
    }
}();
