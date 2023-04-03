#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { handleProcessException } from './helpers/process-exception';

import { ProcessException } from './helpers/process-exception';
import { getArgs, getFileOrHashPath } from './util';
import { exec } from 'child_process';

void async function () {
    try {
        let args = getArgs();
        let path =  getFileOrHashPath(args["_"][0]);
        if (path) {
            console.log(`open -a Mail ${path}`);
            exec(`open -a Mail ${path}`);
        } else {
            return new ProcessException(2, `The specified file or hash ${args["_"][0]} could not be found.`);
        }
    } catch (pe) {
        handleProcessException(pe);
    }
}();
