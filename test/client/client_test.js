import { Abject } from "../../src/abject/abject.js";
import { SimpleHistoric } from "../../src/abject/simple-historic.js";
import { TodaClient, WaitForHitchError } from "../../src/client/client.js";
import { SECP256r1 } from "../../src/client/secp256r1.js";
import { LocalInventoryClient, VirtualInventoryClient } from "../../src/client/inventory.js";
import { Interpreter } from "../../src/core/interpret.js";
import { HashMap } from "../../src/core/map.js";
import { Atoms } from "../../src/core/atoms.js";
import { Twist } from "../../src/core/twist.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { Hash, Sha256 } from "../../src/core/hash.js";
import { PairTriePacket } from "../../src/core/packet.js";
import { Line } from "../../src/core/line.js";
import { MockSimpleHistoricRelay, isolateTwist } from "./mocks.js";
import assert from "assert";
import fs from "fs-extra";
import nock from "nock";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

        //let key = Hash.fromHex("2208318633b506017519e9b90b0bdc8451772415ba29144ab7778cb09cc2d2fa6a");
        //let val = Hash.fromHex("41c3b37b9d9eba8478ae44e1d95f3b6de2a40db91ea9d1e7440914b66b6eb6f932");
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

     it("should append to a twist with the specified rigging and make a post", async () => {
         let keyPair = await SECP256r1.generate();
         let toda = new TodaClient(new LocalInventoryClient("./files"));
         toda.shieldSalt = path.resolve(__dirname, "./files/salt");
         toda.addSatisfier(keyPair);
         let localLine = await toda.create();

         let a = await toda.create(localLine.getHash(), keyPair);

         let externalTetherHash = Sha256.fromBytes(ByteArray.fromStr("foobar"));

         let b = await toda.append(a, localLine.getHash(), keyPair);

         let hoist = (await toda.getRelay(a).getHoist(a));

         let rigging = new HashMap();
         let h0 = Sha256.fromBytes(ByteArray.fromStr("h0"));
         let h1 = Sha256.fromBytes(ByteArray.fromStr("h1"));
         let h2 = Sha256.fromBytes(ByteArray.fromStr("h2"));
         let h3 = Sha256.fromBytes(ByteArray.fromStr("h3"));
         rigging.set(h0, h1);
         rigging.set(h2, h3);

         let c = await toda.append(b, externalTetherHash, keyPair, undefined, () => {},
                                   new PairTriePacket(rigging));

         assert(h1.equals(c.rig(h0)));
         assert(h3.equals(c.rig(h2)));
         assert(hoist.getHash().equals(c.rig(a.getHash())));
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

    it("append with remote test", async () => {
        let top = new MockSimpleHistoricRelay("http://localhost:8090", "http://localhost:notactuallyreal");
        await top.initialize();
        nock.cleanAll();
        top.nockEndpoints("http://localhost:8090");

        let footKp = await SECP256r1.generate();
        let foot = new TodaClient(new LocalInventoryClient(`${__dirname}/files`));
        foot.shieldSalt = path.resolve(__dirname, "./files/salt");
        foot.addSatisfier(footKp);
        foot.defaultTopLineHash = top.latest().getHash();

        let foot0_abj = new SimpleHistoric();
        let foot0 = await foot.finalizeTwist(foot0_abj.buildTwist(), undefined, footKp);
        let foot1_abj = foot0_abj.createSuccessor();
        foot1_abj.set(new Date().toISOString(), "http://localhost:8090");
        let foot1 = await foot.finalizeTwist(foot1_abj.buildTwist(), top.latest().getHash(), footKp);
        let foot2_abj = foot1_abj.createSuccessor();
        foot2_abj.set(new Date().toISOString(), "http://localhost:8090");
        let foot2 = await foot.finalizeTwist(foot2_abj.buildTwist(), top.latest().getHash(), footKp);
        let foot3_abj = foot2_abj.createSuccessor();
        foot3_abj.set(new Date().toISOString(), "http://localhost:8090");
        let foot3 = await foot.finalizeTwist(foot3_abj.buildTwist(), top.latest().getHash(), footKp);

        assert.ok(foot3);
        assert.ok(foot3.get(top.latest().getHash()));
        assert.equal("http://localhost:8090", Abject.fromTwist(foot3).tetherUrl());
    });

    it("should have valid req + sats", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("./files"));
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");
        toda.addSatisfier(keyPair);

        let t0 = await toda.create(undefined, keyPair);
        let t1 = await toda.append(t0, undefined, keyPair);

        let line = new Line();
        line.addAtoms(t1.getAtoms());
        let i = new Interpreter(line, undefined);
        await i.verifyReqSat(SECP256r1.requirementTypeHash, t0, t1);
    });

});

