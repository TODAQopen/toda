/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const {Hash} = require("../core/hash");
const {Abject} = require("./abject");
const {Actionable} = require("./actionable");
const {HashMap} = require("../core/map");

class SimpleHistoric extends Abject {
    static interpreter = Hash.fromHex("22a79a7b8b0ee38c196cfefb263cc4a7310d801db8df332e31021267c8c30e1f7c");

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
        return this.twistHash;
    }

    getContext() {
        return this.getFieldAbject(Actionable.fieldSyms.context);
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
}

Abject.registerInterpreter(SimpleHistoric);

exports.SimpleHistoric = SimpleHistoric;
