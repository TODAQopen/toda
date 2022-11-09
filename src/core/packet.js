/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const {ByteArray} = require("./byte-array");
const {fourByteInt} = require("./util");
const {Hash} = require("./hash");

/**
 * Describes a (data) packet.
 * Packets can't have anything except data.  So, there.
 */
class Packet {

    // 4GB (1024^3 * 4 bytes) limit
    static MAX_CONTENT_SIZE = 1024 * 1024 * 1024 * 4;

    /**
     * Raw constructor of packets. Users are recommended to use the
     * shape-specific constructors in subclasses.
     *
     * @param content <ByteArray> the bytes to be used as content
     */
    constructor(content) {
        if (content.length > Packet.MAX_CONTENT_SIZE) {
            throw new ShapeException("SIZE_EXCEEDED", "Maximum content size exceeded.");
        }

        this.len = fourByteInt(content.length);
        this.content = content;
        this.shapedVal = content; //urg

        this.serializedValue = new ByteArray(content.length + 5);
        this.serializedValue[0] = this.constructor.shapeCode;
        this.serializedValue.set(this.len, 1);
        this.serializedValue.set(this.content, 5);
    }

    /**
     *  The layout of a packet is:
     *  - 1 byte: <shape>
     *  - 4 bytes: <content length, unsigned int32>
     *  - n bytes: <content>
     *
     * @returns <ByteArray> The serialized value of the packet
     */
    serialize() {
        return this.serializedValue;
    }

    static PACKET_SHAPE_OFFSET = 0;
    static PACKET_LENGTH_OFFSET = 1;
    static PACKET_LENGTH_LENGTH = 4;
    static PACKET_CONTENT_OFFSET = this.PACKET_LENGTH_OFFSET + this.PACKET_LENGTH_LENGTH;

    static parse(bytes) {
        let packetLength = ByteArray.from(bytes.slice(this.PACKET_LENGTH_OFFSET,
            this.PACKET_LENGTH_OFFSET + this.PACKET_LENGTH_LENGTH)).toInt();
        return Packet.createFromShapeCode(bytes[this.PACKET_SHAPE_OFFSET],
            ByteArray.from(bytes.slice(this.PACKET_CONTENT_OFFSET,
                this.PACKET_CONTENT_OFFSET + packetLength)));
    }

    static createFromShapeCode(shapeCode, content) {
        let imp = this.implementationForShapeCode(shapeCode);
        if (!imp) {
            throw new ShapeException("SHAPE_UNKNOWN", "Unknown shape: " + shapeCode);
        }

        let o = new Packet(content);

        // xxx(acg): tell me you don't love js
        o.__proto__ = imp.prototype;
        o.shapedVal = o.getShapedValueFromContent(); //haaaack :-)
        o.serializedValue[0] = shapeCode; // haaaack

        return o;
    }

    /**
     * @param packet <Packet> to compare to
     * @returns <Boolean>
     */
    equals(packet) {
        return this.toString() == packet.toString();
    }

    /**
     * @returns <String> the hex representation of this object
     */
    toString() {
        return this.serialize().toString();
    }

    static registeredShapeByCode = {};

    static registerShape(subclass) {
        this.registeredShapeByCode[subclass.shapeCode] = subclass;
    }

    static implementationForShapeCode(shapeCode) {
        return this.registeredShapeByCode[shapeCode] || null;
    }


    getShapedValue() {
        throw new Error("abstract method not implemented in class Packet");
    }

    /**
     * @returns <Array.<Hash>> All hashes inside this packet
     */
    getContainedHashes() {
        throw new Error("abstract method not implemented in class Packet");
    }

    // /**
    //  * Returns a map of Hashes and Packets which represent a given object.
    //  * Assumes the top-level is a trie.
    //  * @returns <Map.<Hash:Packet>>
    //  */
    // fromObject(obj) {
    //     // TODO(acg)
    // }

    isTwist(){
        return this instanceof BasicTwistPacket;
    }

    static getShapeCode() {
        return this.shapeCode;
    }

    static getMoniker() {
        return this.moniker;
    }

    getContent() {
        return this.content;
    }

    // Get the content size in bytes
    getSize() {
        return this.content.length;
    }
}

/**
 * A packet containing arbitrary (raw binary) data
 */
class ArbitraryPacket extends Packet {
    static shapeCode = 0x60;
    static moniker = "Arbitrary Packet";

    /**
     * @returns <ByteArray> the bytes contained in this packet
     */
    getShapedValue() {
        return this.shapedVal;
    }

    getShapedValueFromContent() {
        return this.content;
    }

    /**
     * @returns <Array.<Hash>>
     */
    getContainedHashes() {
        return [];
    }

    /**
     * @returns <Array.<Hash>>
     */
    getContainedValueHashes() {
        return [];
    }
}

/**
 * A packet containing a (list of) hash(es)
 */
