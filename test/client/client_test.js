/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { TodaClient, WaitForHitchError } = require("../../src/client/client");
const { SECP256r1 } = require("../../src/client/secp256r1");
const { LocalInventoryClient } = require("../../src/client/inventory");

const { ByteArray } = require("../../src/core/byte-array");
const { Hash, Sha256 } = require("../../src/core/hash");

const { Line } = require("../../src/core/line");

const assert = require("assert");
const fs = require("fs-extra");
const path = require("path");

describe("create", () => {

    it("should create a Twist with the correct properties", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("./files"));
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");
        toda.addSatisfier(keyPair);

        let tether = Hash.fromHex("2208318633b506017519e9b90b0bdc8451772415ba29144ab7778cb09cc2d2fa6a");

        // FIXME(acg): delete this function
        //let cargo = await getAtomsFromPath(path.resolve(__dirname, "./files/out4.sr.toda"));
        let twist = await toda.create(tether, keyPair); //, cargo);

        assert(twist.getTetherHash().equals(tether));
        assert.equal(twist.shield().getShapedValue().length, 32);
        assert.equal(twist.reqs().shapedVal.size, 1);

        //let key = Hash.parse(new ByteArray(Buffer.from("2208318633b506017519e9b90b0bdc8451772415ba29144ab7778cb09cc2d2fa6a", "hex")));
        //let val = Hash.parse(new ByteArray(Buffer.from("41c3b37b9d9eba8478ae44e1d95f3b6de2a40db91ea9d1e7440914b66b6eb6f932", "hex")));
        //assert(twist.cargo(new NullHash()).equals(SimpleRigged.interpreter));
        //assert.equal(twist.get(twist.cargo(Actionable.fieldSyms.popTop)), cargo.get(Actionable.fieldSyms.popTop));
        //assert.deepEqual(twist.get(twist.cargo(key)), cargo.get(val));

    });

    it("should not add a default shield to a locally tethered Twist", async () => {
        let toda = new TodaClient(new LocalInventoryClient("./files"));
        let localLine = await toda.create();
        let t = await toda.create(localLine.getHash());
        assert.equal(t.shield(), null);
    });
});

describe("append", () => {

    it("should append to a twist with the correct properties", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("./files"));
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");
        toda.addSatisfier(keyPair);
        let localLine = await toda.create();

        let a = await toda.create(localLine.getHash(), keyPair);

        let externalTetherHash = Sha256.fromBytes(ByteArray.fromStr("foobar"));

        let b = await toda.append(a, externalTetherHash, keyPair);

        // Verify the tether has changed and a shield was set, since the tether is no longer local
        assert(b.getTetherHash().equals(externalTetherHash));
        assert.equal(b.shield().getShapedValue().length, 32);
        assert(a.getHash().equals(b.prev().getHash()));

        // Verify that although the tether has changed, the hitch exists on the
        // first line and we still control it

        let hoist = (await toda.getRelay(a).getHoist(a));
        let latestLocal = Line.fromAtoms(toda.inv.get(localLine.getHash()));
        assert(hoist.getHash().equals(latestLocal.latestTwist()));
    });


        // TODO(acg): Not sure what's up with the below.

        /*

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
            */

    it("should hoist", async () => {
        let toda = new TodaClient(new LocalInventoryClient(`${__dirname}/files`));
        //toda.defaultRelayPath = `${__dirname}/files/line.toda`;
        let prev = toda.getExplicitPath(`${__dirname}/files/test.toda`);
        let next = await toda.append(prev);

        let expectedHoist = await (toda.getRelay(prev).getHoist(prev));
        assert.deepEqual(next.rig(prev), expectedHoist);
    });


    it("should 'do nothing' if the twist is not tethered or has no lead or meet", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient(`${__dirname}/files`));
        toda.addSatisfier(keyPair);
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");

        let tether = await toda.create(Hash.fromHex("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280"));
        assert.equal(tether.rig(), null);

        let prev = await toda.create();
        //let prev = toda.getExplicitPath(`${__dirname}/files/test.toda`);
        let next = await toda.append(prev, tether.getHash());
        assert.equal(next.rig(), null);

    });

    it("should ERROR if the lead has no hoist hitch", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient(`${__dirname}/files`));
        toda.addSatisfier(keyPair);
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");

        //let line = await toda.create(Hash.fromHex("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280"));
        let tether = Hash.fromHex("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf299");
        let lead = await toda.create(tether);
        let meat = await toda.append(lead, tether, undefined, undefined,
                                     undefined, undefined, { noHoist: true} ); // not strictly required
        await (toda.append(meat, tether).then(() => assert(false)).catch((e) => {
            assert(e instanceof WaitForHitchError);
        }));
    });


});
