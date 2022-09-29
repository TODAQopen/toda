#!/usr/bin/env node
/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { Line, PersistentLine } = require("../../core/line");
const { getArgs, getConfig, formatInputs, getFileOrInput, getDistinct, getFileOrHashPath, parseAbjectOrTwist, getAtomsFromPath, getLineURL } = require("./util");
const { refresh, control } = require("./helpers/control");
const { Atoms } = require("../../core/atoms");
const { Twist } = require("../../core/twist");
const fs = require("fs-extra");
const chalk = require("chalk");
const DraftLog = require("draftlog").into(console);

// Lists the twists contained in the specified directory or toda file, including tethers.
// toda list [directory_path|file_path]
void async function () {
    try {
        let args = getArgs();
        let path = args["_"][0] || getConfig().store;

        if (!fs.existsSync(path)) {
            let betterPath = getFileOrHashPath(path);
            if (betterPath) {
                path = betterPath;
            }
        }

        let line;
        try {
            let lstat = fs.lstatSync(path);
            if (lstat.isDirectory()) {
                line = new PersistentLine(path);
            }
        } catch (e) {}
        if (!line) {
            let bytes = await getFileOrInput(path);
            line = Line.fromBytes(bytes);
        }

        let res;
        if (args["detailed"]) {
            //res = args['latest'] ? line.latestDetailedTwistList() : line.detailedTwistList();
            res = line.latestDetailedTwistList();
        } else {
            //res = args['latest'] ? line.latestTwistList() : line.twistList();
            res = line.latestTwistList();
        }

        let twistHashes = getDistinct(res);
        twistHashes.sort();
        //logFormatted(toPagedString(twistHashes, args['all']));
        for (let hash of twistHashes) {
            showTwist(hash).catch(console.log);
        }

    } catch (pe) {
        console.log("PE:", pe);
        throw pe;
    //handleProcessException(pe);
    }
}();

// not needed yet; just done in closure
//const twists = {};

async function showTwist(twistHash) {
    let args = getArgs();
    let config = getConfig();

    args.poptop = args.poptop ?? config.line;
    let inputs = await formatInputs(args);


    let twist = {hash: twistHash,
        numTwists: null,
        statusControl: null, //chalk.dim.white("Waiting..."),
        statusDownload: null, //chalk.dim.white("Determining tether..."),
        statusPoptop: null,
        statusParse: chalk.dim.white("Loading..."),
        statusError: null,
        status: console.draft(),
    };
    renderTwist(twist);


    try {
        // obviously, duplicates a bunch from toda-control
        let atoms = Atoms.fromBytes(await getFileOrInput(twist.hash));
        twist.statusParse = chalk.dim.white("Parsing...");
        renderTwist(twist);
        let abject = parseAbjectOrTwist(atoms);
        twist.statusParse = chalk.green(`[${abject.constructor.name}]`);
        renderTwist(twist);
        let poptop = null;
        let defaultTop = false;
        if (abject.popTop) {
            poptop = getLineURL(abject.getAbject(abject.popTop()).thisUrl());
        } else {
            defaultTop = true;
            poptop = config.line;
        }
        renderTwist(twist);
        twist.statusDownload = chalk.dim.white(`Downloading ${poptop}`);
        poptop = new Twist(await getAtomsFromPath(poptop)).getHash();
        twist.statusDownload = chalk.dim.white(`AIP ${poptop.toString().substr(0,8)} ${defaultTop ? "[default]" : ""}`);
        let refreshedAbject = await refresh(abject, poptop, config, args.refresh, true);
        twist.statusControl = chalk.dim.white("Determining control...");
        renderTwist(twist);
        await control(refreshedAbject, poptop, inputs.privateKey);
        twist.statusControl = chalk.green("✓ Local control");
        renderTwist(twist);
    } catch(e) {
        if (e.reason) {
            twist.statusError = chalk.red(e.reason);
            // TODO(acg): Let's do better. Distinguish between screwed up proof,
            // and another tether in control.
            twist.statusControl = chalk.dim.blue("Not controlled");
        } else {
            // hack
            if (e.constructor.name == "MissingHashPacketError") {
                twist.statusError = chalk.red("Incomplete data");
                twist.statusControl = chalk.dim.yellow("? Incomplete");
            } else {
                twist.statusError = chalk.red(`Unknown error: ${e}`);
                if (twist.statusDownload) {
                    twist.statusControl = chalk.red("Error");
                } else {
                    twist.statusDownload = chalk.red("Parse/Download Error");
                    twist.statusControl = chalk.red("------");
                }
            }
        }
        renderTwist(twist);
    }
}

function renderTwist(twist) {
    let out = chalk.dim.white(twist.hash.toString().substr(0,8));
    if (twist.statusParse) {
        out += "\t" + twist.statusParse;
    }
    if (twist.statusDownload) {
        out += "\t" + twist.statusDownload;
    }
    if (twist.statusControl) {
        out += "\t" + twist.statusControl;
    }
    if (twist.statusError) {
        out += "\t" + twist.statusError;
    }
    twist.status(out);
}
