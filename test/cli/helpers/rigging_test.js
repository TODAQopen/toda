/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { Atoms } = require("../../../src/core/atoms");
const { Twist, TwistBuilder } = require("../../../src/core/twist");
const { ByteArray } = require("../../../src/core/byte-array");
const { hoist, submitHoist, getLine, getHoist, getLead, isValidAndControlled, getTetheredAtoms } = require("../../../src/cli/bin/helpers/rigging");
const { ProcessException } = require("../../../src/cli/bin/helpers/process-exception");
const { Hash, Sha256 } = require("../../../src/core/hash");
const { Shield } = require("../../../src/core/shield");
const { create } = require("../../../src/cli/bin/helpers/twist");
const { generateKey } = require("../../../src/cli/lib/pki");
const { capability, authorize } = require("../../../src/cli/bin/helpers/capability");
const { getFileOrInput, setConfig } = require("../../../src/cli/bin/util");
const { SignatureRequirement } = require("../../../src/core/reqsat");
const nock = require("nock");
const assert = require("assert");
const fs = require("fs-extra");
const path = require("path");

const host = "https://localhost:8080";

describe("hoist", async () => {
    it("should make a post request to the specified line server with the provided data", () => {
        let scope = nock(host).post("/hoist");
        scope.reply(200);

        return hoist(new Atoms(), host).then(r => {
            assert.equal(r.status, 200);
        });
    });
});

describe("submitHoist", () => {
    it("should make a hoist request with the correct data", () => {
        let scope = nock(host).post("/hoist");
        scope.reply(200, (uri, requestBody) => requestBody);

        let lead = new Twist(new TwistBuilder().serialize());
        let meetHash = lead.createSuccessor().serialize().lastAtomHash();

        let rigging = Shield.rigForHoist(lead.getHash(), meetHash, lead.shield());
        let atoms = new Atoms([[Sha256.fromPacket(rigging), rigging]]);

        return submitHoist(lead, meetHash, host).then(r => {
            assert.equal(r.status, 200);
            assert.equal(r.data, atoms.toBytes());
        });
    });
});

describe("getLine", () => {
    it("should make a get request to the specified line server", () => {
        let scope = nock(host).get("/line");
        scope.reply(200, Buffer.from("foo"));

        return getLine(host).then(r => {
            assert.deepEqual(r, new ByteArray(Buffer.from("foo")));
        });
    });
});

describe("getHoist", () => {
    it("should verify that a hoist hitch exists for the provided lead on the specified line server", async () => {
        let bytes = new ByteArray(fs.readFileSync(path.resolve(__dirname, "./files/test.toda")));

        let twist = new Twist(Atoms.fromBytes(bytes));
        let lead = await getLead(twist);

        let lineBytes = fs.readFileSync(path.resolve(__dirname, "./files/line.toda"));

        let scope = nock(host).get("/line");
        scope.reply(200, lineBytes);

        let expected = Hash.parse(new ByteArray(Buffer.from("41d3b8000e5959b81bcf55a4c4782deab8583f9b4c0624cdf9fec731cd2b06f40e", "hex")));
        return getHoist(lead, host).then(r => {
            assert.deepEqual(r.getHash(), expected);
        });
    });
});

describe("getLead", () => {
    it("should retrieve the lead for a given meet", async () => {
        let bytes = new ByteArray(fs.readFileSync(path.resolve(__dirname, "./files/test.toda")));

        let twist = new Twist(Atoms.fromBytes(bytes));
        let lead = await getLead(twist);

        let expected = Hash.parse(new ByteArray(Buffer.from("4137fdea890ef4733175e7a8fa29da709267ac33090b3323b12aad986f52d20817", "hex")));
        assert.deepEqual(lead.getHash(), expected);
    });

    it("should reject if the specified twist is not tethered", async () => {
        let twist = new Twist(new TwistBuilder().serialize());
        await assert.rejects(getLead(twist), new ProcessException(3, "The specified twist does not have a tether."));
    });

    it("should reject if the specified twist does not have a last fast twist", async () => {
        let bytes = new ByteArray(fs.readFileSync(path.resolve(__dirname, "./files/line.toda")));
        let line = new Twist(Atoms.fromBytes(bytes));

        let twist = new Twist(new TwistBuilder().serialize());

        let tb = twist.createSuccessor();
        tb.setTether(line);
        let successor = new Twist(tb.serialize());
        await assert.rejects(getLead(successor), new ProcessException(4, "The specified twist does not have a last fast twist."));
    });
});

describe("isValidAndControlled", async () => {
    let store = path.resolve(__dirname, "./files");
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
