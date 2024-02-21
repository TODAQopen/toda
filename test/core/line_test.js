import { Hash, NullHash, Sha256 } from "../../src/core/hash.js";
import { Atoms } from "../../src/core/atoms.js";
import { Twist, TwistBuilder } from "../../src/core/twist.js";
import { Line } from "../../src/core/line.js";
import { utf8ToBytes } from "../../src/core/byteUtil.js";
import { ArbitraryPacket, BasicBodyPacket, BasicTwistPacket } from "../../src/core/packet.js";
import { sbh } from "../util.js";
import assert from "assert";

function hpp(str) { // hash-packet-pair
    let p = new ArbitraryPacket(utf8ToBytes(str));
    return [Sha256.fromPacket(p), p];
}

function simpleTwist(...strings) {
    let tb = new TwistBuilder();
    tb.setFieldAtoms(sbh("atoms"), Atoms.fromPairs(strings.map(s => hpp(s))));
    return new Twist(tb.serialize());
}

function progenerate(twist, tether) {
    if (!tether) {
        return new Twist(twist.createSuccessor().serialize());
    } else {
        let tb = new TwistBuilder(twist.getAtoms());
        tb.setPrevHash(twist.getHash());
        tb.setTether(tether);
        return new Twist(tb.serialize());
    }
}

function tetherTwist(twist, tether) {
    let tb = new TwistBuilder(twist.getAtoms());
    tb.setTether(tether);
    return new Twist(tb.serialize());
}

function getPropsForTestComparison(hash) {
    // dx: in general we shouldn't touch properties directly, use methods instead
    return {offset: hash.offset, length: hash.numBytes(), stringValue: hash.toString()};
}

describe("Line/twist", () => {
    it("Sould get twist by hash", () => {
        let tw = simpleTwist("one", "two", "three");
        let line = new Line();
        line.putTwist(tw);
        assert(tw.equals(line.twist(tw.getHash())));
    });
});

describe("Line/packet", () => {
    let tw = simpleTwist("one", "two", "three");
    let line = new Line();
    line.putTwist(tw);
    let [h1,p1] = hpp("one"); assert.deepEqual(p1, line.packet(h1));
    let [h2,p2] = hpp("two"); assert.deepEqual(p2, line.packet(h2));
    let [h3,p3] = hpp("three"); assert.deepEqual(p3, line.packet(h3));
});

describe("Line/twistList", () => {
    it("Should return a list of focus twists hashes", () => {
        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        let tw2 = simpleTwist("Dave", "Eva", "Frank");
        let line = new Line();
        line.putTwist(tw1);
        line.putTwist(tw2);
        //XXX(acg): Line no longer has any concept of "multiple focuses"
        assert.deepEqual([tw2.getHash()], line.twistList());
    });
});

describe("Line/prev", () => {
    it("Should return the hash of the previous twist in line", () => {
        let line = new Line();
        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        line.putTwist(tw1);
        let tw2 = new Twist(tw1.createSuccessor().serialize());
        line.putTwist(tw2);
        assert(line.prev(tw2.getHash()).equals(tw1.getHash()));
        assert.ifError(line.prev(tw1.getHash()));
    });
});

describe("Line/first", () => {
    it("Should return the first twist in line", () => {
        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        let tw2 = new Twist(tw1.createSuccessor().serialize());
        let tw3 = new Twist(tw2.createSuccessor().serialize());
        let line = new Line();
        line.putTwist(tw1);
        line.putTwist(tw2);
        line.putTwist(tw3);
        assert(line.first(tw3.getHash()).equals(tw1.getHash()));
        assert(line.first(tw2.getHash()).equals(tw1.getHash()));
        assert(line.first(tw1.getHash()).equals(tw1.getHash()));
    });
});

