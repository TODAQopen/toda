import { Hash, Sha256 } from "../../src/core/hash.js";
import { Atoms } from "../../src/core/atoms.js";
import { RemoteRelayClient, RemoteNextRelayClient, LocalRelayClient, LocalNextRelayClient } from "../../src/client/relay.js";
import { TodaClient, TodaClientV2 } from "../../src/client/client.js";
import { LocalInventoryClient, VirtualInventoryClient } from "../../src/client/inventory.js";
import { Twist } from "../../src/core/twist.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { nockLocalFileServer, nock404FileServer } from "./mocks.js";
import { randH, uuidCargo } from "../util.js";
import nock from "nock";
import assert from "assert";
import fs from "fs-extra";
import path from "path";
import { v4 as uuid } from "uuid";
import { PairTriePacket } from "../../src/core/packet.js";
import { HashMap } from "../../src/core/map.js";

const url = "https://localhost:8080";

describe("hoist", async () => {
    it("should make a post request to the specified line server with the provided data", () => {
        let scope = nock(url).post("/");
        scope.reply(200);

        let relay = new RemoteRelayClient(url);
        return relay._hoist(new Atoms()).then(r => {
            assert.equal(r.status, 200);
        });
    });
});

describe("submitHoist", () => {
    it("should make a hoist request with the correct data", async () => {
        let scope = nock(url).post("/");
        scope.reply(200, (uri, requestBody) => requestBody);

        let toda = new TodaClient(new VirtualInventoryClient());
        let a = await toda.create();
        let b = await toda.append(a);

        let relay = new RemoteRelayClient(url);
        return relay.hoist(a, b.getHash(), url).then(r => {
            assert.equal(r.status, 200);
            // FIXME! r.data appears to be receiving a hex string...
        });
    });
});

//FIXME: relay client *will* break with fake (non-atom) data.
/*describe("getLine", () => {
    it("should make a get request to the specified line server", () => {
        let scope = nock(url).get("/");
        scope.reply(200, Buffer.from("foo"));

        let relay = new RemoteRelayClient(url);
        return relay.get().then(r => {
            assert.deepEqual(r, new ByteArray(Buffer.from("foo")));
        });
    });
});*/

describe("getHoist", () => {
    it("should verify that a hoist hitch exists for the provided lead on the specified line server", async () => {
        let toda = new TodaClient(new VirtualInventoryClient());
        let x = await toda.getExplicitPath( new URL('./files/test.toda', import.meta.url));

        let scope = nock(url).get("/");
        scope.reply(200, fs.readFileSync( new URL('./files/line.toda', import.meta.url)));

        let relay = new RemoteRelayClient(url);
        return relay.getHoist(x.lastFast()).then(r => {
            assert(r.getHash().equals(
                Hash.fromHex("41d3b8000e5959b81bcf55a4c4782deab8583f9b4c0624cdf9fec731cd2b06f40e")));
        });
    });
});

/*
describe("isValidAndControlled", async () => {
    let store = new URL('./files', import.meta.url)
    let linePath = path.resolve(store, "cap-line.toda");
    let keyPair, acTwist, poptop;

    beforeEach(() => setConfig({ line: linePath, store: store }));

    it("Should verify the integrity of the hoist line and that control belongs to the specified line", async () => {
        keyPair = await crypto.subtle.generateKey({name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
        let req = {
            type: SignatureRequirement.REQ_SECP256r1,
            key: keyPair.publicKey
        };
        let tb = await create(null, req, null, keyPair.privateKey, null);
        fs.outputFileSync(linePath, tb.serialize().toBytes());

        // create a capability with this poptop, append to it, hoist it locally (should be automatic), verify that integrity and matchy matchy
        let cap = await capability("http://test-url.com", ["GET"], new Date(), ByteArray.fromUtf8("foo"), linePath, linePath);
        let ac = await authorize(cap, "http://localhost", "POST", null, null, linePath, keyPair.privateKey);
        let lt = new Twist(Atoms.fromBytes(await getFileOrInput(linePath)));

        poptop = lt.getHash();

        let refreshedAtoms = await getTetheredAtoms(ac, poptop);
        acTwist = new Twist(refreshedAtoms, ac.getHash());

        // Verify that the Authed Cap is controlled by the local line
        assert(await isValidAndControlled(acTwist, poptop, keyPair.privateKey));
    });

    it("Should verify that a different key does not have control", async () => {
        // Verify that a different key does not have control
        let keyPair2 = await generateKey();
        await assert.rejects(
            isValidAndControlled(acTwist, poptop, keyPair2.privateKey),
            new ProcessException(7, "Unable to establish local control of this file (verifying controller)"));
    });

    it("Should fail to verify a hitch line with a different poptop", async () => {
        // throw missing info error
        let tb2 = await create(null, null, null, keyPair.privateKey, null);
        let lt2 = new Twist(tb2.serialize());
        let poptop2 = lt2.getHash();

        //assert throws error
        await assert.rejects(
            isValidAndControlled(acTwist, poptop2, keyPair.privateKey),
            new ProcessException(6, "Unable to establish local control of this file (verifying hitch line)"));
    });
});
*/

