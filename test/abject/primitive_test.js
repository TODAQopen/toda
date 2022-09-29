/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const {Primitive, P1String, P1Float, P1Date, P1Boolean} = require("../../src/abject/primitive");
const {Abject} = require("../../src/abject/abject");
const {Sha256} = require("../../src/core/hash");
const assert = require("assert");

// TODO(acg): A lot of edge-testing with various AbjectErrors, etc.

describe("P1String", () => {
    it("can be created", () => {
        let p1s = new P1String("introduction to the calculus of variations");
        let atoms = p1s.serialize(Sha256);
        assert.equal(atoms.size, 2);

        // we expect two atoms.  One containing the raw utf8 string
        // above, and one containing a trie with [x] entries: the
        // interpreter, and a reference to the string packet.

        // XX(acg): these are more testing Abject internals:
        let keys = [...atoms.keys()];
        let triePacket = atoms.get(keys[1]).getShapedValue();
        assert.equal(triePacket.get(Abject.NULL), P1String.interpreter);
        assert.equal(triePacket.get(Primitive.fieldSyms.value), keys[0]);
        assert.equal(triePacket.size, 2);

        assert.equal(Buffer.from(atoms.get(keys[0]).getShapedValue()).toString(),
            "introduction to the calculus of variations");
    });

    it("can be read", () => {
        let p1s = new P1String("introduction to the calculus of variations");
        let atoms = p1s.serialize(Sha256);
        assert.equal(Abject.parse(atoms), "introduction to the calculus of variations");

    });
});

describe("P1Float", () => {

    it("integers work", () => {
        let p1n = new P1Float(42);
        let atoms = p1n.serialize(Sha256);
        assert.equal(atoms.size, 2);

        // we expect two atoms.  One containing the raw ieee num
        // above, and one containing a trie with [x] entries: the
        // interpreter, and a reference to the num packet

        // XX(acg): these are more testing Abject internals:
        let keys = [...atoms.keys()];
        let triePacket = atoms.get(keys[1]).getShapedValue();
        assert.equal(triePacket.get(Abject.NULL), P1Float.interpreter);
        assert.equal(triePacket.get(Primitive.fieldSyms.value), keys[0]);
        assert.equal(triePacket.size, 2);

        assert.equal(Abject.parse(atoms), 42);

        atoms = new P1Float(-42).serialize(Sha256);
        assert.equal(Abject.parse(atoms), -42);

    });

    it("handles floats", () => {
        let atoms = new P1Float(3.14159/3).serialize(Sha256);
        assert.equal(Abject.parse(atoms), 3.14159/3);

        atoms = new P1Float(6.023e-23).serialize(Sha256);
        assert.equal(Abject.parse(atoms), 6.023e-23);
    });

});

describe("P1Date", () => {

    it("dates work", () => {
        let now = new Date();
        let p1d = new P1Date(now);
        let atoms = p1d.serialize(Sha256);
        assert.equal(atoms.size, 2);

        assert.equal(Abject.parse(atoms).getTime(), now.getTime());
    });

});

describe("P1Boolean", () => {

    it("bools work", () => {
        let atoms = new P1Boolean(true).serialize(Sha256);
        assert.equal(atoms.size, 2);
        assert.equal(Abject.parse(atoms), true);

        atoms = new P1Boolean(false).serialize(Sha256);
        assert.equal(atoms.size, 2);
        assert.equal(Abject.parse(atoms), false);
    });

});
