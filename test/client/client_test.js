import { TodaClient, WaitForHitchError } from "../../src/client/client.js";
import { LocalInventoryClient } from "../../src/client/inventory.js";
import { v4 as uuid } from "uuid";
import { uuidCargo } from "../util.js";
import { Interpreter } from "../../src/core/interpret.js";
import { utf8ToBytes } from "../../src/core/byteUtil.js";
import { Line } from "../../src/core/line.js";
import assert from "assert";
import { Hash, Sha256 } from "../../src/core/hash.js";
import { TwistBuilder } from "../../src/core/twist.js";
import { SimpleHistoric } from "../../src/abject/simple-historic.js";
import { RemoteRelayClient, LocalRelayClient }
    from "../../src/client/relay.js";
import { TestRelayServer } from "./relay_server.js";
import { SECP256r1 } from "../../src/client/secp256r1.js";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { HashMap } from "../../src/core/map.js";
import { PairTriePacket } from "../../src/core/packet.js";
import { Abject } from "../../src/abject/abject.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("create", async () => {
    it("should create a Twist with the correct properties", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await toda.populateInventory();
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");
        toda.addSatisfier(keyPair);

        let tether = Hash.fromHex("2208318633b506017519e9b90b0bdc8451772415ba29144ab7778cb09cc2d2fa6a");

        let twist = await toda.create(tether, keyPair); //, cargo);

        assert(twist.getTetherHash().equals(tether));
        assert.equal(twist.shield().getShapedValue().length, 32);
        assert.equal(twist.reqs().shapedVal.size, 1);
    });

    it("should not add a default shield to a locally tethered Twist", async () => {
        let toda = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await toda.populateInventory();
        let localLine = await toda.create();
        let t = await toda.create(localLine.getHash());
        assert.equal(t.shield(), null);
    });
});

