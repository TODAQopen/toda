/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const {ByteArray} = require("../core/byte-array");
const {NullHash, Sha256, Symbol} = require("../core/hash");
const {BasicTwistPacket, PairTriePacket, HashPacket} = require("../core/packet");
const {HashMap} = require("../core/map");
const {Atoms} = require("../core/atoms");

const NULL = new NullHash();

/***
 * An Abject implementation should provide the following:
 *
 * Static methods to interpret atoms and return Abjects or Primitives
 * Constructor to create in-memory view objects
 * Serializer to return atoms given

 */


class Abject {

    static NULL = NULL;

    static interpreter = null;

    static interpreters = new HashMap(); /** @type <Map.<NoFollow, Class<Abject>>> */

    constructor() {

	      this.preferredHashImp = Sha256;

	      // supporting atoms
	      this.atoms = new Atoms();

	      // top-level data map
	      this.data = new HashMap();

	      this.setInterpreter(this.constructor.interpreter);
    }

    getAtoms() {
        return this.atoms;
    }

    /**
     * Sets key-val pair in top-level data
     * @param field <Hash>
     * @param val <Hash>
     */
    setFieldHash(field, val) {
	      if (!field || !val) {
	          throw new AbjectError(this.atoms, "both params required setting a field value");
	      }
	      this.data.set(field, val);
    }

    /**
     * @param field <Hash>
     * @param valHash <Hash>
     * @param valPacket <Packet>
     */
    setFieldAtom(field, valHash, valPacket) {
	      this.addAtom(valHash, valPacket);
	      this.setFieldHash(field, valHash);
    }

    /**
     * Set a field atom and calculate the hash of teh packet on the
     * fly using the default hasher
     * @param field <Hash>
     * @param valPacket <Packet>
     */
    setField(field, valPacket) {
	      // xxx(acg): maybe add an optional param to supply a hasher?
	      this.setFieldAtom(field, this.hashPacket(valPacket), valPacket);
    }

    /**
     * @param field <Hash>
     * @param abject <Abject>
     * @param hashImp <Class<Hash>>
     */
    setFieldAbject(field, abject, hashImp) {
        let atoms = abject.serialize(hashImp);
	      this.atoms.merge(atoms);
	      this.setFieldHash(field, atoms.lastAtomHash());
    }

    /**
     * @param field <Hash>
     * @param abjects <Array.<Abject>>
     * @param hashImp <Class<Hash>>
     */
    setFieldAbjects(field, abjects, hashImp) {
        // wow what an enormous pain

        let abjectAtoms = abjects.map(a => a.serialize(hashImp));
        let abjectHashes = abjectAtoms.map(a => a.lastAtomHash());
        let packet = new HashPacket(abjectHashes);

        for (let atoms of abjectAtoms) {
            this.addAtoms(atoms);
        }
        this.setField(field, packet);
    }

    /**
     * @param interpreter <Hash>
     */
    setInterpreter(interpreter) {
	      if (!interpreter) {
	          throw new AbjectError(this.atoms, "interpreter required");
	      }
	      this.setFieldHash(NULL, interpreter);
    }

    /**
     * Add a supporting atom
     * @param h <Hash>
     * @param p <Packet>
     */
    addAtom(h, p) {
	      this.atoms.set(h, p);
    }

    addAtoms(atoms) {
        this.atoms.merge(atoms);
    }

    /**
     * @returns [<Hash>,<Packet>]
     */
    dataAtom(hashImp) {
	      let packet = PairTriePacket.createFromUnsorted(this.data);
	      return [(hashImp || this.preferredHashImp).fromPacket(packet), packet];
    }

    /**
     * @returns [<Hash>,<Packet>]
     */
    topAtom(hashImp) {
        // this gets overridden in actionables.
        return this.dataAtom(hashImp);
    }

    /**
     * @returns <Hash>
     */
    getHash(hashImp) {
	      return this.topAtom(hashImp || this.preferredHashImp)[0];
    }

    /**
     * Return a collection of ordered atoms.  Top-level atom is
     * returned last.
     * @param hashImp <Class.<Hash>> hasher to user for top-level data
     * @return <Atoms>
     */
    serialize(hashImp) {
	      let [h,p] = this.dataAtom(hashImp);
	      return this.atoms.clone().set(h,p);
    }

    /**
     * FIXME(acg): naming, etc. etc.....
     */
    serializeToBytes(hashImp) {
	      //todo(acg): initialize with the actual num of bytes we'll need
	      let byteBuffer = new ByteArray();
	      for (const [hash,packet] in this.atoms) {
	          byteBuffer = byteBuffer.concat(hash.serialize().concat(packet.serialize()));
	      }
	      return byteBuffer.concat(dataHash.serialize().concat(dataPacket.serialize()));
    }

