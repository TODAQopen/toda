/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { ProcessException } = require("./process-exception");
const { keysPaired, SignatureRequirement } = require("../../../core/reqsat");
const { ByteArray } = require("../../../core/byte-array");

/** Sets the requirements specified in the command args on a file. Modifies the file.
 * @param tb <TwistBuilder> the twist builder to set the requirements on. Gets modified.
 * @param privateKey <CryptoKey> the identity to verify can be used to satisfy the requirement
 * @param reqs <Object> An object containing the public key and requirement type
 */
async function setRequirements(tb, privateKey, reqs) {
    let verified = await keysPaired(privateKey, reqs.key);
    if (!verified) {
        throw new ProcessException(1, "WARN: The specified identity does not satisfy the specified requirements.");
    }

    let pubKeyBuffer = await crypto.subtle.exportKey("spki", reqs.key);
    //todo(mje): Pass a SignatureRequirement around, not an object
    let requirement = new SignatureRequirement(tb.getHashImp(), reqs.type, new ByteArray(Buffer.from(pubKeyBuffer)));
    tb.setRequirements(requirement);
}

exports.setRequirements = setRequirements;
