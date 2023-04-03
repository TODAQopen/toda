/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

import { Hash } from '../core/hash.js';

import { Abject } from './abject.js';
import { Actionable } from './actionable.js';
import { HashMap } from '../core/map.js';
import { AssetClassField, DI, DIAssetClassClass } from './di.js';
import { P1String } from './primitive.js';
import { TwistBuilder } from '../core/twist.js';

//todo(mje): Presumably we need a way to set requirements on this
class SimpleHistoric extends Abject {
    static interpreter = Hash.fromHex("22a79a7b8b0ee38c196cfefb263cc4a7310d801db8df332e31021267c8c30e1f7c");

    constructor() {
        super();
        this.twistHash = null;
        this.twistBuilder = new TwistBuilder();
    }

    static fieldSyms = {
        timestamp: Hash.fromHex("22c7df9af32847a5425b1c9577fef55431732ca50889110b3e6ac9897a7e5583b4"),
        tetherUrl: Hash.fromHex("2260d93fcffc9b40a3beb1aee1e288fcabf39a46b0e8f2652812891d362c2bcc26"),
        thisUrl: Hash.fromHex("22a2ab56e06159160bc71471930b8351cdb2349d2e1558975a701cf851765d100f"),
        infoUrl: Hash.fromHex("22dfac92e85bb22a8c02afb90398b0ee159ce72c5a179b85370643950186826ce6"),
        moniker: Hash.fromHex("229f6c4ba9f5d85c850530d33e7c5482b5074a26d6849e00b7e346aa9425c6158d"),
    };

    //todo(mje): For a super quick interpretation of this line just read the di in the cargo of the last twist
    // So you can treat the whole line as one simple historic abject
    static parse(atoms, focusHash, cargoHash) {
        let x = new this();
        x.atoms = atoms;
        x.data = new HashMap(atoms.get(cargoHash).getShapedValue());
        x.twistHash = focusHash || atoms.lastAtomHash();
        return x;
    }

    //todo(mje): HACK - Temporary fix to read the focus correctly with `getHash()`
    getHash() {
        return this.twistHash ?? this.buildTwist().getHash();
    }

    serialize(hashImp) {
        return this.buildTwist().serialize(hashImp);
    }

    getContext() {
        return this.getFieldAbject(Actionable.fieldSyms.context);
    }

    setContext(abject) {
        return this.setFieldAbject(Actionable.fieldSyms.context, abject);
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
        return next;
    }

    timestamp() {
        let c = this.getContext();
        return c.getFieldAbject(SimpleHistoric.fieldSyms.timestamp);
    }

    tetherUrl() {
        let c = this.getContext();
        return c.getFieldAbject(SimpleHistoric.fieldSyms.tetherUrl);
    }

    thisUrl() {
        let c = this.getContext();
        return c.getFieldAbject(SimpleHistoric.fieldSyms.thisUrl);
    }

    infoUrl() {
        let c = this.getContext();
        return c.getFieldAbject(SimpleHistoric.fieldSyms.infoUrl);
    }

    moniker() {
        let c = this.getContext();
        return c.getFieldAbject(SimpleHistoric.fieldSyms.moniker);
    }

    set(timestamp, tetherUrl, thisUrl, infoUrl, moniker) {
        let context = new DI();
        context.setAssetClass(SimpleHistoric.AC);
        context.setFieldAbject(SimpleHistoric.AC.fieldSyms.timestamp, new P1String(timestamp));

        if (tetherUrl) {
            context.setFieldAbject(SimpleHistoric.AC.fieldSyms.tetherUrl, new P1String(tetherUrl));
        }

        if (thisUrl) {
            context.setFieldAbject(SimpleHistoric.AC.fieldSyms.thisUrl, new P1String(thisUrl));
        }

        if (infoUrl) {
            context.setFieldAbject(SimpleHistoric.AC.fieldSyms.infoUrl, new P1String(infoUrl));
        }

        if (moniker) {
            context.setFieldAbject(SimpleHistoric.AC.fieldSyms.moniker, new P1String(moniker));
        }

        this.setContext(context);
    }
}

Abject.registerInterpreter(SimpleHistoric);

let fTimestamp = new AssetClassField();
fTimestamp.consolidation = DI.consolidations.lastWriteWins;
fTimestamp.type = P1String.interpreter;
fTimestamp.required = true;

let fTetherUrl = new AssetClassField();
fTetherUrl.consolidation = DI.consolidations.lastWriteWins;
fTetherUrl.type = P1String.interpreter;

let fThisUrl = new AssetClassField();
fThisUrl.consolidation = DI.consolidations.lastWriteWins;
fThisUrl.type = P1String.interpreter;

let fInfoUrl = new AssetClassField();
fInfoUrl.consolidation = DI.consolidations.lastWriteWins;
fInfoUrl.type = P1String.interpreter;

let fMoniker = new AssetClassField();
fMoniker.consolidation = DI.consolidations.lastWriteWins;
fMoniker.type = P1String.interpreter;

SimpleHistoric.AC = new DIAssetClassClass();
SimpleHistoric.AC.fieldSyms = SimpleHistoric.fieldSyms;

SimpleHistoric.AC.addACField(SimpleHistoric.AC.fieldSyms.timestamp, fTimestamp);
SimpleHistoric.AC.addACField(SimpleHistoric.AC.fieldSyms.tetherUrl, fTetherUrl);
SimpleHistoric.AC.addACField(SimpleHistoric.AC.fieldSyms.thisUrl, fThisUrl);
SimpleHistoric.AC.addACField(SimpleHistoric.AC.fieldSyms.infoUrl, fInfoUrl);
SimpleHistoric.AC.addACField(SimpleHistoric.AC.fieldSyms.moniker, fMoniker);

export { SimpleHistoric };
