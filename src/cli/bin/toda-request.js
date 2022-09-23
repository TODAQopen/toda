#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getArgs, formatInputs, writeToFile } = require("./util");
const { authorize } = require("./helpers/capability");
const { verifyControl } = require("./helpers/control");
const { handleProcessException } = require("./helpers/process-exception");
const axios = require("axios");

//todo(mje): Perhaps we want to generate some master Capability and use that by default?
/** Generates a request using the specified Capability
 * toda request
 * [--url STRING]
 * [--verb STRING]
 * [--nonce STRING]
 * [--data HEX]
 * [--capability CAPABILITY_PATH]
 */
void async function () {
    try {
        let args = getArgs();
        let inputs = await formatInputs(args);

        let abject = await verifyControl(inputs.capability, inputs.privateKey, inputs.poptop);
        let cap = await authorize(abject, inputs.url, inputs.verb, inputs.nonce, inputs.shield, inputs.tether, inputs.privateKey);

        if (!args.test) {
            writeToFile(cap, args.out);
        }

        let res = await axios({
            method: inputs.verb,
            url: inputs.url,
            data: inputs.data,
            responseType: "arraybuffer",
            headers: {
                "Content-Type": "application/octet-stream",
                "X-TODA-Capability": Buffer.from(cap.serialize().toBytes()).toString("base64")
            },
        });

        process.stdout.write(res.data);
    } catch (pe) {
        handleProcessException(pe);
    }
}();