describe("Line/history", () => {
    let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
    let tw2 = new Twist(tw1.createSuccessor().serialize());
    let tw3 = new Twist(tw2.createSuccessor().serialize());
    let line = new Line();
    line.putTwist(tw1);
    line.putTwist(tw2);
    line.putTwist(tw3);
    it("Should return a list of all twist hashes before and including the input one", () => {
        assert.deepEqual(line.history(tw3.getHash()).map(getPropsForTestComparison), [tw1,tw2,tw3].map(t => t.getHash()).map(getPropsForTestComparison));
        assert.deepEqual(line.history(tw2.getHash()).map(getPropsForTestComparison), [tw1,tw2].map(t => t.getHash()).map(getPropsForTestComparison));
        assert.deepEqual(line.history(tw1.getHash()).map(getPropsForTestComparison), [tw1.getHash()].map(getPropsForTestComparison));
    });
    it("Should return null if hash is not a twist in line", () => {
        assert.equal(line.history(sbh("askjankdcjnd")), null);
    });
});

describe("Line/successor", () => {
    let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
    let tw2 = new Twist(tw1.createSuccessor().serialize());
    let line = new Line();
    line.putTwist(tw1);
    line.putTwist(tw2);
    it("Should return the hash of the successor twist", () => {
        assert(line.successor(tw1.getHash()).equals(tw2.getHash()));
    });
    it("Should return nothing if there is no successor found", () => {
        assert.ifError(line.successor(tw2.getHash()));
    });
});

describe("Line/last", () => {
    let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
    let tw2 = new Twist(tw1.createSuccessor().serialize());
    let tw3 = new Twist(tw2.createSuccessor().serialize());
    let line = new Line();
    line.putTwist(tw1);
    line.putTwist(tw2);
    line.putTwist(tw3);
    it("Should return the last twist successor", () => {
        assert(line.last(tw1.getHash()).equals(tw3.getHash()));
        assert(line.last(tw2.getHash()).equals(tw3.getHash()));
    });
    it("Should return null if not successor exists", () => {
        assert.equal(line.last(tw3.getHash()), null);
    });
    it("Should not have defined behaviour for looking up a successor for an unknown hash", () => {
        assert.ifError(line.last(sbh("soemthing random this time")));
    });
});

describe("Line/successorList", () => {
    let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
    let tw2 = new Twist(tw1.createSuccessor().serialize());
    let tw3 = new Twist(tw2.createSuccessor().serialize());
    let line = new Line();
    line.putTwist(tw1);
    line.putTwist(tw2);
    line.putTwist(tw3);
    it("Should return a list of all twist hashes before and including the input one", () => {
        assert.deepEqual(line.successorList(tw1.getHash()), [tw2,tw3].map(t=>t.getHash()));
        assert.deepEqual(line.successorList(tw2.getHash()), [tw3.getHash()]);
        assert.deepEqual(line.successorList(tw3.getHash()), []);
    });
    it("Should return null if hash is not a twist in line", () => {
        assert.equal(line.successorList(sbh("askjankdcjnd")), null);
    });
});

describe("Line/lastFast", () => {
    it("Should return the undefined as the last tethered twist (none tethered)", () => {
        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        let tw2 = progenerate(tw1);
        let tw3 = progenerate(tw2);

        let line = new Line();
        line.putTwist(tw1);
        line.putTwist(tw2);
        line.putTwist(tw3);

        assert.equal(line.lastFastBeforeHash(tw1.getHash()), undefined);
        assert.equal(line.lastFastBeforeHash(tw2.getHash()), undefined);
        assert.equal(line.lastFastBeforeHash(tw3.getHash()), undefined);
    });
    it("Should return the latest tethered twist in given twist's line (tw1)", () => {
        let tether = simpleTwist("Tether", "Me", "This");

        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        tw1 = tetherTwist(tw1, tether);

        let tw2 = progenerate(tw1);
        let tw3 = progenerate(tw2);

        let line = new Line();
        line.putTwist(tether);
        line.putTwist(tw1);
        line.putTwist(tw2);
        line.putTwist(tw3);

        assert(line.lastFast(tw1.getHash()).equals(tw1.getHash()));
        assert(line.lastFast(tw2.getHash()).equals(tw1.getHash()));
        assert(line.lastFast(tw3.getHash()).equals(tw1.getHash()));
    });

    it("Should return the latest tethered twist in given twist's line (tw2)", () => {
        let tether = simpleTwist("Tether", "Me", "This");

        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        tw1 = tetherTwist(tw1, tether);

        let tw2 = progenerate(tw1, tether);
        let tw3 = progenerate(tw2);

        let line = new Line();
        line.putTwist(tether);
        line.putTwist(tw1);
        line.putTwist(tw2);
        line.putTwist(tw3);

        assert(line.lastFast(tw1.getHash()).equals(tw2.getHash()));
        assert(line.lastFast(tw2.getHash()).equals(tw2.getHash()));
        assert(line.lastFast(tw3.getHash()).equals(tw2.getHash()));
    });

    it("Should return the latest tethered twist in given twist's line (tw3)", () => {
        let tether = simpleTwist("Tether", "Me", "This");

        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        tw1 = tetherTwist(tw1, tether);

        let tw2 = progenerate(tw1, tether);
        let tw3 = progenerate(tw2, tether);

        let line = new Line();
        line.putTwist(tether);
        line.putTwist(tw1);
        line.putTwist(tw2);
        line.putTwist(tw3);

        assert(line.lastFast(tw1.getHash()).equals(tw3.getHash()));
        assert(line.lastFast(tw2.getHash()).equals(tw3.getHash()));
        assert(line.lastFast(tw3.getHash()).equals(tw3.getHash()));
    });
});

