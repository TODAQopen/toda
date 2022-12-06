/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { TodaClient, CannotSatisfyError } = require("../../src/client/client");
const { SECP256r1 } = require("../../src/client/secp256r1");
const { KeyPair } = require("../../src/client/keypair");
const { VirtualInventoryClient } = require("../../src/client/inventory");
//const { ByteArray } = require("../../../src/core/byte-array");
const assert = require("assert");

describe("setRequirements", () => {
    it("should set the requirements trie on the twistbuilder", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new VirtualInventoryClient());

        let x = await toda.create(null, keyPair);
        assert(SECP256r1.requirementTypeHash.equals(Array.from(x.reqs().getShapedValue().keys())[0]));

    });
    // we can bring this back later.
    /*
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
    });*/
});

describe("satisfyRequirements", () => {
    it("should set the satisfactions trie on the twistbuilder", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new VirtualInventoryClient());
        toda.addSatisfier(keyPair);

        let prev = await toda.create(null, keyPair);
        let next = await toda.append(prev);
        assert(SECP256r1.requirementTypeHash.equals(Array.from(next.sats().getShapedValue().keys())[0]));
    });

    it("should throw an exception if a requirement cannot be met", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClient(new VirtualInventoryClient());

        let prev = await toda.create(null, keyPair);

        await assert.rejects(
            () => toda.append(prev),
            (err) => {
                assert(err instanceof CannotSatisfyError);
                return true;
            });
    });
});
