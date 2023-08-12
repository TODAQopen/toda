/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { BasicBodyPacket, BasicTwistPacket, PairTriePacket } from './packet.js';

import { Sha256, NullHash, Hash } from './hash.js';
import { HashMap } from './map.js';
import { Atoms } from './atoms.js';
import { Shield } from './shield.js';
import { SignatureRequirement } from './reqsat.js';

class MissingHashPacketError extends Error {
    constructor(hash, message) {
        super();
        this.hash = hash?.toString();
        this.message = message;
    }
}
class MissingPrevError extends MissingHashPacketError {
    constructor(hash) {
        super(hash, "Missing previous " + hash);
    }
}
class ShapeError extends Error {
    constructor(hash, msg) {
        super();
        this.hash = hash;
        this.msg = msg;
    }
}

// it would sort of be nice for this to be the same as the below class, but it's annoying.
class TwistBuilder {
    static defaultHashImp = Sha256;

    constructor(atoms, cargo, satisfactions, tether, requirements, shield, rigging) {
        this.atoms = atoms ? Atoms.fromAtoms(atoms) : new Atoms();
        this.data = new HashMap(cargo || []);
        this.satisfactions = satisfactions || null;
        this.tether = tether || null;
        this.requirements = requirements || null;
        this.shieldPacket = shield || null;
        this.riggingPacket = null;
        this.rigging = new HashMap(rigging || []);

        this.hashImp = TwistBuilder.defaultHashImp;

        this.satsHash = new NullHash();
        this.prevHash = new NullHash();
        this.tetherHash = new NullHash();
        this.reqsHash = new NullHash();
        this.cargoHash = new NullHash();
        this.shieldHash = new NullHash();
        this.riggingHash = new NullHash();
    }

    /** Sets the prev hash. Useful for when creating a Twist successor
     * @param prevHash <Hash> the prev hash
     */
    setPrevHash(prevHash) {
        this.prevHash = prevHash;
    }

    getPrevHash() {
        return this.prevHash;
    }

    setRiggingPacket(riggingPacket) {
        this.riggingPacket = riggingPacket;
    }

    /** Adds a key-val to the rigging trie hashmap
     * @param key <Hash> the key hash
     * @param val <Hash> the value hash
     */
    addRigging(key, val) {
        this.rigging.set(key, val);
    }

    setKeyRequirement(type, pubKey) {
        this.setRequirements(new SignatureRequirement(this.getHashImp(), type, pubKey));
    }

    /** Sets the twist requirements
     * @param requirements <Requirement>
     */
    setRequirements(requirements) {
        this.requirements = requirements;
    }

    /** Sets the reqs hash directly. Useful for creating a Twist successor
     * @param reqsHash <Hash> the reqs hash
     */
    setRequirementsHash(reqsHash) {
        this.reqsHash = reqsHash;
    }

    /** Sets the twist satisfactions
     * @param satisfier <RequirementSatisfier>
     */
    async satisfy(satisfier) {
        let body = this.getBodyPacket();
        let bodyHash = this.hashImp.fromPacket(body);
        let satisfaction = await satisfier.satisfy(this.prev(), bodyHash);
        this.satisfactions = satisfaction;
    }

    /** Sets the twist tether
     * @param tether <Twist> the line to tether to
     */
    setTether(tether) {
        this.tether = tether;
    }

    //todo(mje): Do we even need this or should we always be including the whole tether line?
    setTetherHash(tetherHash) {
        this.tetherHash = tetherHash;
    }

    setShield(shield) {
        this.shieldPacket = shield;
    }

    serialize(hashImp) {
        hashImp = hashImp || this.hashImp;
        let body = this.getBodyPacket();
        let bodyHash = hashImp.fromPacket(body);

        if (this.satisfactions) {
            let satisfactions = this.satisfactions.satsTrie;
            this.satsHash = hashImp.fromPacket(satisfactions);
            this.atoms.set(this.satsHash, satisfactions);

            this.addAtoms(Atoms.fromPairs(this.satisfactions.getPairs()));
        }

        let twist = new BasicTwistPacket(bodyHash, this.satsHash);
        let twistHash = hashImp.fromPacket(twist);
        let atoms = Atoms.fromAtoms(this.atoms);
        atoms.set(bodyHash, body);
        atoms.set(twistHash, twist);
        atoms.focus = twistHash;
        return atoms;
    }

    twist(hashImp) {
        return new Twist(this.serialize(hashImp));
    }

    /** Sets the cargo data
     * @param atoms <Atoms> the cargo atoms to set
     */
    setCargo(atoms) {
        this.addAtoms(atoms);
        let thisisdumb = atoms.toPairs(); // dx: todo: remove this! replace with twist.focus
        this.cargoHash = atoms.focus || thisisdumb[thisisdumb.length-1][0];
    }

