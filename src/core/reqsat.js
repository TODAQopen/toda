/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { ByteArray } = require("./byte-array");
const { Symbol, Sha256 } = require("./hash");
const { MemorySyncPacketStore } = require("./store");
const { PairTriePacket, ArbitraryPacket, HashPacket } = require("./packet");
const { Twist } = require("./twist");
const todaCrypto = require("./crypto");

class Requirement extends MemorySyncPacketStore {
    static DEFAULT_HASH_IMP = Sha256;

    /**
   * @param reqsTrie <PairTriePacket> a trie packet representing requirement(s)
   */
    constructor(hashImp, reqsTrie) {
        super();
        this.reqsTrie = reqsTrie;
        this.hashImp = hashImp;
        this.put(hashImp.fromPacket(reqsTrie), reqsTrie);
    }

    static getReqClass(reqsTrie) {
    //let key[...reqsTrie.getShapedValue().keys()][0]
    }
}

class RequirementList extends Requirement {
    static REQ_LIST = new Symbol(Sha256.hash(ByteArray.fromStr("reqsatlist")));
    static REQ_LIST_MONIKER = "requirements";

    static REQ_LIST_DEPRECATED = Sha256.fromBytes(ByteArray.fromStr("reqsatlist"));

    constructor(hashImp) {
        super(hashImp, new PairTriePacket());
    }

    weightToBytes(weight) {
        return new ByteArray(Buffer.from([weight]));
    }

    bytesToWeight(bytes) {
        return bytes[0];
    }

    /**
   * @param weight <int>
   * @param requirement <Requirement> a requirement
   */
    addReq(weight, requirement) {
        requirement.copyInto(this);
        let weightPacket = new ArbitraryPacket(this.weightToBytes(weight));
        let reqEntry = new HashPacket([this.hashImp.fromPacket(weightPacket),
            this.hashImp.fromPacket(requirement.reqsTrie)]);
        let reqEntryHash = this.hashImp.fromPacket(reqEntry);
        this.put(this.hashImp.fromPacket(weightPacket), weightPacket);
        this.put(reqEntryHash, reqEntry);

        let entries = this.getListEntries().push(reqEntryHash);
        let entriesPacket = new HashPacket(entries);
        let entriesPacketHash = this.hashImp.fromPacket(entriesPacket);
        this.put(entriesPacketHash, entriesPacket);
        this.reqsTrie = new PairTriePacket(new Map([[RequirementList.REQ_LIST,
            entriesPacketHash]]));
    }

    /**
   * @returns <Array.<Hash>> hashes of individual weight/req list entries
   */
    getListEntries() {
        let entriesPacket = this.reqsTrie.get(RequirementList.REQ_LIST);
        if (entriesPacket) {
            return entriesPacket.getShapedValue();
        }
        return [];
    }

}

class SignatureRequirement extends Requirement {
    static REQ_SECP256r1 = new Symbol(Sha256.hash(ByteArray.fromStr("secp256r1")));
    static REQ_SECP256r1_MONIKER = "SECP256r1";
    static REQ_ED25519 = new Symbol(Sha256.hash(ByteArray.fromStr("ed25519")));
    static REQ_ED25519_MONIKER = "ED25519";

    static REQ_SECP256r1_DEPRECATED = Sha256.fromBytes(ByteArray.fromStr("secp256r1"));
    static REQ_ED25519_DEPRECATED = Sha256.fromBytes(ByteArray.fromStr("ed25519"));


    /**
   * @param hashImp <Class> the hash imp to use
   * @param publicKey <ByteArray> the public key to require
   */
    constructor(hashImp, keyType, publicKey) {
        let keyPacket = new ArbitraryPacket(publicKey);
        let keyPacketHash = hashImp.fromPacket(keyPacket);
        let reqsKVs = new Map([[keyType, keyPacketHash]]);
        let reqsTrie = new PairTriePacket(reqsKVs);
        super(hashImp, reqsTrie);
        this.put(keyPacketHash, keyPacket);
    }
}

class DefaultSignatureRequirement extends Requirement {
    static DEFAULT_SIG = SignatureRequirement.REQ_SECP256r1;

