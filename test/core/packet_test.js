/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const {ByteArray} = require("../../src/core/byte-array");
const {Sha256} = require("../../src/core/hash");
const {beq} = require("../util");
const {Packet,
    ArbitraryPacket,
    HashPacket,
    PairTriePacket} = require("../../src/core/packet");
const assert = require("assert");

describe("ArbitraryPacket", () => {
    it("can be created, serialized, parsed", () => {
        let p = Packet.parse(new ArbitraryPacket(ByteArray.fromStr("bbq")).serialize());
        assert.equal(p.constructor.shapeCode, 0x60);
        beq(p.getShapedValue(), ByteArray.fromStr("bbq"));
    });
});

describe("HashPacket", () => {
    it("can be created, serialized, parsed", () => {
        let hashes = ["b","b","q"].map((x) => Sha256.fromPacket(new ArbitraryPacket(ByteArray.fromStr(x))));
        let p = Packet.parse(new HashPacket(hashes).serialize());
        assert.equal(p.constructor.shapeCode, 0x61);
        let s = p.getShapedValue();
        for (let idx in hashes) {
            assert(hashes[idx].equals(s[idx]));
        }
    });
});

describe("PairTriePacket", () => {
    it("can be created, serialized, parsed", () => {
        let hashes = ["a","b","c","d"].map((x) => Sha256.fromBytes(ByteArray.fromStr(x)));
        let pairs = [[hashes[1], hashes[0]],
            [hashes[0], hashes[1]]];
        let p = Packet.parse(new PairTriePacket(new Map(pairs)).serialize());
        assert.equal(p.constructor.shapeCode, 0x63);
        let s = p.getShapedValue();
        let ks = s.keys();
        assert(pairs[0][1].equals(s.get(ks.next().value)));
        assert(pairs[1][1].equals(s.get(ks.next().value)));
    });

    it("throws on incorrect order", () => {
        let hashes = ["a","b","c","d"].map((x) => Sha256.fromBytes(ByteArray.fromStr(x)));
        let pairs = [[hashes[0], hashes[1]],
            [hashes[1], hashes[0]]];
        assert.throws(() => new PairTriePacket(new Map(pairs)),
            { message: "SHAPE_ORDER"});
    });
});