describe("RemoteNextRelayClient", async () => {
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
        nock.cleanAll();
        nockLocalFileServer("test/client/remoteNextRelay_files", 8080);
        let relay = new RemoteNextRelayClient("http://wikipedia.com", "http://localhost:8080", null);
        let randomH = Hash.fromHex("41ecb829ed640be46e7a44fe6fb1a6b7038548a59f8069e24df55f3ae719d7beb4");
        assert.ok(!(await relay._getNext(randomH)));
        nock.cleanAll();
    });

    it("next() from twist when .getNext file exists", async () => {
        nock.cleanAll();
        nockLocalFileServer("test/client/remoteNextRelay_files", 8080);
        let relay = new RemoteNextRelayClient("http://wikipedia.com", "http://localhost:8080", null);
        let twist = await relay._getNext(twistHashes[2]);
        assert.ok(twist);
        assert.ok(twist.getHash().equals(twistHashes[3]));
        assert.ok(twist.prev().getHash().equals(twistHashes[2]));
        // Sanity check: .next.toda test files do not contain shields
        assert.ok(!twist.prev().shield());
        nock.cleanAll();
    });

    it("getShield() for twist when .shield file doesn't exist", async () => {
        nock.cleanAll();
        nockLocalFileServer("test/client/remoteNextRelay_files", 8080);
        let relay = new RemoteNextRelayClient("http://wikipedia.com", "http://localhost:8080", null);
        let randomH = Hash.fromHex("41ecb829ed640be46e7a44fe6fb1a6b7038548a59f8069e24df55f3ae719d7beb4");
        assert.ok(!(await relay._getShield(randomH)));
        nock.cleanAll();
    });

    it("getShield() for twist when .shield file does exist", async () => {
        nock.cleanAll();
        nockLocalFileServer("test/client/remoteNextRelay_files", 8080);
        let relay = new RemoteNextRelayClient("http://wikipedia.com", "http://localhost:8080", null);
        let shield = await relay._getShield(twistHashes[2]);
        assert.ok(shield);
        let p = path.join("test/client/remoteNextRelay_files/", `${twistHexes[2]}.toda`);
        let twist2 = Twist.fromBytes(new ByteArray(fs.readFileSync(p)));
        let loadedContent = shield.getShapedValueFromContent();
        let expectedContent = twist2.shield().getShapedValueFromContent();
        assert.ok(loadedContent.equals(expectedContent));
        nock.cleanAll();
    });

    it("get() walks backwards + forwards for loose twist", async () => {
        nock.cleanAll();
        nockLocalFileServer("test/client/remoteNextRelay_files", 8080);
        let relay = new RemoteNextRelayClient("http://wikipedia.com", "http://localhost:8080", twistHashes[4]);
        let twist = await relay.get();
        assert.ok(twist.getHash().equals(twistHashes[8]));
        assert.ok(twist.get(twistHashes[2])); // Went backwards until the fast twist (twists[2])
        assert.ok(!twist.get(twistHashes[1])); // Does not include prior to that (twists[1])

        // Check that all shields have been populated
        twist = new Twist(twist.getAtoms(), twistHashes[7]);
        assert.ok(twist.shield());
        twist = new Twist(twist.getAtoms(), twistHashes[5]);
        assert.ok(twist.shield());
        twist = new Twist(twist.getAtoms(), twistHashes[2]);
        assert.ok(twist.shield());

        nock.cleanAll();
    });

    it("get() with a `backwardsStopPredicate` behaves as expected", async () => {
        nock.cleanAll();
        nockLocalFileServer("test/client/remoteNextRelay_files", 8080);
        let relay = new RemoteNextRelayClient("http://wikipedia.com", "http://localhost:8080", twistHashes[4], (t) => twistHashes[3].equals(t.getHash()));
        let twist = await relay.get();
        assert.ok(twist.getHash().equals(twistHashes[8]));
        assert.ok(twist.get(twistHashes[3])); // Went backwards and stopped at the requested predicate
        assert.ok(!twist.get(twistHashes[1])); // Does not include prior to that (twists[1])

        // Check that all shields have been populated
        twist = new Twist(twist.getAtoms(), twistHashes[7]);
        assert.ok(twist.shield());
        twist = new Twist(twist.getAtoms(), twistHashes[5]);
        assert.ok(twist.shield());

        nock.cleanAll();
    });

    it("get() no backwards when twist is already fast", async () => {
        nock.cleanAll();
        nockLocalFileServer("test/client/remoteNextRelay_files", 8080);
        let relay = new RemoteNextRelayClient("http://wikipedia.com", "http://localhost:8080", twistHashes[5]);
        let twist = await relay.get();
        assert.ok(twist.getHash().equals(twistHashes[8]));
        assert.ok(twist.get(twistHashes[5])); // Went backwards until the fast twist (twists[5])
        assert.ok(!twist.get(twistHashes[4])); // Does not include prior to that (twists[4])

        // Check that all shields have been populated
        twist = new Twist(twist.getAtoms(), twistHashes[7]);
        assert.ok(twist.shield());
        twist = new Twist(twist.getAtoms(), twistHashes[5]);
        assert.ok(twist.shield());

        nock.cleanAll();
    });

    it("get() returns nil if nothing available", async () => {
        nock.cleanAll();
        nockLocalFileServer("test/client/remoteNextRelay_files", 8080);
        let randomH = Hash.fromHex("41ecb829ed640be46e7a44fe6fb1a6b7038548a59f8069e24df55f3ae719d7beb4");
        let relay = new RemoteNextRelayClient("http://wikipedia.com", "http://localhost:8080", randomH);
        assert.ok(!(await relay.get()));
        nock.cleanAll();
    });

    it("should make a hoist request with the correct data", async () => {
        nock.cleanAll();
        nock("https://localhost:8080")
            .post("/")
            .reply(200, (_, requestBody) => requestBody);

        let toda = new TodaClient(new VirtualInventoryClient());
        toda._getSalt = () => ByteArray.fromHex("012345");
        let tether = Hash.fromHex("41e6e7a44fe6fb1a6b7038548a59f8069e24df55f3ae719d7beb4cb829ed640be4");
        let a = await toda.create(tether)
        let b = await toda.append(a);
        

        let relay = new RemoteNextRelayClient("https://localhost:8080", "http://wikipedia.com", null);
        let response = await relay.hoist(a, b.getHash());
        assert.ok(200, response.status);

        let expectedPairtrie = a.hoistPacket(b.getHash());
        let expectedKvs = {};
        expectedPairtrie.getShapedValueFromContent().forEach((v, k) => {
            expectedKvs[k.toString()] = v.toString();
        });
        assert.deepEqual(expectedKvs, response.data['hoist-request']);
        assert.ok(response.data['relay-twist'] == tether.toString());
        nock.cleanAll();
    });
});

