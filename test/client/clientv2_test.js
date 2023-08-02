import { TodaClientV2 } from "../../src/client/client.js";
import { LocalInventoryClient } from "../../src/client/inventory.js";
import { v4 as uuid } from "uuid";
import { uuidCargo } from "../util.js";
import { Interpreter } from "../../src/core/interpret.js";
import { Line } from "../../src/core/line.js";
import assert from "assert";
import { Hash } from "../../src/core/hash.js";
import { TwistBuilder } from "../../src/core/twist.js";
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
            const t1 = await top.append(t0);
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

    it("getRelay: remoteNextRelayClient has correct backwardsStopPredicate set", async () => {
        let inv = new LocalInventoryClient("./files/" + uuid());
        let toda = new TodaClientV2(inv, "http://localhost:8081");

        let tb = new TwistBuilder();
        tb.setPrevHash(Hash.fromHex("41383a4192fb411d0b79cf81e3b763eec6c6d56b76dcee2983196380dd5c43208b"));
        let toplineTwist = tb.twist();
        tb = new TwistBuilder();
        tb.setPrevHash(toplineTwist.getHash());
        let toplineSuccessor = tb.twist();
        toda.defaultTopLineHash = toplineTwist.getHash();

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

        assert.ok(relay.backwardsStopPredicate(toplineTwist));
        assert.ok(!relay.backwardsStopPredicate(toplineSuccessor));
    });
});