class HashPacket extends Packet {
    static shapeCode = 0x61;
    static moniker = "Hash Packet";

    /**
     * @param hashes <Array.<Hash>> the list of hashes to create a packet from.
     */
    constructor(hashes) {
        super(hashes.map((hash) => hash.serialize())
            .reduce((buffer, bytes) => buffer.concat(bytes),
                new ByteArray()));
        this.shapedVal = hashes;
    }

    getShapedValueFromContent() {
        let buf = this.content;
        let hashes = [];
        while (buf.length > 0) {
            let hash = Hash.parse(buf);
            hashes.push(hash);
            buf = buf.slice(hash.numBytes());
        }
        return hashes;
    }

    /**
     * @returns <Array.<Hash>> an array of Hashes representing the content of this packet
     */
    getShapedValue() {
        return this.shapedVal;
    }

    /**
     * @returns <Array.<Hash>>
     */
    getContainedHashes() {
        return this.getShapedValueFromContent(); // efficiency issue?
    }

    getContainedValueHashes() {
        return this.getContainedHashes();
    }
}

/**
 * A packet containing a (list of) pair(s) of hashes
 */
class HashPairPacket extends HashPacket {
    /**
     * @param pairs <Array.<Hash,Hash>> the list of hash pairs to create a packet from.
     */
    constructor(pairs) {
        super(pairs.flat());

        // XXX(acg): store this for efficiency
        this.shapedVal = pairs;
    }


    getShapedValueFromContent() {
        let hs = super.getShapedValueFromContent();
        if (hs.length % 2 != 0)
            throw ShapeException("HashPairPacket does not contain even number of hashes.");
        return hs.reduce((pairs, hash, index) => {
            // xxx(acg): seriously js has no built-in array chunkifier?
            if (index % 2 == 0) pairs.push([]);
            pairs[pairs.length - 1].push(hash);
            return pairs;
        }, []);
    }
    /**
     * @returns Array.<[Hash,Hash]> array of pairs of Hashes
     */
    getShapedValue() {
        return this.shapedVal;
    }

    /**
     * @param keyHash <Hash>
     * @param valHash <Hash>
     * @returns <HashPairPacket> the packet with the added pair
     */
    set(keyHash, valHash) {
        let arr = this.getShapedValue();
        arr.push([keyHash, valHash]);
        return new this(arr);
    }

    /**
     * @returns <Array.<Hash>> Includes all Key and Value hashes
     */
    getContainedHashes() {
        return super.getShapedValueFromContent(); //efficiency?
    }
}

/**
 * A packet containing a trie of hashes.
 * Currently serialized as k:v pairs of the entire list.
 */
class PairTriePacket extends HashPairPacket {
    static shapeCode = 0x63;
    static moniker = "Pair Trie Packet";

    /**
     * @param hashMap <Map.<Hash:Hash>> k:v pairs of hashes.  MUST be sorted.
     */
    constructor(hashMap) {
        if (!PairTriePacket.isSorted(hashMap)) {
            throw new ShapeException("SHAPE_ORDER", "Map not sorted");
        }
        super([...hashMap]);

        //XXX(acg): also store this, for efficiency.
        this.shapedVal = hashMap;
    }

    /**
     * @param hashMap <Map.<Hash:Hash>> k:v pairs of hashes.
     * @returns <PairTriePacket>
     */
    static createFromUnsorted(hashMap) {
        let keys = [...hashMap.keys()].sort();
        let m = new Map();
        keys.forEach((k) => {
            m.set(k, hashMap.get(k));
        });
        return new this(m);
    }

