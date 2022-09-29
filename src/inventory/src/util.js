/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const fs = require("fs");
const yaml = require("yaml");
const path = require("path");

// Retrieves the config file
function getConfig() {
    const configFile = fs.readFileSync(path.resolve(__dirname, "../../../config.yml"), "utf8");
    return yaml.parse(configFile).INVENTORY;
}

// Promisifies a function (useful for some fs workflows)
function pfn(fn) {
    return (...ARGS) => new Promise((res,rej) => fn(...ARGS,(e,d)=>e?rej(e):res(d)));
}

exports.getConfig = getConfig;
exports.pfn = pfn;

