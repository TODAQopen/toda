/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { ByteArray } from '../core/byte-array.js';

import { Hash } from '../core/hash.js';
import { Packet, PairTriePacket } from '../core/packet.js';
import { HashMap } from '../core/map.js';
import { Atoms } from '../core/atoms.js';
import { Abject, AbjectError } from './abject.js';
import { P1String, P1Float, P1Date, P1Boolean } from './primitive.js';

class DI extends Abject {

    static interpreter = this.gensym("/interpreters/di-static");

    static fieldSyms = {
        assetClass: this.gensym("field/asset-class"),

        ACfields: Hash.parse(new ByteArray(Buffer.from("22d29913f7eb9b76f0a1227d0b34465b7adf2236452e20734197e40da790f1f00d","hex"))),
        ACFieldrequired: Hash.parse(new ByteArray(Buffer.from("22410489d7e5b4d32f75888c24eb20765342e670fc2616969cbb1fd06e3d3324d5","hex"))),
        ACFieldtype: Hash.parse(new ByteArray(Buffer.from("22dba83636eaa2a14b9cc219669a4f82b7fe6d08cdd4318b5bfa37d51d47a9bf4f","hex"))),
        ACFieldlist: Hash.parse(new ByteArray(Buffer.from("2299980d10e44dff83b24b80472098e40ff5fee15d70a3a5d2cfac5c47311929f5","hex"))),
        ACFieldconsolidation: Hash.parse(new ByteArray(Buffer.from("225c499de98d731839873cd66e4d84532e53162328c377d1b7fc057630d03f0436","hex")))

    };

    static consolidations = {
        append: Hash.parse(new ByteArray(Buffer.from("2295df977c3405f37820d6b03f54785c35beba127da5cc3d5ec442206d54656376","hex"))),
        remove: Hash.parse(new ByteArray(Buffer.from("2238cb2d3d05737963c33c391a99b06a3db6d24bbfdc18a00f595d7ab0c386c6e7","hex"))),
        lastWriteWins: Hash.parse(new ByteArray(Buffer.from("221d98c3cedd4c0ff12458b2e22d270fcf6f45ca8ffaf64dd8eca957599d3ff562","hex"))),
        firstWriteWins: Hash.parse(new ByteArray(Buffer.from("222276108951a0926d11418a8446b01051177d720227ec2a10bd57c1b4e261f4f3","hex")))
    };

    /**
     * Returns a list of (hashes) of fields
     * @returns <Array.<Hash>> typically NoFollow?
     */
    listAllFields() {
        let dat = this.data.clone();
        dat.delete(Abject.NULL);
        dat.delete(DI.fieldSyms.assetClass);
        return [...dat.keys()];
    }

    /** @return <Symbol?> */
    getAssetClassHash() {
        return this.getFieldHash(DI.fieldSyms.assetClass);
    }

    /**
     * @return <DIAssetClassClass>
     */
    getAssetClass() {
        return DIAssetClassClass.parse(this.atoms, this.getAssetClassHash());
    }

    setAssetClass(ac) {
        let atoms = ac.serialize(this.preferredHashImp);
        this.addAtoms(atoms);
        this.setAssetClassHash(ac.getHash());
    }

    setAssetClassHash(acHash) {
        this.setFieldHash(DI.fieldSyms.assetClass, acHash);
    }

    /**
   * Assumes primary atom is last.
   */
    static parse(atoms, focusHash, cargoHash) {
        focusHash = focusHash || atoms.lastAtomHash();

        if (cargoHash && !cargoHash.equals(focusHash)) {
            throw new AbjectIllegalTwistError(atoms, this.interpreter);
        }
        let dat = atoms.get(focusHash);
        let assetClassHash = dat.get(DI.fieldSyms.assetClass);
        let cls = DI;
        if (assetClassHash.equals(DI.fieldSyms.assetClass)) {
            cls = DIAssetClassClass;
        }
        let x = new cls();
        x.data = new HashMap(atoms.get(focusHash).getShapedValue()); // does htis work?
        x.atoms = atoms;
        return x;
    }

    // FIXME(acg): SECURITY SECURITY these field definitions must all be the same
    /**
     * @param dis Array.<DI>
     * @returns <DI>
     */
    static consolidate(dis) {
        if (dis.length == 0) {
            return [];
        }
        let consol = dis[0];
        let ach = consol.getAssetClass().getHash();

        for (let di of dis.slice(1)) {
            let ac = di.getAssetClass();
            if (!ac.getHash().equals(ach)) {
                throw new Error("cannot consolidate across different asset classes");
            }
            for (let field of ac.getFieldHashes()) {
                let fieldDefinition = ac.getFieldDefinition(field);

                let val = di.getFieldAbject(field);
                if (val) {
                    if (consol.data.get(field)) {
                        consol.setFieldMagic( //hack
                            field,
                            fieldDefinition.consolidate(consol.getFieldAbject(field), val));
                    }
                }
            }
            // need to merge supporting atoms too.
            consol.addAtoms(di.atoms);
        }

        // slightly a hack to deal with returning 'append' values as
        // lists even where theres only one value:
        if (dis.length == 1) {
            let ac = consol.getAssetClass();
            for (let field of ac.getFieldHashes()) {
                let fieldDefinition = ac.getFieldDefinition(field);

                let val = consol.getFieldAbject(field);
                if (val) {
                    if (consol.data.get(field)) {
                        consol.setFieldMagic( //hack
                            field,
                            fieldDefinition.consolidate(val, null));
                    }
                }
            }

        }

        return consol;
    }