    setFieldHash(field, hash) {
        this.data.set(field, hash);
    }

    setFieldPacket(field, packet) {
        let packetHash = TwistBuilder.defaultHashImp.fromPacket(packet);
        this.atoms.set(packetHash, packet);
        this.atoms.focus = packetHash;
        this.setFieldHash(field, packetHash);
    }

    setFieldAtoms(field, atoms) {
        this.addAtoms(atoms);
        this.setFieldHash(field, atoms.focus);
    }

    getCargoPacket() {
        return PairTriePacket.createFromUnsorted(this.data);
    }

    getRiggingPacket() {
        return this.riggingPacket || PairTriePacket.createFromUnsorted(this.rigging);
    }

    getAtoms() {
        return this.atoms;
    }

    getBodyPacket(hashImp) {
        hashImp = hashImp || TwistBuilder.defaultHashImp;

        if (this.tether) {
            let tether = this.tether.getPacket();
            this.tetherHash = hashImp.fromPacket(tether);
            this.atoms.set(this.tetherHash, tether);

            this.addAtoms(this.tether.getAtoms());
        }

        if (this.requirements) {
            let requirements = this.requirements.reqsTrie;
            this.reqsHash = hashImp.fromPacket(requirements);
            this.atoms.set(this.reqsHash, requirements);

            this.addAtoms(Atoms.fromPairs(this.requirements.getPairs()));
        }

        if (this.data.size > 0) {
            let cargo = this.getCargoPacket(hashImp);
            this.cargoHash = hashImp.fromPacket(cargo);
            this.atoms.set(this.cargoHash, cargo);
        }

        if (this.riggingPacket || this.rigging.size > 0) {
            if (this.riggingPacket && this.rigging.size > 0) {
                for (let k of this.rigging.keys()) {
                    this.riggingPacket = this.riggingPacket.set(k, this.rigging.get(k));
                }
            }
            let rigging = this.getRiggingPacket(hashImp);
            this.riggingHash = hashImp.fromPacket(rigging);
            this.atoms.set(this.riggingHash, rigging);
        }

        if (this.shieldPacket) {
            this.shieldHash = hashImp.fromPacket(this.shieldPacket);

            //CHECKME: we probably don't always want the shield in here.
            this.atoms.set(this.shieldHash, this.shieldPacket);
        }
        // dx: think: do we need to set the .focus here?

        return new BasicBodyPacket(this.prevHash,
            this.tetherHash,
            this.reqsHash,
            this.cargoHash,
            this.riggingHash,
            this.shieldHash);
    }

    // dx: NOTE! changes the focus!! why????
    // dx: TODO: change this so it doesn't change the focus, do that manually if desired
    addAtoms(atoms) {
        this.atoms.merge(atoms)
    }

    createSuccessor() {
        let atoms = this.serialize();
        let next = new TwistBuilder(atoms);
        next.prevHash = atoms.focus;
        return next;
    }

    hasRequirements() {
        return this.requirements.size > 0;
    }

    getTetherHash() {
        return this.tetherHash; //TODO: misses out on where this.tether was set
    }

    isTethered() {
        return this.tether || (this.tetherHash && !this.tetherHash.isNull());
    }

    getHashImp() {
        return this.hashImp;
    }

    getHash() {
        // we should really memoize this or something
        return this.serialize().focus;
    }

    // kinda redundant
    prev() {
        let ph = this.getPrevHash();
        if (ph.isNull()) {
            return null;
        }
        if (this.atoms.get(ph)) {
            return new Twist(this.atoms, ph);
        }
        throw new MissingPrevError(ph);
    }

}

class Twist {

    constructor(atoms, hash) {
        this.atoms = atoms;
        this.hash = hash || atoms.focus;

        this.packet = atoms.get(this.hash);
        if (!this.packet) {
            throw new MissingHashPacketError(this.hash);
        }

        this.body = atoms.get(this.packet.getBodyHash());
        if (!this.body) {
            throw new MissingHashPacketError(this.packet.getBodyHash());
        }
    }

    getHashImp() {
        return this.packet.getHashImp();
    }

    getAtoms() {
        return this.atoms;
    }

    getHash() {
        return this.hash;
    }

    getPacket() {
        return this.packet;
    }

    getBody() {
        return this.body;
    }

    getBodyHash() {
        return this.packet.getBodyHash();
    }

    get(hash) {
        return this.atoms.get(hash);
    }

    isTethered() {
        return !this.body.getTetherHash().isNull();
    }

    getPrevHash() {
        return this.body.getPrevHash();
    }

    prev() {
        let ph = this.getPrevHash();
        if (ph.isNull()) {
            return null;
        }
        if (this.get(ph)) {
            return new Twist(this.atoms, ph);
        }
        throw new MissingPrevError(ph);
    }

