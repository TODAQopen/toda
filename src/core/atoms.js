/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Hash } from './hash.js';
import { Packet } from './packet.js';

/**
 * Adds helpful utilities when using HashMap as HashMap<Hash,Packet>
 */
class Atoms {

    static _packets = {};

    hashes = {};
    _focus = null; // dx: think: hash or string? what about list?
    // maybe it's a list of hashes? then we don't need Atoms.hashes? ...

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
        // dx: perf: keep pairs as a cached structure
        //  internally once focus is removed
        let pairs = [];
        let fh = focus+"";

        for (var h in this.hashes) {
            if (h !== fh) {
                pairs.push([this.hashes[h], Atoms._getFromCache(h)]);
            }
        }

        if (this.hashes[fh]) {
            pairs.push([this.hashes[fh], Atoms._getFromCache(fh)]);
        }

        return pairs;
    }

    keys() {
        // dx: todo: delete this function?
        // it's only used three places, and two are tests
        return Object.values(this.hashes);
    }

    set focus(hash) {
        let h = hash.toString();
        this.hashes[h] = hash;
        this._focus = h;
    }

    get focus() {
        return this.hashes[this._focus];
    }

    /**
     * @param {Hash} hash
     * @param {Packet} packet
     * @returns {void}
     * @throws things
     **/
    set(hash, packet) {
        if (!packet) {
            throw new Error("Cannot set null packet");
        }

        let h = hash.toString();
        if (!h) {
            throw new Error("Cannot set an undefined hash");
        }

        Atoms._addToCache(hash, h, packet);

        this.hashes[h] = hash;
        return this;
    }

    static _addToCache(hash, hashHex, packet) {
        if (!Object.prototype.hasOwnProperty.call(Atoms._packets, hashHex)) {
            // dx: think: could throw if packet != p already...
            //  but then we'd have to do an expensive equality check every time
            hash.assertVerifiesPacket(packet); // throws
            Atoms._packets[hashHex] = packet;
        }
    }

    static _getFromCache(hashHex) {
        return Atoms._packets[hashHex];
    }

    get(hash) {
        if (!hash) {
            return undefined;
        }
        let h = hash.toString();
        if (this.hashes[h]) {
            return Atoms._getFromCache(h);
        }
        return null;
    }

    mergeNOFOCUS(atoms) {
        // dx: todo: this is very silly, remove this whole
        //  function once focus is removed
        this.hashes = {...this.hashes, ...atoms.hashes};
    }

    merge(atoms) {
        Object.assign(this.hashes, atoms.hashes);
        this._focus = atoms._focus;
    }

    toBytes(focus) {
        // dx: todo: remove the || once we lose focus
        focus = focus || this._focus;
        let a = this.toPairs(focus);

        let len = a.reduce((acc, [h,p]) =>
            acc + h.numBytes() + p.getLength(), 0);
        let ret = new Uint8Array(len);
        let off = 0;
        a.forEach(([h, p]) => {
            ret.set(h.toBytes(), off);
            off += h.toBytes().byteLength;
            ret.set(p.toBytes(), off);
            off += p.getLength();
        });
        return ret;
    }

    /**
     * @param {Buffer|Uint8Array} bytes
     * @returns {Atoms}
     **/
    static fromBytes(bytes) {
        bytes = new Uint8Array(bytes);
        let atoms = new Atoms();
        let lasthash;
        let i = 0, bl = bytes.length;

        while (i < bl) {
            let hash = Hash.parse(bytes, i);
            i += hash.numBytes();
            let h = hash.toString();
            let packet = Atoms._getFromCache(h);

            if (!packet) {
                packet = Packet.parse(bytes, i);
                Atoms._addToCache(hash, h, packet);
            } else {
                //todo(dx): make sure the bytes match... how is this not tested?
            }

            i += packet.getLength();
            atoms.hashes[h] = hash;
            lasthash = hash;
        }

        atoms.focus = lasthash;
        return atoms;
    }
}

export { Atoms };