    static classForInterpreter(interpreterHash, objectHash) {
        if (objectHash.equals(DI.fieldSyms.assetClass)) {
            return DIAssetClassClass;
        }
        return super.classForInterpreter(interpreterHash);
    }

    static abjectify(value) {
        if (typeof value == "string") {
            return new P1String(value);
        }
        if (typeof value == "number") {
            return new P1Float(value);
        }
        if (value instanceof Date) {
            return new P1Date(value);
        }
        return value;
    }

    setFieldMagic(field, value) {
        // for when things *really* get out of control.
        if (value instanceof Hash) {
            return this.setFieldHash(field, value);
        }
        if (value instanceof Packet) {
            return this.setField(field, value);
        }
        if (value instanceof Array) {
            return this.setFieldAbjects(field, value.map(DI.abjectify));
        }
        return this.setFieldAbject(field, DI.abjectify(value));
    }
}

class AssetClassField {

    consolidate(fOrig, fNext) {

        // honestly could just do these as subclasses
        if (this.consolidation && this.consolidation.equals(DI.consolidations.remove)) {
            if (!this.list) {
                throw new AbjectError(); // explode.
            }
            if (fNext) {
                let newList = [];
                for (let x of fOrig) {
                    let broke = false;
                    for (let y of fNext) {
                        if (x == y || (x.equals && x.equals(y))) {
                            broke = true;
                            break;
                        }
                    }
                    if (!broke) {
                        newList.push(x);
                    }
                }
                return newList;
            } else {
                return fOrig;
            }
        }
        if (this.consolidation && this.consolidation.equals(DI.consolidations.firstWriteWins)) {
            return fOrig || fNext;
        }
        if (this.consolidation && this.consolidation.equals(DI.consolidations.lastWriteWins)) {
            return fNext || fOrig;
        }

        // Default to append.
        let append = [];
        if (fOrig) {
            append.push(fOrig);
        }
        if (fNext) {
            append.push(fNext);
        }
        return append;
    }

    /**
     * @return <Atoms>
     */
    serialize(hashImp) {
        let atoms = new Atoms();
        let data = new HashMap();

        //urg
        if (this.required !== undefined) {
            let required = new P1Boolean(this.required).serialize(hashImp);
            atoms = required;
            data.set(DI.fieldSyms.ACFieldrequired, required.lastAtomHash());
        }
        if (this.type !== undefined) {
            data.set(DI.fieldSyms.ACFieldtype, this.type);
        }
        if (this.list !== undefined) {
            let list = new P1Boolean(this.list).serialize(hashImp);
            atoms = new Atoms([...atoms, ...list]);
            data.set(DI.fieldSyms.ACFieldlist, list.lastAtomHash());
        }
        if (this.consolidation !== undefined) {
            data.set(DI.fieldSyms.ACFieldconsolidation, this.consolidation);
        }

        //urg - dupliates stuff from Abject
        let packet = PairTriePacket.createFromUnsorted(data);
        atoms.set(hashImp.fromPacket(packet),packet);
        return atoms;
    }

    /**
     * @param focusHash hash of the field definition to get
     */
    static parse(atoms, focusHash) {
        let f = new this();
        let packet = atoms.get(focusHash);

        let required = packet.get(DI.fieldSyms.ACFieldrequired);
        if (required) {
            f.required = Abject.parse(atoms, required);
        }

        let type = packet.get(DI.fieldSyms.ACFieldtype);
        if (type) {
            f.type = type;
        }

        let list = packet.get(DI.fieldSyms.ACFieldlist);
        if (list) {
            f.list = Abject.parse(atoms, list);
        }

        let acfc = packet.get(DI.fieldSyms.ACFieldconsolidation);
        if (acfc) { // symbol
            // TODO: check if supported consol type
            f.consolidation = acfc;
        }

        return f;
    }
}

class DIAssetClassClass extends DI {

    constructor() {
        super();
        this.setAssetClassHash(DI.fieldSyms.assetClass);
    }

    getFieldHashes() {
        let fields = this.getField(DI.fieldSyms.ACfields);
        return fields ? fields.getContainedKeyHashes() : [];
    }

    getFieldDefinition(fieldHash) {
        return AssetClassField.parse(this.atoms, this.getField(DI.fieldSyms.ACfields).get(fieldHash));
    }

    addACField(fieldSym, fieldSpec) {
        let atoms = fieldSpec.serialize(this.preferredHashImp);
        let fieldSpecHash = atoms.lastAtomHash();
        let fields = this.getField(DI.fieldSyms.ACfields);
        if (!fields) {
            fields = new PairTriePacket(new Map());
        }
        fields = fields.set(fieldSym, fieldSpecHash);
        this.addAtoms(atoms);
        this.setField(DI.fieldSyms.ACfields, fields);
    }


}


class AbjectIllegalTwistError extends AbjectError {
    constructor(atoms, interpreter) {
        super(atoms);
        this.interpreter = interpreter;
    }
}


let EmptyAssetClass = new DIAssetClassClass();
//let DIAssetClass = new DIAssetClassClass();

Abject.registerInterpreter(DI);

export { DI };
export { AssetClassField };
export { DIAssetClassClass };
