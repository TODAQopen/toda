/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const fs = require("fs");
const { Atoms } = require("./atoms");
const { HashMap } = require("./map");
const { BasicTwistPacket, BasicBodyPacket } = require("./packet");
const { ByteArray } = require("./byte-array");
const { Twist, MissingHashPacketError } = require("./twist");

class Line {
    /**
   * @returns {Line}
   */
    constructor() {
        this.atoms = new Atoms();
        this.parents = new HashMap();
        this.successors = new HashMap();
        this.focuses = [];
    }

    static fromAtoms(atoms) {
        let x = new this();

        for (let [h,p] of atoms) {
            x.put(h,p);
        }

        x.focuses.push(atoms.lastAtomHash());
        return x;
    }

    static fromBytes(bytes) {
        return Line.fromAtoms(Atoms.fromBytes(bytes));
    }

    getAtoms() {
        return this.atoms;
    }

    /**
   * Returns an array of twists related to the focuses of each file
   * @returns {Array<Hash>} Array of twist hashes
   */
    twistList() {
        let focusHistories = this.focuses.map(h => this.history(this.last(h) || h)).flat();
        return Array.from(this.atoms.keys()).filter(h => focusHistories.find(fh => fh.equals(h)));
    }

    /**
   * Returns an array of the latest twists related to the focuses of each file, eg. excluding any twists that are ancestors of another in the list
   * @returns {Array<Hash>} Array of twist hashes
   */
    latestTwistList() {
        return this.focuses.map(h => this.last(h) || h);
    }

    /**
   * Returns an array of all twists
   * @returns {Array<Hash>} Array of twist hashes
   */
    detailedTwistList() {
        return Array.from(this.atoms.keys()).filter(h => !!this.twist(h));
    }

    /**
   * Returns an array of the latest twists, eg. excluding any twists that are ancestors of another in the list
   * @returns {Array<Hash>} Array of twist hashes
   */
    latestDetailedTwistList() {
        return this.detailedTwistList().map(h => this.last(h) || h);
    }

    /**
   * Returns the hash of the first twist in line
   * @param {Hash} hash twist hash
   * @returns {Hash} hash of first twist
   */
    first(hash) {
        let prev = this.prev(hash);
        if (!prev) {
            return hash;
        } else {
            return this.first(prev);
        }
    // NOTE(sfertman): can also do this.history(hash)[0] || null
    // but I think this is more performant
    }

    /**
   * Returns a list of hashes of all twist predecessors starting with first and ending the current one.
   * Returns null if hash doesn't point to a stored twist.
   * @param {Hash} hash
   * @returns {Array<Hash>|null}
   */
    history(hash) {
        if (!this.twist(hash)) {
            return null;
        }

        let history = [hash];
        let prev = this.prev(hash);

        while (prev) {
            history.unshift(prev);
            prev = this.prev(prev);
        }

        return history;
    }

    /**
   * Returns the hash of the previous twist in line
   * @param {Hash} hash twist hash
   * @returns {Hash} hash of previous twist
   */
    prev(hash) {
        let twist = this.twist(hash);

        if (!twist) {
            return null;
        }

        let ph = twist.body.getPrevHash(); // I don't want the twist here; just the hash
        return ph.isNull() ? null : ph;
    }

    /**
   * Returns a list of all twist successors.
   * Returns null if hash doesn't point to a stored twist.
   * @param {Hash} hash twist hash
   * @returns {Array<Hash>}
   */
    successorList(hash) {
        if (!this.twist(hash)) {
            return null;
        }

        let successors = [];
        let successor = this.successor(hash);

        while (successor) {
            successors.push(successor);
            successor = this.successor(successor);
        }

        return successors;
    }

    /**
   * Returns the last successor for a given twist hash if exist and null otherwize
   * @param {Hash} hash
   * @returns {Hash} The last successor in a twist line
   */
    last(hash) {
        let successors = this.successorList(hash);
        if (successors) {
            return this.successorList(hash).slice(-1)[0] || null;
        }
    }

    completeHistory(hash) {
        let history = this.history(hash) || [];
        let successors = this.successorList(hash);

        if (!history || !successors) {
            return null;
        }

        return history.concat(successors);
    }

