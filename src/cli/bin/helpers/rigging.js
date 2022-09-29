/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const axios = require("axios");
const { ProcessException } = require("./process-exception");
const { Line } = require("../../../core/line");
const { Interpreter } = require("../../../core/interpret");
const { Atoms } = require("../../../core/atoms");
const { Sha256 } = require("../../../core/hash");
const { Shield } = require("../../../core/shield");
const { ByteArray } = require("../../../core/byte-array");
const { Twist } = require("../../../core/twist");
const { isControlled } = require("../../../core/reqsat");
const { getAtomsFromPath, parseAbjectOrTwist, getLineURL, getConfig } = require("../util");
const fs = require("fs-extra");
const chalk = require("chalk");

/** Retrieves the line bytes from the line server
 * @param url <String> the line server url or a path to a local line
 * @returns Promise<ByteArray> The response body from the line server
 */
async function getLine(url) {
    if (fs.existsSync(url)) {
        return new ByteArray(fs.readFileSync(url));
    }

    return axios({
        method: "get",
        url: new URL("/line", url).toString(),
        responseType: "arraybuffer"
    }).then(res => new ByteArray(res.data));
}

/** Submits a hoisting request to the line server
 * @param atoms <Atoms> the atoms to post to the line server
 * @param url <String> the line server
 * @returns Promise<ByteArray> The response body from the line server
 */
async function hoist(atoms, url) {
    return axios({
        method: "POST",
        url: new URL("/hoist", url).toString(),
        contentType: "application/octet-stream",
        data: atoms.toBytes()
    });
}

/** POSTs a hoist request to the line server
 * @param lead <Twist>
 * @param meetHash <Hash>
 * @param url <String> URL to a line server or path to a line file
 * @returns {Promise<*>}
 */
async function submitHoist(lead, meetHash, url) {
    let rigging = Shield.rigForHoist(lead.getHash(), meetHash, lead.shield());
    let atoms = new Atoms([[Sha256.fromPacket(rigging), rigging]]);
    return hoist(atoms, url);
}

/** Retrieves the hoist hitch for the specified lead
 * @param lead <Twist> the lead whose hitch to verify
 * @param url <String> the line server url
 * @returns Promise<Twist|null> The hash of the hitch hoist if it exists, or null
 */
async function getHoist(lead, url) {
    //todo(mje): Replace with getTetheredAtoms()
    let lineBytes = await getLine(url);
    let leadLine = Line.fromAtoms(lead.getAtoms()).addBytes(lineBytes);
    let i = new Interpreter(leadLine);
    return i.hitchHoist(lead.getHash());
}

/** Retrieves the last fast twist for a given Twist. Throws an error if the provided twist isn't tethered
 * or doesn't have a last fast twist.
 * @param meet <Twist> A meet whose lead we need to find.
 * @returns <Twist|ProcessException> The lead twist or an error
 */
async function getLead(meet) {
    if (!meet.isTethered()) {
        return Promise.reject(new ProcessException(3, "The specified twist does not have a tether."));
    }

    let line = Line.fromAtoms(meet.getAtoms());
    let leadHash = line.lastFastBeforeHash(meet.getHash());
    if (!leadHash) {
        return Promise.reject(new ProcessException(4, "The specified twist does not have a last fast twist."));
    }

    return line.twist(leadHash);
}

/** Verifies whether this twist requires a rigging trie and attempts to satisfy it
 * @param tb <TwistBuilder> the twist builder to set the requirements on. Gets modified.
 * @param url <String> the line server
 * @returns <Promise|ProcessException> a promise that is resolved when the twist's rigging trie has been set, or throws
 * a ProcessException if that required hitch hoist cannot be found
 */
async function setRiggingTrie(tb, url) {
    let prev = new Twist(tb.serialize()).prev();
    if (!tb.isTethered() || !prev) {
        return;
    }

    let line = Line.fromAtoms(prev.getAtoms());
    let meetHash = prev.isTethered() ? prev.getHash() : line.lastFastBeforeHash(prev.getHash());
    if (meetHash) {
        let leadHash = line.lastFastBeforeHash(meetHash);
        if (leadHash) {
            let lead = line.twist(leadHash);
            return getHoist(lead, url).then(hh => {
                if (!hh) {
                    return Promise.reject(new ProcessException(5, `No hitch hoist found for lead ${lead.getHash()}`));
                }

                tb.addRigging(lead.getHash(), hh.getHash());
            });
        }
    }
}

/** Verifies whether this twist has a valid hitch line and is controllable with the specified key
 * @param abject <Abject|Twist> the twist to verify control over.
 * @param poptop <Hash> the poptop of the twist
 * @param pk <CryptoKey> the pk to verify control with
 * @returns <Promise|ProcessException> a promise that is resolved when the twist's rigging trie has been set, or throws
 * a ProcessException if that required hitch hoist cannot be found or the specified PK can not control the abject
 */
