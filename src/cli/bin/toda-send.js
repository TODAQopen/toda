#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { logFormatted } = require("./helpers/formatters");
const { handleProcessException } = require("./helpers/process-exception");
const { ProcessException } = require("./helpers/process-exception");
const { getArgs, getFileOrHashPath, getConfig } = require("./util");
const {exec} = require("child_process");

void async function () {
    try {
        let args = getArgs(process);
        let config = getConfig(args["config"]);
        let path =  getFileOrHashPath(args, args["_"][0]);
        if (path) {
            console.log(`open -a Mail ${path}`);
            exec(`open -a Mail ${path}`);
        } else {
            return new ProcessException(2, `The specified file or hash ${args["_"][0]} could not be found.`);
        }
    } catch (pe) {
        handleProcessException(process, pe);
    }
}();