    /**
      * @param hashMap <Map.<Hash,Hash>>
      * @returns <Boolean>
      */
    static isSorted(hashMap) {
        // sorting is lexicographic by hex value

        let keys = [...hashMap.keys()];
        let sortedKeys = [...keys].sort();
        for (let i=0;i<keys.length;i++) {
            if (keys[i] != sortedKeys[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * @returns <Map.<Hash:Hash>> k:v pairs of hashes
     */
    getShapedValue() {
        return this.shapedVal;
    }

    getShapedValueFromContent() {
        let pairs = super.getShapedValueFromContent();
        let trie = new Map();

        for (let [k,v] of pairs) {
            // FIXME(acg): this logic should perhaps be in the constructor
            if (trie.has(k)) {
                throw new ShapeException("SHAPE_DUPLICATE",
                    "Shape Error: duplicate key detected: " + k);
            }
            trie.set(k,v);
        }
        return trie;
    }

    /**
     * Returns the trie represented as a hashmap.
     * @returns <Object.<String,Packet>>
     */
    getHashMap() {
        //this mutates within a closure.  sry not sry. it's gettign late.
        let obj = Array.from(this.getShapedValue()).reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
        return obj;
    }

    /**
     * @param keyHash <Hash> The hash to retrieve from the trie
     * @returns <Hash>
     */
    get(keyHash) {
        // not terrifically efficient at this time
        // there's some sneaky string conversion here; don't worry bout it
        return this.getHashMap()[keyHash];
    }

    /**
     * @param keyHash <Hash>
     * @param valHash <Hash>
     * @returns <PairTriePacket> the packet with the added hash pair
     */
    set(keyHash, valHash) {
        //FML batman
        let shapedValue = new Map(this.getShapedValue());
        for (let key of shapedValue.keys()) {
            if (key.equals(keyHash)) {
                shapedValue.delete(key);
                break;
            }
        }
        return PairTriePacket.createFromUnsorted(shapedValue.set(keyHash, valHash));
    }

    /**
     * @returns <Array.<Hash>> All Key and Value hashes
     */
    getContainedHashes() {
        return super.getContainedHashes();
    }

    /**
     * @returns <Array.<Hash>> Includes only the Value hashes
     */
    getContainedValueHashes() {
        return Array.from(this.shapedVal.values());
    }

    /**
     * @returns <Array.<Hash>> Includes only the Key hashes
     */
    getContainedKeyHashes() {
        return Array.from(this.shapedVal.keys());
    }

    /**
     * Returns a new trie where this trie's null value is set to the supplied param
     * @param hash <Hash> the value to set at null
     * @returns <PairTriePacket>
     */
    setNull(hash) {
        return this.set(this.getHashImp().nullHash(), hash);
    }

    /**
     * Analagous to setNull but for a key of all 1s.
     * @param hash <Hash> the value ot set at the max hash in this trie.
     * @returns <PairTriePacket>
     */
    setMax(hash) {
        return this.set(this.getHashImp().maxHash(), hash);
    }
}

// rigging shapes

class BasicTwistPacket extends HashPacket {
    static shapeCode = 0x48;
    static moniker = "Basic Twist Packet";

    /**
     * @param body <Hash> a hash of a BasicBodyPacket
     * @param sats <Hash> a hash of a trie describing how prev twist's reqs have been met
     */
    constructor(body, sats) {
        super([body, sats]);
    }

    getShapedValueFromContent() {
        let shapedValue = super.getShapedValueFromContent();
        if(shapedValue.length != 2)
            throw ShapeException("Basic twist contains " + shapedValue.length + " hashes, not 2.");
        return shapedValue;
    }

    // helpful shortcuts
    getBodyHash() {
        return this.getShapedValue()[0];
    }

    getSatsHash() {
        return this.getShapedValue()[1];
    }

    /*
     * @returns <Class.<Hash>?>
     */
    getHashImp() {
        let firstKey = this.getShapedValue()[0];
        if (firstKey) {
            return firstKey.constructor;
        }
        return null;
    }
}

class BasicBodyPacket extends HashPacket {
    static shapeCode = 0x49;
    static moniker = "Basic Body Packet";

    /**
     * @param prev <Hash> the hash of the previous twist
     * @param tether <Hash> the twist this is tethered to ("location...")
     * @param reqs <Hash> a trie containing details of requirements needed to create a successor
     * @param cargo <Hash> a trie containing the payload of this twist
     * @param rigging <Hash> a trie whose purpose is TBA
     * @param shield <Hash> the shield value
     */
    constructor(prev, tether, reqs, cargo, rigging, shield) {
        super([prev, tether, shield, reqs, rigging, cargo]);
    }

    getShapedValueFromContent() {
        let shapedValue = super.getShapedValueFromContent();
        if(shapedValue.length != 6)
            throw ShapeException("Basic body contains " + shapedValue.length + " hashes, not 6.");
        return shapedValue;
    }

    // helpful shortcuts
    getPrevHash() {
        return this.getShapedValue()[0];
    }

    getTetherHash() {
        return this.getShapedValue()[1];
    }

    getReqsHash() {
        return this.getShapedValue()[3];
    }

    getCargoHash() {
        return this.getShapedValue()[5];
    }

    getRiggingHash() {
        return this.getShapedValue()[4];
    }

    getShieldHash() {
        return this.getShapedValue()[2];
    }

    /**
     * mostly a hack/heuristic for now
     * @returns <Class.<Hash>?>
     */
    getHashImp() {
        return this.getCargoHash().constructor;
    }

}

Packet.registerShape(ArbitraryPacket);
Packet.registerShape(HashPacket);
Packet.registerShape(PairTriePacket);
Packet.registerShape(BasicTwistPacket);
Packet.registerShape(BasicBodyPacket);

class ShapeException extends Error {
    constructor(message, code){
        super(message);
        this.code = code;
    }
}


exports.Packet = Packet;
exports.ArbitraryPacket = ArbitraryPacket;
exports.HashPacket = HashPacket;
exports.PairTriePacket = PairTriePacket;
exports.BasicTwistPacket = BasicTwistPacket;
exports.BasicBodyPacket = BasicBodyPacket;

exports.ShapeException = ShapeException;