describe("LocalNextRelayClient", async () => {
    it("Simple next", async () => {
        const inv = new LocalInventoryClient("./files/" + uuid())
        const toda = new TodaClientV2(inv, "http://localhost:8009");
        toda._getSalt = () => ByteArray.fromUtf8("some salty");

        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0);
        const t2 = await toda.append(t1);

        const relay = new LocalNextRelayClient(toda, t2.getHash());
        let twist = relay._getNext(t0.getHash());
        assert.ok(twist);
        assert.ok(twist.getHash().equals(t1.getHash()));
        assert.ok(twist.prev());
        assert.ok(!twist.get(t2.getHash()));

        twist = relay._getNext(t1.getHash());
        assert.ok(twist);
        assert.ok(twist.getHash().equals(t2.getHash()));
        assert.ok(twist.prev());
        assert.ok(!twist.get(t0.getHash()));
        assert.throws(() => twist.prev().prev());

        twist = relay._getNext(t2.getHash()); // TOO RECENT! Doesn't have a 'next'
        assert.ok(!twist);
    });

    it("Simple .shield, last fast", async() => {
        const inv = new LocalInventoryClient("./files/" + uuid())
        const toda = new TodaClientV2(inv, "http://localhost:8009");
        toda._getSalt = () => ByteArray.fromUtf8("some salty");
        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0, randH(), null, null, () => {}, null, { noHoist: true });
        const t2 = await toda.append(t1);
        const t3 = await toda.append(t2, randH(), null, null, () => {}, null, { noHoist: true });

        const relay = new LocalNextRelayClient(toda, t3.getHash());
        assert.ok(!relay._getShield(t0.getHash())); // dne: loose
        assert.ok(relay._getShield(t1.getHash())); // Public!
        assert.ok((relay._getShield(t1.getHash())).content.equals(t1.shield().content));
        assert.ok(!relay._getShield(t2.getHash())); // dne: loose
        assert.ok(!relay._getShield(t3.getHash())); // dne: not public since it's the most recent fast
    });

    it("Simple .shield, last loose", async() => {
        const inv = new LocalInventoryClient("./files/" + uuid())
        const toda = new TodaClientV2(inv, "http://localhost:8009");
        toda._getSalt = () => ByteArray.fromUtf8("some salty");
        const t0 = await toda.create(null, null, uuidCargo());
        const t1 = await toda.append(t0, randH(), null, null, () => {}, null, { noHoist: true });
        const t2 = await toda.append(t1);
        const t3 = await toda.append(t2, randH(), null, null, () => {}, null, { noHoist: true });
        const t4 = await toda.append(t3);

        const relay = new LocalNextRelayClient(toda, t3.getHash());
        assert.ok(!relay._getShield(t0.getHash())); // dne: loose
        assert.ok(relay._getShield(t1.getHash())); // Public!
        assert.ok((relay._getShield(t1.getHash())).content.equals(t1.shield().content));
        assert.ok(!relay._getShield(t2.getHash())); // dne: loose
        assert.ok(!relay._getShield(t3.getHash())); // dne: not public since it's the most recent fast
        assert.ok(!relay._getShield(t4.getHash())); // dne: loose
    });
});