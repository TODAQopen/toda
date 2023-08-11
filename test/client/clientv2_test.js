import { TodaClientV2 } from "../../src/client/client.js";
import { LocalInventoryClient } from "../../src/client/inventory.js";
import { v4 as uuid } from "uuid";
import { uuidCargo } from "../util.js";
import { Interpreter } from "../../src/core/interpret.js";
import { Line } from "../../src/core/line.js";
import assert from "assert";
import { Hash } from "../../src/core/hash.js";
import { TwistBuilder, Twist } from "../../src/core/twist.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { SimpleHistoric } from "../../src/abject/simple-historic.js";
import { RemoteNextRelayClient, LocalNextRelayClient } from "../../src/client/relay.js";
import { startRelay, stopRelay } from "./relay_server.js";

describe("append", async () => {
    it("append local test", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid())
        const toda = new TodaClientV2(inv, "http://localhost:1234");
        toda._getSalt = () => ByteArray.fromUtf8("some salty");
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
        const inv = new LocalInventoryClient("./files/" + uuid())
        const toda = new TodaClientV2(inv, "http://localhost:1234");
        toda._getSalt = () => ByteArray.fromUtf8("some salty");
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
        const inv = new LocalInventoryClient("./files/" + uuid())
        const top = new TodaClientV2(inv, "http://localhost:1234");
        top._getSalt = () => ByteArray.fromUtf8("some salty");
        const topRelay = await startRelay(top, { port: 8090 });
        try {
            const t0 = await top.create(null, null, uuidCargo());
            const foot = new TodaClientV2(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8090/files");
            foot._getSalt = () => ByteArray.fromUtf8("some salty2");
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
            await stopRelay(topRelay);
        }
    });

    it("append stacked remote test", async () => {
        const top = new TodaClientV2(new LocalInventoryClient("./files/" + uuid()), "http://localhost:1234");
        top._getSalt = () => ByteArray.fromUtf8("some salty");
        const topRelay = await startRelay(top, { port: 8090 });
        const mid = new TodaClientV2(new LocalInventoryClient("./files/" + uuid()), "http://localhost:8090/files");
        mid._getSalt = () => ByteArray.fromUtf8("some salty2");
        const midRelay = await startRelay(mid, { port: 8091, fileServerRedirects: ["http://localhost:8090/files"] });
        try {
            const t0 = await top.create(null, null, uuidCargo());
            await top.append(t0);
            mid.defaultRelayHash = t0.getHash();
            mid.defaultRelayUrl = "http://localhost:8090/hoist";
            mid.defaultTopLineHash = t0.getHash();
            const m0 = await mid.create(t0.getHash(), null, uuidCargo());

            const foot = new TodaClientV2(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8091/files");
            foot._getSalt = () => ByteArray.fromUtf8("some salty");
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
            await stopRelay(topRelay);
            await stopRelay(midRelay);
        }
    });

    it("tether is auto-updated", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid())
        const top = new TodaClientV2(inv, "http://localhost:1234");
        top._getSalt = () => ByteArray.fromUtf8("some salty");
        const topRelay = await startRelay(top, { port: 8090 });
        try {
            const t0 = await top.create(null, null, uuidCargo());

            const foot = new TodaClientV2(new LocalInventoryClient("./files/" + uuid()),
                                        "http://localhost:8090/files");
            foot._getSalt = () => ByteArray.fromUtf8("some salty");
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

            const t = top.get(t0.getHash());

            assert.ok(f1.getTetherHash().equals(t.prev().prev().prev().getPrevHash()));
            assert.ok(f2.getTetherHash().equals(t.prev().prev().getPrevHash()));
            assert.ok(f3.getTetherHash().equals(t.prev().getPrevHash()));
            assert.ok(f4.getTetherHash().equals(t.getPrevHash()));
        } finally {
            await stopRelay(topRelay);
        }
    });
});

