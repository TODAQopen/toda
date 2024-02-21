import { Atoms } from "../../src/core/atoms.js";
import { Sha256 } from "../../src/core/hash.js";
import { ArbitraryPacket } from "../../src/core/packet.js";
import { utf8ToBytes } from "../../src/core/byteUtil.js";
import assert from "assert";

function pairFromStr(str) {
    let p = new ArbitraryPacket(utf8ToBytes(str));
    return [Sha256.fromPacket(p), p];
}

describe("Basic Atoms operations", () => {
    let atoms = new Atoms();
    let pairs = ['one', 'two', 'three'].map(pairFromStr);

    it("Should set hash-packet pairs", () => {
        atoms.set(...pairs[0]);
        atoms.set(...pairs[1]);
        atoms.set(...pairs[2]);
    });

    it("Should get those packets back", () => {
        assert.equal(JSON.stringify(pairs[0][1]), JSON.stringify(atoms.get(pairs[0][0])));
        assert.equal(JSON.stringify(pairs[1][1]), JSON.stringify(atoms.get(pairs[1][0])));
        assert.equal(JSON.stringify(pairs[2][1]), JSON.stringify(atoms.get(pairs[2][0])));
    });

    it("Should return the original pairs", () => {
        assert.equal(JSON.stringify(pairs), JSON.stringify(atoms.toPairs()));
    });

    it("Should convert Atoms to bytes and back", () => {
        assert.equal(JSON.stringify(atoms.toPairs()), JSON.stringify(Atoms.fromBytes(atoms.toBytes()).toPairs()));
    });
});


describe("Fancy Atoms operations", () => {
    let a1, a2, a3, a4;

    it("Should make atoms from pairs", () => {
        let pairs = ['one', 'two', 'three'].map(pairFromStr);
        a1 = Atoms.fromPairs(pairs);
        assert.equal(JSON.stringify(a1.toPairs()), JSON.stringify(pairs));
    });

    it("Should make atoms from atoms", () => {
        let pairs = ['four', 'five', 'six'].map(pairFromStr);
        let atoms = Atoms.fromPairs(pairs);
        a2 = Atoms.fromAtoms(atoms);
        assert.equal(JSON.stringify(a2.toPairs()), JSON.stringify(atoms.toPairs()));
    });

    it("Should merge atoms", () => {
        a3 = new Atoms();
        a3.merge(a1);
        assert.equal(JSON.stringify(a3.toPairs()), JSON.stringify(a1.toPairs()));
    });

    it("Should merge more atoms", () => {
        a3.merge(a2);
        assert.equal(JSON.stringify(a3.toPairs()), JSON.stringify(a1.toPairs().concat(a2.toPairs())));
    });

    it("Should dedupe atoms", () => {
        a4 = Atoms.fromAtoms(a1, a2, a3);
        assert.equal(JSON.stringify(a4.toPairs()), JSON.stringify(a1.toPairs().concat(a2.toPairs())));
    });

    it("Should convert Atoms to bytes and back", () => {
        assert.equal(JSON.stringify(a3.toPairs()), JSON.stringify(Atoms.fromBytes(a3.toBytes()).toPairs()));
    });
});