    /**
   * Returns the last tethered twist hash or null if none are tethered.
   * Returns null if input hash is not found in store.
   * @param {Hash} hash
   * @returns {Hash}
   */
    lastFast(hash) {
        let line = this.completeHistory(hash);
        while (line.length > 0) {
            let h = line.pop();
            let twist = this.twist(h);
            if (twist && twist.isTethered()) {
                return h;
            }
        }
    }

    /**
   * Returns the hash of the latest tethered twist before the given one (searches backwards from the given hash.)
   * Returns null if input hash is not found in store.
   * @param {Hash} hash
   * @returns {Hash}
   */
    lastFastBeforeHash(hash) {
        let history = this.history(hash) || [];
        history.pop();

        if (!history) {
            return null;
        }

        while (history.length > 0) {
            let h = history.pop();
            let twist = this.twist(h);
            if (twist && twist.isTethered()) {
                return h;
            }
        }
    }

    /**
   * Returns a Twist object corresponding to the given hash if exists nd null otherwize
   * @param {Hash} hash
   * @returns {Twist} Twist corresponding to the given hash
   */
    twist(hash) {
        if (!this.atoms.get(hash) || !this.atoms.get(hash).getBodyHash) {
            return null;
        }

        try {
            return new Twist(this.atoms, hash);
        } catch (err) {
            if (err instanceof MissingHashPacketError) {
                return null;
            }

            throw err;
        }
    }

    /**
   * Returns packet by hash this.store if exists and null otherwise
   * @param {Hash} hash
   * @returns {Packet}
   */
    packet(hash) {
        return this.atoms.get(hash);
    }

    /**
   * Copies the given twist store into this.store
   * @param {Twist} twist
   */
    putTwist(twist) {
        this.focuses.push(twist.atoms.lastAtomHash());
        return twist.atoms.forEach((packet, hash) => this.put(hash, packet));
    }

    //store fns
    verify(hash, packet) {
        return hash.assertVerifiesPacket(packet);
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

    put(hash, packet) {
        this.verify(hash, packet);
        this.atoms.set(hash, packet);
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

    addAtoms(atoms) {
        for (let [h,p] of atoms) {
            this.put(h,p);
        }

        return this;
    }

    addBytes(bytes) {
        return this.addAtoms(Atoms.fromBytes(bytes));
    }
}


class PersistentLine extends Line {
    constructor(dir) {
        super();
        this.dir = dir || __dirname;

        try {
            fs.mkdirSync(this.dir);
        } catch (err) {
            if (err.code != "EEXIST") {
                throw err;
            }
        }
        let todaFiles = fs.readdirSync(this.dir).filter(fname => fname.endsWith(".toda"));
        todaFiles.forEach(fname => {
            let atoms = Atoms.fromBytes(ByteArray.from(fs.readFileSync(this.withDir(fname))));
            atoms.forEach((packet, hash) => this.put(hash, packet));
            this.focuses.push(atoms.lastAtomHash());
        });
    }

    /**
   * Prefixes this.dir to a given file name string
   * @param {string} fname
   * @returns {string}
   */
    withDir(fname) {
        return `${this.dir}/${fname}`;
    }

    /**
   * Returns a file name corresponding to a given hash
   * @param {Hash} hash
   * @returns {string}
   */
    filePath(hash) {
        return this.withDir(`${hash}.toda`);
    }

    /**
   * Serializes and writes a twist to disk
   * @param {Hash} hash
   */
    toDisk(hash) {
        let twist = this.twist(hash);
        fs.writeFileSync(this.filePath(hash), twist.atoms.toBytes());
    }

    /**
   * Serializes all in twists in memory and writes them to disk
   */
    dump() {
        let twists = this.atoms.keys().map(h => [h, this.twist(h)]).filter(([h, t]) => !!t); // get all twist hashes and objects
        twists.forEach(t => fs.writeFileSync(this.filePath(t.getHash()), t.atoms.toBytes()));
    }
}

exports.Line = Line;
exports.PersistentLine = PersistentLine;

