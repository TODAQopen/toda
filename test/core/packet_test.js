import { ByteArray } from "../../src/core/byte-array.js";
import { Sha256 } from "../../src/core/hash.js";
import { Packet, ArbitraryPacket, HashPacket, PairTriePacket } 
    from "../../src/core/packet.js";
import assert from "assert";

describe("ArbitraryPacket", () => {
    it("can be created, serialized, parsed", () => {
        let p = Packet.parse(new ArbitraryPacket(ByteArray.fromUtf8("bbq")).toBytes());
        assert.equal(p.constructor.shapeCode, 0x60);
        ByteArray.fromUtf8("bbq").toString() === p.getShapedValue().toString();
    });
});

describe("HashPacket", () => {
    it("can be created, serialized, parsed", () => {
        let hashes = ["b","b","q"].map((x) => Sha256.fromPacket(new ArbitraryPacket(ByteArray.fromUtf8(x))));
        let p = Packet.parse(new HashPacket(hashes).toBytes());
        assert.equal(p.constructor.shapeCode, 0x61);
        let s = p.getShapedValue();
        for (let idx in hashes) {
            assert(hashes[idx].equals(s[idx]));
        }
    });
});

describe("PairTriePacket", () => {
    it("can be created, serialized, parsed", () => {
        let hashes = ["a","b","c","d"].map((x) => Sha256.fromBytes(ByteArray.fromUtf8(x)));
        let pairs = [[hashes[1], hashes[0]],
            [hashes[0], hashes[1]]];
        let p = Packet.parse(new PairTriePacket(new Map(pairs)).toBytes());
        assert.equal(p.constructor.shapeCode, 0x63);
        let s = p.getShapedValue();
        let ks = s.keys();
        assert(pairs[0][1].equals(s.get(ks.next().value)));
        assert(pairs[1][1].equals(s.get(ks.next().value)));
    });

    it("throws on incorrect order", () => {
        let hashes = ["a","b","c","d"].map((x) => Sha256.fromBytes(ByteArray.fromUtf8(x)));
        let pairs = [[hashes[0], hashes[1]],
            [hashes[1], hashes[0]]];
        assert.throws(() => new PairTriePacket(new Map(pairs)),
            { message: "SHAPE_ORDER"});
    });
});