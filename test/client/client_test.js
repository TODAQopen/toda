import { Abject } from "../../src/abject/abject.js";
import { SimpleHistoric } from "../../src/abject/simple-historic.js";
import { TodaClient, TodaClientV2, WaitForHitchError } from "../../src/client/client.js";
import { SECP256r1 } from "../../src/client/secp256r1.js";
import { LocalInventoryClient, VirtualInventoryClient } from "../../src/client/inventory.js";
import { Interpreter } from "../../src/core/interpret.js";
import { HashMap } from "../../src/core/map.js";
import { Twist } from "../../src/core/twist.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { Hash, Sha256 } from "../../src/core/hash.js";
import { PairTriePacket } from "../../src/core/packet.js";
import { Line } from "../../src/core/line.js";
import { MockSimpleHistoricRelay, isolateSegment } from "./mocks.js";
import assert from "assert";
import fs from "fs-extra";
import nock from "nock";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("create", async () => {

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

describe("append", async () => {
    it("should append to a twist with the correct properties", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("./files"));
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");
        toda.addSatisfier(keyPair);
        let localLine = await toda.create();

        let a = await toda.create(localLine.getHash(), keyPair);

        let externalTetherHash = Sha256.fromBytes(ByteArray.fromUtf8("foobar"));

        let b = await toda.append(a, externalTetherHash, keyPair);

        // Verify the tether has changed and a shield was set, since the tether is no longer local
        assert(b.getTetherHash().equals(externalTetherHash));
        assert.equal(b.shield().getShapedValue().length, 32);
        assert(a.getHash().equals(b.prev().getHash()));

        // Verify that although the tether has changed, the hitch exists on the
        // first line and we still control it

        let {hoist} = (await toda.getRelay(a).getHoist(a));
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

        let externalTetherHash = Sha256.fromBytes(ByteArray.fromUtf8("foobar"));

        let b = await toda.append(a, localLine.getHash(), keyPair);

        let {hoist} = (await toda.getRelay(a).getHoist(a));

        let rigging = new HashMap();
        let h0 = Sha256.fromBytes(ByteArray.fromUtf8("h0"));
        let h1 = Sha256.fromBytes(ByteArray.fromUtf8("h1"));
        let h2 = Sha256.fromBytes(ByteArray.fromUtf8("h2"));
        let h3 = Sha256.fromBytes(ByteArray.fromUtf8("h3"));
        rigging.set(h0, h1);
        rigging.set(h2, h3);

        let c = await toda.append(b, externalTetherHash, keyPair, undefined, () => { },
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

        let {hoist: expectedHoist} = await (toda.getRelay(prev).getHoist(prev));
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
            undefined, undefined, { noHoist: true }); // not strictly required
        await (toda.append(meat, tether).then(() => assert(false)).catch((e) => {
            assert(e instanceof WaitForHitchError);
        }));
    });

    it("append with remote test", async () => {
        try {
            nock.cleanAll();

            let top = new MockSimpleHistoricRelay("http://localhost:8090");
            await top.initialize();
            top.serve();

            let foot = new MockSimpleHistoricRelay(undefined, "http://localhost:8090", top.latest().getHash());
            await foot.initialize();
            await foot.append(top.latest().getHash());
            await foot.append(top.latest().getHash());
            await foot.append(top.latest().getHash());

            assert.equal(4, foot.twists().length);
            assert.ok(foot.latest().get(top.latest().getHash()));
            assert.equal("http://localhost:8090", Abject.fromTwist(foot.latest()).tetherUrl());
        } finally {
            nock.cleanAll();
        }
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

    it("append automatically updates tether where possible", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("./files"));
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");
        toda.addSatisfier(keyPair);
        let tetherLine_0 = await toda.create(Hash.fromHex("41b5c5ab593c91b676d6dbae3d561cef0180701099a580dddbf2374b23b138455"));
        let tetherLine_1 = await toda.append(tetherLine_0);
        let tetherLine_2 = await toda.append(tetherLine_1);

        let localLine_0 = await toda.create();
        localLine_0.addAtoms(tetherLine_2.getAtoms());
        let localLine_1 = await toda.append(localLine_0, tetherLine_0.getHash());

        // Even though we specified an old tether, append is smart enough to use the latest known twist of that specified line
        assert(localLine_1.getTetherHash().equals(tetherLine_2.getHash()));
    });

});

