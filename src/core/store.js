/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { BasicTwistPacket, BasicBodyPacket } from '../core/packet.js';

import { Atoms } from './atoms.js';
import { HashMap } from './map.js';
import { HashNotFoundError } from './error.js';
import { byteConcat } from './byteUtil.js';

class PacketStore {

    async get(hash) {
    }

    put(hash, packet) {
    }

    /**
     * @returns <Array.<Hash>> the hashes of
     *  packets which reference the supplied hash
     */
    getParentHashes(hash) {
        throw new Error("not implemented");
    }

    // TODO: add getSuccessor as a standard interface function

    getPairs() {
        throw new Error("not implemented");
    }
}

class InMemoryPacketStore extends PacketStore {

    constructor() {
        super();
         // we also want to preserve the Hash obj so we don't have to parse
        this.pairs = new Map();
        this.masterMap = {};
        this.masterReverseIndex = {};
        this.successorMap = {};
    }

    getPairs() {
        return this.pairs;
    }

    async get(hash) {
        // XXX(acg): shortcut if we have this actual object
        return this.pairs.get(hash) ||
               this.masterMap[hash] ||
               Promise.reject(new HashNotFoundError(hash));
    }

    async successor(hash) {
        let h = this._getSuccessorHash(hash);
        if (h) {
            return this.get(h).then(p => {
                return [h, p];
            }).catch(() => {
                return [h, null];
            });
        }
        return null;
    }

    async search(hash) {
        let parents = this._getParentHashes(hash);
        if (parents) {
            return parents.map((h) => [h, this.masterMap[h]]);
        }
        return null;
    }

    _getParentHashes(hash) {
        return this.masterReverseIndex[hash];
    }

    _getSync(hash) {
        return this.masterMap[hash] || null;
    }

    _getSuccessorHash(twistHash) {
        return this.successorMap[twistHash] || null;
    }

    _addChildHash(parentHash, childHash) {
        // my left arm for a defaultdict
        // yes thank you i know closure has one
        // but i'm not importing a gb of js just to get a defaultdict
        if (this.masterReverseIndex[childHash]) {
            this.masterReverseIndex[childHash].push(parentHash);
        } else {
            this.masterReverseIndex[childHash] =  [parentHash];
        }
    }

    async put(hash, packet) {
        super.put(hash, packet);
        this.masterMap[hash] = packet;
        this.pairs.set(hash, packet);
        packet.getContainedHashes().
            forEach(childHash => this._addChildHash(hash, childHash));

        if (packet instanceof BasicTwistPacket) {
            let body = this._getSync(packet.getBodyHash());
            if (body) {
                this.successorMap[await body.getPrevHash()] = hash;
            }
        }

        if (packet instanceof BasicBodyPacket) {
            let parents = this._getParentHashes(hash);
            if (parents && parents[0]) {
                this.successorMap[packet.getPrevHash()] = parents[0];
            }
        }
    }

    // mostly a hack, doesn't really work over network
    // used for testing atm
    async copyInto(store) {
        return Promise.all(Array.from(this.pairs).
            map(([hash, packet]) => store.put(hash, packet)));
    }
}

class SerialStore extends InMemoryPacketStore {
    constructor(initialBytes) {
        super();
        this.byteBuffer = initialBytes || new Uint8Array();
        this.primaryHash = null;

        if (initialBytes) {
            this.parseAndAddBytes(initialBytes);
        }
    }

    getPrimaryHash() {
        return this.primaryHash;
    }

    setPrimaryHash(hash) {
        this.primaryHash = hash;
    }

    /**
   * Getter for the byteBuffer
   * @returns {Uint8Array} the byte buffer
   */
    getBytes() {
        return this.byteBuffer;
    }

    /**
   * Adds a file to the serial store, ensuring the twist is put last
   */
    async putFile(file) {
        return file.copyStoreInto(this).then(async () =>
            this.forcePut(file.getHash(), await file.getTwistPacket()));
    }

    put(hash, packet) {
        let existingPacket = this.pairs.get(hash) || this.masterMap[hash];
        if (!existingPacket) {
            const pairBytes = byteConcat(hash.toBytes(),
                                                       packet.toBytes());
            this.byteBuffer = byteConcat(this.byteBuffer,
                                                       pairBytes);
            super.put(hash, packet);
        }
    }

