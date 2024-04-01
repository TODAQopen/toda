import { MissingHashPacketError, Twist, TwistBuilder } from "../../src/core/twist.js";
import { ArbitraryPacket, BasicBodyPacket, BasicTwistPacket, PairTriePacket } from "../../src/core/packet.js";
import { Hash, NullHash, Sha256 } from "../../src/core/hash.js";
import { utf8ToBytes } from "../../src/core/byteUtil.js";
import assert from 'assert';
import { Atoms } from "../../src/core/atoms.js";

describe("TwistBuilder/getBodyPacket", () => {
    it("properly merges an existing packet with additional rig entries", () => {
        let x = new TwistBuilder();
        x.setRiggingPacket(PairTriePacket.createFromUnsorted(new Map([[Sha256.fromBytes(utf8ToBytes("bbq")),
                                                        Sha256.fromBytes(utf8ToBytes("bbq"))],
                                                       [Sha256.fromBytes(utf8ToBytes("bbq2")),
                                                        Sha256.fromBytes(utf8ToBytes("bbq2"))]
                                                      ])));
        x.addRigging(Sha256.fromBytes(utf8ToBytes("sauce")),
                     Sha256.fromBytes(utf8ToBytes("sauce")));
        let body = x.getBodyPacket();
        let riggingPacket = x.atoms.get(body.getRiggingHash());
        let rigging = riggingPacket.getShapedValue();
        assert.equal(rigging.size, 3);
        assert(riggingPacket.get(Sha256.fromBytes(utf8ToBytes("sauce")))
               .equals(Sha256.fromBytes(utf8ToBytes("sauce"))));
    });
});

describe("Shield function caching", async function () {
    it("Works as expected", async function () {
        const p = new ArbitraryPacket(utf8ToBytes("some shieldy shield"));
        const tb = new TwistBuilder();
        tb.setShield(p);
        const t = tb.twist();
        const h = Sha256.fromHex("4170ba33708cbfb103f1a8e34afef333ba7dc021022b2d9aaa583aabb8058d8d67");
        const s0 = t.shieldFunction(h);
        assert.ok(Twist._shieldCacheGet(t.getShieldHash(), h));
        //HACK: Super duper hack shim
        p.content = "I am clearly not bytes this should explode everything if we try to use it.";
        const s1 = t.shieldFunction(h);
        assert.ok(s0.equals(s1));
    });

    it("Shielding with the same shield on different hashes works without clobbering", async function () {
        const p = new ArbitraryPacket(utf8ToBytes("some shieldy shield 2"));
        const tb = new TwistBuilder();
        tb.setShield(p);
        const t = tb.twist();
        const h0 = Sha256.fromHex("4170ba33708cbfb103f1a8e34afef333ba7dc021022b2d9aaa583aabb8058d8d67");
        const h1 = Sha256.fromHex("4103f1a8e3ba33708cbfb19aaa583aabb8058d8d674afef333ba7dc021022b2d70");
        const s0 = t.shieldFunction(h0);
        const s1 = t.shieldFunction(h1);
        assert.ok(t.shieldFunction(h0).equals(s0));
        assert.ok(t.shieldFunction(h1).equals(s1));
        //sanity
        assert.ok(!s0.equals(s1));
    });

    it("Twists missing shield are not allowed to access the cache", async function () {
        const p = new ArbitraryPacket(utf8ToBytes("some shieldy shield"));
        const tb = new TwistBuilder();
        tb.setShield(p);
        const t = tb.twist();
        const h = Sha256.fromHex("4170ba33708cbfb103f1a8e34afef333ba7dc021022b2d9aaa583aabb8058d8d67");
        t.shieldFunction(h);

        const bp = new BasicBodyPacket(new NullHash(), 
                                       new NullHash(), 
                                       new NullHash(), 
                                       new NullHash(), 
                                       new NullHash(), 
                                       t.getShieldHash());
        const bh = Sha256.fromPacket(bp);
        const tp = new BasicTwistPacket(bh, new NullHash());
        const th = Sha256.fromPacket(tp);
        const atoms = new Atoms();
        atoms.set(bh, bp);
        atoms.set(th, tp);
        atoms.focus = th;
        const t2 = new Twist(atoms);
        assert.throws(() => t2.shieldFunction(h), MissingHashPacketError);
    });
});