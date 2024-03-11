import { Hash } from "../../src/core/hash.js";
import { RemoteRelayClient, LocalRelayClient } from "../../src/client/relay.js";
import { TodaClient } from "../../src/client/client.js";
import { LocalInventoryClient, VirtualInventoryClient }
    from "../../src/client/inventory.js";
import { Abject } from "../../src/abject/abject.js";
import { Twist } from "../../src/core/twist.js";
import { nockLocalFileServer } from "./mocks.js";
import { randH, uuidCargo } from "../util.js";
import { hexToBytes, utf8ToBytes } from "../../src/core/byteUtil.js"; 
import nock from "nock";
import assert from "assert";
import fs from "fs-extra";
import path from "path";
import { v4 as uuid } from "uuid";

describe("RemoteRelayClient", async () => {
    const twistHexes = ["418f79797eca5a8d46d3183737f0a9c50e4950a1f86298621785939cf6d41bee5b",
                        "41c9e07a006115beb76b92273e1612754750a51de90769361f05cfa0a62999fc76",
                        "411e92391c496a74d168f67cc434dd18b46b536f719f5691cabd96377f2606efaf", // fast
                        "417b666fe45dfd709954328b145be7c4ade6b636433c0e70da7e37b98a52ef8e54",
                        "41c23ccbe5731c4b77e15ade38d5fc305a5986dc810b0707d40d3fd4aa1236f8b2",
                        "4131c65001117d57a1eaad04b84457d1b74ddb0a6a07b58cc207623351e20f5a9f", // fast
                        "411764d35c547a131caeed1bee31208942bb6b3b019dc5d13a030036ea37a921cf",
                        "417fb3920df356573f6dcc283e6f2f8dd9866ac9e5469e8da5816aa742bd424b57", // fast
                        "41e1b0a489cf9a8a8e0da57d18a72bd7f4fca0fe507af4cea607eea804b7d93f3b"];
    const twistHashes = twistHexes.map(x => Hash.fromHex(x));

    it("next() from twist when .getNext file doesn't exist", async () => {
        nockLocalFileServer("test/client/remoteRelay_files", 8080);
        let relay = new RemoteRelayClient("http://wikipedia.com", "http://localhost:8080", null);
        let randomH = Hash.fromHex("41ecb829ed640be46e7a44fe6fb1a6b7038548a59f8069e24df55f3ae719d7beb4");
        assert.ifError((await relay._getNext(randomH)));
            });

    it("next() from twist when .getNext file exists", async () => {
        nockLocalFileServer("test/client/remoteRelay_files", 8080);
        let relay = new RemoteRelayClient("http://wikipedia.com", "http://localhost:8080", null);
        let twist = await relay._getNext(twistHashes[2]);
        assert.ok(twist);
        assert.ok(twist.getHash().equals(twistHashes[3]));
        assert.ok(twist.prev().getHash().equals(twistHashes[2]));
        // Sanity check: .next.toda test files do not contain shields
        assert.ifError(twist.prev().shield());
            });

    it("getShield() for twist when .shield file doesn't exist", async () => {
        nockLocalFileServer("test/client/remoteRelay_files", 8080);
        let relay = new RemoteRelayClient("http://wikipedia.com", "http://localhost:8080", null);
        let randomH = Hash.fromHex("41ecb829ed640be46e7a44fe6fb1a6b7038548a59f8069e24df55f3ae719d7beb4");
        assert.ifError((await relay._getShield(randomH)));
            });

    it("getShield() for twist when .shield file does exist", async () => {
        nockLocalFileServer("test/client/remoteRelay_files", 8080);
        let relay = new RemoteRelayClient("http://wikipedia.com", "http://localhost:8080", null);
        let shield = await relay._getShield(twistHashes[2]);
        assert.ok(shield);
        let p = path.join("test/client/remoteRelay_files/", `${twistHexes[2]}.toda`);
        let twist2 = Twist.fromBytes(new Uint8Array(fs.readFileSync(p)));
        let loadedContent = shield.getShapedValueFromContent();
        let expectedContent = twist2.shield().getShapedValueFromContent();
        assert.equal(loadedContent.toString(), expectedContent.toString());
            });

    it("get() walks backwards + forwards for loose twist", async () => {
        nockLocalFileServer("test/client/remoteRelay_files", 8080);
        let relay = new RemoteRelayClient("http://wikipedia.com", "http://localhost:8080", twistHashes[4]);
        let twist = await relay.get();
        assert.ok(twist.getHash().equals(twistHashes[8]));
        assert.ok(twist.get(twistHashes[2])); // Went backwards until the fast twist (twists[2])
        assert.ifError(twist.get(twistHashes[1])); // Does not include prior to that (twists[1])

        // Check that all shields have been populated
        twist = new Twist(twist.getAtoms(), twistHashes[7]);
        assert.ok(twist.shield());
        twist = new Twist(twist.getAtoms(), twistHashes[5]);
        assert.ok(twist.shield());
        twist = new Twist(twist.getAtoms(), twistHashes[2]);
        assert.ok(twist.shield());

            });

    it("get() with a `backwardsStopPredicate` behaves as expected", async () => {
        nockLocalFileServer("test/client/remoteRelay_files", 8080);
        let relay = new RemoteRelayClient("http://wikipedia.com", "http://localhost:8080", twistHashes[4], (t) => twistHashes[3].equals(t.getHash()));
        let twist = await relay.get();
        assert.ok(twist.getHash().equals(twistHashes[8]));
        assert.ok(twist.get(twistHashes[3])); // Went backwards and stopped at the requested predicate
        assert.ifError(twist.get(twistHashes[1])); // Does not include prior to that (twists[1])

        // Check that all shields have been populated
        twist = new Twist(twist.getAtoms(), twistHashes[7]);
        assert.ok(twist.shield());
        twist = new Twist(twist.getAtoms(), twistHashes[5]);
        assert.ok(twist.shield());

            });

    it("get() no backwards when twist is already fast", async () => {
        nockLocalFileServer("test/client/remoteRelay_files", 8080);
        let relay = new RemoteRelayClient("http://wikipedia.com", "http://localhost:8080", twistHashes[5]);
        let twist = await relay.get();
        assert.ok(twist.getHash().equals(twistHashes[8]));
        assert.ok(twist.get(twistHashes[5])); // Went backwards until the fast twist (twists[5])
        assert.ifError(twist.get(twistHashes[4])); // Does not include prior to that (twists[4])

        // Check that all shields have been populated
        twist = new Twist(twist.getAtoms(), twistHashes[7]);
        assert.ok(twist.shield());
        twist = new Twist(twist.getAtoms(), twistHashes[5]);
        assert.ok(twist.shield());

            });

    it("get() no backwards when find poptop forwards", async () => {
        RemoteRelayClient.globalNextCache = {};
        RemoteRelayClient.globalShieldCache = {};

        nock.cleanAll();
        nockLocalFileServer("test/client/remoteRelay_files", 8080);
        let relay = new RemoteRelayClient("http://wikipedia.com", "http://localhost:8080", twistHashes[4], null, twistHashes[7]);
        let twist = await relay.get();
        assert.ok(twist.getHash().equals(twistHashes[8]));
        assert.ok(twist.get(twistHashes[4]));
        assert.ifError(twist.get(twistHashes[3])); // Didn't go backwards at all

        // Check that all shields have been populated
        twist = new Twist(twist.getAtoms(), twistHashes[7]);
        assert.ok(twist.shield());
        twist = new Twist(twist.getAtoms(), twistHashes[5]);
        assert.ok(twist.shield());

        nock.cleanAll();
    });

    it("get() returns nil if nothing available", async () => {
        nockLocalFileServer("test/client/remoteRelay_files", 8080);
        let randomH = Hash.fromHex("41ecb829ed640be46e7a44fe6fb1a6b7038548a59f8069e24df55f3ae719d7beb4");
        let relay = new RemoteRelayClient("http://wikipedia.com", "http://localhost:8080", randomH);
        assert.ifError((await relay.get()));
            });

    it("should make a hoist request with the correct data", async () => {
        nock("https://localhost:8080")
            .post("/")
            .reply(200, (_, requestBody) => requestBody);

        let toda = new TodaClient(new VirtualInventoryClient());
        toda._getSalt = () => hexToBytes("012345");
        let tether = Hash.fromHex("41e6e7a44fe6fb1a6b7038548a59f8069e24df55f3ae719d7beb4cb829ed640be4");
        let a = await toda.create(tether);
        let b = await toda.append(a);


        let relay = new RemoteRelayClient("https://localhost:8080", "http://wikipedia.com", null);
        let response = await relay.hoist(a, b.getHash());
        assert.ok(200, response.status);

        let expectedPairtrie = a.hoistPacket(b.getHash());
        let expectedKvs = {};
        expectedPairtrie.getShapedValueFromContent().forEach((v, k) => {
            expectedKvs[k.toString()] = v.toString();
        });
        assert.deepEqual(expectedKvs, response.data['hoist-request']);
        assert.ok(response.data['relay-twist'] == tether.toString());
            });
});

