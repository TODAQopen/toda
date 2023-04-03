import { Atoms } from "../../src/core/atoms.js";
import { Sha256 } from "../../src/core/hash.js";
import { ArbitraryPacket } from "../../src/core/packet.js";
import { sbh, bafs } from "../util.js";
import assert from "assert";

function phpairFromStr(str) {
    let p = new ArbitraryPacket(bafs(str));
    return [Sha256.fromPacket(p), p];
}

describe("Atoms/set", () => {
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
