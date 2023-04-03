/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Abject } from '../../../abject/abject.js';

import { Capability } from '../../../abject/capability.js';
import { getAtomsFromPath } from '../util.js';

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
    let setterFn = (abj) => { abj.authorize(url, verb, nonce); };
    return append(cap, shield, null, tether, pk, setterFn, null);
}

/**
 * Creates a Capability Delegate
 * @param capability <Capability> The capability to authorize
 * @param url <String> The url to authorize for
 * @param verbs <Array[String]> The http verbs that are authorized
 * @param expiry <Date> Expiry date
 * @param shield <ByteArray> A set of bytes to act as the shield.
 * @param tether <String> The path to the tethered line
 * @param pk <CryptoKey> The private key for satisfying requirements
 * @param config <Object> A config object containing the local line and default line server paths
 * @returns <[Capability, Capability]> The updated Delegator and the Delegate
 */
async function delegate(capability, url, verbs, expiry, shield, tether, pk, config) {
    let del = capability.createDelegate();
    del.restrict(url, verbs, expiry);

    if (tether) {
        await setFastFields(tether, del.twistBuilder, config, shield);
    }

    // Append to delegator for CONFIRM
    let capNextTb = await append(capability, null, null, tether, pk, (abj) => {
        abj.confirmDelegate(del);
    }, null, config);
    let capabilityNext = Abject.parse(capNextTb.serialize());

    // Append to delegate for COMPLETE
    let delTb = await append(del, shield, null, tether, pk, (abj) => {
        abj.completeDelegate(capabilityNext);
    }, null, config);
    let delegate = Abject.parse(delTb.serialize());

    return [capabilityNext, delegate];
}

export { capability };
export { authorize };
export { delegate };
