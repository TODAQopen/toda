#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getFileOrInput, getArgs, getAcceptedInputs } = require("./util");
const { handleProcessException } = require("./helpers/process-exception");
const { logFormatted, stringifyValues, formatTabDelimited } = require("./helpers/formatters");
const { getHistory } = require("./helpers/history");
const { Atoms } = require("../../core/atoms");
const { Twist } = require("../../core/twist");
const { Line } = require("../../core/line");

const acceptedFields = {
    twist: "00"
};

// Reads the specified .toda file and prints out some information about it
void async function () {
    try {
        let args = getArgs(acceptedFields);
        let inputs = getAcceptedInputs(args, acceptedFields);
        let bytes = await getFileOrInput(args["_"][0]);
        let atoms = Atoms.fromBytes(bytes);
        let twistHash = inputs.twist.isNull() ? atoms.lastAtomHash() : inputs.twist;

        if (args["line"]) {
            twistHash = Line.fromBytes(bytes).last(twistHash);
        }

        let twist = new Twist(atoms, twistHash);
        let history = getHistory(twist);
        logFormatted(formatHistory(history, args["json"]), args["json"]);
    } catch (pe) {
        handleProcessException(pe);
    }
}();

// Accepts an Array of history detail objects [{require: <Hash>, rigging: <Hash>}]
// Returns either the JSON or a tab-delimited string of the details to log
function formatHistory(history, isJson) {
    let json = history.map(d => stringifyValues(Object.entries(d)));
    if (isJson) {
        return json;
    }

    return json.map(sd => formatTabDelimited(sd)).join("\n");
}
