/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { Atoms } = require("../../../src/core/atoms");
const { Twist, TwistBuilder } = require("../../../src/core/twist");
const { ByteArray } = require("../../../src/core/byte-array");
const { hoist, submitHoist, getLine, getHoist, getLead, setRiggingTrie,
    isValidAndControlled, getTetheredAtoms } = require("../../../src/cli/bin/helpers/rigging");
const { ProcessException } = require("../../../src/cli/bin/helpers/process-exception");
const { Hash, Sha256 } = require("../../../src/core/hash");
const { Shield } = require("../../../src/core/shield");
const { create } = require("../../../src/cli/bin/helpers/twist");
const { generateKey } = require("../../../src/cli/lib/pki");
const { capability, authorize } = require("../../../src/cli/bin/helpers/capability");
const { getFileOrInput } = require("../../../src/cli/bin/util");
const { SignatureRequirement } = require("../../../src/core/reqsat");
const nock = require("nock");
const assert = require("assert");
const fs = require("fs-extra");
const path = require("path");
const yaml = require("yaml");

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
    it("should verify that a hoist hitch exists for the provided lead on the specified line server", () => {
        let bytes = new ByteArray(fs.readFileSync(path.resolve(__dirname, "./files/test.toda")));

        let twist = new Twist(Atoms.fromBytes(bytes));
        let lead = getLead(twist);

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
    it("should retrieve the lead for a given meet", () => {
        let bytes = new ByteArray(fs.readFileSync(path.resolve(__dirname, "./files/test.toda")));

        let twist = new Twist(Atoms.fromBytes(bytes));

        let expected = Hash.parse(new ByteArray(Buffer.from("4137fdea890ef4733175e7a8fa29da709267ac33090b3323b12aad986f52d20817", "hex")));
        assert.deepEqual(getLead(twist).getHash(), expected);
    });

    it("should throw an error if the specified twist is not tethered", () => {
        let twist = new Twist(new TwistBuilder().serialize());

        assert.throws(() => getLead(twist), ProcessException);
    });

    it("should throw an error if the specified twist does not have a last fast twist", () => {
        let bytes = new ByteArray(fs.readFileSync(path.resolve(__dirname, "./files/line.toda")));
        let line = new Twist(Atoms.fromBytes(bytes));

        let twist = new Twist(new TwistBuilder().serialize());

        let tb = twist.createSuccessor();
        tb.setTether(line);
        let successor = new Twist(tb.serialize());

        assert.throws(() => getLead(successor), ProcessException);
    });
});


describe("setRiggingTrie", () => {
    it("should set the requirements trie on the twistbuilder", async () => {
        let lineBytes = fs.readFileSync(path.resolve(__dirname, "./files/line.toda"));
        let scope = nock(host).get("/line");
        scope.reply(200, lineBytes);

        let bytes = new ByteArray(fs.readFileSync(path.resolve(__dirname, "./files/test.toda")));
        let prev = new Twist(Atoms.fromBytes(bytes));

        let tb = prev.createSuccessor();
        await setRiggingTrie(tb, host);
        let twist = new Twist(tb.serialize());

        scope = nock(host).get("/line");
        scope.reply(200, lineBytes);

        let expected = await getHoist(prev, host);
        assert.deepEqual(twist.rig(prev), expected);
    });

    it("should do nothing if the twist is not tethered or has no lead or meet", async () => {
        let lineBytes = fs.readFileSync(path.resolve(__dirname, "./files/line.toda"));
        let scope = nock(host).get("/line");
        scope.reply(200, lineBytes);

        let line = new Twist(Atoms.fromBytes(new ByteArray(lineBytes)));

        let meetBytes = new ByteArray(fs.readFileSync(path.resolve(__dirname, "./files/test.toda")));
        let meet = new Twist(Atoms.fromBytes(meetBytes));

        // tether, no prev
        let tbTether = new TwistBuilder();
        tbTether.setTether(line);
        await setRiggingTrie(tbTether, host);
        let twistTether = new Twist(tbTether.serialize());

        assert.equal(twistTether.rig(), null);

        // prev, no tether
        scope = nock(host).get("/line");
        scope.reply(200, lineBytes);

        let tbSuccessor = meet.createSuccessor();
        await setRiggingTrie(tbSuccessor, host);
        let twistSuccessor = new Twist(tbSuccessor.serialize());

        assert.equal(twistSuccessor.rig(), null);
    });

    it("should throw an exception if the lead has no hoist hitch", async () => {
        let lineBytes = fs.readFileSync(path.resolve(__dirname, "./files/line.toda"));
        let scope = nock(host).get("/line");
        scope.reply(200, lineBytes);

        let line = new Twist(Atoms.fromBytes(new ByteArray(lineBytes)));

        let leadTb = new TwistBuilder();
        leadTb.setTether(line);
        let lead = new Twist(leadTb.serialize());

        let meetTb = lead.createSuccessor();
        meetTb.setTether(line);
        let meet = new Twist(meetTb.serialize());

        let tb = meet.createSuccessor();
        tb.setTether(line);
        await assert.rejects(
            async () => setRiggingTrie(tb, host),
            (err) => {
                assert.equal(err.exitCode, 5);
                assert.equal(err.reason, "No hitch hoist found for lead 419c042628d59acf225ea4e25914ad801f7d3bf427fb5e6b59445f3813a4022de4");
                return true;
            });
    });
});

describe("isValidAndControlled", async () => {
    let linePath = path.resolve(__dirname, "./files/cap-line.toda");
    let keyPair, acTwist, poptop;

    beforeEach(() => process.env.config = yaml.stringify({ line: linePath }));

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
            async () => isValidAndControlled(acTwist, poptop, keyPair2.privateKey),
            (err) => {
                assert.equal(err.exitCode, 7);
                assert.equal(err.reason, "Unable to establish local control of this file (verifying controller)");
                return true;
            });
    });

    it("Should fail to verify a hitch line with a different poptop", async () => {
        // throw missing info error
        let tb2 = await create(null, null, null, keyPair.privateKey, null);
        let lt2 = new Twist(tb2.serialize());
        let poptop2 = lt2.getHash();

        //assert throws error
        await assert.rejects(isValidAndControlled(acTwist, poptop2, keyPair.privateKey),
            (err) => {
                assert.equal(err.exitCode, 6);
                assert.equal(err.reason, "Unable to establish local control of this file (verifying hitch line)");
                return true;
            });
    });
});
