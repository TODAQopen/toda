/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { ByteArray } = require("./byte-array");
const { Hash } = require("./hash");
const { Packet } = require("./packet");
const { HashMap } = require("./map");

/**
 * Adds helpful utilities when using HashMap as HashMap<Hash,Packet>
 *
 */
class Atoms extends HashMap {
    /**
   * @param {Hash} hash
   * @param {Packet} packet
   * @returns {void}
   * @throws things
   */
    set(hash, packet) {
        // TODO: turn this assertion back on (make it fast and lazy)
        // hash.assertVerifiesPacket(packet); // throws
        return super.set(hash, packet);
    }

    forceSetLast(hash, packet) {
        if (this.has(hash)) {
            this.delete(hash);
        }

        return this.set(hash, packet);
    }

    copy() {
        let clone = new Atoms(this);
        clone.hashes = Object.assign({}, this.hashes);
        return clone;
    }


    /**
   * Retrieves the last atom in the hashmap.
   * (Generally the top-level item of interest)
   * @return [<Hash>,<Packet>]
   */
    lastAtom() {
        let ks = [...this.keys()]; //perf?
        let hash = ks[ks.length - 1];
        return [hash, this.get(hash)];
    }

    /**
   * @return {Packet}
   */
    lastPacket() {
        let [h, p] = this.lastAtom();
        return p;
    }

    /**
   * @return {Hash}
   */
    lastAtomHash() {
        let [h, p] = this.lastAtom();
        return h;
    }

    toBytes() {
        let a = Array.from(this)
        let len = a.reduce((acc, [h,p]) => acc+h.serializedValue.byteLength+p.serializedValue.byteLength, 0)
        let ret = new ByteArray(len)
        let off = 0
        a.forEach(([h, p]) => {
            ret.set(h.serializedValue, off)
            off += h.serializedValue.byteLength
            ret.set(p.serializedValue, off)
            off += p.serializedValue.byteLength
        })
        return ret
    }

    /**
   * @param {Buffer} bytes
   */
    static *entries(bytes) {
        while (bytes.length > 0) {
            let hash = Hash.parse(bytes);
            bytes = bytes.subarray(hash.serialize().length);
            let packet = Packet.parse(bytes);
            bytes = bytes.subarray(packet.serialize().length);
            yield [hash, packet];
        }
    }

    /**
   * @param {Buffer|ByteArray} bytes
   * @returns {Atoms}
   */
    static fromBytes(bytes) {
        let atoms = new Atoms();
        for (let [h, p] of Atoms.entries(Buffer.from(bytes))) {
            atoms.set(h, p);
        }
        return atoms;
    }

}

exports.Atoms = Atoms;
