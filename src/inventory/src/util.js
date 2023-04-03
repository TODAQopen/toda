/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import fs from 'fs';
import yaml from 'yaml';

// Retrieves the config file
function getConfig() {
    const url = new URL('../../../config.yml', import.meta.url)
    const configFile = fs.readFileSync(url, "utf8");
    return yaml.parse(configFile).INVENTORY;
}

// Promisifies a function (useful for some fs workflows)
function pfn(fn) {
    return (...ARGS) => new Promise((res,rej) => fn(...ARGS,(e,d)=>e?rej(e):res(d)));
}

export { getConfig };
export { pfn };

