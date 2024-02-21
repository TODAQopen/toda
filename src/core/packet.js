/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { fourByteInt, bytesToHex, 
         byteConcat, bytesToInt } from './byteUtil.js';
import { Hash } from './hash.js';
import { HashMap } from './map.js';
import { NamedError } from './error.js';

/**
 * Describes a (data) packet.
 * Packets can't have anything except data.  So, there.
 */
class Packet {

    // 4GB (1024^3 * 4 bytes) limit
    static MAX_CONTENT_SIZE = 1024 * 1024 * 1024 * 4;
    static PACKET_SHAPE_OFFSET = 0;
    static PACKET_LENGTH_OFFSET = 1;
    static PACKET_LENGTH_LENGTH = 4;
    static PACKET_CONTENT_OFFSET = this.PACKET_LENGTH_OFFSET +
                                   this.PACKET_LENGTH_LENGTH;
    static registeredShapeByCode = {};

    /**
     * Raw constructor of packets. Users are recommended to use the
     * shape-specific constructors in subclasses.
     *
     * @param bytes <Uint8Array> the bytes to be used as content
     * @param offset <int> beginning of the content
     *  in bytes (not the whole packet)
     * @param length <int> length of the content
     */
    constructor(bytes, offset, length) {
        if (offset === undefined) {
            offset = 0;
        }
        if (length === undefined) {
            length = bytes.length - offset;
        }

        if (length > Packet.MAX_CONTENT_SIZE) {
            throw new ShapeException("SIZE_EXCEEDED",
                "Maximum content size exceeded.");
        }
        if (offset + length > bytes.length) {
            throw new Error("Byte are too short", bytes);
        }

        const newBytes = new Uint8Array(Packet.PACKET_CONTENT_OFFSET + length);
        const lenBytes = fourByteInt(length);
        newBytes.set(lenBytes, Packet.PACKET_LENGTH_OFFSET);
        newBytes.set(bytes.subarray(offset, offset + length), 
                     Packet.PACKET_CONTENT_OFFSET);
        this.bytes = newBytes;
        // note: subarray creates a 'view' of the array, not a new array
        this.content = newBytes.subarray(Packet.PACKET_CONTENT_OFFSET);
        this.offset = 0;
        this.length = length;
    }

    _setShape(shape) {
        this.bytes[0] = shape;
    }

    // lazy packet expansion
    get shapedVal() {
        Object.defineProperty(this, "shapedVal",
            { value: this.getShapedValueFromContent(),
              writable: false, configurable: true });
        return this.shapedVal;
    }

    /**
     *  The layout of a packet is:
     *  - 1 byte: <shape>
     *  - 4 bytes: <content length, unsigned int32>
     *  - n bytes: <content>
     *
     * @returns <Uint8Array> The serialized value of the packet
     */
    toBytes() {
        return this.bytes;
    }

    /**
     * @param packet <Packet> to compare to
     * @returns <Boolean>
     */
    equals(packet) {
        return this.toString() == packet.toString();
    }

    /**
     * @returns <String> the hex representation of this packet
     */
    toString() {
        if (!this.strValue) {
            this.strValue = bytesToHex(this.content, 
                                                    this.offset, 
                                                    this.length);
        }

        return this.strValue;
    }

    /**
     * @returns <Array.<Hash>> All hashes inside this packet
     */
    getContainedHashes() {
        throw new Error("abstract method not implemented in class Packet");
    }

    isTwist() {
        return this instanceof BasicTwistPacket;
    }

    getShapedValue() {
        return this.shapedVal;
    }

    getContent() {
        // dx: might need serialized version? this is only used in the CLI...
        return this.content;
    }

    /**
     * @returns <int> Total packet size in bytes (not just content)
     */
    getLength() {
        return this.length + Packet.PACKET_CONTENT_OFFSET;
    }


    /**
     * @param bytes  <Uint8Array> bytes for the whole packet (not just content)
     * @param packetStart <int> offset of the whole packet (not just content)
     * @returns <Packet>
     */
    static parse(bytes, packetStart=0) {
        let packetLength = bytesToInt(bytes, packetStart +
            Packet.PACKET_LENGTH_OFFSET, Packet.PACKET_LENGTH_LENGTH);

        if (bytes.length -
            Packet.PACKET_CONTENT_OFFSET -
            packetStart < packetLength) {
            throw new ShapeException(
                "Packet length does not match specified length.");
        }

        let shapeCode = bytes[packetStart + this.PACKET_SHAPE_OFFSET];
        return Packet.createFromShapeCode(shapeCode, bytes,
                                          packetStart, packetLength);
    }

    /**
     * @param shapeCode <int> a shape code as a decimal value (a JS number)
     * @param bytes <Uint8Array> bytes for the whole packet (not just content)
     * @param packetStart <int> beginning of the whole packet (not just content)
     * @param length <int> length of the content, not the whole packet
     * @returns <Boolean>
     */
    static createFromShapeCode(shapeCode, bytes, packetStart=0, length=0) {
        let imp = this.implementationForShapeCode(shapeCode);
        if (!imp) {
            throw new ShapeException("SHAPE_UNKNOWN",
                "Unknown shape: " + shapeCode);
        }

        let o = new Packet(bytes, packetStart
            + Packet.PACKET_CONTENT_OFFSET, length);

        // xxx(acg): tell me you don't love js
        o.__proto__ = imp.prototype;
        o._setShape(shapeCode);
        return o;
    }

    static getShapeCode() {
        return this.shapeCode;
    }