describe("append", async () => {
    it("should append to a twist with the correct properties", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await toda.populateInventory();
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");
        toda.addSatisfier(keyPair);
        let localLine = await toda.create();

        let a = await toda.create(localLine.getHash(), keyPair);

        let externalTetherHash = Sha256.fromBytes(utf8ToBytes("foobar"));

        let b = await toda.append(a, externalTetherHash, keyPair);

        // Verify the tether has changed and a shield was set, since the tether is no longer local
        assert(b.getTetherHash().equals(externalTetherHash));
        assert.equal(b.shield().getShapedValue().length, 32);
        assert(a.getHash().equals(b.prev().getHash()));

        // Verify that although the tether has changed, the hitch exists on the
        // first line and we still control it

        let {hoist} = (await toda.getRelay(a).getHoist(a));
        let latestLocal = Line.fromAtoms(await toda.inv.get(localLine.getHash()));
        assert(hoist.getHash().equals(latestLocal.latestTwist()));
    });

    it("should append to a twist with the specified rigging and make a post", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await toda.populateInventory();
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");
        toda.addSatisfier(keyPair);
        let localLine = await toda.create();

        let a = await toda.create(localLine.getHash(), keyPair);

        let externalTetherHash = Sha256.fromBytes(utf8ToBytes("foobar"));

        let b = await toda.append(a, localLine.getHash(), keyPair);

        let {hoist} = (await toda.getRelay(a).getHoist(a));

        let rigging = new HashMap();
        let h0 = Sha256.fromBytes(utf8ToBytes("h0"));
        let h1 = Sha256.fromBytes(utf8ToBytes("h1"));
        let h2 = Sha256.fromBytes(utf8ToBytes("h2"));
        let h3 = Sha256.fromBytes(utf8ToBytes("h3"));
        rigging.set(h0, h1);
        rigging.set(h2, h3);

        let c = await toda.append(b, externalTetherHash, keyPair, undefined, () => { },
            new PairTriePacket(rigging));

        assert(h1.equals(c.rig(h0)));
        assert(h3.equals(c.rig(h2)));
        assert(hoist.getHash().equals(c.rig(a.getHash())));
    });

    it("should hoist", async () => {
        let toda = new TodaClient(new LocalInventoryClient(`${__dirname}/files`, false));
        await toda.populateInventory();
        let prev = await toda.getExplicitPath(`${__dirname}/files/4151a40bde66fc10e07b1cef4668811f68c570658ead8bb192098cacb55171bd29.toda`);
        let next = await toda.append(prev);

        let {hoist: expectedHoist} = await (toda.getRelay(prev).getHoist(prev));
        assert.deepEqual(next.rig(prev), expectedHoist);
    });

    it("should 'do nothing' if the twist is not tethered or has no lead or meet", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient(`${__dirname}/files`, false));
        await toda.populateInventory();
        toda.addSatisfier(keyPair);
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");

        let tether = await toda.create(Hash.fromHex("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280"));
        assert.equal(tether.rig(), null);

        let prev = await toda.create();
        let next = await toda.append(prev, tether.getHash());
        assert.equal(next.rig(), null);
    });

    it("should ERROR if the lead has no hoist hitch", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient(`${__dirname}/files`, false));
        await toda.populateInventory();
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

    it("should have valid req + sats", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await toda.populateInventory();
        toda.shieldSalt = path.resolve(__dirname, "./files/salt");
        toda.addSatisfier(keyPair);

        let t0 = await toda.create(undefined, keyPair);
        let t1 = await toda.append(t0, undefined, keyPair);

        let line = new Line();
        line.addAtoms(t1.getAtoms());
        let i = new Interpreter(line, undefined);
        i._verifyLegit(t0, t1);
        await i.verifyCollectedReqSats();
    });

    it("append local test", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        const toda = new TodaClient(inv, "http://localhost:1234");
        await toda.populateInventory();
        toda._getSalt = () => utf8ToBytes("some salty");
        const t0 = await toda.create(null, null, uuidCargo());
        toda.defaultTopLineHash = t0.getHash();
        const f0 = await toda.create(t0.getHash());
        const f1 = await toda.append(f0, t0.getHash());
        const f2 = await toda.append(f1, t0.getHash());
        const f3 = await toda.append(f2, t0.getHash());
        const f4 = await toda.append(f3, t0.getHash());

        const i = new Interpreter(Line.fromTwist(f4), t0.getHash());
        await i.verifyHitchLine(f4.getHash());

    });

    it("append stacked local test", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        const toda = new TodaClient(inv, "http://localhost:1234");
        await toda.populateInventory();
        toda._getSalt = () => utf8ToBytes("some salty");
        const t0 = await toda.create(null, null, uuidCargo());
        toda.defaultTopLineHash = t0.getHash();
        const m0 = await toda.create(t0.getHash());
        const f0 = await toda.create(m0.getHash());
        const f1 = await toda.append(f0, m0.getHash());
        const f2 = await toda.append(f1, m0.getHash());
        const f3 = await toda.append(f2, m0.getHash());
        const f4 = await toda.append(f3, m0.getHash());

        const i = new Interpreter(Line.fromTwist(f4), t0.getHash());
        await i.verifyHitchLine(f4.getHash());
    });

    it("append with remote test", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        const top = new TodaClient(inv, "http://localhost:1234");
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, { port: 8090 }).start();
        try {
            const t0 = await top.create(null, null, uuidCargo());
            const foot = new TodaClient(
                new LocalInventoryClient("./files/" + uuid()),
                "http://localhost:8090/files");
            await foot.populateInventory();
            foot._getSalt = () => utf8ToBytes("some salty2");
            foot.defaultRelayHash = t0.getHash();
            foot.defaultRelayUrl = "http://localhost:8090/hoist";
            foot.defaultTopLineHash = t0.getHash();

            const f0 = await foot.create(t0.getHash());
            const f1 = await foot.append(f0, t0.getHash());
            const f2 = await foot.append(f1, t0.getHash());
            const f3 = await foot.append(f2, t0.getHash());
            const f4 = await foot.append(f3, t0.getHash());

            const i = new Interpreter(Line.fromTwist(f4), t0.getHash());
            await i.verifyHitchLine(f4.getHash());
        } finally {
            topRelay.stop();
        }
    });

    it("append with remote test: no hoist saved; rehoist mechanism rehoists", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        const top = new TodaClient(inv, "http://localhost:1234");
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, { port: 8090 }).start();
        try {
            const t0 = await top.create(null, null, uuidCargo());
            const foot = new TodaClient(
                new LocalInventoryClient("./files/" + uuid()),
                "http://localhost:8090/files");
            await foot.populateInventory();
            foot._getSalt = () => utf8ToBytes("some salty2");
            foot.defaultRelayHash = t0.getHash();
            foot.defaultRelayUrl = "http://localhost:8090/hoist";
            foot.defaultTopLineHash = t0.getHash();

            const f0 = await foot.create(t0.getHash());
            const f1 = await foot.append(f0, t0.getHash());
            const f2 = await foot.append(f1, t0.getHash());
            // Prevent the next twist from hoisting
            topRelay.shims.hoist = () => 204;
            const f3 = await foot.append(f2, t0.getHash());
            // Reenable hoisting; should be able to rehoist and continue
            topRelay.shims.hoist = null;
            const f4 = await foot.append(f3, t0.getHash());

            const i = new Interpreter(Line.fromTwist(f4), t0.getHash());
            await i.verifyHitchLine(f4.getHash());
        } finally {
            topRelay.stop();
        }
    });

    it("append stacked remote test", async () => {
        const top = new TodaClient(new LocalInventoryClient("./files/" + uuid()), "http://localhost:1234");
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, { port: 8090 }).start();

        const mid = new TodaClient(new LocalInventoryClient("./files/" + uuid()), "http://localhost:8090/files");
        await mid.populateInventory();
        mid._getSalt = () => utf8ToBytes("some salty2");
        const midRelay = await new TestRelayServer(mid, { port: 8091, fileServerRedirects: ["http://localhost:8090/files"] }).start();
        try {
            const t0 = await top.create(null, null, uuidCargo());
            await top.append(t0);
            mid.defaultRelayHash = t0.getHash();
            mid.defaultRelayUrl = "http://localhost:8090/hoist";
            mid.defaultTopLineHash = t0.getHash();
            const m0 = await mid.create(t0.getHash(), null, uuidCargo());


            const foot = new TodaClient(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8091/files");
            await foot.populateInventory();
            foot._getSalt = () => utf8ToBytes("some salty");
            foot.defaultRelayHash = m0.getHash();
            foot.defaultRelayUrl = "http://localhost:8091/hoist";
            foot.defaultTopLineHash = t0.getHash();

            const f0 = await foot.create(m0.getHash());
            const f1 = await foot.append(f0, m0.getHash());
            const f2 = await foot.append(f1, m0.getHash());
            const f3 = await foot.append(f2, m0.getHash());
            const f4 = await foot.append(f3, m0.getHash());

            const i = new Interpreter(Line.fromTwist(f4), t0.getHash());

            await i.verifyHitchLine(f4.getHash());
        } finally {
            await topRelay.stop();
            await midRelay.stop();
        }
    });

    it("tether is auto-updated", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        const top = new TodaClient(inv, "http://localhost:1234");
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, { port: 8090 }).start();
        try {
            const t0 = await top.create(null, null, uuidCargo());

            const foot = new TodaClient(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8090/files");
            await foot.populateInventory();
            foot._getSalt = () => utf8ToBytes("some salty");
            foot.defaultRelayHash = t0.getHash();
            foot.defaultRelayUrl = "http://localhost:8090/hoist";
            foot.defaultTopLineHash = t0.getHash();

            const f0 = await foot.create(t0.getHash());
            const f1 = await foot.append(f0, t0.getHash());
            const f2 = await foot.append(f1, t0.getHash());
            const f3 = await foot.append(f2, t0.getHash());
            const f4 = await foot.append(f3, t0.getHash());

            const i = new Interpreter(Line.fromTwist(f4), t0.getHash());
            await i.verifyHitchLine(f4.getHash());

            const t = await top.get(t0.getHash());

            assert.ok(f1.getTetherHash().equals(t.prev().prev().prev().getPrevHash()));
            assert.ok(f2.getTetherHash().equals(t.prev().prev().getPrevHash()));
            assert.ok(f3.getTetherHash().equals(t.prev().getPrevHash()));
            assert.ok(f4.getTetherHash().equals(t.getPrevHash()));
        } finally {
            await topRelay.stop();
        }
    });

    it("Append does not pull poptop when noRemote: true", async () => {
        let toda = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await toda.populateInventory();
        toda._getSalt = () => utf8ToBytes("some salty");
        const t0 = await toda.create(null, null, uuidCargo());
        toda.defaultTopLineHash = t0.getHash();
        // Seed initial
        const m0 = await toda.create(t0.getHash());
        const f0 = await toda.create(m0.getHash());
        const f1 = await toda.append(f0, m0.getHash());
        const f2 = await toda.append(f1, m0.getHash());
        const f3 = await toda.append(f2, m0.getHash());
        const f4 = await toda.append(f3, m0.getHash());
        const t1 = await toda.get(t0.getHash());
        const t2 = await toda.append(t1);
        const f5 = await toda.append(f4, m0.getHash(), null, null, 
                                     () => {}, null, { noRemote: true });
        // Sanity
        assert.ok(f5.get(t1.getHash()));
        // Actual check
        assert.ok(!f5.get(t2.getHash()));
    });
});