    /**
     * @return <Class.<Hash>>
     */
    getPreferredHashImp() {
	      return this.preferredHashImp;
    }

    /**
     * @param packet <Packet>
     * @return <Hash>
     */
    hashPacket(packet) {
	      return this.getPreferredHashImp().fromPacket(packet);
    }

    /**
     * @param interpreterCls <Class.<Abject>>
     */
    static registerInterpreter(interpreterCls) {
	      this.interpreters.set(interpreterCls.interpreter, interpreterCls);
    }

    /**
     * @param interpreterHash <Hash>
     * @return <Class.<Abject>?>
     */
    static classForInterpreter(interpreterHash) {
	      return this.interpreters.get(interpreterHash);
    }


    /**
     * Returns a new abject using the same atom set with a different focus
     */
    getAbject(focusHash) {
        //XXX(acg): Tired of derived objects screwing around with OG atom store.
        //Doing a copy instead.
        return Abject.parse(this.atoms.copy(), focusHash);
    }

    getFieldHash(fieldSym) {
        return this.data.get(fieldSym);
    }

    getField(fieldSym) {
        return this.atoms.get(this.data.get(fieldSym));
    }

    getFieldAbject(fieldSym) {
        let fieldHash = this.getFieldHash(fieldSym);
        if (fieldHash) {
            return this.getAbject(fieldHash);
        }
        return null;
    }

    /**
     * Interpret the given collection of atoms given installed
     * interpreters.  Assumes primary atom is last.
     * @param atoms <Atoms>
     * @param focus <Hash?>
     * @return <Abject|String|Date|Number?>
     */
    static parse(atoms, focusHash) {
        let focus;
        if (focusHash) {
            focus = atoms.get(focusHash);
        } else {
	          focus = atoms.lastPacket();
        }

        // deal with reference to lists
        if (focus.constructor == HashPacket) {
            return focus.shapedVal.map(h => Abject.parse(atoms, h));
        }

	      let body = null;
        let cargo = null;
	      let cargoHash = undefined;

	      if (focus instanceof BasicTwistPacket) {
	          // TODO(acg): push this logic down into the forthcoming Twist class
	          body = atoms.get(focus.getBodyHash());
	          if (!body) {
		            throw new AbjectMissingBodyPacket(atoms);
	          }
		        cargoHash = body.getCargoHash();
	          cargo = atoms.get(cargoHash);

	          if (!cargo) {
		            throw new AbjectMissingCargoPacket(atoms);
	          }
	      }

	      let interpreterHash = cargo ? cargo.get(NULL) : focus.get(NULL); //urg
	      if (!interpreterHash) {
	          throw new AbjectMissingInterpreterFieldError(atoms);
	      }

	      let interpreter = this.classForInterpreter(interpreterHash, focusHash);
	      if (!interpreter) {
	          throw new AbjectMissingInterpreterError(atoms, interpreterHash);
	      }

	      return interpreter.parse(atoms, focusHash, cargoHash);
    }

    /**
     * Syntactic sugar for generating symbols in this 'namespace'
     * @param seed <String>
     * @return <Symbol>
     */
    static gensym(seed) {

	      const prefix = "adotsym:/";
	      let sym = prefix;
	      if (this.interpreter) {
	          sym += this.interpreter + "/";
	      }
	      sym += seed;

	      return new Symbol(Sha256.hash(new ByteArray(Buffer.from(sym))));
    }

    /**
     * Returns an environment-specific object for this thing.
     * MUST fail if associated rigs are not correctly formed.
     *
     * MAY be asynchronous if rigs are actually checked.
     */
    view() {
        return this;
    }
}

class AbjectError extends Error {
    static verbose = false;

    constructor(abjectAtoms) {
        super();
	      if (abjectAtoms) {
	          this.abjectHash = abjectAtoms.lastAtomHash();

	          if (this.verbose) {
		            this.abjectAtoms = abjectAtoms;
	          }
	      }
    }
}

class AbjectAtomMissingError extends AbjectError {
    /**
     * @param missingHash <Hash> the missing hash
     * @param pathIfKnown <Array.<Hash>> path from root cargo to the key referencing the hash we can't follow
     */
    constructor(atoms, missingHash, pathIfKnown) {
	      super(atoms);
	      this.missingHash = missingHash;
	      this.pathIfKnown = pathIfKnown;
    }
}
class AbjectMissingInterpreterFieldError extends AbjectError {}

class AbjectMissingInterpreterError extends AbjectError {
    constructor(atoms, abjectInterpreterHash) {
	      super(atoms);
	      this.abjectInterpreterHash = abjectInterpreterHash;
    }
}

class AbjectEmptyError extends AbjectError {}
class AbjectMissingBodyPacket extends AbjectError {}
class AbjectMissingCargoPacket extends AbjectError {}


exports.Abject = Abject;
exports.AbjectError = AbjectError;