describe("finalize twist", () => {

    it("should correctly make a successor to the first abject", async () => {
        let toda = new TodaClient(new VirtualInventoryClient());
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");

        let a0 = new SimpleHistoric();
        let tb0 = a0.buildTwist();
        let t0 = await toda.finalizeTwist(tb0);
        let tether = Hash.fromHex("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf299");
        let tb1 = a0.createSuccessor().buildTwist();
        let t1 = await toda.finalizeTwist(tb1, tether);

        assert.ok(t0.getHash().equals(t1.prev().getHash()));
        assert.ok(tether.equals(t1.getTetherHash()));
        assert.ok(Abject.fromTwist(t1));
        assert.ok(Abject.fromTwist(t1) instanceof SimpleHistoric);
    });

    it("test simple historic fields properly populated", async () => {
        let toda = new TodaClient(new VirtualInventoryClient());
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");

        let timestamp = new Date().toISOString();
        let thisUrl = "http://www.myspace.com";

        let a0 = new SimpleHistoric();
        a0.set(timestamp, undefined, thisUrl);
        let t0 = await toda.finalizeTwist(a0.buildTwist());
        let tether = Hash.fromHex("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf299");
        let a1 = Abject.fromTwist(t0).createSuccessor();
        a1.set(timestamp, undefined, thisUrl);
        let tb1 = a1.buildTwist();
        let t1 = await toda.finalizeTwist(tb1, tether);

        assert.equal(timestamp, Abject.fromTwist(t0).timestamp());
        assert.equal(thisUrl, Abject.fromTwist(t0).thisUrl());
        assert.equal(timestamp, Abject.fromTwist(t1).timestamp());
        assert.equal(thisUrl, Abject.fromTwist(t1).thisUrl());
    });
});


describe("pull should include all required info", async () => {
    it("send to remote and back", async () => {

        fs.mkdirSync("/tmp/todatest/files1", {recursive:true});
        fs.mkdirSync("/tmp/todatest/files2", {recursive:true});
        fs.writeFileSync("/tmp/todatest/files1/salt","aaaaaa");
        fs.writeFileSync("/tmp/todatest/files2/salt","bbbbbb");

        // set up a local address
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("/tmp/todatest/files1"));
        toda.shieldSalt = "/tmp/todatest/files1/salt";
        toda.addSatisfier(keyPair);
        let localLine = await toda.create(null, keyPair);
        let localLineNext = await toda.append(localLine, null, keyPair);

        // set up a "remote" address
        let keyPair2 = await SECP256r1.generate();
        let toda2 = new TodaClient(new LocalInventoryClient("/tmp/todatest/files2"));
        toda2.shieldSalt = "/tmp/todatest/files2/salt";
        toda2.addSatisfier(keyPair2);
        let remoteLine = await toda2.create(null, keyPair2);
        let remoteLineNext = await toda2.append(remoteLine, null, keyPair2);

        // create a test file controlled by local
        let a = await toda.create(localLineNext.getHash());
        // append a second fast twist with same tether, causing a hitch.
        let aNext = await toda.append(a, localLineNext.getHash());
        assert(await toda.isSatisfiable(aNext));

        // append a third fast twist, because why not
        let aNNext = await toda.append(aNext, localLineNext.getHash());
        assert(await toda.isSatisfiable(aNNext));

        // xfer it to the original twist in the remote.
        let aNNNext = await toda.append(aNNext, remoteLine.getHash());
        toda2.inv.put(aNNNext.getAtoms());

        assert(! (await toda.isSatisfiable(aNNNext)));
        assert(await toda2.isSatisfiable(aNNNext));

        // append another fast twist, causing a hitch, requiring previous (local) hoist info
        let b = await toda2.append(aNNNext, remoteLineNext.getHash());
        assert(await toda2.isSatisfiable(b));

        //...

        //TODO(acg): do a variant of this which includes canonicity, and which
        //also demonstrates how forks fail.

    });
});

