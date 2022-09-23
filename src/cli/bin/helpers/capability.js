/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { Capability } = require("../../../abject/capability");
const { append, setFastFields } = require("./twist");
const { getAtomsFromPath } = require("../util");

/**
 * Builds a Capability
 * @param url <String> The url to authorize for
 * @param verbs <Array[String]> The http verbs that are authorized
 * @param expiry <Date?> Expiry date
 * @param shield <ByteArray?> A set of bytes to act as the shield
 * @param poptop <String> Hash of a twist to be the poptop.
 * @param tether <String> Path to a line or the URL of a line server.
 * @returns <Capability> Which will need to be serialized() to be exported
 */
async function capability(url, verbs, expiry, shield, poptop, tether) {
    let master = new Capability();
    master.restrict(url, verbs, expiry);

    let top = await getAtomsFromPath(poptop);
    master.addAtoms(top);
    master.setPopTop(top.lastAtomHash());

    if (tether) {
        await setFastFields(tether, master.buildTwist(), shield);
    }

    //todo(mje): Support reqs/sats if we're not tethering?
    return master;
}

/**
 * Authorizes a Capability
 * @param cap <Capability> The capability to authorize
 * @param url <String> the url to authorize
 * @param verb <String> the verb to authorize
 * @param nonce <String> the nonce to set
 * @param shield <ByteArray?> A set of bytes to act as the shield. If not specified defaults to H(Salt|Prev)
 * @param tether <String> The path to the tethered line
 * @param pk <CryptoKey> The private key for satisfying requirements
 * @returns <TwistBuilder> Which will need to be serialized() to be exported
 */

async function authorize(cap, url, verb, nonce, shield, tether, pk) {
    let setterFn = (tb, abj) => { abj.authorize(url, verb, nonce); };
    return append(cap, shield, null, tether, pk, setterFn, null);
}

exports.capability = capability;
exports.authorize = authorize;
