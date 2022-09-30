#!/usr/bin/env node
/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { getArgs, getFileOrInput, write, formatInputs, writeToFile } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { delegate } = require("./helpers/capability");
const { verifyControl } = require("./helpers/control");
const { Atoms } = require("../../core/atoms");
const { Abject } = require("../../abject/abject");

/** Creates a new delegate of the specified capability
 * toda capability-delegate
 * [--capability CAPABILITY_PATH]
 * [--url STRING]
 * [--verbs [STRING]]
 * [--expiry EPOCH_TIMESTAMP_MS]
 * [--shield HEX]
 * [--tether URL or path to file]
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
        let [delegator, del] = await delegate(abject, inputs.url, inputs.verbs, inputs.expiry, inputs.shield, inputs.tether, inputs.privateKey);

        if (!args.test) {
            writeToFile(del, args.out);

            //todo(mje): THINK - should this happen inside Delegate automatically?
            writeToFile(delegator);
        }

        write(del);
    } catch (pe) {
        handleProcessException(pe);
    }
}();
