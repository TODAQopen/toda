/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { BasicBodyPacket, BasicTwistPacket, PairTriePacket } = require("./packet");
const { Sha256, NullHash } = require("./hash");
const { HashMap } = require("./map");
const { Atoms } = require("./atoms");
const { Shield } = require("./shield");
const { SignatureRequirement } = require("./reqsat");

class MissingHashPacketError extends Error {
    constructor(hash, message) {
        super();
        this.hash = hash.toString();
        this.message = message;
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
        atoms = atoms || [];
        this.atoms = new Atoms([...atoms]);
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
     * @param satisfactions <SignatureSatisfaction>
     */
    setSatisfactions(satisfactions) {
        this.satisfactions = satisfactions;
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

            this.addAtoms(new Atoms(this.satisfactions.getPairs()));
        }

        let twist = new BasicTwistPacket(bodyHash, this.satsHash);
        let twistHash = hashImp.fromPacket(twist);
        return new Atoms([...this.atoms, [bodyHash, body], [twistHash, twist]]);
    }

    twist(hashImp) {
        return new Twist(this.serialize(hashImp));
    }

    /** Sets the cargo data
     * @param atoms <Atoms> the cargo atoms to set
     */
    setCargo(atoms) {
        this.addAtoms(atoms);
        this.cargoHash = atoms.lastAtomHash();
    }

    setFieldHash(field, hash) {
        this.data.set(field, hash);
    }

    setFieldPacket(field, packet) {
        let packetHash = TwistBuilder.defaultHashImp.fromPacket(packet);
        this.atoms.set(packetHash, packet);
        this.setFieldHash(field, packetHash);
    }

    setFieldAtoms(field, atoms) {
        this.addAtoms(atoms);
        this.setFieldHash(field, atoms.lastAtomHash());
    }

    getCargoPacket() {
        return PairTriePacket.createFromUnsorted(this.data);
    }

    getRiggingPacket() {
        return this.riggingPacket || PairTriePacket.createFromUnsorted(this.rigging);
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

            this.addAtoms(new Atoms(this.requirements.getPairs()));
        }

        if (this.data.size > 0) {
            let cargo = this.getCargoPacket(hashImp);
            this.cargoHash = hashImp.fromPacket(cargo);
            this.atoms.set(this.cargoHash, cargo);
        }

        if (this.riggingPacket || this.rigging.size > 0) {
            if (this.riggingPacket && this.rigging.size > 0) {
                // TODO(acg): this was written in 0.5 seconds.  pls review:
                // quick hack merge:
                for (let k of this.rigging.keys()) {
                    this.riggingPacket.set(k, this.rigging.get(k));
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

        return new BasicBodyPacket(this.prevHash,
            this.tetherHash,
            this.reqsHash,
            this.cargoHash,
            this.riggingHash,
            this.shieldHash);
    }

    addAtoms(atoms) {
        this.atoms = new Atoms([...this.atoms, ...atoms]);
    }

    createSuccessor() {
        let atoms = this.serialize();
        let next = new TwistBuilder(atoms);
        next.prevHash = atoms.lastAtomHash();
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
        return this.serialize().lastAtomHash();
    }

    // kinda redundant
    prev() {
        let ph = this.getPrevHash();
        if (ph.isNull()) {
            return null;
        }
        return new Twist(this.atoms, ph);
    }

}

class Twist {

    constructor(atoms, hash) {
        this.atoms = atoms;
        this.hash = hash || atoms.lastAtomHash();

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

    prev() {
        let ph = this.body.getPrevHash();
        if (ph.isNull()) {
            return null;
        }
        return new Twist(this.atoms, ph);
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
     * Backwards search of previous twists, looking for the hash of the tether
     *  whose twist exists in this.atoms
     * @returns <Hash>
     */
    findLastStoredTetherHash()
    {
        let tetherHash = this.getTetherHash();
        if (this.get(tetherHash)) {
            return tetherHash;
        }
        return this.lastFast()?.findLastStoredTetherHash();
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

    /**
     * @returns <ArbitraryPacket>
     */
    shield() {
        return this.get(this.body.getShieldHash());
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
    safeAddAtoms(atoms) {
        let [h,p] = this.atoms.lastAtom();
        this.atoms = new Atoms([...this.atoms, ...atoms]);
        this.atoms.forceSetLast(h,p);
    }
}

exports.Twist = Twist;
exports.TwistBuilder = TwistBuilder;
exports.MissingHashPacketError = MissingHashPacketError;
exports.ShapeError = ShapeError;