describe("Multi-remote pull test", () => {
        it("Should be able to recursively reach up to the topline", async () => {
            nock.cleanAll();

            let top = new MockSimpleHistoricRelay("http://localhost:8090");
            await top.initialize();
            top.nockEndpoints("http://localhost:8090");

            let mid = new MockSimpleHistoricRelay("http://localhost:8091", "http://localhost:8090");
            await mid.initialize();
            mid.nockEndpoints("http://localhost:8091");

            let footKp = await SECP256r1.generate();
            let foot = new TodaClient(new LocalInventoryClient(`${__dirname}/files`));
            foot.shieldSalt = path.resolve(__dirname, "./files/salt");
            foot.addSatisfier(footKp);
            foot.defaultTopLineHash = top.latest().getHash();

            await top.append();
            await mid.append(top.latest().getHash());
            await mid.append(top.latest().getHash());

            let foot0_abj = new SimpleHistoric();
            let foot0 = await foot.finalizeTwist(foot0_abj.buildTwist(), undefined, footKp);
            let foot1_abj = Abject.fromTwist(foot0).createSuccessor();
            foot1_abj.set(new Date().toISOString(), "http://localhost:8091");
            let foot1 = await foot.finalizeTwist(foot1_abj.buildTwist(), mid.latest().getHash(), footKp);
            let foot2_abj = Abject.fromTwist(foot1).createSuccessor();
            foot2_abj.set(new Date().toISOString(), "http://localhost:8091");
            let foot2 = await foot.finalizeTwist(foot2_abj.buildTwist(), mid.latest().getHash(), footKp);
            let foot3_abj = Abject.fromTwist(foot2).createSuccessor();
            foot3_abj.set(new Date().toISOString(), "http://localhost:8091");
            let foot3 = await foot.finalizeTwist(foot3_abj.buildTwist(), mid.latest().getHash(), footKp);

            assert.ok(foot3.get(mid.latest().getHash()));
            assert.ok(foot3.get(top.latest().getHash()));

            let foot4_abj = Abject.fromTwist(foot3).createSuccessor();
            foot4_abj.set(new Date().toISOString(), "http://localhost:8091");
            let foot4 = await foot.finalizeTwist(foot4_abj.buildTwist(), mid.latest().getHash(), footKp);

            assert.ok(foot4.get(mid.latest().getHash()));
            assert.ok(foot4.get(top.latest().getHash()));

            // NOTE: Sorry this test gets a bit much after this; need to double check 'start-hash'
            //        behaviour and it's 5pm on the last work day of the year so I don't want to
            //        figure out a better place for this to live
            // TODO: Move somewhere else? Separate test maybe? Not sure.

            // Test the uri requests called
            let midGetRequests = mid.logs.filter(r => r.method === "get");

            assert.equal(3, midGetRequests.length);
            assert.equal("/", midGetRequests[0].uri);
            assert.equal("/?start-hash=" + mid.twists()[3].getHash(), midGetRequests[1].uri);
            assert.equal("/?start-hash=" + mid.twists()[4].getHash(), midGetRequests[2].uri);

            // Double check that the mocked server provided the expected outputs
            let atomsFromMidGet0 = Atoms.fromBytes(midGetRequests[0].response);
            assert.ok(atomsFromMidGet0.get(mid.twists()[0].getHash()));
            assert.ok(atomsFromMidGet0.get(mid.twists()[1].getHash()));
            assert.ok(atomsFromMidGet0.get(mid.twists()[2].getHash()));
            assert.ok(atomsFromMidGet0.get(mid.twists()[3].getHash()));
            // not made yet
            assert.ok(!atomsFromMidGet0.get(mid.twists()[4].getHash()));
            assert.ok(!atomsFromMidGet0.get(mid.twists()[5].getHash()));

            let atomsFromMidGet1 = Atoms.fromBytes(midGetRequests[1].response);
            assert.ok(!atomsFromMidGet1.get(mid.twists()[0].getHash()));
            assert.ok(!atomsFromMidGet1.get(mid.twists()[1].getHash()));
            assert.ok(!atomsFromMidGet1.get(mid.twists()[2].getHash()));
            // asked for [3] and after
            assert.ok(atomsFromMidGet1.get(mid.twists()[3].getHash()));
            assert.ok(atomsFromMidGet1.get(mid.twists()[4].getHash()));
            // not made yet
            assert.ok(!atomsFromMidGet1.get(mid.twists()[5].getHash()));

            let atomsFromMidGet2 = Atoms.fromBytes(midGetRequests[2].response);
            assert.ok(!atomsFromMidGet2.get(mid.twists()[0].getHash()));
            assert.ok(!atomsFromMidGet2.get(mid.twists()[1].getHash()));
            assert.ok(!atomsFromMidGet2.get(mid.twists()[2].getHash()));
            assert.ok(!atomsFromMidGet2.get(mid.twists()[3].getHash()));
            // asked for [4] and after
            assert.ok(atomsFromMidGet2.get(mid.twists()[4].getHash()));
            assert.ok(atomsFromMidGet2.get(mid.twists()[5].getHash()));
        });

    it("Should never pull http://localhost:8092, since 8091 is the topline", async () => {
        nock.cleanAll();

        // foot tethers into A (8090), into B (8091), into C (8092)
        let C_abj = new SimpleHistoric();
        C_abj.set(new Date().toISOString(), "http://localhost:8093", "http://localhost:8092");
        let C = C_abj.buildTwist().twist();

        let B_abj = new SimpleHistoric();
        B_abj.set(new Date().toISOString(), "http://localhost:8092", "http://localhost:8091");
        B_abj.buildTwist().setTetherHash(C.getHash());
        let B = B_abj.buildTwist().twist();

        let A_abj = new SimpleHistoric();
        A_abj.set(new Date().toISOString(), "http://localhost:8091", "http://localhost:8090");
        A_abj.buildTwist().setTetherHash(B.getHash());
        let A = A_abj.buildTwist().twist();

        let foot0_abj = new SimpleHistoric();
        foot0_abj.set(new Date().toISOString(), "http://localhost:8090");
        foot0_abj.buildTwist().setTetherHash(A.getHash());
        let foot0 = foot0_abj.buildTwist().twist();

        let foot1_abj = Abject.fromTwist(foot0).createSuccessor();
        foot1_abj.set(new Date().toISOString(), "http://localhost:8090");
        foot1_abj.buildTwist().setTetherHash(A.getHash());
        let foot1 = foot1_abj.buildTwist().twist();

        let requestTracker = [];
        nock("http://localhost:8092")
            .persist()
            .get("/")
            .reply(200, () => { requestTracker.push(8092);
                                return Buffer.from(C.getAtoms().toBytes()); });

        nock("http://localhost:8091")
            .persist()
            .get("/")
            .reply(200, () => { requestTracker.push(8091);
                                return Buffer.from(B.getAtoms().toBytes()); });

        nock("http://localhost:8090")
            .persist()
            .get("/")
            .reply(200, () => { requestTracker.push(8090);
                                return Buffer.from(A.getAtoms().toBytes()); });

        let client = new TodaClient(new LocalInventoryClient(`${__dirname}/files`));
        client.defaultTopLineHash = B.getHash();
        await client.pull(foot1, B.getHash());
        assert.deepEqual([8090, 8091], requestTracker);
    });
});