    /**
   * @param publicKey <ByteArray> the public key to require
   */
    constructor(publicKey) {
        super(DefaultSignatureRequirement.DEFAULT_HASH_IMP, DefaultSignatureRequirement.DEFAULT_SIG, publicKey);
    }
}

class Satisfaction extends MemorySyncPacketStore {
    static DEFAULT_HASH_IMP = Sha256;

    /**
   * @param satsTrie <PairTriePacket> a trie packet representing sats
   */
    constructor(hashImp, satsTrie) {
        super();
        this.satsTrie = satsTrie;
        this.hashImp = hashImp;
        this.put(hashImp.fromPacket(satsTrie), satsTrie);
    }
}

class SignatureSatisfaction extends Satisfaction {
    /**
   * @param hashImp <Class> the hash imp to use
   * @param signature <ByteArray> the signature bytes
   */
    constructor(hashImp, keyType, signature) {
        let sigPacket = new ArbitraryPacket(signature);
        let sigPacketHash = hashImp.fromPacket(sigPacket);
        let satsTrie = new PairTriePacket(new Map([[keyType, sigPacketHash]]));
        super(hashImp, satsTrie);
        this.put(sigPacketHash, sigPacket);
    }
}

class DefaultSignatureSatisfaction extends SignatureSatisfaction {
    /**
   * @param hashImp <Class> the hash imp to use
   * @param signature <ByteArray> the signature bytes
   */
    constructor(signature) {
        super(DefaultSignatureSatisfaction.DEFAULT_HASH_IMP, DefaultSignatureRequirement.DEFAULT_SIG, signature);
    }
}


class SatisfactionList extends Satisfaction {

    /**
   * @param sats <Array.<Satisfaction>> list of satisfactions in the same order as reqs were specd
   */
    constructor(hashImp, sats) {
        let satsListPacket = new HashPacket(sats);
        let satsListPacketHash = hashImp.fromPacket(satsListPacket);

        super(hashImp, new PairTriePacket(new Map([[RequirementList.REQ_LIST,
            satsListPacketHash]])));
        this.put(satsListPacketHash, satsListPacket);
        sats.copyInto(this);
    }
}

/**
 * Verifies that signature satisfies one of the listed requirements
 * @param twist <Twist> a twist whose requirements should be satisfied
 * @param privateKey <CryptoKey> The identity we wish to use to satisfy the requirements
 * @returns <Hash> The Hash of the signature algorithm key that can be satisfied
 */
//todo(mje): Add support for reqslist
async function getSatisfiableReq(twist, privateKey) {
    let reqsTrie = twist.reqs();
    for (let [sigAlgHash, packetHash] of Array.from(reqsTrie.getShapedValue().entries())) {
        let packet = twist.get(packetHash);
        let publicKey = await crypto.subtle.importKey(
            "spki",
            packet.getShapedValue(),
            {name: "ECDSA", namedCurve: "P-256",},
            true,
            ["sign", "verify"]);
        let verified = await keysPaired(privateKey, publicKey);
        if (verified) {
            return sigAlgHash;
        }
    }
}

/** Satisfies any requirements that can be satisfied on the specified file with the supplied private key and signingFN
 * @param tb <TwistBuilder> The twist builder that needs satisfactions
 * @param pk <CryptoKey> The private key to determine which reqs can be satisfied
 * @param signFn <Function> A function to sign the twist
 * @returns <Promise>
 */
async function satisfyRequirements(tb, pk, signFn) {
    let twist = new Twist(tb.serialize());
    let prev = twist.prev();
    if (prev && prev.reqs()) {
        let satisfiableReqType = await getSatisfiableReq(prev, pk);
        if (!satisfiableReqType) {
            return Promise.reject("The specified identity does not satisfy any of the PREV's requirements.");
        }

        //todo(mje): Add support for reqslist
        let signature = await signFn(twist, pk);
        let sats = new SignatureSatisfaction(tb.getHashImp(), satisfiableReqType, signature);
        tb.setSatisfactions(sats);
    }
}

