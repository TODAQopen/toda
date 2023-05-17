/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Hash } from '../core/hash.js';

import { HashMap } from '../core/map.js';
import { Abject } from './abject.js';
import { Interpreter } from '../core/interpret.js';
import { ByteArray } from '../core/byte-array.js';
import { PairTriePacket } from '../core/packet.js';
import { Twist, TwistBuilder } from '../core/twist.js';
import { Line } from '../core/line.js';

class Actionable extends Abject {

    static fieldSyms = {
        popTop: Hash.fromHex("22c70173874680c58e5c1d32854bd10486aac6f1aa821b56e3d512fd72e45ac72e"),
        context : Actionable.gensym("field/context")
    };

    constructor() {
        super();
        this.twistHash = null;
        this.twistBuilder = new TwistBuilder();
    }

    getHash() {
        // this value is set if we have parsed a thing.
        if (this.twistHash) {
            return this.twistHash;
        }
        // otherwise we calculate it on-the-fly as a builder... not going to be quick:
        return this.buildTwist().getHash();
    }

    popTop() {
        return this.first().getFieldHash(Actionable.fieldSyms.popTop);
    }

    setPopTop(topHash) {
        if (!this.isFirst()) {
            throw new Error("cannot set poptop on non-first twist");
        }
        this.setFieldHash(Actionable.fieldSyms.popTop, topHash);
    }

    buildTwist() {
        this.twistBuilder.atoms.merge(this.atoms);
        this.twistBuilder.data.merge(this.data);
        return this.twistBuilder;
    }

    createSuccessor() {
        let next = new this.constructor();
        next.twistBuilder.setPrevHash(this.getHash());
        next.addAtoms(this.serialize());
        next.setInterpreter(this.constructor.interpreter);
        return next;
    }

    // These may be factored out into a twisty mixin or something:
    static parse(atoms, focusHash, cargoHash) {
        let x = new this();
        x.atoms = atoms;
        x.data = new HashMap(atoms.get(cargoHash).getShapedValue()); // does htis work?
        x.twistHash = focusHash || atoms.lastAtomHash();
        return x;
    }

    prevHash() {
        if (this.twistHash) {
            return new Twist(this.atoms, this.twistHash).body.getPrevHash();
        }
        return this.twistBuilder.prevHash;
    }

    prev() {
        let prevHash = this.prevHash();
        if (prevHash && !prevHash.isNull()) {
            return this.getAbject(prevHash);
        }
        return null;
    }

    isFirst() {
        return !this.prevHash() || this.prevHash().isNull();
    }

    first() {
        if (this.isFirst()) {
            return this;
        }

        let p = this.prev();
        return p.first();
    }

    serialize(hashImp) {
        if (this.twistHash) {

            // This is pretty dangerous and in general you shouldn't be
            // serializing something that already exists... did you change a
            // twist or something?!

            // Will fail if you've changed things in an already existing thing.

            // But it's sorta used in the rig checker, so, fine.

            return this.atoms;
        }

        return this.buildTwist().serialize(hashImp);
    }

    // xxx(acg): is this ever used?
    cargo() {
        return PairTriePacket.createFromUnsorted(this.data);
    }

    checkPoptop() {
        let line = Line.fromAtoms(this.serialize(this.preferredHashImp));
        let i = new Interpreter(line, this.popTop());
        return i.verifyTopline();
    }

    checkRig() {
        let line = Line.fromAtoms(this.serialize(this.preferredHashImp));
        let i = new Interpreter(line, this.popTop());
        return i.verifyHitchLine(this.getHash());
    }

    getContext() {
        return this.getFieldAbject(Actionable.fieldSyms.context);
    }

    setContext(abject, hashImp) {
        return this.setFieldAbject(Actionable.fieldSyms.context, abject, hashImp);
    }

    // Returns the timestamp of the abject's poptop hitch
    getPoptopTimestamp() {
        let atoms = this.serialize();
        let pt = new Twist(atoms, this.popTop());

        //todo(mje): This could become a performance bottleneck, let's find a way to optimize
        let interpreter = new Interpreter(Line.fromAtoms(atoms), pt.first().getHash());
        let hitch = interpreter.getToplineHitch(this.getHash());
        if (hitch) {
            return this.getAbject(hitch.getHash()).timestamp();
        }
    }
}

