#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { default: axios } = require("axios");
const { Atoms } = require("../../core/atoms");
const { handleProcessException } = require("./helpers/process-exception");
const { getArgs, getFileOrInput, getConfig, formatInputs, parseAbjectOrTwist, getAtomsFromPath, getLineURL } = require("./util");
const { refresh } = require("./helpers/control");
const { Twist } = require("../../core/twist");
const { Line } = require("../../core/line");
const chalk = require("chalk");
const DraftLog = require("draftlog").into(console);

void async function () {

    try {
        let args = getArgs(process);
        let config = getConfig(args["config"]);
        let inputs = await formatInputs(args);
        let hex, inventoryServer;
        if (args["_"].length > 0) {
            let fileSource = args["_"][0];
            [hex, inventoryServer] = fileSource.split("@");
        }
        inventoryServer = inventoryServer || inputs.inventoryServer;

        let atoms = Atoms.fromBytes(await getFileOrInput(process, args["_"][0]));
        let abject = parseAbjectOrTwist(atoms);

        let status = console.draft();
        status(chalk.white("Pulling latest proof information..."));

        if (abject.popTop) {
            inputs.poptop = getLineURL(abject.getAbject(abject.popTop()).thisUrl());
        }

        let pt = new Twist(await getAtomsFromPath(inputs.poptop));
        let poptop = Line.fromAtoms(pt.getAtoms()).first(pt.getHash());
        let refreshedAbject = await refresh(abject, poptop, config, true, status);
        let refreshedAtoms = refreshedAbject.getAtoms ? refreshedAbject.getAtoms() : refreshedAbject.serialize();
        let bytes = refreshedAtoms.toBytes();

        status(chalk.white("Posting to the inventory server..."));

        let response = await axios({
            method: "POST",
            url: `${inventoryServer}/files`,
            headers: { "Content-Type": "application/octet-stream" },
            // TODO(sfertman): add capability header once inventory server supports it
            responseType: "arraybuffer",
            data: Buffer.from(bytes)
        });

        console.log(chalk.green("✔ Successfully stored abject ") + chalk.white(abject.getHash().toString().substr(56)) + chalk.green(" on ") + chalk.dim.white(inventoryServer));
    } catch (pe) {
        handleProcessException(process, pe);
    }

}();

