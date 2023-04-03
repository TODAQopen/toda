#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import {
    getArgs,
    getFileOrInput,
    formatInputs,
    write,
    getClient,
    getConfig,
    setConfig,
} from './util.js';

import { handleProcessException } from './helpers/process-exception.js';
import { Atoms } from '../../core/atoms.js';
import { Hash } from '../../core/hash.js';

import DraftLog from "draftlog";
if (process.stdout.isTTY) {
    DraftLog(console);
}

/** Creates a .toda file with the specified details that is a successor to prev
 * toda append PREV
 * [--secp256r1 PUBLIC_KEY_PATH]
 * [--ed25519 PUBLIC_KEY_PATH]
 * [--shield HEX]
 * [--tether URL]
 * [--poptop URL]
 * {--prev PREV_PATH | PREV_SRC}
 * {--cargo CARGO_PATH | --empty | CARGO_SRC}
 */
void async function () {
    try {
        let args = getArgs();
        let inputs = await formatInputs(args);

        if (!args.empty && !inputs.cargo) {
            inputs.cargo = Atoms.fromBytes(await getFileOrInput());
        }

        //let prev = Twist.fromBytes(getFileOrHash(args["_"][0]));
        let toda = await getClient();

        if (!toda.defaultRelayHash) {
            let t = await toda.create(null, inputs.req);
            toda.defaultRelayHash = t.getHash();
            let config = getConfig();
            config.relayHash = t.getHash().toString();
            setConfig(config);
        }

        //TODO: re-introduce fuzzy matching here?
        let prev = toda.get(Hash.fromHex(args["_"][0]));

        //TODO(acg): provide other levels of guarantees - e.g. canonicity.
        if (!(await toda.isSatisfiable(prev))) {
            console.error("not satisfiable.");
            return;
        }

        let x = await toda.append(prev, inputs.tether, inputs.req, inputs.cargo, () => {});

        write(x);

    } catch (pe) {
        handleProcessException(pe);
        //throw pe;
    }
}();