describe("TodaClientV2 unit tests", async () => {
    it("getRelay: Twist has a tether url => use RemoteNextRelayClient", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClientV2(inv, "http://localhost:8081");
        let tether = Hash.fromHex("4129383a4196c763eec6d96380db76dcee831d5c43208b92fcf81e563bb411d0b7");
        let abj = new SimpleHistoric();
        abj.set("SOMETIMESTAMP", "http://localhost:9000");
        abj.buildTwist().setTetherHash(tether);
        abj = abj.createSuccessor();
        let twist = abj.buildTwist().twist();
        let relay = toda.getRelay(twist);
        assert.ok(relay instanceof RemoteNextRelayClient);
        assert.ok(relay.tetherHash.equals(tether));
        assert.equal(relay.fileServerUrl, "http://localhost:8081");
        assert.ok(relay.relayUrl == "http://localhost:9000");
    });

    it("getRelay: No tether url => use LocalNextRelayClient", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClientV2(inv, "http://localhost:8081");
        let tb = new TwistBuilder();
        tb.setTetherHash = Hash.fromHex("4129383a4196c763eec6d96380db76dcee831d5c43208b92fcf81e563bb411d0b7");
        let tether = tb.twist();
        tb = new TwistBuilder();
        tb.setTetherHash(tether.getHash());
        tb = tb.createSuccessor();
        let twist = tb.twist();
        inv.put(tether.getAtoms());
        let relay = toda.getRelay(twist);
        assert.ok(relay instanceof LocalNextRelayClient);
        assert.ok(relay.tetherHash.equals(tether.getHash()));
    });

    it("getRelay: No tether url => not in local => use DefaultRelay", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClientV2(inv, "http://localhost:8081");
        toda.defaultRelayUrl = "http://localhost:9000";
        let tether = Hash.fromHex("4129383a4196c763eec6d96380db76dcee831d5c43208b92fcf81e563bb411d0b7");
        let tb = new TwistBuilder();
        tb.setTetherHash(tether);
        tb = tb.createSuccessor();
        let twist = tb.twist();
        let relay = toda.getRelay(twist);
        assert.ok(relay instanceof RemoteNextRelayClient);
        assert.ok(relay.tetherHash.equals(tether));
        assert.equal(relay.fileServerUrl, "http://localhost:8081");
        assert.ok(relay.relayUrl == "http://localhost:9000");
    });
});