async function isValidAndControlled(abject, poptop, pk) {
    try {
        let atoms = abject instanceof Twist ? abject.getAtoms() : abject.serialize();
        let i = new Interpreter(Line.fromAtoms(atoms), poptop);
        await i.verifyHitchLine(abject.getHash());
    } catch(e) {
        return Promise.reject(new ProcessException(6, "Unable to establish local control of this file (verifying hitch line)"));
    }

    try {
        let twist = abject instanceof Twist ? abject : new Twist(abject.serialize(), abject.getHash());
        return await isControlled(twist, pk);
    } catch(e) {
        return Promise.reject(new ProcessException(7, "Unable to establish local control of this file (verifying controller)"));
    }
}

/** Adds the atoms from the tethered lines to this twist, up to the poptop
 * @param abject <Abject|Twist> the twist to refresh
 * @param poptop <Hash> the poptop of the twist
 * @returns <Promise<Atoms>> The atoms in all the tethered chains
 */
async function getTetheredAtoms(abject, poptop, noStatus) {
    let status = null;
    if (!noStatus) {
        status = console.draft && process.stdout.isTTY ? console.draft() : null;
    }

    let twist = abject instanceof Twist ? abject : new Twist(abject.serialize());

    if ((twist.isTethered() || abject.tetherUrl) && !twistLineContainsHash(twist, poptop)) {
        if (status) {
            status(chalk.green.dim(">") + chalk.white.dim(twist.getHash().toString().substr(56)) + ".".repeat(15) + chalk.blue("Locating"));
        }

        let tetherUrl = await getTetherUrl(abject);

        if (status) {
            status(chalk.green.dim(">") + chalk.white.dim(twist.getHash().toString().substr(56)) + ".".repeat(15) + chalk.blue("Downloading " + tetherUrl));
        }
        let atoms = await getTetheredAtoms(parseAbjectOrTwist(await getAtomsFromPath(tetherUrl)), poptop, noStatus);

        if (status) {
            status(chalk.green.dim(">") + chalk.white.dim(twist.getHash().toString().substr(56)) + ".".repeat(15) + chalk.blue("Material received") + chalk.dim.white(` [${tetherUrl}]`));
        //console.log();
        }
        let res = new Atoms([...twist.getAtoms(), ...atoms]);
        res.forceSetLast(twist.getHash(), twist.getPacket());
        return res;
    }

    if (status) {
        status(chalk.green.dim(">") + chalk.white.dim(twist.getHash().toString().substr(56)) + ".".repeat(15) + chalk.blue("Reached AIP"));
    }
    let tga = twist.getAtoms();
    return tga;
}

/**todo(mje): HACK - Until local line is a SimpleHistoric:
 * If abject is the local line it is tethered to config.poptop.
 * If abject is a SimpleHistoric, grab the tetherUrl
 * Otherwise assume tethered to the local line
 * @param abject <Abject|Twist> the abject or twist whose tether url to find
 * @returns <Boolean> true if the hash is in the twist's line
 */
async function getTetherUrl(abject) {
    let config = getConfig();
    let twist = abject instanceof Twist ? abject : new Twist(abject.serialize());
    let llTwist = parseAbjectOrTwist(await getAtomsFromPath(config.line));

    if (isSameLine(llTwist, twist)) {
        return getLineURL(config.poptop);
    } else if (abject.tetherUrl && abject.tetherUrl()) {
        return getLineURL(abject.tetherUrl());
    } else {
        return config.line;
    }
}

/** Verifies whether the twist's line contains the specified hash
 * @param twist <Twist> the twist whose line to search
 * @param hash <Hash> the hash to verify
 * @returns <Boolean> true if the hash is in the twist's line
 */
function twistLineContainsHash(twist, hash) {
    let line = Line.fromAtoms(twist.getAtoms());
    return line.twistList().find(h => h.equals(hash));
}

function isSameLine(twist, t) {
    let line = Line.fromAtoms(twist.getAtoms()).first(twist.getHash());
    let tl = Line.fromAtoms(t.getAtoms()).first(t.getHash());
    return line.equals(tl);
}

exports.getLine = getLine;
exports.hoist = hoist;
exports.getHoist = getHoist;
exports.getLead = getLead;
exports.submitHoist = submitHoist;
exports.setRiggingTrie = setRiggingTrie;
exports.isValidAndControlled = isValidAndControlled;
exports.getTetheredAtoms = getTetheredAtoms;
exports.getTetherUrl = getTetherUrl;
