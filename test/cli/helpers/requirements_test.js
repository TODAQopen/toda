/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
* 
* Apache License 2.0
*************************************************************/

const { setRequirements } = require("../../../src/cli/bin/helpers/requirements");
const { signBytes } = require("../../../src/cli/lib/pki");
const { Twist, TwistBuilder } = require("../../../src/core/twist");
const { satisfyRequirements, SignatureRequirement } = require("../../../src/core/reqsat");
const { ByteArray } = require("../../../src/core/byte-array");
const assert = require("assert");

describe("setRequirements", () => {
    it("should set the requirements trie on the twistbuilder", async () => {
        let keyPair = await crypto.subtle.generateKey({name: "ECDSA", namedCurve: "P-256"},
            true,
            ["sign", "verify"]);

        let tb = new TwistBuilder();
        await setRequirements(tb, keyPair.privateKey, { type: SignatureRequirement.REQ_SECP256r1, key: keyPair.publicKey });

        let twist = new Twist(tb.serialize());
        assert.deepEqual(Array.from(twist.reqs().getShapedValue().keys())[0], SignatureRequirement.REQ_SECP256r1);
    });

    it("should throw an exception if the keys are not paired", async () => {
        let keyPair = await crypto.subtle.generateKey({name: "ECDSA", namedCurve: "P-256"},
            true,
            ["sign", "verify"]);

        let keyPair2 = await crypto.subtle.generateKey({name: "ECDSA", namedCurve: "P-256"},
            true,
            ["sign", "verify"]);

        let tb = new TwistBuilder();
        await assert.rejects(
            async () => setRequirements(tb, keyPair.privateKey, { type: SignatureRequirement.REQ_SECP256r1, key: keyPair2.publicKey }),
            (err) => {
                assert.equal(err.exitCode, 1);
                assert.equal(err.reason, "WARN: The specified identity does not satisfy the specified requirements.");
                return true;
            });
    });
});

describe("satisfyRequirements", () => {
    it("should set the satisfactions trie on the twistbuilder", async () => {
        let keyPair = await crypto.subtle.generateKey({name: "ECDSA", namedCurve: "P-256"},
            true,
            ["sign", "verify"]);

        let prevTb = new TwistBuilder();
        let pubKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
        let req = new SignatureRequirement(prevTb.getHashImp(), SignatureRequirement.REQ_SECP256r1, new ByteArray(Buffer.from(pubKeyBuffer)));
        prevTb.setRequirements(req);
        let prev = new Twist(prevTb.serialize());

        let tb = prev.createSuccessor();
        let signFn = (twist, pk) => {
            return signBytes(pk, twist.getPacket().getBodyHash().getHashValue());
        };
        await satisfyRequirements(tb, keyPair.privateKey, signFn);

        let twist = new Twist(tb.serialize());
        assert.deepEqual(Array.from(twist.sats().getShapedValue().keys())[0], SignatureRequirement.REQ_SECP256r1);
    });

    it("should throw an exception if a requirement cannot be met", async () => {
        let keyPair = await crypto.subtle.generateKey({name: "ECDSA", namedCurve: "P-256"},
            true,
            ["sign", "verify"]);

        let keyPair2 = await crypto.subtle.generateKey({name: "ECDSA", namedCurve: "P-256"},
            true,
            ["sign", "verify"]);

        let prevTb = new TwistBuilder();
        let pubKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
        let req = new SignatureRequirement(prevTb.getHashImp(), SignatureRequirement.REQ_SECP256r1, new ByteArray(Buffer.from(pubKeyBuffer)));
        prevTb.setRequirements(req);
        let prev = new Twist(prevTb.serialize());

        let tb = prev.createSuccessor();
        let signature = await signBytes(keyPair2.privateKey, prev.getPacket().getBodyHash().getHashValue());

        await assert.rejects(
            async () => satisfyRequirements(tb, keyPair2.privateKey, signature),
            (err) => {
                assert.equal(err, "The specified identity does not satisfy any of the PREV's requirements.");
                return true;
            });
    });
});
