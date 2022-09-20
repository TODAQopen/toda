/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const sjcl = require("./sjcl");
const {ByteArray} = require("./byte-array");
// const {isNode} = require("./util");
// let blake3;

// if (isNode()) {
//   blake3 = require('blake3');
// }

class Hash {
    /**
     * Raw constructor of a hash object. Users are recommended to use the static
     * parsing method if reading off the wire, so you can take advantage of the subclasses.
     *
     * @param hashValue <ByteArray> representing the result of applying the hashing algorithm specified by algoCode.  Length depends on selected algorithm.
     *
     */
    constructor(hashValue) {
        // just guard against bad coding
        if (hashValue.length != this.constructor.getHashValueLength()){
            throw new Error("cannot set hash value of wrong length: ", hashValue);
        }
        this.hashValue = hashValue;

        this.serializedValue = new ByteArray(hashValue.length + 1);
        this.serializedValue[0] = this.constructor.algoCode;
        this.serializedValue.set(this.hashValue, 1);
    }

    static hash(data) {
        throw new Error("abstract method not implemented in base class Hash");
    }

    static ALGO_CODE_LENGTH = 1;
    static MONIKER;
    static DESCRIPTION;

    /**
     * The layout of a Hash is:
     * - 1 byte: <algoCode>
     * - n bytes: <hashValue>
     *
     * @returns <ByteArray> The serialized value of the Hash
     */
    serialize() {
        return this.serializedValue;
    }

    getHashValue() {
        return this.hashValue;
    }

    /**
     * @returns <String> the hex representation of this object
     */
    toString() {
        return this.serialize().toString();
    }

    /**
     * @returns <int> The number of bytes needed to hold the serialized version
     *  of this Hash
     */
    numBytes() {
        return this.serialize().length;
    }

    /**
     * @param <ByteArray> raw bytes which hopefully start with an algoCode
     */
    static parse(raw) {
        return this.createFromAlgoCode(raw[0], raw.slice(1));
    }

    static fromHex(str) {
        return Hash.parse(new ByteArray(Buffer.from(str, "hex")));
    }

    /**
     * @param algoCode <int> a value representing which hashing algorithm was used
     * @param hashValue <ByteArray> bytes representing the result of the hash function (OR MORE)
     * @returns <Hash> an instance of a subclass of Hash with the appropriate algo
     * warning: will truncate supplied hashValue if it's too long
     */
    static createFromAlgoCode(algoCode, hashValue) {
        let imp = this.implementationForAlgoCode(algoCode);
        if (!imp) {
            throw new Error("Unknown algorithm code: ", algoCode);
        }
        return new imp(ByteArray.from(hashValue.slice(0, imp.getHashValueLength())));
    }

    static registeredAlgoByCode = {};

    static registerType(subclass) {
        this.registeredAlgoByCode[subclass.algoCode] = subclass;
    }

    static implementationForAlgoCode(algoCode) {
        return this.registeredAlgoByCode[algoCode] || null;
    }


    /**
     * @returns <ByteArray> the bytes of the packet to hash for 'Hash.fromPacket'
     */
    static getHashablePacket(packet) {
        return packet.serialize();
    }

    /**
     * @param <ByteArray> data the data to hash with this alg and represent as a Hash
     * @returns <Hash> a newly created instance of a subclass of Hash
     */
    static fromBytes(data) {
        return new this(this.hash(data));
    }

    /**
     * @param <Packet> packet The packet to hash
     * @returns <Hash> a newly created instance of a subclass of Hash
     */
    static fromPacket(packet) {
        return this.fromBytes(this.getHashablePacket(packet));
    }

    /**
     * Returns true iff the supplied packet hashes to this Hash's hashCode when
     * this Hash's algo is used.
     */
    verifiesPacket(packet) {
        return ByteArray.isEqual(this.constructor.fromPacket(packet).hashValue,
            this.hashValue);

    }

    assertVerifiesPacket(packet) {
        if (!this.verifiesPacket(packet)) {
            throw new Error("hash mismatch error");
        }
    }

    static getHashValueLength() {
        throw new Error("abstract class has no fixed value length");
    }

    static getMoniker() {
        return this.MONIKER;
    }

    static getDescription() {
        return this.DESCRIPTION;
    }

    /**
     * @param hash <Hash> to compare to
     * @returns <Boolean>
     */
    equals(hash) {
        return this.toString() == hash.toString();
    }

    /**
     * Only returns true for the actual null algo implementation.
     */
    isNull() {
        return false;
    }

    /**
     * Only returns true for the actual Symbol algo implementation.
     */
    isSymbol() {
        return false;
    }
}

class NullHash extends Hash {
    static algoCode = 0x00;
    static MONIKER = "Null Hash";
    static DESCRIPTION = "Represents an empty hash";

    constructor() {
        return super(new ByteArray());
    }

    static hash(data) {
        throw new Error("cannot hash data with null algo");
    }

    static getHashValueLength() {
        return 0;
    }

    static parse(raw) {
        return new this();
    }

    isNull() {
        return true;
    }
}

/**
 * Classic standard sha256 hash implementation.
 */
class Sha256 extends Hash {
    static algoCode = 0x41;
    static MONIKER = "SHA256";
    static DESCRIPTION = "SHA256";

    /**
     * @param <ByteArray> data The data to be hashed
     * @returns <ByteArray> the raw hash value according to this algorithm
     */
    static hash(data) {
        var sha = new sjcl.hash.sha256();
        sha.update(sjcl.codec.bytes.toBits(data));
        return new ByteArray(sjcl.codec.arrayBuffer.fromBits(sha.finalize()));
    }

    // This implementation always yields hashValues that are precisely 32 bytes
    static FIXED_HASH_VALUE_LENGTH = 32;

    /**
     * @param <ByteArray> raw bytes hopefully starting with this algoCode
     * @returns <Sha256> parsed implementation of this class
     */
    static parse(raw) {
        let h = new Hash(raw.slice(this.ALGO_CODE_LENGTH,
            this.ALGO_CODE_LENGTH +
                                   this.FIXED_HASH_VALUE_LENGTH));

        // xxx(acg) slightly shady - maybe move to base class
        h.__proto__ = this.prototype;
        return h;
    }

    static getHashValueLength() {
        return this.FIXED_HASH_VALUE_LENGTH;
    }
}

class Symbol extends Hash {

    static algoCode = 0x22;
    static MONIKER = "Symbol";
    static DESCRIPTION = "A hash that doesn't point at a packet";

    static FIXED_HASH_VALUE_LENGTH = 32;

    static hash(data) {
        throw new Error("this implementation should not be used to hash data");
    }


    // TODO(acg): What is this used for; seems similar to base class?
    /**
   * @param <ByteArray> raw bytes hopefully starting with this algoCode
   * @returns <Sha256> parsed implementation of this class
   */
    static parse(raw) {
        let h = new Hash(raw.slice(this.ALGO_CODE_LENGTH,
            this.ALGO_CODE_LENGTH +
                                 this.FIXED_HASH_VALUE_LENGTH));

        // xxx(acg) slightly shady - maybe move to base class
        h.__proto__ = this.prototype;
        return h;
    }

    static getHashValueLength() {
        return this.FIXED_HASH_VALUE_LENGTH;
    }

    isSymbol() {
        return true;
    }

}

Hash.registerType(Sha256);
Hash.registerType(NullHash);
Hash.registerType(Symbol);


exports.Hash = Hash;
exports.Sha256 = Sha256;
exports.NullHash = NullHash;
exports.Symbol = Symbol;