describe("finalize twist", async () => {
    it("should correctly make a successor to the first abject", async () => {
        let toda = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await toda.populateInventory();
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
        let toda = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await toda.populateInventory();
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

describe("TodaClient unit tests", async () => {
    it("getRelay: Twist has a tether url => use RemoteRelayClient", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8081");
        await toda.populateInventory();
        let tether = Hash.fromHex("4129383a4196c763eec6d96380db76dcee831d5c43208b92fcf81e563bb411d0b7");
        let abj = new SimpleHistoric();
        abj.set("SOMETIMESTAMP", "http://localhost:9000");
        abj.buildTwist().setTetherHash(tether);
        abj = abj.createSuccessor();
        let twist = abj.buildTwist().twist();
        let relay = toda.getRelay(twist);
        assert.ok(relay instanceof RemoteRelayClient);
        assert.ok(relay.tetherHash.equals(tether));
        assert.equal(relay.fileServerUrl, "http://localhost:8081");
        assert.ok(relay.relayUrl == "http://localhost:9000");
    });

    it("getRelay: No tether url => use LocalRelayClient", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8081");
        await toda.populateInventory();
        let tb = new TwistBuilder();
        tb.setTetherHash = Hash.fromHex("4129383a4196c763eec6d96380db76dcee831d5c43208b92fcf81e563bb411d0b7");
        let tether = tb.twist();
        tb = new TwistBuilder();
        tb.setTetherHash(tether.getHash());
        tb = tb.createSuccessor();
        let twist = tb.twist();
        inv.put(tether.getAtoms());
        let relay = toda.getRelay(twist);
        assert.ok(relay instanceof LocalRelayClient);
        assert.ok(relay.tetherHash.equals(tether.getHash()));
    });

    it("getRelay: No tether url => not in local => use DefaultRelay", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClient(inv, "http://localhost:8081");
        await toda.populateInventory();
        toda.defaultRelayUrl = "http://localhost:9000";
        let tether = Hash.fromHex("4129383a4196c763eec6d96380db76dcee831d5c43208b92fcf81e563bb411d0b7");
        let tb = new TwistBuilder();
        tb.setTetherHash(tether);
        tb = tb.createSuccessor();
        let twist = tb.twist();
        let relay = toda.getRelay(twist);
        assert.ok(relay instanceof RemoteRelayClient);
        assert.ok(relay.tetherHash.equals(tether));
        assert.equal(relay.fileServerUrl, "http://localhost:8081");
        assert.ok(relay.relayUrl == "http://localhost:9000");
    });
});

describe("Stopping conditions", async () => {
    it("No data seeded: stops at specified poptop", async () => {
        const invTop = new LocalInventoryClient("./files/" + uuid());
        const top = new TodaClient(invTop, "http://localhost:1234");
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, {port: 8090}).start();
        try {
            const top0 = await top.create(null, null, uuidCargo());
            const top1 = await top.append(top0);
            const top2 = await top.append(top1);
            const top3 = await top.append(top2);
            const top4 = await top.append(top3);

            const invFoot = new LocalInventoryClient("./files/" + uuid());
            const foot = new TodaClient(invFoot, "http://localhost:8090/files");
            await foot.populateInventory();
            foot._getSalt = () => utf8ToBytes("some salty");
            foot.defaultRelayUrl = "http://localhost:8090/hoist";
            foot.defaultTopLineHash = top1.getHash();
            foot.defaultRelayHash = top1.getHash();

            const f0 = await foot.create(top4.getHash());
            const f1 = await foot.append(f0, top4.getHash());

            // Does not grab top0: it has already gone back to the poptop
            assert.ifError(topRelay.requestLogs.includes(`GET /files/${top0.getHash()}.next.toda`) || null);
            // Does grab top1: the poptop
            assert.ok(topRelay.requestLogs.includes(`GET /files/${top1.getHash()}.next.toda`));
        } finally {
            await topRelay.stop();
        }
    });

    it("No data seeded: stops at fast twist before proceeding to poptop", async () => {
        const invTop = new LocalInventoryClient("./files/" + uuid());
        const top = new TodaClient(invTop, "http://localhost:1234");
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, {port: 8090}).start();
        const invMid = new LocalInventoryClient("./files/" + uuid());
        const mid = new TodaClient(invMid, "http://localhost:8090/files");
        await mid.populateInventory();
        mid._getSalt = () => utf8ToBytes("mose malty");
        const midRelay = await new TestRelayServer(mid, {port: 8091, fileServerRedirects: ["http://localhost:8090/files"]}).start();
        try {
            const top0 = await top.create(null, null, uuidCargo());
            const top1 = await top.append(top0);
            const top2 = await top.append(top1);
            const top3 = await top.append(top2);

            mid.defaultRelayUrl = "http://localhost:8090/hoist";
            mid.defaultTopLineHash = top1.getHash();
            mid.defaultRelayHash = top1.getHash();

            const mid0 = await mid.create(null, null, uuidCargo());
            const mid1 = await mid.append(mid0);
            const mid2 = await mid.append(mid1, top1.getHash());
            const mid3 = await mid.append(mid2);
            const mid4 = await mid.append(mid3);
            const mid5 = await mid.append(mid4, top3.getHash());

            const invFoot = new LocalInventoryClient("./files/" + uuid());
            const foot = new TodaClient(invFoot, "http://localhost:8091/files");
            await foot.populateInventory();
            foot._getSalt = () => utf8ToBytes("some salty");
            foot.defaultRelayUrl = "http://localhost:8091/hoist";
            foot.defaultTopLineHash = top1.getHash();
            foot.defaultRelayHash = mid4.getHash();

            const f0 = await foot.create(mid4.getHash());
            const f1 = await foot.append(f0, mid4.getHash());

            // Does not grab mid1: it has already reached a fast twist (mid2)
            assert.ifError(midRelay.requestLogs.includes(`GET /files/${mid1.getHash()}.next.toda`) || null);
            // Does grab mid2: the fast twist
            assert.ok(midRelay.requestLogs.includes(`GET /files/${mid2.getHash()}.next.toda`));
        } finally {
            await midRelay.stop();
            await topRelay.stop();
        }
    });

    it("When data already exists and there are no fast twists in the relay, will stopRelay at the most recently known loose twist", async () => {
        const invTop = new LocalInventoryClient("./files/" + uuid());
        const top = new TodaClient(invTop, "http://localhost:1234");
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, {port: 8090}).start();
        try {
            const top0 = await top.create(null, null, uuidCargo());
            const top1 = await top.append(top0);

            const invFoot = new LocalInventoryClient("./files/" + uuid());
            const foot = new TodaClient(invFoot, "http://localhost:8090/files");
            await foot.populateInventory();

            foot._getSalt = () => utf8ToBytes("some salty");
            foot.defaultRelayUrl = "http://localhost:8090/hoist";
            foot.defaultTopLineHash = top1.getHash();
            foot.defaultRelayHash = top1.getHash();

            const f0 = await foot.create(top1.getHash());
            const f1 = await foot.append(f0, top1.getHash());

            const top2 = await top.get(top1.getHash());
            const f2 = await foot.append(f1, top1.getHash());
            const top3 = await top.get(top1.getHash());
            const f3 = await foot.append(f2, top1.getHash());
            const top4 = await top.get(top1.getHash());
            const f4 = await foot.append(f3, top1.getHash());
            const top5 = await top.get(top1.getHash());

            // Clear the logs
            topRelay.requestLogs.length = 0;

            const f5 = await foot.append(f4, top1.getHash());
            const top6 = await top.get(top1.getHash());

            // For sanity check; double check that all of the twists did end up in f5
            assert.ok(await f5.get(top1.getHash()));
            assert.ok(await f5.get(top2.getHash()));
            assert.ok(await f5.get(top3.getHash()));
            assert.ok(await f5.get(top4.getHash()));
            assert.ok(await f5.get(top5.getHash()));
            assert.ok(await f5.get(top6.getHash()));

            // Does not grab top1; really old twist that is already stored
            assert.ifError(topRelay.requestLogs.includes(`GET /files/${top1.getHash()}.next.toda`) || null);
            // Does not grab top2; still too old
            assert.ifError(topRelay.requestLogs.includes(`GET /files/${top2.getHash()}.next.toda`) || null);
            // Needs to grab top3: it's the tether of f3 (ie, of the lead), and onwards
            // cached.
            //assert.ok(topRelay.requestLogs.includes(`GET /files/${top3.getHash()}.next.toda`));
            //assert.ok(topRelay.requestLogs.includes(`GET /files/${top4.getHash()}.next.toda`));
            //assert.ok(topRelay.requestLogs.includes(`GET /files/${top5.getHash()}.next.toda`));
            //assert.ok(topRelay.requestLogs.includes(`GET /files/${top6.getHash()}.next.toda`));
        } finally {
            await topRelay.stop();
        }
    });

    it("When data already exists and the relay has fast twists, won't stopRelay at known loose twists: keep going until it hits a fast twist", async () => {
        const invTop = new LocalInventoryClient("./files/" + uuid());
        const top = new TodaClient(invTop, "http://localhost:1234");
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, {port: 8090}).start();
        const invMid = new LocalInventoryClient("./files/" + uuid());
        const mid = new TodaClient(invMid, "http://localhost:8090/files");
        await mid.populateInventory();
        mid._getSalt = () => utf8ToBytes("mose malty");
        const midRelay = await new TestRelayServer(mid, {port: 8091, fileServerRedirects: ["http://localhost:8090/files"]}).start();
        try {
            const top0 = await top.create(null, null, uuidCargo());
            const top1 = await top.append(top0);
            const top2 = await top.append(top1);
            const top3 = await top.append(top2);

            mid.defaultRelayUrl = "http://localhost:8090/hoist";
            mid.defaultTopLineHash = top1.getHash();
            mid.defaultRelayHash = top1.getHash();

            const mid0 = await mid.create(null, null, uuidCargo());
            const mid1 = await mid.append(mid0);
            const mid2 = await mid.append(mid1, top1.getHash());
            const mid3 = await mid.append(mid2);
            const mid4 = await mid.append(mid3);
            const mid5 = await mid.append(mid4, top3.getHash());

            const invFoot = new LocalInventoryClient("./files/" + uuid());
            const foot = new TodaClient(invFoot, "http://localhost:8091/files");
            await foot.populateInventory();
            foot._getSalt = () => utf8ToBytes("some salty");
            foot.defaultRelayUrl = "http://localhost:8091/hoist";
            foot.defaultTopLineHash = top1.getHash();
            foot.defaultRelayHash = mid4.getHash();

            const f0 = await foot.create(mid4.getHash());
            const f1 = await foot.append(f0, mid4.getHash());

            // Make doubly sure the new data made it into f1 for the sake of this test
            f1.addAtoms(mid5.getAtoms());

            // Clear the logs
            midRelay.requestLogs.length = 0;

            const f2 = await foot.append(f1, mid4.getHash());

            // Even though we already have info for mid4, since the midline has tethers we know about,
            //  we keep going until we see a fast twist (ie, mid2)
            //cached.
            //assert.ok(midRelay.requestLogs.includes(`GET /files/${mid2.getHash()}.next.toda`));
            // Doesn't go beyond that
            assert.ifError(midRelay.requestLogs.includes(`GET /files/${mid1.getHash()}.next.toda`) || null);
        } finally {
            await midRelay.stop();
            await topRelay.stop();
        }
    });
});

