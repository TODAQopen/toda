/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const assert = require("assert");
const { Atoms } = require("../../src/core/atoms");
const { Sha256 } = require("../../src/core/hash");
const { ArbitraryPacket } = require("../../src/core/packet");
const { sbh, bafs } = require("../util");

function phpairFromStr(str) {
    let p = new ArbitraryPacket(bafs(str));
    return [Sha256.fromPacket(p), p];
}

describe("Atoms/set", () => {
    it("Should throw if hash-packet pair doesn't verify", () => {
        assert.throws(() => {
            new Atoms([[sbh("1"), new ArbitraryPacket(bafs("one"))]]);
        });
        assert.throws(() => {
            let atoms = new Atoms();
            atoms.set(sbh("hello"), new ArbitraryPacket(bafs("goodbye")));
        });
    });
    it("Should set hash-packet pairs", () => {
        let atoms = new Atoms();
        atoms.set(...phpairFromStr("one"));
        atoms.set(...phpairFromStr("two"));
        atoms.set(...phpairFromStr("three"));
    });
});

describe("Atoms/fromBytes", () => {
    it("Should convert Atoms to bytes and back", () => {
        let atoms = new Atoms([
            phpairFromStr("one"),
            phpairFromStr("two"),
            phpairFromStr("three")
        ]);
        assert.deepEqual(atoms, Atoms.fromBytes(atoms.toBytes()));
    });
});
