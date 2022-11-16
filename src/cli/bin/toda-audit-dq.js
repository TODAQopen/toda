#!/usr/bin/env node
/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { generateAuditReport } = require("../../reporting/audit");
const { getArgs, getFileOrHash } = require("./util");
const { Atoms } = require("../../core/atoms");
const { Abject } = require("../../abject/abject");
const { handleProcessException } = require("./helpers/process-exception");

//todo(mje): DO we need this for sure?
// const { DQ } = require("../../abject/quantity");

// ./toda audit-dq ../../reporting/examples/41419f04a356a76c8c8196dfa74cfd45d45c4b3b54a7514fca3cb3515a87f599ad.toda
void async function () {
    try {
        let args = getArgs();
        let dq = Abject.parse(Atoms.fromBytes(getFileOrHash(args["_"][0])));
        await generateAuditReport(dq, args.out);
    } catch (pe) {
        handleProcessException(pe);
    }
}();