class DelegableActionable extends Actionable {
    static fieldSyms = {
        delegateInitiate: Hash.fromHex("22251dbe656f28f8fd46de35a13c1d74921cb73c1c198800b77eb2417f09435a82"),
        delegateConfirm: Hash.fromHex("2246de612f227162a3d60819c45d88ba2d88d74aa86d64f865bf371be5ec8c52f0"),
        delegateComplete: Hash.fromHex("229b2a6d33408bc08d1af4ec63f0fb8e627d6e3b4d3f208e90390c3d8df789de34"),
    };

    createDelegate() {
        let d = new this.constructor();
        d.addAtoms(this.serialize());
        d.setInterpreter(this.constructor.interpreter);
        d.setFieldHash(DelegableActionable.fieldSyms.delegateInitiate,
            this.getHash(this.preferredHashImp));
        return d;
    }

    // XXX(acg): *overwrites* confirmation entry. do not call multiple times for same twist
    confirmDelegate(d) {
        this.confirmDelegates([d]);
    }

    // XXX(acg): *overwrites* confirmation entry, and leaves a dangling atom. do
    // not call twice for same twist
    confirmDelegates(ds) {
        this.setFieldAbjects(DelegableActionable.fieldSyms.delegateConfirm, ds);
    }

    completeDelegate(parent) {
        this.setFieldAbject(DelegableActionable.fieldSyms.delegateComplete, parent);
    }

    // all delegates confirmed in *this* twist
    confirmedDelegates() {
        return this.getFieldAbject(DelegableActionable.fieldSyms.delegateConfirm);
    }

    /**
     * @returns <DelegableActionable?>
     */
    delegateInitiate() {
        return this.first().getFieldAbject(DelegableActionable.fieldSyms.delegateInitiate);
    }

    /**
     * @returns <DelegableActionable?>
     */
    delegateComplete() {
        let dc = this.getFieldAbject(DelegableActionable.fieldSyms.delegateComplete);
        if (dc) {
            return dc;
        }
        let prev = this.prev();
        if (prev) {
            return prev.delegateComplete();
        }
        return null;
    }

    /**
     * @returns <DelegableActionable?>
     */
    delegateOf() {
        let dc = this.delegateComplete();
        if (dc) {
            // expects a list (HashPacket)
            let confirm = dc.getField(DelegableActionable.fieldSyms.delegateConfirm);
            if (!confirm) {
                return null;
            }
            let thisHash = this.first().getHash();
            for (let hash of confirm.shapedVal) {
                // maybe push this into the packet class?
                if (hash.equals(thisHash)) {
                    return dc;
                }
            }
        }
        return null;
    }


    // all immediate child delegates confirmed by this line, to this point.
    allConfirmedDelegates() {
        if (this.isFirst()) {
            return [];
        }
        return this.prev().allConfirmedDelegates().concat(this.confirmedDelegates());
    }

    /**
     * @returns <Hash?>
     */
    popTop() {
        let di = this.delegateInitiate();
        if (di) {
            return di.popTop();
        }
        return super.popTop();
    }

    /**
     * @return <Array.<DelegableActionable>>
     */
    delegationChain() {
        if (!this.delegateInitiate()) {
            return [this];
        }
        if (!this.delegateOf()) {
            return [this]; //xxx(acg): maybe throw something instead of silent
        }
        return [...this.delegateOf().delegationChain(), this];
    }

    async checkAllRigs() {
        await this.checkPoptop();
        let chain = this.delegationChain();
        for (let di of chain) {
            await di.checkRig();
        }
    }

    root() {
        return this.delegationChain()[0].first();
    }

    rootId() {
        return this.root().getHash();
    }

    rootContext() {
        return this.root().getContext();
    }
}

class SimpleRigged extends Actionable {
    static interpreter = Hash.fromHex("224a77394f604847ace4358961d501d95c19ec9b9572ee877368a274411daf01fb");

}

Abject.registerInterpreter(SimpleRigged);
export { Actionable };
export { SimpleRigged };
export { DelegableActionable };
