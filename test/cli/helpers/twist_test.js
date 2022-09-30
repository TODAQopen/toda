/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { Twist, TwistBuilder } = require("../../../src/core/twist");
const { ByteArray } = require("../../../src/core/byte-array");
const { create, append, setFastFields } = require("../../../src/cli/bin/helpers/twist");
const { getHoist, isValidAndControlled, getTetheredAtoms } = require("../../../src/cli/bin/helpers/rigging");
const { getAtomsFromPath, generateShield, setConfig } = require("../../../src/cli/bin/util");
const { ArbitraryPacket } = require("../../../src/core/packet");
const { NullHash, Hash, Sha256 } = require("../../../src/core/hash");
const { Actionable, SimpleRigged } = require("../../../src/abject/actionable");
const { SignatureRequirement } = require("../../../src/core/reqsat");
const { generateKey } = require("../../../src/cli/lib/pki");
const assert = require("assert");
const fs = require("fs-extra");
const path = require("path");

describe("create", () => {
    let tether = path.resolve(__dirname, "./files/cap-line.toda");
    let shield = ByteArray.fromStr("foo");
    let salt = path.resolve(__dirname, "./files/salt");

    beforeEach(() => setConfig({ line: tether, salt: salt, store: "/" }));

    it("should create a Twist with the correct properties", async () => {
        let keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" },
            true,
            ["sign", "verify"]
        );

        // Generate a local line
        let tetherTb = await create(null, null, null, keyPair.privateKey, null);
        fs.outputFileSync(tether, tetherTb.serialize().toBytes());

        let cargo = await getAtomsFromPath(path.resolve(__dirname, "./files/out4.sr.toda"));

        let req = {
            type: SignatureRequirement.REQ_SECP256r1,
            key: keyPair.publicKey
        };

        let tb = await create(shield, req, tether, keyPair.privateKey, cargo);
        let twist = new Twist(tb.serialize());

        assert(twist.tether().getHash().equals(tetherTb.getHash()));
        assert.deepEqual(twist.shield(), new ArbitraryPacket(shield));

        let key = Hash.parse(new ByteArray(Buffer.from("2208318633b506017519e9b90b0bdc8451772415ba29144ab7778cb09cc2d2fa6a", "hex")));
        let val = Hash.parse(new ByteArray(Buffer.from("41c3b37b9d9eba8478ae44e1d95f3b6de2a40db91ea9d1e7440914b66b6eb6f932", "hex")));
        assert(twist.cargo(new NullHash()).equals(SimpleRigged.interpreter));
        assert.equal(twist.get(twist.cargo(Actionable.fieldSyms.popTop)), cargo.get(Actionable.fieldSyms.popTop));
        assert.deepEqual(twist.get(twist.cargo(key)), cargo.get(val));

        let pubKeyBuffer = await crypto.subtle.exportKey("spki", req.key);
        let publicKey = new ByteArray(Buffer.from(pubKeyBuffer));
        let keyPacket = new ArbitraryPacket(publicKey);
        let keyPacketHash = SignatureRequirement.DEFAULT_HASH_IMP.fromPacket(keyPacket);
        assert(twist.reqs(SignatureRequirement.REQ_SECP256r1).equals(keyPacketHash));
    });

    it("should add a default shield to an externally tethered Twist", async () => {
        let tether = "2208318633b506017519e9b90b0bdc8451772415ba29144ab7778cb09cc2d2fa6a";
        let tb = await create(null, null, tether, null, null);
        let twist = new Twist(tb.serialize());
        let expected = new ArbitraryPacket(generateShield(new ByteArray(fs.readFileSync(salt)), null));
        assert.deepEqual(twist.shield(), expected);
    });

    it("should not add a default shield to a locally tethered Twist", async () => {
        let tb = await create(null, null, tether, null, null);
        let twist = new Twist(tb.serialize());
        assert.equal(twist.shield(), null);
    });
});