// TODO: This test is broken due to logic in the client
describe("pull should include all required info", async () => {
    it("send to remote and back", async () => {
        const dir0 = "./files/" + uuid();
        const dir1 = "./files/" + uuid();

        // set up a local address
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new LocalInventoryClient(dir0));
        await toda.populateInventory();
        toda.shieldSalt = dir0 + "/salt";
        fs.writeFileSync(toda.shieldSalt, "aaaaaa");
        toda.addSatisfier(keyPair);
        let localLine = await toda.create(null, keyPair);
        let localLineNext = await toda.append(localLine, null, keyPair);

        // set up a "remote" address
        let keyPair2 = await SECP256r1.generate();
        let toda2 = new TodaClient(new LocalInventoryClient(dir1));
        await toda2.populateInventory();
        toda2.shieldSalt = dir1 + "/salt";
        fs.writeFileSync(toda2.shieldSalt, "bbbbbb");
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

        assert.equal(await toda.isSatisfiable(aNNNext), false);
        assert(await toda2.isSatisfiable(aNNNext));

        // append another fast twist, causing a hitch,
        //  requiring previous (local) hoist info
        let b = await toda2.append(aNNNext, remoteLineNext.getHash());
        assert(await toda2.isSatisfiable(b));

        //...

        //TODO(acg): do a variant of this which includes canonicity, and which
        //also demonstrates how forks fail.

    });
});

