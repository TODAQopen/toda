#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { ByteArray } = require("../../core/byte-array");
const { getArgs, getConfig, formatInputs, write, writeToFile } = require("./util");
const { capability } = require("./helpers/capability");
const { handleProcessException } = require("./helpers/process-exception");

/** Creates a Capability with the specified details.
 * toda capability
 * [--url STRING]
 * [--verbs STRING]
 * [--expiry EPOCH_TIMESTAMP_MS]
 * [--shield HEX]
 * [--poptop HASH]
 * [--tether URL or path to file]
 */
void async function () {
    try {
        let args = getArgs(process);
        let config = getConfig(args.config);
        let inputs = await formatInputs(args);

        let cap = await capability(inputs.url, inputs.verbs, inputs.expiry, inputs.shield, inputs.poptop, inputs.tether, config);

        if (!args.test) {
            writeToFile(config, cap, args.out);
        }

        write(process, cap);
    } catch (pe) {
        handleProcessException(process, pe);
    }
}();