//TODO(acg): I think we require more detailed tests on when shieldPackets are
//included.

describe("Deep recursive pull tests", async() => {
    // For all of these tests, 'a' represents the footline, 'b' represents the line above, ... etc.
    it("Remote recursive pull, no loose twists", async() =>
        {
            nock.cleanAll();

            let remote_e = new MockSimpleHistoricRelay("http://localhost:8094");
            remote_e.nockEndpoints("http://localhost:8094");
            await remote_e.initialize();
            await remote_e.append();

            let remote_d = new MockSimpleHistoricRelay("http://localhost:8093", "http://localhost:8094");
            remote_d.nockEndpoints("http://localhost:8093");
            await remote_d.initialize();
            await remote_d.append(remote_e.latest().getHash());
            await remote_d.append(remote_e.latest().getHash());
            await remote_d.append(remote_e.latest().getHash());

            let remote_c = new MockSimpleHistoricRelay("http://localhost:8092", "http://localhost:8093");
            remote_c.nockEndpoints("http://localhost:8092");
            await remote_c.initialize();
            await remote_c.append(remote_d.latest().getHash());

            let remote_b = new MockSimpleHistoricRelay("http://localhost:8091", "http://localhost:8092");
            remote_b.nockEndpoints("http://localhost:8091");
            await remote_b.initialize();
            await remote_b.append(remote_c.latest().getHash());

            let aKp = await SECP256r1.generate();
            let a = new TodaClient(new LocalInventoryClient(`${__dirname}/files`));
            a.shieldSalt = path.resolve(__dirname, "./files/salt");
            a.addSatisfier(aKp);
            a.defaultTopLineHash = remote_d.latest().getHash();

            let a0_abj = new SimpleHistoric();
            a0_abj.set(new Date().toISOString(), "http://localhost:8091");
            let a0 = await a.finalizeTwist(a0_abj.buildTwist(), remote_b.latest().getHash(), aKp);

            let a1_abj = Abject.fromTwist(a0).createSuccessor();
            a1_abj.set(new Date().toISOString(), "http://localhost:8091");
            let a1 = await a.finalizeTwist(a1_abj.buildTwist(), remote_b.latest().getHash(), aKp);

            let a2_abj = Abject.fromTwist(a1).createSuccessor();
            a2_abj.set(new Date().toISOString(), "http://localhost:8091");
            let a2 = await a.finalizeTwist(a2_abj.buildTwist(), remote_b.latest().getHash(), aKp);

            await a.isCanonical(a2, remote_d.first().getHash());

            // isolate the twists in the bottom line S.T. we can test pull in complete isolation
            let a0_isolated = isolateTwist(a0);
            let a1_isolated = isolateTwist(a1);
            let a2_isolated = isolateTwist(a2);
            a2_isolated = new Atoms([...a0_isolated, ...a1_isolated, ...a2_isolated]);
            let a2_isolated_twist = new Twist(a2_isolated, a2.getHash());

            await a.pull(a2_isolated_twist, remote_d.first().getHash());
            await a.isCanonical(a2_isolated_twist, remote_d.first().getHash());
        });

    it("Remote recursive pull works even if intermediary line has loose twist at end", async() =>
        {
            nock.cleanAll();

            let remote_e = new MockSimpleHistoricRelay("http://localhost:8094");
            remote_e.nockEndpoints("http://localhost:8094");
            await remote_e.initialize();
            await remote_e.append();

            let remote_d = new MockSimpleHistoricRelay("http://localhost:8093", "http://localhost:8094");
            remote_d.nockEndpoints("http://localhost:8093");
            await remote_d.initialize();
            await remote_d.append(remote_e.latest().getHash());
            await remote_d.append(remote_e.latest().getHash());
            await remote_d.append(remote_e.latest().getHash());

            let remote_c = new MockSimpleHistoricRelay("http://localhost:8092", "http://localhost:8093");
            remote_c.nockEndpoints("http://localhost:8092");
            await remote_c.initialize();
            await remote_c.append(remote_d.latest().getHash());

            let remote_b = new MockSimpleHistoricRelay("http://localhost:8091", "http://localhost:8092");
            remote_b.nockEndpoints("http://localhost:8091");
            await remote_b.initialize();
            await remote_b.append(remote_c.latest().getHash());

            let aKp = await SECP256r1.generate();
            let a = new TodaClient(new LocalInventoryClient(`${__dirname}/files`));
            a.shieldSalt = path.resolve(__dirname, "./files/salt");
            a.addSatisfier(aKp);
            a.defaultTopLineHash = remote_d.latest().getHash();

            let a0_abj = new SimpleHistoric();
            a0_abj.set(new Date().toISOString(), "http://localhost:8091");
            let a0 = await a.finalizeTwist(a0_abj.buildTwist(), remote_b.latest().getHash(), aKp);

            let a1_abj = Abject.fromTwist(a0).createSuccessor();
            a1_abj.set(new Date().toISOString(), "http://localhost:8091");
            let a1 = await a.finalizeTwist(a1_abj.buildTwist(), remote_b.latest().getHash(), aKp);

            let a2_abj = Abject.fromTwist(a1).createSuccessor();
            a2_abj.set(new Date().toISOString(), "http://localhost:8091");
            let a2 = await a.finalizeTwist(a2_abj.buildTwist(), remote_b.latest().getHash(), aKp);

            // Add a loose twist to the end for spice
            await remote_c.append();

            // isolate the twists in the bottom line S.T. we can test pull in complete isolation
            let a0_isolated = isolateTwist(a0);
            let a1_isolated = isolateTwist(a1);
            let a2_isolated = isolateTwist(a2);
            a2_isolated = new Atoms([...a0_isolated, ...a1_isolated, ...a2_isolated]);
            let a2_isolated_twist = new Twist(a2_isolated, a2.getHash());

            await a.pull(a2_isolated_twist, remote_d.first().getHash());
            await a.isCanonical(a2_isolated_twist, remote_d.first().getHash());
        });

    it("Remote recursive pull, with intermediary loose twists", async() =>
        {
            nock.cleanAll();

            let remote_e = new MockSimpleHistoricRelay("http://localhost:8094");
            remote_e.nockEndpoints("http://localhost:8094");
            await remote_e.initialize();
            await remote_e.append();

            let remote_d = new MockSimpleHistoricRelay("http://localhost:8093", "http://localhost:8094");
            remote_d.nockEndpoints("http://localhost:8093");
            await remote_d.initialize();
            await remote_d.append(remote_e.latest().getHash());
            await remote_d.append(remote_e.latest().getHash());
            await remote_d.append(remote_e.latest().getHash());

            let remote_c = new MockSimpleHistoricRelay("http://localhost:8092", "http://localhost:8093");
            remote_c.nockEndpoints("http://localhost:8092");
            await remote_c.initialize();
            await remote_c.append(remote_d.latest().getHash());
            await remote_c.append(remote_d.latest().getHash());
            await remote_c.append();
            await remote_c.append(); // A couple of loose twists for added spice

            let remote_b = new MockSimpleHistoricRelay("http://localhost:8091", "http://localhost:8092");
            remote_b.nockEndpoints("http://localhost:8091");
            await remote_b.initialize();
            await remote_b.append(remote_c.latest().getHash());
            await remote_b.append(remote_c.latest().getHash());
            await remote_b.append();
            await remote_b.append(); // A couple of loose twists for added spice

            let aKp = await SECP256r1.generate();
            let a = new TodaClient(new LocalInventoryClient(`${__dirname}/files`));
            a.shieldSalt = path.resolve(__dirname, "./files/salt");
            a.addSatisfier(aKp);
            a.defaultTopLineHash = remote_d.first().getHash();

            let a0_abj = new SimpleHistoric();
            a0_abj.set(new Date().toISOString(), "http://localhost:8091");
            let a0 = await a.finalizeTwist(a0_abj.buildTwist(), remote_b.latest().getHash(), aKp);

            let a1_abj = Abject.fromTwist(a0).createSuccessor();
            a1_abj.set(new Date().toISOString(), "http://localhost:8091");
            let a1 = await a.finalizeTwist(a1_abj.buildTwist(), remote_b.latest().getHash(), aKp);

            let a2_abj = Abject.fromTwist(a1).createSuccessor();
            a2_abj.set(new Date().toISOString(), "http://localhost:8091");
            let a2 = await a.finalizeTwist(a2_abj.buildTwist(), remote_b.latest().getHash(), aKp);

            await a.isCanonical(a2, remote_d.first().getHash());

            // isolate the twists in the bottom line S.T. we can test pull in complete isolation
            let a0_isolated = isolateTwist(a0);
            let a1_isolated = isolateTwist(a1);
            let a2_isolated = isolateTwist(a2);
            a2_isolated = new Atoms([...a0_isolated, ...a1_isolated, ...a2_isolated]);
            let a2_isolated_twist = new Twist(a2_isolated, a2.getHash());

            await a.pull(a2_isolated_twist, remote_d.first().getHash());
            await a.isCanonical(a2_isolated_twist, remote_d.first().getHash());
        });
});