describe("Line/lastFastBeforeHash", () => {
    it("Should return the last tethered twist before given hash (none tethered)", () => {
        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        let tw2 = progenerate(tw1);
        let tw3 = progenerate(tw2);

        let line = new Line();
        line.putTwist(tw1);
        line.putTwist(tw2);
        line.putTwist(tw3);

        assert.equal(line.lastFastBeforeHash(tw1.getHash()), undefined);
        assert.equal(line.lastFastBeforeHash(tw2.getHash()), undefined);
        assert.equal(line.lastFastBeforeHash(tw3.getHash()), undefined);
    });
    it("Should return the last tethered twist before given hash (tw1)", () => {
        let tether = simpleTwist("Tether", "Me", "This");

        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        tw1 = tetherTwist(tw1, tether);

        let tw2 = progenerate(tw1);
        let tw3 = progenerate(tw2);

        let line = new Line();
        line.putTwist(tether);
        line.putTwist(tw1);
        line.putTwist(tw2);
        line.putTwist(tw3);

        assert.equal(line.lastFastBeforeHash(tw1.getHash()), undefined);
        assert(line.lastFastBeforeHash(tw2.getHash()).equals(tw1.getHash()));
        assert(line.lastFastBeforeHash(tw3.getHash()).equals(tw1.getHash()));
    });

    it("Should return the last tethered twist before given hash (tw2)", () => {
        let tether = simpleTwist("Tether", "Me", "This");

        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        tw1 = tetherTwist(tw1, tether);

        let tw2 = progenerate(tw1, tether);
        let tw3 = progenerate(tw2);

        let line = new Line();
        line.putTwist(tether);
        line.putTwist(tw1);
        line.putTwist(tw2);
        line.putTwist(tw3);

        assert.equal(line.lastFastBeforeHash(tw1.getHash()), undefined);
        assert(line.lastFastBeforeHash(tw2.getHash()).equals(tw1.getHash()));
        assert(line.lastFastBeforeHash(tw3.getHash()).equals(tw2.getHash()));
    });
    it("Should return the last tethered twist before given hash (tw3)", () => {
        let tether = simpleTwist("Tether", "Me", "This");

        let tw1 = simpleTwist("Alice", "Bob", "Charlotte");
        tw1 = tetherTwist(tw1, tether);

        let tw2 = progenerate(tw1, tether);
        let tw3 = progenerate(tw2, tether);

        let line = new Line();
        line.putTwist(tether);
        line.putTwist(tw1);
        line.putTwist(tw2);
        line.putTwist(tw3);

        assert.equal(line.lastFastBeforeHash(tw1.getHash()), undefined);
        assert(line.lastFastBeforeHash(tw2.getHash()).equals(tw1.getHash()));
        assert(line.lastFastBeforeHash(tw3.getHash()).equals(tw2.getHash()));
    });
});

