/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { ProcessException } = require("./process-exception");
const { Line } = require("../../../core/line");
const { Atoms } = require("../../../core/atoms");
const { Hash } = require("../../../core/hash");
const { ByteArray } = require("../../../core/byte-array");
const { TwistBuilder, Twist } = require("../../../core/twist");
const { Shield } = require("../../../core/shield");
const { ArbitraryPacket } = require("../../../core/packet");
const { getLine, getHoist, submitHoist, getTetherUrl } = require("./rigging");
const { signBytes } = require("../../lib/pki");
const { satisfyRequirements } = require("../../../core/reqsat");
const { setRequirements } = require("./requirements");
const { getSuccessor, generateShield, getFileOrHashPath, getConfig } = require("../util");
const fs = require("fs-extra");

/**
 * Creates a TwistBuilder.
 * @param shield <ByteArray|null> the shield bytes
 * @param req <Object|null> an object containing a requirement type and a public key
 * @param tether <string|null> the url for a line server
 * @param pk <CryptoKey> A private key
 * @param cargo <Atoms|null> A set of Atoms [[key, packet]] to use as the cargo
 * @returns <TwistBuilder> a TwistBuilder object that can be used to generate the Twist
 */
async function create(shield, req, tether, pk, cargo) {
    let tb = new TwistBuilder();

    if (req) {
        await setRequirements(tb, pk, req);
    }

    if (cargo) {
        tb.setCargo(cargo);
    }

    if (tether) {
        await setFastFields(tether, tb, shield);
    }

    return tb;
}

/**
 * Creates a TwistBuilder as a successor to a given file. If it has its own REQs, verifies that the pk is sufficient
 * to satisfy at least one of those requirements, and satisfies it if so.
 * @param abject <Twist/Abject> A twist or an abject to append to
 * @param shield <ByteArray|null> The shield bytes
 * @param req <Object|null> an object containing a requirement type and a public key
 * @param tether <string|null> the url for a line server or path to a line
 * @param pk <CryptoKey> A private key
 * @param setterFn <Function> A function to mutate the successor before signing and hoisting it
 * @param cargo <Atoms|null> A set of Atoms to use as the cargo
 * @returns <TwistBuilder> a TwistBuilder object that can be used to generate the Twist
 */
async function append(abject, shield, req, tether, pk, setterFn = () => {}, cargo) {
    if (getSuccessor(abject)) {
        return Promise.reject(new ProcessException(6, `The twist ${abject.getHash()} already has a successor.`));
    }

    //THINK(mje): Kinda hacky that this supports both a Twist and an Abject
    let abj = abject.createSuccessor();
    let tb = abj instanceof TwistBuilder ? abj : abj.buildTwist();

    if (req) {
        await setRequirements(tb, pk, req);
    }

    if (cargo) {
        tb.setCargo(cargo);
    }

    // Post hitching logic
    if (tether) {
        await setFastFields(tether, tb, shield);
    }

    // Setter fn to perform any field modifications before signing and hoisting
    setterFn(tb, abj);

    // Any changes to the Abject must be merged into its underlying TwistBuilder, eg. for signing and shielding
    if (abj.buildTwist) {
        abj.buildTwist();
    }

    // Signing logic
    await satisfyRequirements(tb, pk, async (twist, pk) => {
        return signBytes(pk, twist.getPacket().getBodyHash().serialize());
    });

    // Hitch Hoist logic
    if (tether) {
        await hoist(abj, pk);
    }

    return abj instanceof TwistBuilder ? abj : abj.buildTwist();
}

/**
 * Sets the tether, generates the shield, and updates the rigging trie as necessary.
 * @param tether <Hash|String> The hash of the tether, path to a twist file or URL to a line server
 * @param tb <TwistBuilder> The abject on which to update the rigging trie
 * @param shield <ByteArray?> A set of bytes to act as the shield
 */
async function setFastFields(tether, tb, shield) {
    // Set the tether. It might be a hash, a path or a URL.

    try {
        let tetherHash = Hash.parse(new ByteArray(Buffer.from(tether, "hex")));
        tb.setTetherHash(tetherHash);
    } catch(e) {
        let bytes = await getLine(tether);
        tb.setTether(new Twist(Atoms.fromBytes(bytes)));
    }

    // If there is no shield and this is an external tether then generate a default shield
    if (!shield && !getFileOrHashPath(tether)) {
        let salt = new ByteArray(fs.readFileSync(getConfig().salt));
        shield = generateShield(salt, tb.getPrevHash());
    }

    if (shield) {
        tb.setShield(new ArbitraryPacket(shield));
    }

    // Set the rigging
    let line = Line.fromAtoms(tb.serialize());
    let lastFastTwist = line.twist(line.lastFastBeforeHash(line.lastFastBeforeHash(tb.getHash())));
    if (lastFastTwist) {
        let tetherUrl = await getTetherUrl(tb);
        let hh = await getHoist(lastFastTwist, tetherUrl);

        if (hh) {
            tb.addRigging(lastFastTwist.getHash(), hh.getHash());
        }
    }
}

/**
 * Hitches to the specified local tether line. This is basically a line server fn. Modifies the Line.
 * path, pk should be things the line server knows about and doesn't need passed in as args.
 * @param lead <Twist> A twist or an abject to append to
 * @param meetHash <Hash> an object representing requirements
 * @param path <Twist> path to the local file to hitch to
 * @param pk <CryptoKey> A private key for signing
 * @returns <TwistBuilder> a TwistBuilder object that can be used to generate the Twist
 */
//todo(mje): We'll want to verify poptop when doing this so we don't continue to hoist forever
// eg. rigging.twistLineContainsHash()
async function hoistLocal(lead, meetHash, path, pk) {
    let tether = new Twist(Atoms.fromBytes(new ByteArray(fs.readFileSync(path))));
    let rigging = Shield.rigForHoist(lead.getHash(), meetHash, lead.shield());

    let setterFn = (tb) => {
        for (let [k, v] of Array.from(rigging.getShapedValue())) {
            tb.addRigging(k, v);
        }
    };

    let tetherUrl = tether.isTethered() ? await getTetherUrl(tether) : null;
    let tb = await append(tether, null, null, tetherUrl, pk, setterFn, null);

    //todo(mje): Keep the name of the line file the same until we have tether-url implemented.
    fs.outputFileSync(path, tb.serialize().toBytes());
}

/**
 * Submits a hitch hoist if required
 * @param abject <String> The path to a twist file or URL to a line server
 * @param pk <CryptoKey> The key to use for signing
 */
async function hoist(abject, pk) {
    let line = Line.fromAtoms(abject.serialize());
    let lastFastTwist = line.twist(line.lastFastBeforeHash(abject.getHash()));
    if (lastFastTwist) {
        let tetherUrl = await getTetherUrl(abject);
        return fs.existsSync(tetherUrl)
            ? hoistLocal(lastFastTwist, abject.getHash(), tetherUrl, pk)
            : submitHoist(lastFastTwist, abject.getHash(), tetherUrl);
    }
}

exports.create = create;
exports.append = append;
exports.setFastFields = setFastFields;