    static getMoniker() {
        return this.moniker;
    }

    static registerShape(subclass) {
        this.registeredShapeByCode[subclass.shapeCode] = subclass;
    }

    static implementationForShapeCode(shapeCode) {
        return this.registeredShapeByCode[shapeCode] || null;
    }
}

/**
 * A packet containing arbitrary (raw binary) data
 */
class ArbitraryPacket extends Packet {
    static shapeCode = 0x60;
    static moniker = "Arbitrary Packet";

    constructor(content, offset, length) {
        super(content, offset, length);
        this._setShape(ArbitraryPacket.shapeCode);
    }

    getShapedValueFromContent() {
        return this.content.subarray(this.offset, this.offset + this.length);
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
        // PERF: should instantiate the correct length of bytes in the first
        //       place to avoid calling "concat" each time
        super(hashes.map((hash) => hash.toBytes())
            .reduce((buffer, bytes) => byteConcat(buffer, bytes),
                new Uint8Array()));
        this._setShape(HashPacket.shapeCode);
    }

    getShapedValueFromContent() {
        let bytes = this.content;
        let i = this.offset;
        let bl = this.offset + this.length;
        let hashes = [];

        while (i < bl) {
            let hash = Hash.parse(bytes, i);
            i += hash.numBytes();
            hashes.push(hash);
        }
        return hashes;
    }

    /**
     * @returns <Array.<Hash>>
     */
    getContainedHashes() {
        return this.shapedVal; // efficiency issue?
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
     * @param pairs <Array.<Hash,Hash>> the list of
     *  hash pairs to create a packet from.
     */
    constructor(pairs) {
        super(pairs.flat());
    }

    getShapedValueFromContent() {
        let hs = super.getShapedValueFromContent();
        if (hs.length % 2 != 0) {
            throw new ShapeException(
                "HashPairPacket does not contain even number of hashes.");
        }

        return hs.reduce((pairs, hash, index) => {
            // xxx(acg): seriously js has no built-in array chunkifier?
            if (index % 2 == 0) {
                pairs.push([]);
            }
            pairs[pairs.length - 1].push(hash);
            return pairs;
        }, []);
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
        return this.shapedVal;
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
        this._setShape(PairTriePacket.shapeCode);
    }

    /**
     * @param hashMap <Map.<Hash:Hash>> k:v pairs of hashes.
     * @returns <PairTriePacket>
     */
    static createFromUnsorted(hashMap) {
        let keys = [...hashMap.keys()].sort();
        let m = new HashMap();
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

    getShapedValueFromContent() {
        let pairs = super.getShapedValueFromContent();
        let trie = new HashMap();

        for (let [k,v] of pairs) {
            if (trie.has(k)) {
                throw new ShapeException("SHAPE_DUPLICATE",
                    "Shape Error: duplicate key detected: " + k);
            }
            trie.set(k,v);
        }

        // dx: perf: sorting is expensive, could inline
        // this into the above for-loop
        if (!PairTriePacket.isSorted(trie)) {
            throw new ShapeException("SHAPE_ORDER", "Map not sorted");
        }
        return trie;
    }

    /**
     * @param keyHash <Hash> The hash to retrieve from the trie
     * @returns <Hash>
     */
    get(keyHash) {
        return this.shapedVal.get(keyHash.toString());
    }

    /**
     * @param keyHash <Hash>
     * @param valHash <Hash>
     * @returns <PairTriePacket> the packet with the added hash pair
     */
    set(keyHash, valHash) {
        //FML batman
        let shapedValue = new HashMap(this.getShapedValue());
        for (let key of shapedValue.keys()) {
            if (key.equals(keyHash)) {
                shapedValue.delete(key);
                break;
            }
        }
        // dx: perf: some room for improvement...
        return PairTriePacket.createFromUnsorted(
            shapedValue.set(keyHash, valHash));
    }

    /**
     * @returns <Array.<Hash>> All Key and Value hashes
     */
    getContainedHashes() {
        return this.shapedVal;
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
     * Returns a new trie where this trie's null
     *  value is set to the supplied param
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
     * @param sats <Hash> a hash of a trie describing
     *  how prev twist's reqs have been met
     */
    constructor(body, sats) {
        super([body, sats]);
        this._setShape(BasicTwistPacket.shapeCode);
    }

    getShapedValueFromContent() {
        let shapedValue = super.getShapedValueFromContent();
        if (shapedValue.length != 2) {
            throw new ShapeException("Basic twist contains "
            + shapedValue.length + " hashes, not 2.");
        }
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
     * @param reqs <Hash> a trie containing details of requirements
     *  needed to create a successor
     * @param cargo <Hash> a trie containing the payload of this twist
     * @param rigging <Hash> a trie whose purpose is TBA
     * @param shield <Hash> the shield value
     */
    constructor(prev, tether, reqs, cargo, rigging, shield) {
        super([prev, tether, shield, reqs, rigging, cargo]);
        this._setShape(BasicBodyPacket.shapeCode);
    }

    getShapedValueFromContent() {
        let shapedValue = super.getShapedValueFromContent();
        if (shapedValue.length != 6) {
            throw new ShapeException("Basic body contains "
            + shapedValue.length + " hashes, not 6.");
        }
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

class ShapeException extends NamedError {
    constructor(message, code) {
        super(message);
        this.code = code;
    }
}


export { Packet };
export { ArbitraryPacket };
export { HashPacket };
export { PairTriePacket };
export { BasicTwistPacket };
export { BasicBodyPacket };
export { ShapeException };
