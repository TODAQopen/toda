/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { ByteArray } from './byte-array.js';

import { Sha256, Symbol } from './hash.js';
import { MemorySyncPacketStore } from './store.js';
import { PairTriePacket, ArbitraryPacket, HashPacket } from './packet.js';

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
    static REQ_LIST = Symbol.fromStr("reqsatlist");
    static REQ_LIST_MONIKER = "requirements";

    constructor(hashImp) {
        super(hashImp, new PairTriePacket());
    }

    // dx: this isn't used anywhere, 
    //  so I don't know if this conversion is correct
    weightToBytes(weight) {
        return new ByteArray([weight]);
        // return new ByteArray(Buffer.from([weight]));
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
    static REQ_SECP256r1 = Symbol.fromStr("secp256r1");
    static REQ_SECP256r1_MONIKER = "SECP256r1";
    static REQ_ED25519 = Symbol.fromStr("ed25519");
    static REQ_ED25519_MONIKER = "ED25519";

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
        super(DefaultSignatureRequirement.DEFAULT_HASH_IMP, 
              DefaultSignatureRequirement.DEFAULT_SIG, publicKey);
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
        super(DefaultSignatureSatisfaction.DEFAULT_HASH_IMP, 
              DefaultSignatureRequirement.DEFAULT_SIG, signature);
    }
}


class SatisfactionList extends Satisfaction {

    /**
   * @param sats <Array.<Satisfaction>> list of 
   *  satisfactions in the same order as reqs were specd
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



const RequirementMonikers = {
    [RequirementList.REQ_LIST]: RequirementList.REQ_LIST_MONIKER,
    [SignatureRequirement.REQ_SECP256r1]: 
        SignatureRequirement.REQ_SECP256r1_MONIKER,
    [SignatureRequirement.REQ_ED25519]: 
        SignatureRequirement.REQ_ED25519_MONIKER,
    _: "Unknown"
};



class RequirementSatisfier {

    static satisfierImplementations = {};

    static registerSatisfier(reqTypeHash, imp) {
        this.satisfierImplementations[reqTypeHash] = imp;
    }

    static implementationForReqType(reqTypeHash) {
        return this.satisfierImplementations[reqTypeHash];
    }

    static verifySatisfaction(reqTypeHash, twist, reqPacket, satPacket) {
        let imp = this.implementationForReqType(reqTypeHash);
        if (!imp) {
            throw new ReqSatError("Unsupported requirement type:", 
                reqTypeHash.toString());
        }
        return imp.verifySatisfaction(reqTypeHash, twist, reqPacket, satPacket);
    }

    static isSatisfiable(requirementTypeHash, requirementPacket) {
        throw new ReqSatError('not implemented');
    }

    /** Returns a SignatureSatisfaction
     */
    async satisfy(prevTwist, newBodyHash) {
        throw new Error("Not implemented!");
    }
}

export { ReqSatError };
export { RequirementList };
export { SignatureRequirement };
export { SignatureSatisfaction };
export { DefaultSignatureSatisfaction };
export { RequirementMonikers };
export { RequirementSatisfier };