    /**
      * Walks backwards, looking for the most recent prev that matches `predicate`
      * @param predicate <Function(this)>
      * @
     */
    findLast(predicate) {
        if (predicate(this)) {
            return this;
        }
        let p = this.prev();
        if (p) {
            return p.findLast(predicate);
        }
        return null;
    }

    /** Returns the last fast twist before this one. */
    lastFast() {
        let p = this.prev();
        if (p) {
            return p.findLast(t => t.isTethered());
        }
        return null;
    }

    /**
     * Backwards search of previous twists, looking for the last tether that
     *  exists in the this.atoms
     * @returns <Twist>
     */
    findLastStoredTether()
    {
        if (this.get(this.getTetherHash())) {
            return this.tether();
        }
        return this.lastFast()?.findLastStoredTether();
    }

    /**
     * Backwards search of previous twists, looking for the hash of the tether
     *  whose twist exists in this.atoms
     * @returns <Hash>
     */
    findLastStoredTetherHash()
    {
        return this.findLastStoredTether()?.getHash();
    }

    /**
      * Looks to see if `previousHash` is one of the previous twists of this twist,
      *  returning that twist if it does.
      * @param previousHash <Hash>
      * @returns <Twist>
      */
    findPrevious(previousHash)
    {
        return this.findLast(t => t.getHash().equals(previousHash));
    }

    first() {
        let prev = this.prev();
        if (!prev) {
            return this;
        }

        return prev.first();
    }

    rig(hash) {
        let riggingHash = this.body.getRiggingHash();
        if (riggingHash.isNull()) {
            return null;
        }
        let rigging =  this.get(riggingHash);
        if (!rigging) {
            throw new MissingHashPacketError(riggingHash);
        }
        if (!(rigging instanceof PairTriePacket)) {
            throw new ShapeError(this.body.getRiggingHash(), "Rigging must be pairtrie");
        }
        return rigging.get(hash);
    }

    getShieldHash() {
        return this.body.getShieldHash();
    }

    /**
     * @returns <ArbitraryPacket>
     */
    shield() {
        return this.get(this.getShieldHash());
    }

    tether() {
        if (this.isTethered()) {
            return new Twist(this.atoms, this.body.getTetherHash());
        }
        return null;
    }


    getTetherHash() {
        return this.body.getTetherHash();
    }

    /**
     * if param 'key' provided, does a lookup, otherwise returns trie.
     */
    reqs(key) {
        let reqHash = this.body.getReqsHash();
        if (reqHash.isNull()) {
            return null;
        }
        let reqs = this.get(reqHash);
        if (!reqs) {
            throw new MissingHashPacketError(reqHash, "Requirements packet missing");
        }
        if (key) {
            return reqs.get(key);
        }
        return reqs;
    }

    /**
     * if param 'key' provided, does a lookup, otherwise returns trie.
     */
    sats(key) {
        let satHash = this.packet.getSatsHash();
        if (satHash.isNull()) {
            return null;
        }
        let sats = this.get(satHash);
        if (!sats) {
            throw new MissingHashPacketError(satHash, "Sats packet missing");
        }
        if (key) {
            return sats.get(key);
        }
        return sats;
    }

    cargo(key) {
        let cargoHash = this.body.getCargoHash();
        if (cargoHash.isNull()) {
            return null;
        }
        let cargo = this.get(cargoHash);
        if (!cargo) {
            throw new MissingHashPacketError(cargoHash, "Cargo packet missing");
        }
        if (key) {
            return cargo.get(key);
        }
        return cargo;
    }

    hasRigKey(hash) {
        return !!this.rig(hash);
    }

    equals(twist) {
        return this.hash.equals(twist.hash);
    }

    createSuccessor() {
        let tb = new TwistBuilder(this.atoms);
        tb.setPrevHash(this.hash);

        if (this.reqs()) {
            tb.setRequirementsHash(this.body.getReqsHash());
        }

        return tb;
    }

    hoistPacket(successorHash) {
        return Shield.rigForHoist(this.getHash(), successorHash, this.shield());
    }

    static fromBytes(bytes) {
        return new this(Atoms.fromBytes(bytes));
    }

    // adds atoms without changing the focus.
    addAtoms(atoms) {
        this.atoms.mergeNOFOCUS(atoms);
        // dx: todo: make this just merge, and lift focus into twist
    }

    /**
     * Determine whether or not the shield of `twistHash` is safe
     *  to publicize
     * @param {Hash} otherTwistHash
     * @returns {Boolean}
     */
    shieldIsPublic(otherTwistHash) {
        return !this.lastFast(true)?.getHash().equals(otherTwistHash);
    }
}

export { Twist };
export { TwistBuilder };
export { MissingHashPacketError };
export { ShapeError };
export { MissingPrevError };