describe("Multi-remote pull test", () => {
    it("Should be able to recursively reach up to the topline", async () => {
        const top = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, { port: 8090 }).start();

        const mid = new TodaClient(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8090/files");
        await mid.populateInventory();
        mid._getSalt = () => utf8ToBytes("some salty2");
        mid.defaultRelayUrl = "http://localhost:8090/hoist";
        const midRelay = await new TestRelayServer(mid, { port: 8091,
                                                          fileServerRedirects: ["http://localhost:8090/files"] }).start();

        const foot = new TodaClient(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8091/files");
        await foot.populateInventory();
        foot.defaultRelayUrl = "http://localhost:8091/hoist";
        foot._getSalt = () => utf8ToBytes("some salty2");
        try {
            const t0 = await top.create(null, null, uuidCargo());
            await top.append(t0);

            const m0 = await mid.create(t0.getHash());
            await mid.append(m0, t0.getHash());

            foot.defaultTopLineHash = t0.getHash();

            const f0 = await foot.create(m0.getHash());
            const f1 = await foot.append(f0, m0.getHash());
            const f2 = await foot.append(f1, m0.getHash());

            const t1 = await top.get(t0.getHash());
            const m1 = await mid.get(m0.getHash());

            assert.ok(await f2.get(t1.getHash()));
            assert.ok(await f2.get(m1.getHash()));

            const f3 = await foot.append(f2, m0.getHash());

            assert.ok(await f3.get(t1.getHash()));
            assert.ok(await f3.get(m1.getHash()));

        } finally {
            await midRelay.stop();
            await topRelay.stop();
        }
    });

    it("Will stop when it hits the defaultTopLineHash", async () => {
        const top = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, { port: 8090 }).start();

        const mid = new TodaClient(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8090/files");
        await mid.populateInventory();
        mid._getSalt = () => utf8ToBytes("some salty2");
        mid.defaultRelayUrl = "http://localhost:8090/hoist";
        const midRelay = await new TestRelayServer(mid, { port: 8091,
                                                          fileServerRedirects: ["http://localhost:8090/files"] }).start();

        const foot = new TodaClient(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8091/files");
        await foot.populateInventory();
        foot.defaultRelayUrl = "http://localhost:8091/hoist";
        foot._getSalt = () => utf8ToBytes("some salty2");
        try {
            const t0 = await top.create(null, null, uuidCargo());
            await top.append(t0);

            const m0 = await mid.create(t0.getHash());
            await mid.append(m0, t0.getHash());

            foot.defaultTopLineHash = m0.getHash();

            const f0 = await foot.create(m0.getHash());
            const f1 = await foot.append(f0, m0.getHash());
            const f2 = await foot.append(f1, m0.getHash());

            const t1 = await top.get(t0.getHash());
            const m1 = await mid.get(m0.getHash());

            assert.ifError(await f2.get(t1.getHash()));
            assert.ok(await f2.get(m1.getHash()));

            const f3 = await foot.append(f2, m0.getHash());

            const t2 = await top.get(t0.getHash());
            const m2 = await mid.get(m0.getHash());

            assert.ifError(await f3.get(t2.getHash()));
            assert.ok(await f3.get(m2.getHash()));
        } finally {
            await midRelay.stop();
            await topRelay.stop();
        }
    });

    it("Won't reach up all the way if no defaultTopLineHash specified", async () => {
        const top = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await top.populateInventory();
        top._getSalt = () => utf8ToBytes("some salty");
        const topRelay = await new TestRelayServer(top, { port: 8090 }).start();

        const mid = new TodaClient(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8090/files");
        await mid.populateInventory();
        mid._getSalt = () => utf8ToBytes("some salty2");
        mid.defaultRelayUrl = "http://localhost:8090/hoist";
        const midRelay = await new TestRelayServer(mid, { port: 8091,
                                                          fileServerRedirects: ["http://localhost:8090/files"] }).start();

        const foot = new TodaClient(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8091/files");
        await foot.populateInventory();
        foot.defaultRelayUrl = "http://localhost:8091/hoist";
        foot._getSalt = () => utf8ToBytes("some salty2");
        try {
            const t0 = await top.create(null, null, uuidCargo());
            await top.append(t0);

            const m0 = await mid.create(t0.getHash());
            await mid.append(m0, t0.getHash());

            const f0 = await foot.create(m0.getHash());
            const f1 = await foot.append(f0, m0.getHash());
            const f2 = await foot.append(f1, m0.getHash());

            const t1 = await top.get(t0.getHash());
            const m1 = await mid.get(m0.getHash());

            assert.ok(!await f2.get(t1.getHash()));
            assert.ok(await f2.get(m1.getHash()));

            const f3 = await foot.append(f2, m0.getHash());

            assert.ok(!await f3.get(t1.getHash()));
            assert.ok(await f3.get(m1.getHash()));
        } finally {
            await midRelay.stop();
            await topRelay.stop();
        }
    });
});

describe("Unowned archiving works as expected", async function() {
    it("Appending will not unown the file when it is still owned", async () => {
        const client = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await client.populateInventory();
        client._getSalt = () => utf8ToBytes("some salty");

        const kp = await SECP256r1.generate();
        client.addSatisfier(kp);

        const t0 = await client.create(null, kp, uuidCargo());
        const t1 = await client.append(t0, null, kp);

        assert.ok(!client.inv.isUnowned(t1.getHash()));
    });

    it("Appending will unown the file when it is no longer owned", async () => {
        const client = new TodaClient(new LocalInventoryClient("./files/" + uuid()));
        await client.populateInventory();
        client._getSalt = () => utf8ToBytes("some salty");

        const kp = await SECP256r1.generate();
        client.addSatisfier(kp);
        const kpOther = await SECP256r1.generate();

        const t0 = await client.create(null, kp, uuidCargo());
        const t1 = await client.append(t0, null, kpOther);

        assert.ok(client.inv.isUnowned(t1.getHash()));
    });

    it("archiveUnownedFiles will unown all unowned files", async () => {
        // NOTE: To properly mock this behaviour, we'll use two keypairs
        //       as we're generating files (to avoid having them being
        //       marked unowned as we're generating the files)
        //       Then we will reinstantiate the client with only one of them

        const dir = "./files/" + uuid();
        let client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        client._getSalt = () => utf8ToBytes("some salty");

        const kp0 = await SECP256r1.generate();
        client.addSatisfier(kp0);
        const kp1 = await SECP256r1.generate();
        client.addSatisfier(kp1);

        client.shouldArchiveUnownedFiles = false;

        // Always kp0
        const a0 = await client.create(null, kp0, uuidCargo());
        const a1 = await client.append(a0, null, kp0);
        const a2 = await client.append(a1, null, kp0);

        // Switches to kp1 then back
        const b0 = await client.create(null, kp0, uuidCargo());
        const b1 = await client.append(b0, null, kp1);
        const b2 = await client.append(b1, null, kp0);

        // Switches to kp1
        const c0 = await client.create(null, kp0, uuidCargo());
        const c1 = await client.append(c0, null, kp1);
        const c2 = await client.append(c1, null, kp1);

        // Always kp1
        const d0 = await client.create(null, kp1, uuidCargo());
        const d1 = await client.append(d0, null, kp1);
        const d2 = await client.append(d1, null, kp1);

        // Switches to kp0 then back
        const e0 = await client.create(null, kp1, uuidCargo());
        const e1 = await client.append(e0, null, kp0);
        const e2 = await client.append(e1, null, kp1);

        // Switches to kp0
        const f0 = await client.create(null, kp1, uuidCargo());
        const f1 = await client.append(f0, null, kp0);
        const f2 = await client.append(f1, null, kp0);

        // Sanity; all files should be owned
        assert.ok(!client.inv.isUnowned(a2.getHash()));
        assert.ok(!client.inv.isUnowned(b2.getHash()));
        assert.ok(!client.inv.isUnowned(c2.getHash()));
        assert.ok(!client.inv.isUnowned(d2.getHash()));
        assert.ok(!client.inv.isUnowned(e2.getHash()));
        assert.ok(!client.inv.isUnowned(f2.getHash()));

        // Reinstantiate client with only kp0
        client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        client._getSalt = () => utf8ToBytes("some salty");
        client.addSatisfier(kp0);

        await client.archiveUnownedFiles();

        assert.ok(!client.inv.isUnowned(a2.getHash())); // still owned
        assert.ok(!client.inv.isUnowned(b2.getHash())); // still owned
        assert.ok(client.inv.isUnowned(c2.getHash())); // no longer owned
        assert.ok(client.inv.isUnowned(d2.getHash())); // never owned
        assert.ok(client.inv.isUnowned(e2.getHash())); // no longer owned
        assert.ok(!client.inv.isUnowned(f2.getHash())); // now owned
    });
});

describe("isSatisfiable tests", async function () {
    // TODO: When multi reqs are implemented, we need extensive
    //       testing for those

    it("Success: no requirements on twist", async function () {
        const dir = "./files/" + uuid();
        let client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        const twist = new TwistBuilder().twist();
        assert.ok(await client.isSatisfiable(twist));
    });

    it("Success: multi-leveled no requirements", async function () {
        const dir = "./files/" + uuid();
        let client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        const top = new TwistBuilder().twist();
        const bot = new TwistBuilder(null, null, null, top).twist();
        assert.ok(await client.isSatisfiable(bot));
    });

    it("Success: requirement on twist, client has exactly that satisfier", async function () {
        const dir = "./files/" + uuid();
        let client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        const req = await SECP256r1.generate();
        const tb = new TwistBuilder();
        tb.setKeyRequirement(req.constructor.requirementTypeHash,
                             await req.exportPublicKey());
        const twist = tb.twist();
        client.addSatisfier(req);
        assert.ok(await client.isSatisfiable(twist));
    });

    it("Success: multi-level, requirement on twist, client has exactly that satisfier", async function () {
        const dir = "./files/" + uuid();
        let client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        const req = await SECP256r1.generate();
        const tb = new TwistBuilder();
        tb.setKeyRequirement(req.constructor.requirementTypeHash,
                             await req.exportPublicKey());
        const top = tb.twist();
        const bot = new TwistBuilder(null, null, null, top).twist();
        client.addSatisfier(req);
        assert.ok(await client.isSatisfiable(bot));
    });

    it("Success: requirement on twist, client has that satisfiers + others", async function () {
        const dir = "./files/" + uuid();
        let client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        const reqA = await SECP256r1.generate();
        const reqB = await SECP256r1.generate();
        const reqC = await SECP256r1.generate();
        const tb = new TwistBuilder();
        tb.setKeyRequirement(reqB.constructor.requirementTypeHash,
                             await reqB.exportPublicKey());
        const twist = tb.twist();
        client.addSatisfier(reqA);
        client.addSatisfier(reqB);
        client.addSatisfier(reqC);
        assert.ok(await client.isSatisfiable(twist));
    });

    it("Failure: requirement on twist, client has no satisfiers", async function () {
        const dir = "./files/" + uuid();
        let client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        const req = await SECP256r1.generate();
        const tb = new TwistBuilder();
        tb.setKeyRequirement(req.constructor.requirementTypeHash,
                             await req.exportPublicKey());
        const twist = tb.twist();
        assert.ok(!await client.isSatisfiable(twist));
    });

    it("Failure: requirement on twist, client has multiple satisfiers but not the right one", async function () {
        const dir = "./files/" + uuid();
        let client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        const reqA = await SECP256r1.generate();
        const reqB = await SECP256r1.generate();
        const reqC = await SECP256r1.generate();
        const tb = new TwistBuilder();
        tb.setKeyRequirement(reqB.constructor.requirementTypeHash,
                             await reqB.exportPublicKey());
        const twist = tb.twist();
        client.addSatisfier(reqA);
        client.addSatisfier(reqC);
        assert.ok(!await client.isSatisfiable(twist));
    });

    it("Failure: multi-level requirement on twist, client has multiple satisfiers but not the right one", async function () {
        const dir = "./files/" + uuid();
        let client = new TodaClient(new LocalInventoryClient(dir));
        await client.populateInventory();
        const reqA = await SECP256r1.generate();
        const reqB = await SECP256r1.generate();
        const reqC = await SECP256r1.generate();
        const tb = new TwistBuilder();
        tb.setKeyRequirement(reqB.constructor.requirementTypeHash,
                             await reqB.exportPublicKey());
        const twist = tb.twist();
        const bot = new TwistBuilder(null, null, null, twist).twist();
        client.addSatisfier(reqA);
        client.addSatisfier(reqC);
        assert.ok(!await client.isSatisfiable(bot));
    });
});