describe("Stopping conditions", async () => {
    it("No data seeded: stops at specified poptop", async () => {
        const invTop = new LocalInventoryClient("./files/" + uuid())
        const top = new TodaClientV2(invTop, "http://localhost:1234");
        top._getSalt = () => ByteArray.fromUtf8("some salty");
        const topRelay = await startRelay(top, {port: 8090});
        try {
            const top0 = await top.create(null, null, uuidCargo());
            const top1 = await top.append(top0);
            const top2 = await top.append(top1);
            const top3 = await top.append(top2);
            const top4 = await top.append(top3);

            const invFoot = new LocalInventoryClient("./files/" + uuid())
            const foot = new TodaClientV2(invFoot, "http://localhost:8090/files");
            foot._getSalt = () => ByteArray.fromUtf8("some salty");
            foot.defaultRelayUrl = "http://localhost:8090/hoist";
            foot.defaultTopLineHash = top1.getHash();
            foot.defaultRelayHash = top1.getHash();

            const f0 = await foot.create(top4.getHash());
            const f1 = await foot.append(f0, top4.getHash());

            // Does not grab top0: it has already gone back to the poptop
            assert.ok(!topRelay.app.requestLogs.includes(`GET /files/${top0.getHash()}.next.toda`));
            // Does grab top1: the poptop
            assert.ok(topRelay.app.requestLogs.includes(`GET /files/${top1.getHash()}.next.toda`));
        }
        finally {
            await stopRelay(topRelay);
        }
    });

    it("No data seeded: stops at fast twist before proceeding to poptop", async () => {
        const invTop = new LocalInventoryClient("./files/" + uuid())
        const top = new TodaClientV2(invTop, "http://localhost:1234");
        top._getSalt = () => ByteArray.fromUtf8("some salty");
        const topRelay = await startRelay(top, {port: 8090});
        const invMid = new LocalInventoryClient("./files/" + uuid())
        const mid = new TodaClientV2(invMid, "http://localhost:8090/files");
        mid._getSalt = () => ByteArray.fromUtf8("mose malty");
        const midRelay = await startRelay(mid, {port: 8091, fileServerRedirects: ["http://localhost:8090/files"]});
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

            const invFoot = new LocalInventoryClient("./files/" + uuid())
            const foot = new TodaClientV2(invFoot, "http://localhost:8091/files");
            foot._getSalt = () => ByteArray.fromUtf8("some salty");
            foot.defaultRelayUrl = "http://localhost:8091/hoist";
            foot.defaultTopLineHash = top1.getHash();
            foot.defaultRelayHash = mid4.getHash();

            const f0 = await foot.create(mid4.getHash());
            const f1 = await foot.append(f0, mid4.getHash());

            // Does not grab mid1: it has already reached a fast twist (mid2)
            assert.ok(!midRelay.app.requestLogs.includes(`GET /files/${mid1.getHash()}.next.toda`));
            // Does grab mid2: the fast twist
            assert.ok(midRelay.app.requestLogs.includes(`GET /files/${mid2.getHash()}.next.toda`));
        }
        finally {
            await stopRelay(midRelay);
            await stopRelay(topRelay);
        }
    });

    it("When data already exists and there are no fast twists in the relay, will stopRelay at the most recently known loose twist", async () => {
        const invTop = new LocalInventoryClient("./files/" + uuid())
        const top = new TodaClientV2(invTop, "http://localhost:1234");
        top._getSalt = () => ByteArray.fromUtf8("some salty");
        const topRelay = await startRelay(top, {port: 8090});
        try {
            const top0 = await top.create(null, null, uuidCargo());
            const top1 = await top.append(top0);

            const invFoot = new LocalInventoryClient("./files/" + uuid())
            const foot = new TodaClientV2(invFoot, "http://localhost:8090/files");
            foot._getSalt = () => ByteArray.fromUtf8("some salty");
            foot.defaultRelayUrl = "http://localhost:8090/hoist";
            foot.defaultTopLineHash = top1.getHash();
            foot.defaultRelayHash = top1.getHash();

            const f0 = await foot.create(top1.getHash());
            const f1 = await foot.append(f0, top1.getHash());

            const top2 = top.get(top1.getHash());
            const f2 = await foot.append(f1, top1.getHash());
            const top3 = top.get(top1.getHash());
            const f3 = await foot.append(f2, top1.getHash());
            const top4 = top.get(top1.getHash());
            const f4 = await foot.append(f3, top1.getHash());
            const top5 = top.get(top1.getHash());

            // Clear the logs
            topRelay.app.requestLogs = [];

            const f5 = await foot.append(f4, top1.getHash());
            const top6 = top.get(top1.getHash());

            // For sanity check; double check that all of the twists did end up in f5
            assert.ok(f5.get(top1.getHash()));
            assert.ok(f5.get(top2.getHash()));
            assert.ok(f5.get(top3.getHash()));
            assert.ok(f5.get(top4.getHash()));
            assert.ok(f5.get(top5.getHash()));
            assert.ok(f5.get(top6.getHash()));

            // Does not grab top1; really old twist that is already stored
            assert.ok(!topRelay.app.requestLogs.includes(`GET /files/${top1.getHash()}.next.toda`));
            // Does not grab top2; still too old
            assert.ok(!topRelay.app.requestLogs.includes(`GET /files/${top2.getHash()}.next.toda`));
            // Needs to grab top3: it's the tether of f3 (ie, of the lead), and onwards
            assert.ok(topRelay.app.requestLogs.includes(`GET /files/${top3.getHash()}.next.toda`));
            assert.ok(topRelay.app.requestLogs.includes(`GET /files/${top4.getHash()}.next.toda`));
            assert.ok(topRelay.app.requestLogs.includes(`GET /files/${top5.getHash()}.next.toda`));
            assert.ok(topRelay.app.requestLogs.includes(`GET /files/${top6.getHash()}.next.toda`));
        } finally {
            await stopRelay(topRelay);
        }
    });

    it("When data already exists and the relay has fast twists, won't stopRelay at known loose twists: keep going until it hits a fast twist", async () => {
        const invTop = new LocalInventoryClient("./files/" + uuid())
        const top = new TodaClientV2(invTop, "http://localhost:1234");
        top._getSalt = () => ByteArray.fromUtf8("some salty");
        const topRelay = await startRelay(top, {port: 8090});
        const invMid = new LocalInventoryClient("./files/" + uuid())
        const mid = new TodaClientV2(invMid, "http://localhost:8090/files");
        mid._getSalt = () => ByteArray.fromUtf8("mose malty");
        const midRelay = await startRelay(mid, {port: 8091, fileServerRedirects: ["http://localhost:8090/files"]});
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

            const invFoot = new LocalInventoryClient("./files/" + uuid())
            const foot = new TodaClientV2(invFoot, "http://localhost:8091/files");
            foot._getSalt = () => ByteArray.fromUtf8("some salty");
            foot.defaultRelayUrl = "http://localhost:8091/hoist";
            foot.defaultTopLineHash = top1.getHash();
            foot.defaultRelayHash = mid4.getHash();

            const f0 = await foot.create(mid4.getHash());
            const f1 = await foot.append(f0, mid4.getHash());

            // Make doubly sure the new data made it into f1 for the sake of this test
            f1.safeAddAtoms(mid5.getAtoms());

            // Clear the logs
            midRelay.app.requestLogs = [];

            const f2 = await foot.append(f1, mid4.getHash());

            // Even though we already have info for mid4, since the midline has tethers we know about,
            //  we keep going until we see a fast twist (ie, mid2)
            assert.ok(midRelay.app.requestLogs.includes(`GET /files/${mid2.getHash()}.next.toda`));
            // Doesn't go beyond that
            assert.ok(!midRelay.app.requestLogs.includes(`GET /files/${mid1.getHash()}.next.toda`));
        }
        finally {
            await stopRelay(midRelay);
            await stopRelay(topRelay);
        }
    });
});
