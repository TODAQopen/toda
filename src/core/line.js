/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Atoms } from './atoms.js';
import { HashMap } from './map.js';
import { BasicTwistPacket, BasicBodyPacket } from './packet.js';
import { Twist, MissingHashPacketError } from './twist.js';

class Line {
    /**
   * @returns {Line}
   */
    constructor() {
        this.atoms = new Atoms();
        this.prevs = new HashMap();
        this.parents = new HashMap();
        this.successors = new HashMap();
        this.focus = null;
    }

    static fromAtoms(atoms, focus) {
        let line = new this();
        // line.atoms = atoms; // dx: todo: figure out why this doesn't work
        line.atoms.merge(atoms);

        for (let [h,p] of atoms.toPairs()) {
            line.processPacket(h, p);
        }

        line.focus = focus || atoms.focus;
        return line;
    }

    static fromTwist(twist) {
        return this.fromAtoms(twist.atoms, twist.getHash());
    }

    static fromBytes(bytes) {
        return Line.fromAtoms(Atoms.fromBytes(bytes));
    }

    getAtoms() {
        return this.atoms;
    }

    /**
     * Returns an array of twists related to the focus of each file
     * @returns {Array<Hash>} Array of twist hashes
     */
    twistList() { //FIXME(acg): what is even going on here?
        let focusHistories = this.history(this.last(this.focus) || this.focus);
        return Array.from(this.atoms.keys()).
            filter(h => focusHistories.find(fh => fh.equals(h)));
    }

    contains(hash) {
        return this.twistList().find(h => h.equals(hash));
    }

    _colinearForwards(hash0, hash1) {
        if (!hash0 || !hash1) return false;
        if (hash0.equals(hash1)) return true;
        if (this.successor(hash0)) { 
            return this._colinearForwards(this.successor(hash0), hash1);
        }
        return false;
    }

    _colinearBackwards(hash0, hash1) {
        if (!hash0 || !hash1) return false;
        if (hash0.equals(hash1)) return true;
        if (this.prev(hash0)) { 
            return this._colinearBackwards(this.prev(hash0), hash1);
        }
        return false;
    }

    colinear(hash0, hash1 = this.focus) {
        return this._colinearBackwards(hash0, hash1) || 
               this._colinearForwards(hash0, hash1);
    }

    latestTwist() {
        return this.last(this.focus) || this.focus;
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
   * Returns a list of hashes of all twist predecessors
   *  starting with first and ending the current one.
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
            history.push(prev);
            prev = this.prev(prev);
        }

        return history.reverse();
    }

    /**
   * Returns the hash of the previous twist in line
   * @param {Hash} hash twist hash
   * @returns {Hash} hash of previous twist
   */
    prev(hash) {
        const ph = this.prevs.get(hash);
        return ph?.isNull() ? null : ph;
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
   * Returns the last successor for a given 
   *  twist hash if exist and null otherwize
   * @param {Hash} hash
   * @returns {Hash} The last successor in a twist line
   */
    last(hash) {
        let successors = this.successorList(hash);
        if (successors) {
            return this.successorList(hash).slice(-1)[0] || null;
        }
        return null;
    }

    //XXX(acg): do we really need 15 different history functions?

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
        let hashes = this.completeHistory(hash);
        while (hashes.length > 0) {
            let h = hashes.pop();
            let twist = this.twist(h);
            if (twist && twist.isTethered()) {
                return h;
            }
        }
        return null;
    }

    /**
     * Returns the hash of the latest tethered twist before the 
     *  given one (searches backwards from the given hash.)
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
        return null;
    }


    /**
   * Returns a Twist object corresponding to 
   *  the given hash if exists nd null otherwize
   * @param {Hash} hash
   * @returns {Twist} Twist corresponding to the given hash
   */
    twist(hash) {
        try {
            let twist = new Twist(this.atoms, hash);
            return twist.body ? twist : null;
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

    //FIXME(acg): Remove this. I'm only leaving this in because the tests rely
    //on it for some reason. Tests should just use a virtual inventory.
    /**
     * Copies the given twist store into this.store
     * @param {Twist} twist
     */
    putTwist(twist) {
        this.focus = twist.atoms.focus;
        return twist.atoms.toPairs().
            forEach(([hash, packet]) => this.put(hash, packet));
    }


    //store fns

    get(hash) {
        return this.atoms.get(hash);
    }

    _addChildHash(parentHash, childHash) {
        // dx: perf: speed it up or call it less
        let kid = this.parents.get(childHash);
        if (kid) {
            kid.push(parentHash);
        } else {
            this.parents.set(childHash, [parentHash]);
        }
    }

    _throwConflictingSuccessor(existing, conflicting) {
        throw new Error("Conflicting successors." + 
            " This packet store does not support conflicting successors: " 
            + existing.toString() + " vs " + conflicting.toString());
    }

    // returns a HASH (change from async)
    successor(hash) {
        return this.successors.get(hash);
    }

    put(hash, packet) {
        this.atoms.set(hash, packet);
        this.atoms.focus = hash; // dx: TODO: drop this when we lose focus
        this.processPacket(hash, packet);
    }

    processPacket(hash, packet) {
        if (packet instanceof BasicTwistPacket) {
            packet.getContainedHashes().
                forEach(childHash => this._addChildHash(hash, childHash));
            let body = this.get(packet.getBodyHash());
            if (body) {
                let prev = body.getPrevHash();
                this.prevs.set(hash, prev);
                let existingSuccessor = this.successor(prev);
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
            packet.getContainedHashes().
                forEach(childHash => this._addChildHash(hash, childHash));
            let parentHashes = this.parents.get(hash);
            let twistHash = parentHashes ? parentHashes[0] : null;
            if (twistHash) {
                let prev = packet.getPrevHash();
                this.prevs.set(twistHash, prev);
                let existingSuccessor = this.successor(prev);
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

    addAtoms(atoms) {
        for (let [h,p] of atoms.toPairs()) {
            this.put(h,p);
        }

        return this;
    }

    addBytes(bytes) {
        return this.addAtoms(Atoms.fromBytes(bytes));
    }
}

export { Line };