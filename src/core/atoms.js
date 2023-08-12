/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { ByteArray } from './byte-array.js';

import { Hash } from './hash.js';
import { Packet } from './packet.js';
import { HashMap } from './map.js';

/**
 * Adds helpful utilities when using HashMap as HashMap<Hash,Packet>
 *
 */
// class Atoms extends HashMap {
class Atoms {

    static packets = {};

    hashes = {};
    _focus = null; // dx: think: hash or string? what about list? maybe it's a list of hashes? then we don't need Atoms.hashes? ...


    static fromAtoms(...listOfAtoms) {
        let atoms = new Atoms();
        let args = listOfAtoms.map(a => a.hashes);
        args.unshift(atoms.hashes);
        Object.assign.apply({}, args);
        atoms._focus = listOfAtoms[listOfAtoms.length-1]._focus;
        return atoms;
    }

    static fromPairs(pairs) {
        let atoms = new Atoms();
        pairs.forEach(([h, p]) => atoms.set(h, p));
        atoms.focus = pairs[pairs.length-1][0];
        return atoms;
    }

    toPairs(focus) {
        let pairs = [];
        let fh = focus+"";

        for(var h in this.hashes) {
            if(h !== fh)
                pairs.push([this.hashes[h], Atoms.packets[h]]);
        }

        if(this.hashes[fh])
            pairs.push([this.hashes[fh], Atoms.packets[fh]]);

        return pairs;
    }

    keys() {
        // dx: todo: delete this function? it's only used three places, and two are tests
        return Object.values(this.hashes)
    }

    set focus(hash) {
        let h = hash.toString();
        this.hashes[h] = hash;
        this._focus = h;
    }

    get focus() {
        return this.hashes[this._focus];
    }

    static cache = {}

    /**
   * @param {Hash} hash
   * @param {Packet} packet
   * @returns {void}
   * @throws things
   */
    set(hash, packet) {
        if (!packet) {
            throw new Error("Cannot set null packet");
        }

        let h = hash.toString();
        if(!h) {
            throw new Error("Cannot set an undefined hash");
        }

        if(!Atoms.packets.hasOwnProperty(h)) {
            // dx: think: could throw if packet != p already... but then we'd have to do an expensive equality check every time
            hash.assertVerifiesPacket(packet); // throws
            Atoms.packets[h] = packet;
        }

        this.hashes[h] = hash;
        return this;
    }

    get(hash) {
        let h = hash+""; // optimization
        if(this.hashes[h])
            return Atoms.packets[h];
    }

    mergeNOFOCUS(atoms) {
        // dx: todo: this is very silly, remove this whole function once focus is removed
        this.hashes = {...this.hashes, ...atoms.hashes};
    }

    merge(atoms) {
        Object.assign(this.hashes, atoms.hashes);
        this._focus = atoms._focus;
    }


    toBytes(focus) {
        focus = focus || this._focus; // dx: todo: remove the || once we lose focus
        let a = this.toPairs(focus);

        let len = a.reduce((acc, [h,p]) => acc + h.serializedValue.byteLength + p.serializedValue.byteLength, 0)
        let ret = new ByteArray(len);
        let off = 0;
        a.forEach(([h, p]) => {
            ret.set(h.serializedValue, off);
            off += h.serializedValue.byteLength;
            ret.set(p.serializedValue, off);
            off += p.serializedValue.byteLength;
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
            // dx: TODO: can we make this faster? where is it used?
        }
    }

    /**
   * @param {Buffer|ByteArray} bytes
   * @returns {Atoms}
   */
    static fromBytes(bytes) {
        let atoms = new Atoms();
        let lasthash;
        for (let [h, p] of Atoms.entries(bytes)) {
            atoms.set(h, p);
            lasthash = h;
        }
        atoms.focus = lasthash;
        return atoms;
    }

}

export { Atoms };