describe("finalize twist", async () => {

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

        fs.mkdirSync("/tmp/todatest/files1", { recursive: true });
        fs.mkdirSync("/tmp/todatest/files2", { recursive: true });
        fs.writeFileSync("/tmp/todatest/files1/salt", "aaaaaa");
        fs.writeFileSync("/tmp/todatest/files2/salt", "bbbbbb");

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

        assert.ifError(await toda.isSatisfiable(aNNNext) || null);
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
        try {
            nock.cleanAll();

            let top = new MockSimpleHistoricRelay("http://localhost:8090");
            await top.initialize();
            top.serve();
            await top.append();

            let mid = new MockSimpleHistoricRelay("http://localhost:8091", "http://localhost:8090");
            await mid.initialize();
            mid.serve();
            await mid.append(top.latest().getHash());
            await mid.append(top.latest().getHash());

            let foot = new MockSimpleHistoricRelay(undefined, "http://localhost:8091", top.latest().getHash());
            await foot.initialize();
            let foot0 = foot.latest();
            let foot1 = await foot.append(mid.latest().getHash());
            let foot2 = await foot.append(mid.latest().getHash());

            assert.ok(foot2.get(mid.latest().getHash()));
            assert.ok(foot2.get(top.latest().getHash()));

            let foot3 = await foot.append(mid.latest().getHash());

            assert.ok(foot3.get(mid.latest().getHash()));
            assert.ok(foot3.get(top.latest().getHash()));

            assert.equal(6, mid.twists().length);

        } finally {
            nock.cleanAll();
        }
    });

    it("Should never pull http://localhost:8094, since 8093 is the topline", async () => {
        try {
            nock.cleanAll();

            // A tethers into B (8091), into C (8092), ... into E (8094)
            let E = new MockSimpleHistoricRelay("http://localhost:8094");
            await E.initialize();
            E.serve();
            let D = new MockSimpleHistoricRelay("http://localhost:8093", "http://localhost:8094");
            await D.initialize();
            D.serve();
            let C = new MockSimpleHistoricRelay("http://localhost:8092", "http://localhost:8093");
            await C.initialize();
            C.serve();
            let B = new MockSimpleHistoricRelay("http://localhost:8091", "http://localhost:8092");
            await B.initialize();
            B.serve();
            // D is declared as A's topline
            let A = new MockSimpleHistoricRelay(undefined, "http://localhost:8091", D.latest().getHash());
            await A.initialize();
            await A.append(B.latest().getHash());

            E.clearLogs();
            D.clearLogs();
            C.clearLogs();
            B.clearLogs();

            await A.client.pull(A.latest(), A.client.defaultTopLineHash);

            // Pull pinged B, C, and D
            assert.deepEqual(["get"], B.logs.map(x => x.method));
            assert.deepEqual(["get"], C.logs.map(x => x.method));
            assert.deepEqual(["get"], D.logs.map(x => x.method));
            // Pull did NOT ping E (since D is the topline)
            assert.deepEqual([], E.logs.map(x => x.method));
        } finally {
            nock.cleanAll();
        }
    });
});

//TODO(acg): I think we require more detailed tests on when shieldPackets are
//included.

describe("Deep recursive pull tests", async () => {
    // For all of these tests, 'a' represents the footline, 'b' represents the line above, ... etc.
    it("Remote recursive pull, no loose twists", async () => {
        try {
            nock.cleanAll();

            let remote_e = new MockSimpleHistoricRelay("http://localhost:8094");
            remote_e.serve();
            await remote_e.initialize(true);
            await remote_e.append();

            let remote_d = new MockSimpleHistoricRelay("http://localhost:8093", "http://localhost:8094");
            remote_d.serve();
            await remote_d.initialize();
            await remote_d.append(remote_e.latest().getHash());
            await remote_d.append(remote_e.latest().getHash());
            await remote_d.append(remote_e.latest().getHash());

            let remote_c = new MockSimpleHistoricRelay("http://localhost:8092", "http://localhost:8093");
            remote_c.serve();
            await remote_c.initialize();
            await remote_c.append(remote_d.latest().getHash());

            let remote_b = new MockSimpleHistoricRelay("http://localhost:8091", "http://localhost:8092");
            remote_b.serve();
            await remote_b.initialize();
            await remote_b.append(remote_c.latest().getHash());

            let a = new MockSimpleHistoricRelay(undefined, "http://localhost:8091", remote_d.latest().getHash());
            await a.initialize();
            await a.append(remote_b.latest().getHash());
            await a.append(remote_b.latest().getHash());
            await a.append(remote_b.latest().getHash());

            // isolate the twists in the bottom line S.T. we can test pull in complete isolation
            let isolated_twist = new Twist(isolateSegment(a.latest(), a.first().getHash()), a.latest().getHash());

            await a.client.pull(isolated_twist, remote_d.first().getHash());
            await a.client.isCanonical(isolated_twist, remote_d.first().getHash());
        } finally {
            nock.cleanAll();
        }
    });

    // TODO(cs): This fails! Yay!
    xit("Remote recursive pull, with intermediary loose twists", async () => {
        nock.cleanAll();

        let remote_e = new MockSimpleHistoricRelay("http://localhost:8094");
        remote_e.serve();
        await remote_e.initialize();
        await remote_e.append();

        let remote_d = new MockSimpleHistoricRelay("http://localhost:8093", "http://localhost:8094");
        remote_d.serve();
        await remote_d.initialize();
        await remote_d.append(remote_e.latest().getHash());
        await remote_d.append(remote_e.latest().getHash());
        await remote_d.append(remote_e.latest().getHash());

        let remote_c = new MockSimpleHistoricRelay("http://localhost:8092", "http://localhost:8093");
        remote_c.serve();
        await remote_c.initialize();
        await remote_c.append(remote_d.latest().getHash());
        await remote_c.append();
        await remote_c.append(); // loose twists!


        let remote_b = new MockSimpleHistoricRelay("http://localhost:8091", "http://localhost:8092");
        remote_b.serve();
        await remote_b.initialize();
        await remote_b.append(remote_c.latest().getHash());
        await remote_b.append();
        await remote_b.append(); // loose twists!

        let a = new MockSimpleHistoricRelay(undefined, "http://localhost:8091", remote_d.latest().getHash());
        await a.initialize();
        await a.append(remote_b.latest().getHash());
        await a.append(remote_b.latest().getHash());
        await a.append(remote_b.latest().getHash());

        // isolate the twists in the bottom line S.T. we can test pull in complete isolation
        let isolated_twist = new Twist(isolateSegment(a.latest(), a.first().getHash()), a.latest().getHash());

        await a.client.pull(isolated_twist, remote_d.first().getHash());
        await a.client.isCanonical(isolated_twist, remote_d.first().getHash());
    });
});