    /**
     * Returns a new SerialStore object made with the contents of packetStore
     * @param {InMemoryPacketStore} packetStore
     * @returns {SerialStore} A new SerialStore object
     */
    static async fromPacketStore(packetStore) {
        let ss = new this();
        return packetStore.copyInto(ss).then(() => ss);
    }

    forcePut(hash, packet) {
        const pairBytes = byteConcat(hash.toBytes(),
                                                       packet.toBytes());
        this.byteBuffer = byteConcat(this.byteBuffer,
                                                   pairBytes);
        super.put(hash, packet);
        this.setPrimaryHash(hash);
    }

    /**
     * Returns a new SerialStore made with the contents of file's packet store
     * with an additional atom at the end which point to the file's twist hash.
     * @param {File} file
     */
    static async fromFile(file) {
        let ss = await SerialStore.fromPacketStore(file);
        await ss.forcePut(file.getHash(), await file.getTwistPacket());
        return ss;
    }

    /**
     * Reads and parses a serialized packet store
     *  and returns the "primary hash".
     * @param {Uint8Array} bytes
     * @returns {Hash}
     */
    parseAndAddBytes(bytes) {
        let atoms = Atoms.fromBytes(bytes);
        let pairs = atoms.toPairs();
        pairs.forEach(([hash, packet]) => {
            super.put(hash, packet);
            this.setPrimaryHash(hash);
        });
    }
}

class MemorySyncPacketStore extends PacketStore {

    constructor() {
        super();

        this.atoms = new Atoms();
        this.parents = new HashMap();
        this.successors = new HashMap();
    }

    getPairs() {
        return this.atoms.toPairs();
    }

    static fromAtoms(atoms) {
        let x = new this();
        for (let [h,p] of atoms.toPairs()) {
            x.put(h,p);
        }
        return x;
    }

    get(hash) {
        return this.atoms.get(hash);
    }

    _addChildHash(parentHash, childHash) {
        if (this.parents.get(childHash)) {
            this.parents.get(childHash).push(parentHash);
        } else {
            this.parents.set(childHash, [parentHash]);
        }
    }

    _throwConflictingSuccessor(existing, conflicting) {
        throw new Error("Conflicting successors." +
            " This packet store does not support conflicting successors: " +
            existing.toString() + " vs " + conflicting.toString());
    }

    // returns a HASH (change from async)
    successor(hash) {
        return this.successors.get(hash);
    }

    // dx: think: is this just copied from line.js?
    //  is store.js used anywhere? what even is this?
    put(hash, packet) {
        super.put(hash, packet);
        this.atoms.set(hash, packet);
        this.atoms.focus = hash;
        packet.getContainedHashes().forEach(childHash =>
            this._addChildHash(hash, childHash));

        if (packet instanceof BasicTwistPacket) {
            let body = this.get(packet.getBodyHash());
            if (body) {
                let prev = body.getPrevHash();
                let existingSuccessor = this.successors.get(prev);
                if (existingSuccessor) {
                    if (existingSuccessor.equals(hash)) {
                        return;
                    }
                    this._throwConflictingSuccessor(existingSuccessor, hash);
                }
                if (!prev.isNull()) {
                    this.successors.set(prev, hash);
                }
            }
            // else we don't have the body (yet) - may have been added
            // out-of-order
        }

        if (packet instanceof BasicBodyPacket) {
            let parentHashes = this.parents.get(hash);
            let twistHash = parentHashes ? parentHashes[0] : null;
            if (twistHash) {
                let prev = packet.getPrevHash();
                let existingSuccessor = this.successors.get(prev);
                if (existingSuccessor) {
                    if (existingSuccessor.equals(twistHash)) {
                        return;
                    }
                    this._throwConflictingSuccessor(
                        existingSuccessor, twistHash);
                }
                if (!prev.isNull()) {
                    this.successors.set(prev, twistHash);
                }
            }
            // else we dont have the twist(yet)
        }

    }

    copyInto(store) {
        this.atoms.forEach( (packet, hash) => store.put(hash, packet));
    }

}

export { MemorySyncPacketStore };
export { SerialStore };
