/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Packet, BasicTwistPacket, BasicBodyPacket } from '../core/packet.js';

import { Atoms } from './atoms.js';
import { HashMap } from './map.js';
import { HashNotFoundError } from './error.js';
import { ByteArray } from '../core/byte-array.js';
import { Hash } from '../core/hash.js';

class PacketStore {

    async get(hash) {
    }

    put(hash, packet) {
    }

    /**
     * @returns <Array.<Hash>> the hashes of packets which reference the supplied hash
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
        this.pairs = new Map(); // we also want to preserve the Hash obj so we don't have to parse
        this.masterMap = {};
        this.masterReverseIndex = {};
        this.successorMap = {};
    }

    getPairs() {
        return this.pairs;
    }

    async get(hash) {
        // XXX(acg): shortcut if we have this actual object
        return this.pairs.get(hash) || this.masterMap[hash] || Promise.reject(new HashNotFoundError(hash));
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
        packet.getContainedHashes().forEach(childHash => this._addChildHash(hash, childHash));

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
        return Promise.all(Array.from(this.pairs).map(([hash, packet]) => store.put(hash, packet)));
    }
}

class SerialStore extends InMemoryPacketStore {
    constructor(initialBytes) {
        super();
        this.byteBuffer = initialBytes || new ByteArray();
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
   * @returns {ByteArray} the byte buffer
   */
    getBytes() {
        return this.byteBuffer;
    }

    /**
   * Adds a file to the serial store, ensuring the twist is put last
   */
    async putFile(file) {
        return file.copyStoreInto(this).then(async () => this.forcePut(file.getHash(), await file.getTwistPacket()));
    }

    put(hash, packet) {
        let existingPacket = this.pairs.get(hash) || this.masterMap[hash];
        if (!existingPacket) {
            this.byteBuffer = this.byteBuffer.concat(hash.serialize().concat(packet.serialize()));
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
        this.byteBuffer = this.byteBuffer.concat(hash.serialize().concat(packet.serialize()));
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
     * Reads and parses a serialized packet store and returns the "primary hash".
     * @param {ByteArray} bytes
     * @returns {Hash}
     */
    parseAndAddBytes(bytes) {
        while (bytes.length > 0) {
            let [hash, numBytes] = this.readHash(bytes);
            bytes = bytes.slice(numBytes);
            let [packet, packetNumBytes] = this.readPacket(bytes);
            bytes = bytes.slice(packetNumBytes);
            // we call 'put' on the superclass so we don't write it to the bytestream again
            super.put(hash, packet);
            this.setPrimaryHash(hash);
        }
    }

    /**
     * @returns <ByteArray> the bytes
     */
    readBytes(bytes, num) {
        if (bytes.length < num) {
            throw new Error("could not parse file; reading off end");
        }
        return bytes.slice(0, num);
    }

    /**
     * @returns [<Hash>, <Integer>] where int is number of bytes read.
     */
    readHash(bytes) {
        let algoCode = this.readBytes(bytes, Hash.ALGO_CODE_LENGTH)[0];
        let imp = Hash.implementationForAlgoCode(algoCode);
        bytes = bytes.slice(Hash.ALGO_CODE_LENGTH);


        if (!imp) throw new Error("unknown algo code: " + algoCode);

        let hashBytes = this.readBytes(bytes, imp.getHashValueLength());
        return [Hash.createFromAlgoCode(algoCode, hashBytes), Hash.ALGO_CODE_LENGTH + hashBytes.length];

    }

    /**
     * @returns [<Packet>, <Integer>] where int is number of bytes read.
     */
    readPacket(bytes) {
        let shapeCode = this.readBytes(bytes, Packet.PACKET_LENGTH_OFFSET)[0];
        bytes = bytes.slice(Packet.PACKET_LENGTH_OFFSET);
        let packetLength = this.readBytes(bytes, Packet.PACKET_LENGTH_LENGTH).toInt();
        bytes = bytes.slice(Packet.PACKET_LENGTH_LENGTH);
        return [Packet.createFromShapeCode(shapeCode, this.readBytes(bytes, packetLength)),
            Packet.PACKET_LENGTH_OFFSET +
		Packet.PACKET_LENGTH_LENGTH +
		packetLength];
    }

}


class SyncPacketStore {
    get(hash) {
    }

    put(hash, packet) {
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
        throw new Error("Conflicting successors.  This packet store does not support conflicting successors: " + existing.toString() + " vs " + conflicting.toString());
    }

    // returns a HASH (change from async)
    successor(hash) {
        return this.successors.get(hash);
    }

    // dx: think: is this just copied from line.js? is store.js used anywhere? what even is this?
    put(hash, packet) {
        super.put(hash, packet);
        this.atoms.set(hash, packet);
        this.atoms.focus = hash;
        packet.getContainedHashes().forEach(childHash => this._addChildHash(hash, childHash));

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
                    this._throwConflictingSuccessor(existingSuccessor, twistHash);
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