describe("Colinear", async function () {
    it("Backwards ✅", async function() {
        const line = new Line();
        const t0 = simpleTwist("Alice", "Bob", "Charlotte");
        const t1 = new Twist(t0.createSuccessor().serialize());
        const t2 = new Twist(t1.createSuccessor().serialize());
        const t3 = new Twist(t2.createSuccessor().serialize());
        const t4 = new Twist(t3.createSuccessor().serialize());
        const t5 = new Twist(t4.createSuccessor().serialize());
        [t0, t1, t2, t3, t4, t5].forEach(t => line.putTwist(t));
        assert.ok(line.colinear(t2.getHash(), t5.getHash()));
    });

    it("Forwards ✅", async function() {
        const line = new Line();
        const t0 = simpleTwist("Alice", "Bob", "Charlotte");
        const t1 = new Twist(t0.createSuccessor().serialize());
        const t2 = new Twist(t1.createSuccessor().serialize());
        const t3 = new Twist(t2.createSuccessor().serialize());
        const t4 = new Twist(t3.createSuccessor().serialize());
        const t5 = new Twist(t4.createSuccessor().serialize());
        [t0, t1, t2, t3, t4, t5].forEach(t => line.putTwist(t));
        assert.ok(line.colinear(t5.getHash(), t2.getHash()));
    });

    it("Hash does not exist", async function() {
        const line = new Line();
        const t0 = simpleTwist("Alice", "Bob", "Charlotte");
        const t1 = new Twist(t0.createSuccessor().serialize());
        const t2 = new Twist(t1.createSuccessor().serialize());
        const t3 = new Twist(t2.createSuccessor().serialize());
        const t4 = new Twist(t3.createSuccessor().serialize());
        const t5 = new Twist(t4.createSuccessor().serialize());
        [t0, t1, t2, t3, t4, t5].forEach(t => line.putTwist(t));
        assert.ifError(line.colinear(Hash.fromHex("41a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"),
                                 t5.getHash()) || null);
    });

    it("Not colinear; different lines", async function() {
        const line = new Line();
        const a0 = simpleTwist("Alice", "Bob", "Charlotte");
        const a1 = new Twist(a0.createSuccessor().serialize());
        const a2 = new Twist(a1.createSuccessor().serialize());
        const a3 = new Twist(a2.createSuccessor().serialize());
        const b0 = simpleTwist("Denise", "Eliza", "Fredrico");
        const b1 = new Twist(b0.createSuccessor().serialize());
        const b2 = new Twist(b1.createSuccessor().serialize());
        const b3 = new Twist(b2.createSuccessor().serialize());
        [a0, a1, a2, a3, b0, b1, b2, b3].forEach(t => line.putTwist(t));
        assert.ifError(line.colinear(a2.getHash(),
                                 b1.getHash()) || null);
    });

    it("Same twist", async function() {
        const line = new Line();
        const t0 = simpleTwist("Alice", "Bob", "Charlotte");
        const t1 = new Twist(t0.createSuccessor().serialize());
        const t2 = new Twist(t1.createSuccessor().serialize());
        [t0, t1, t2].forEach(t => line.putTwist(t));
        assert.ok(line.colinear(t1.getHash(),
                                t1.getHash()));
    });

    it("Backwards prev missing", async function() {
        const line = new Line();
        // Ugh...
        const t0Body = new BasicBodyPacket(Hash.fromHex("41c973b83261cfc9e5ca46e4017729394d6ef61141a3ba816aa7a601f18909595b"),
                                           new NullHash(),new NullHash(),new NullHash(),new NullHash(),new NullHash());
        const t0BodyH = Sha256.fromPacket(t0Body);
        const t0Twist = new BasicTwistPacket(t0BodyH, new NullHash());
        const t0TwistH = Sha256.fromPacket(t0Twist);
        const atoms = new Atoms();
        atoms.set(t0BodyH, t0Body);
        atoms.set(t0TwistH, t0Twist);
        const t0 = new Twist(atoms, t0TwistH);
        const t1 = new Twist(t0.createSuccessor().serialize());
        const t2 = new Twist(t1.createSuccessor().serialize());
        const t3 = new Twist(t2.createSuccessor().serialize());
        const t4 = new Twist(t3.createSuccessor().serialize());
        const t5 = new Twist(t4.createSuccessor().serialize());
        [t0, t1, t2, t3, t4, t5].forEach(t => line.putTwist(t));
        assert.ifError(line.colinear(Hash.fromHex("41a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3"),
                                 t5.getHash()) || null);
    });
});