describe("LocalRelayClient", async () => {
    it("Simple next", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        const toda = new TodaClient(inv, "http://localhost:8009");
        toda._getSalt = () => utf8ToBytes("some salty");

        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0);
        const t2 = await toda.append(t1);

        const relay = new LocalRelayClient(toda, t2.getHash());
        // HACK: Force the population of the relay's cachedLine
        relay._populateLine();
        let twist = relay._getNext(t0.getHash());
        assert.ok(twist);
        assert.ok(twist.getHash().equals(t1.getHash()));
        assert.ok(twist.prev());
        assert.ifError(twist.get(t2.getHash()));

        twist = relay._getNext(t1.getHash());
        assert.ok(twist);
        assert.ok(twist.getHash().equals(t2.getHash()));
        assert.ok(twist.prev());
        assert.ifError(twist.get(t0.getHash()));
        assert.throws(() => twist.prev().prev());

        twist = relay._getNext(t2.getHash()); // TOO RECENT! Doesn't have a 'next'
        assert.ifError(twist);
    });

    it("Simple .shield, last fast", async() => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        const toda = new TodaClient(inv, "http://localhost:8009");
        toda._getSalt = () => utf8ToBytes("some salty");
        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0, randH(), null, null, () => {}, null, { noHoist: true });
        const t2 = await toda.append(t1);
        const t3 = await toda.append(t2, randH(), null, null, () => {}, null, { noHoist: true });

        const relay = new LocalRelayClient(toda, t3.getHash());
        assert.ifError(relay._getShield(t0.getHash())); // dne: loose
        assert.ok(relay._getShield(t1.getHash())); // Public!
        assert.equal((relay._getShield(t1.getHash())).toString(), t1.shield().toString());
        assert.ifError(relay._getShield(t2.getHash())); // dne: loose
        assert.ifError(relay._getShield(t3.getHash())); // dne: not public since it's the most recent fast
    });

    it("Simple .shield, last loose", async() => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        const toda = new TodaClient(inv, "http://localhost:8009");
        toda._getSalt = () => utf8ToBytes("some salty");
        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0, randH(), null, null, () => {}, null, { noHoist: true });
        const t2 = await toda.append(t1);
        const t3 = await toda.append(t2, randH(), null, null, () => {}, null, { noHoist: true });
        const t4 = await toda.append(t3);

        const relay = new LocalRelayClient(toda, t3.getHash());
        assert.ifError(relay._getShield(t0.getHash())); // dne: loose
        assert.ok(relay._getShield(t1.getHash())); // Public!
        assert.equal((relay._getShield(t1.getHash())).toString(), t1.shield().toString());
        assert.ifError(relay._getShield(t2.getHash())); // dne: loose
        assert.ifError(relay._getShield(t3.getHash())); // dne: not public since it's the most recent fast
        assert.ifError(relay._getShield(t4.getHash())); // dne: loose
    });

    it("Hoist + getHoist", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid());
        const toda = new TodaClient(inv, "http://localhost:8009");
        toda._getSalt = () => utf8ToBytes("some salty");

        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0);
        const t2 = await toda.append(t1);

        const f0 = await toda.create(t1.getHash());
        const f1 = await toda.append(f0, t1.getHash());

        const relay = new LocalRelayClient(toda, t1.getHash());
        const hoist = (await relay.getHoist(f0)).hoist;

        // xxx(acg): Test to ensure a date is included
        let abj = Abject.fromTwist(hoist);
        let date = abj.getFieldAbject(LocalRelayClient.tsSym);
        assert.equal(date.toISOString().substr(0,10), new Date().toISOString().substr(0,10)); // this will fail if you run the test at exactly 23:59:59.9xx...

        assert.ok(hoist);
        assert.ok(hoist.getPrevHash().equals(t2.getHash()));
    });
});
