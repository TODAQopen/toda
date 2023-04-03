import { Hash } from "../../src/core/hash.js";
import { Atoms } from "../../src/core/atoms.js";
import { RemoteRelayClient } from "../../src/client/relay.js";
import { TodaClient, WaitForHitchError } from "../../src/client/client.js";
import { VirtualInventoryClient } from "../../src/client/inventory.js";
import nock from "nock";
import assert from "assert";
import fs from "fs-extra";
import path from "path";


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
        let cap = await capability("http://test-url.com", ["GET"], new Date(), ByteArray.fromStr("foo"), linePath, linePath);
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
