#!/usr/bin/env node
/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { getArgs, getVersion, getFileOrInput, formatInputs, getAtomsFromPath} = require('./util');
const {DI, DIAssetClassClass, AssetClassField} = require('../../abject/di');
const {Abject} = require("../../abject/abject");
const {Atoms} = require("../../core/atoms");
const {SimpleRigged} = require('../../abject/actionable');
const {P1String, P1Float} = require('../../abject/primitive');
const {ArbitraryPacket} = require("../../core/packet");
const {ByteArray} = require("../../core/byte-array");
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const todaize = require("../../abject/todaize");

// Default outputs are binary streams
void async function () {

    let args = getArgs();

    if (args['version']) {
        return showVersion(args);
    }

    if (args['help']) {
        return showHelp();
    }

    let fileName = args['_'][0];

    let buf = await getFileOrInput(fileName);
    let ba = new ByteArray(buf);
    let opts = {};
    if (buf) {

        if (args['extract']) {
            let abj = Abject.parse(Atoms.fromBytes(ba));
            if (abj.getContext) {
                abj = abj.getContext();
            }
            if (!(abj instanceof DI)) {
                throw new Error("Parsed abject does not contain valid todaized DI class");
            }
            let packet = abj.getField(todaize.Todaized.fieldSyms.fFileContent);
            if (!packet) {
                throw new Error("No stored file content packet");
            }
            process.stdout.write(packet.getContent());
            return;
        }


        opts.fileName = path.basename(fileName);
        let stat = fs.statSync(fileName);
        opts.timeCreated = stat.ctime.toISOString();
        opts.timeModified = stat.mtime.toISOString();
    }
    if (args['descr']) {
        opts.description = args['descr'];
    }
    args = await formatInputs(args);
    let popTopHash = (await getAtomsFromPath(args.poptop)).lastAtomHash() // fragile

    let sr = todaize.todaize(ba, popTopHash, opts);

    // HACK(acg): we do NOT use the SR serializer here -- we avoid gettign a twist.
    process.stdout.write(Abject.prototype.serialize.bind(sr)().toBytes());
}()

function showHelp() {
  console.log(fs.readFileSync(path.join(__dirname, '../help-todaize.txt'), 'utf8'));
}

function showVersion(args) {
  console.log(`v${getVersion(args)}`);
}
