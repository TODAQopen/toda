/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { ProcessException } = require("./process-exception");
const { Line } = require("../../../core/line");
const { Twist } = require("../../../core/twist");
const { isValidAndControlled, getTetheredAtoms } = require("./rigging");
const { isControlled } = require("../../../core/reqsat");
const { parseAbjectOrTwist, filePathForHash, getAtomsFromPath, getLineURL } = require("../util");
const chalk = require("chalk");
const fs = require("fs-extra");
const DraftLog = require("draftlog").into(console);

/**
 * Validates control over the abject and returns the refreshed list of atoms
 * @param abject <Abject|Twist> The abject to validate control over
 * @param poptop <Hash> The poptop hash
 * @param pk <CryptoKey> The key to use for signing
 * @returns <Promise|ProcessException> A promise that resolves if the abject is verified and controlled by this PK
 */
async function control(abject, poptop, pk) {
    try {
        let line = Line.fromAtoms(abject.getAtoms());
        let lastFastHash = line.lastFastBeforeHash(abject.getHash());
        let twist = abject instanceof Twist ? abject : new Twist(abject.serialize(), abject.getHash());

        if (lastFastHash) {
            if (!await isValidAndControlled(twist, poptop, pk)) {
                throw new ProcessException(7, "Unable to establish local control of this file (verifying controller)");
            }
            await isValidAndControlled(twist, poptop, pk);

        } else {
            //HACK(mje): Special case for validating a twist line with no last fast twist
            return await isControlled(twist, pk);
        }
    } catch (e) {
        throw new ProcessException(8, "Unable to establish local control of this file (verifying controller)");
    }
}

/**
 * Given a path retrieves the latest atoms from the tethered up to the specified poptop and
 * @param abject <Abject|Twist> The abject to refresh
 * @param poptop <Hash> The poptop hash
 * @param save <Boolean> If true will persist the updates to the file
 * @param status <console.draft()?> A drafting object for the console
 * @returns <Promise<Atoms>> A promise resolving with the refreshed lsit of atoms
 */
async function refresh(abject, poptop, save, noStatus) {
    let status = null;
    if (!noStatus) {
        status = process.stdout.isTTY ? (console.draft ? console.draft() : null) : null;
    }
    if (status) {
        status(chalk.white("Acquiring abjects..."));
    }
    let refreshedAtoms = await getTetheredAtoms(abject, poptop, noStatus);

    if (status) {
        status(chalk.white("Parsing acquired abjects..."));
    }

    let refreshedAbject = parseAbjectOrTwist(refreshedAtoms);

    if (save) {
        let outputFile = filePathForHash(refreshedAbject.getHash());
        fs.outputFileSync(outputFile, refreshedAtoms.toBytes());

        if (status) {
            status(chalk.white(`Updated local file at ${outputFile}`));
        }
    }

    if (status) {
        status(chalk.white("Abject refreshed!"));
    }
    return refreshedAbject;
}

/**
 * Refreshes and verifies control of the abject and returns the refreshed abject
 * @param abj <Abject> The abject to refresh and verify
 * @param pk <CryptoKey> The private key to verify control of
 * @param defaultPoptop <String> A URL/path to a twist to use as the default poptop
 * @returns <Promise<Abject>> The abject refreshed with the relevant tether line atoms
 */
async function verifyControl(abj, pk, defaultPoptop) {
    //todo(mje): HACK - the capability's poptop could be a non-Abject, which would fail parsing.
    // So assume it's the provided/default poptop
    let ptUrl;
    try {
        let ptAbj = abj.getAbject(abj.popTop());
        ptUrl = getLineURL(ptAbj.thisUrl());
    } catch(e) {
        ptUrl = defaultPoptop;
    }

    let pt = new Twist(await getAtomsFromPath(ptUrl));
    let poptop = Line.fromAtoms(pt.getAtoms()).first(pt.getHash());

    let abject = await refresh(abj, poptop, true, null);
    await control(abject, poptop, pk);

    return abject;
}

exports.control = control;
exports.refresh = refresh;
exports.verifyControl = verifyControl;