describe("append", () => {
    let tetherA = path.resolve(__dirname, "./files/cap-line.toda");
    let salt = path.resolve(__dirname, "./files/salt");

    beforeEach(() => setConfig({ line: tetherA, salt: salt, store: "/", poptop: tetherA }));

    it("should append to a twist with the correct properties", async () => {
        // Generate a local line
        let keyPair = await generateKey();
        let tbA = await create(null, null, null, keyPair.privateKey, null);
        fs.outputFileSync(tetherA, tbA.serialize().toBytes());

        let created = await create(null, null, tetherA, keyPair.privateKey, null);
        let twistA = new Twist(created.serialize());

        let tetherHash = Sha256.fromBytes(ByteArray.fromStr("foobar"));
        let appended = await append(twistA, null, null, tetherHash.toString(), keyPair.privateKey, () => {}, null);
        let twistB = new Twist(appended.serialize());

        // Verify the tether has changed and a shield was set, since the tether is no longer local
        let expectedShield = new ArbitraryPacket(generateShield(new ByteArray(fs.readFileSync(salt)), twistB.prev().getHash()));
        assert(twistB.getBody().getTetherHash().equals(tetherHash));
        assert.deepEqual(twistB.shield(), expectedShield);
        assert(ByteArray.isEqual(twistA.getHash(), twistB.prev().getHash()));

        // Verify that although the tether has changed, the hitch exists on the first line and we still control it
        let lineTwist = new Twist(await getAtomsFromPath(tetherA));
        let hitchHoist = await getHoist(twistA, tetherA);
        assert(hitchHoist.getHash().equals(lineTwist.getHash()));

        let refreshedAtoms = await getTetheredAtoms(twistB, lineTwist.getHash());
        twistB = new Twist(refreshedAtoms, twistB.getHash());

        // we can't verify the tether, we don't know what it is, so this should fail!
        await assert.rejects(
            async () => isValidAndControlled(twistB, lineTwist.getHash(), keyPair.privateKey),
            (err) => {
                assert.equal(err.exitCode, 7);
                assert.equal(err.reason, "Unable to establish local control of this file (verifying controller)");
                return true;
            });

        // Now let's sneakily update the twist without validation anyway to prove it doesn't validate
        let appended2 = await append(twistB, null, null, tetherHash.toString(), keyPair.privateKey, () => {}, null);
        let twistC = new Twist(appended2.serialize());
        await assert.rejects(
            async () => isValidAndControlled(twistC, lineTwist.getHash(), keyPair.privateKey),
            (err) => {
                assert.equal(err.exitCode, 6);
                assert.equal(err.reason, "Unable to establish local control of this file (verifying hitch line)");
                return true;
            });
    });
});

describe("setFastFields", () => {
    let tether = `${__dirname}/files/line.toda`;
    let salt = `${__dirname}/files/salt`;
    beforeEach(() => setConfig({ line: tether, salt: salt, store: "/", poptop: tether }));

    it("should set the requirements trie on the twistbuilder", async () => {
        let atoms = await getAtomsFromPath(`${__dirname}/files/test.toda`);
        let prev = new Twist(atoms);

        let tb = prev.createSuccessor();
        await setFastFields(tether, tb);
        let twist = new Twist(tb.serialize());

        let expected = await getHoist(prev, tether);
        assert.deepEqual(twist.rig(prev), expected);
    });

    it("should do nothing if the twist is not tethered or has no lead or meet", async () => {
        let atoms = await getAtomsFromPath(tether);
        let line = new Twist(atoms);

        let meetAtoms = await getAtomsFromPath(`${__dirname}/files/test.toda`);
        let meet = new Twist(meetAtoms);

        // tether, no prev
        let tbTether = new TwistBuilder();
        tbTether.setTether(line);
        await setFastFields(tether, tbTether);
        let twistTether = new Twist(tbTether.serialize());

        assert.equal(twistTether.rig(), null);

        // prev, no tether
        let tbSuccessor = meet.createSuccessor();
        await setFastFields(tether, tbSuccessor);
        let twistSuccessor = new Twist(tbSuccessor.serialize());

        assert.equal(twistSuccessor.rig(), null);
    });

    it("should do nothing if the lead has no hoist hitch", async () => {
        let atoms = await getAtomsFromPath(tether);
        let line = new Twist(atoms);

        let leadTb = new TwistBuilder();
        leadTb.setTether(line);
        let lead = new Twist(leadTb.serialize());

        let meetTb = lead.createSuccessor();
        meetTb.setTether(line);
        let meet = new Twist(meetTb.serialize());

        let tb = meet.createSuccessor();
        tb.setTether(line);
        await setFastFields(tether, tb);
        let tbTwist = new Twist(tb.serialize());

        assert.equal(tbTwist.rig(), null);
    });
});