/** Verifies whether they privatekey and publickey are paired
 * @param privateKey <CryptoKey>
 * @param publicKey <CryptoKey>
 * @returns <Promise|Boolean> true if the keys are paired
 */
async function keysPaired(privateKey, publicKey) {
    let data = new ByteArray(Buffer.from("arbitrary data"));
    let signedString = await crypto.subtle.sign({name: "ECDSA",  hash: { name: "SHA-256" }},
        privateKey,
        data);

    return crypto.subtle.verify({name: "ECDSA", hash: { name: "SHA-256" }},
        publicKey,
        signedString,
        data);
}

class ReqSatError extends Error {
    constructor(reqHash, reqPacket, satPacket, message) {
        super();
        this.reqHash = reqHash;
        this.reqPacket = reqPacket;
        this.satPacket = satPacket;
        this.message = message;
    }
}
class UnsupportedRequirementError extends ReqSatError {}

function satisfies(reqHash, bodyHash, reqPacket, satPacket) {
    // just implement secp256r1 for now
    if (!reqHash.equals(SignatureRequirement.REQ_SECP256r1)) {
        throw new UnsupportedRequirementError(reqHash, reqPacket, satPacket, SignatureRequirement.REQ_SECP256r1.toString());
    }
    return todaCrypto.Secp256r1.verify(reqPacket.getShapedValue(),
        satPacket.getShapedValue(),
        bodyHash.serialize());
}

const RequirementMonikers = {
    [RequirementList.REQ_LIST]: RequirementList.REQ_LIST_MONIKER,
    [RequirementList.REQ_LIST_DEPRECATED]: RequirementList.REQ_LIST_MONIKER,
    [SignatureRequirement.REQ_SECP256r1]: SignatureRequirement.REQ_SECP256r1_MONIKER,
    [SignatureRequirement.REQ_SECP256r1_DEPRECATED]: SignatureRequirement.REQ_SECP256r1_MONIKER,
    [SignatureRequirement.REQ_ED25519]: SignatureRequirement.REQ_ED25519_MONIKER,
    [SignatureRequirement.REQ_ED25519_DEPRECATED]: SignatureRequirement.REQ_ED25519_MONIKER,
    _: "Unknown"
};

/** Determines if a twist has any requirements satisfied by the PK.
 * @param twist <Twist> the twist to verify control over.
 * @param pk <CryptoKey> the pk to verify control with
 * @returns <Promise<SignatureRequirement|null> a promise that is resolved if this twist has a requirement
 * we can satisfy, or has no requirements at all. Rejects if it cannot satisfy the requirement.
 */
async function satisfiesRequirement(twist, pk) {
    if (twist.reqs()) {
        let satisfiableReqType = await getSatisfiableReq(twist, pk);
        if (!satisfiableReqType) {
            return Promise.reject("The specified identity does not satisfy any of the PREV's requirements.");
        }

        return satisfiableReqType;
    }
}

/** Verifies whether this twist or its tethers are controllable with the specified key
 * @param twist <Twist> the twist to verify control over.
 * @param pk <CryptoKey> the pk to verify control with
 * @returns <Promise<Boolean>> a promise that is resolved if the twist's requirements can be met.
 */
async function isControlled(twist, pk) {
    let satisfiedRequirement = await satisfiesRequirement(twist, pk);
    if (!satisfiedRequirement && twist.tether()) {
        return isControlled(twist.tether(), pk);
    }

    return true;
}

exports.satisfyRequirements = satisfyRequirements;
exports.keysPaired = keysPaired;
exports.satisfies = satisfies;
exports.getSatisfiableReq = getSatisfiableReq;

exports.ReqSatError = ReqSatError;
exports.RequirementList = RequirementList;
exports.SignatureRequirement = SignatureRequirement;
exports.SignatureSatisfaction = SignatureSatisfaction;
exports.DefaultSignatureSatisfaction = DefaultSignatureSatisfaction;

exports.RequirementMonikers = RequirementMonikers;
exports.isControlled = isControlled;
exports.satisfiesRequirement = satisfiesRequirement;

