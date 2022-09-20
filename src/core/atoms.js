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
        hash.assertVerifiesPacket(packet); // throws
        return super.set(hash, packet);
    }

    //todo(mje): HACK - this allows us to refresh the atoms in a twist/abject and maintain the original lastAtom
    forceSetLast(hash, packet) {
        if (this.has(hash)) {
            this.delete(hash);
        }

        return this.set(hash, packet);
    }

    copy() {
        return new Atoms(this);
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
        return Array.from(this).reduce((bytes, [h, p]) => bytes.concat(h.serialize().concat(p.serialize())), new ByteArray());
    }

    /**
   * @param {Buffer} bytes
   */
    static *entries(bytes) {
        while (bytes.length > 0) {
            let hash = Hash.parse(bytes);
            bytes = bytes.slice(hash.serialize().length);
            let packet = Packet.parse(bytes);
            bytes = bytes.slice(packet.serialize().length);
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
