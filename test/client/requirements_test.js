import {
    Interpreter
} from "../../src/core/interpret.js";

import { Line } from "../../src/core/line.js";
import { SerialStore } from "../../src/core/store.js";
import { TodaClientV2, CannotSatisfyError } from "../../src/client/client.js";
import { SECP256r1 } from "../../src/client/secp256r1.js";
import { ByteArray } from "../../src/core/byte-array.js";
import { VirtualInventoryClient } from "../../src/client/inventory.js";
import { Twist } from "../../src/core/twist.js";
import assert from "assert";
import fs from "fs";

import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("setRequirements", () => {
    it("should set the requirements trie on the twistbuilder", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClientV2(new VirtualInventoryClient());

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
        let toda = new TodaClientV2(new VirtualInventoryClient());
        toda.addSatisfier(keyPair);

        let prev = await toda.create(null, keyPair);
        let next = await toda.append(prev);
        assert(SECP256r1.requirementTypeHash.equals(Array.from(next.sats().getShapedValue().keys())[0]));
    });

    it("should throw an exception if a requirement cannot be met", async () => {
        let keyPair = await SECP256r1.generate();
        let toda = new TodaClientV2(new VirtualInventoryClient());

        let prev = await toda.create(null, keyPair);

        await assert.rejects(
            () => toda.append(prev),
            (err) => {
                assert(err instanceof CannotSatisfyError);
                return true;
            });
    });
});

describe("Runs pickled secp256r1 tests (v1)", () => {
    let runPassTest = async (todaFile) => {
        const data = new ByteArray(fs.readFileSync(todaFile));
        let s = new SerialStore(data);
        let line = new Line();
        await s.copyInto(line);
        let i = new Interpreter(line, undefined);

        let twist1 = Twist.fromBytes(data);
        let twist0 = twist1.prev();

        return i.verifyLegit(twist0, twist1);
    };

    let runThrowTest = async (todaFile, expectedErrorType) => {
        const data = new ByteArray(fs.readFileSync(todaFile));
        let s = new SerialStore(data);
        let line = new Line();
        await s.copyInto(line);
        let i = new Interpreter(line, undefined);

        let twist1 = Twist.fromBytes(data);
        let twist0 = twist1.prev();

        let err;
        try {
            await i.verifyLegit(twist0, twist1);
        } catch (e) {
            err = e;
        }
        if (err) {
            assert(err instanceof expectedErrorType);
        } else {
            assert(false, "expected error.");
        }
    };

    it("green: satisfied sig", async() => {
        return runPassTest(`${__dirname}/../toda-tests/reqsat/secp256r1/green/satisfied_sig.toda`);
    });

    it("yellow: sat missing", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/secp256r1/yellow/sat_missing.toda`, Error);
    });

    it("yellow: req missing", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/secp256r1/yellow/req_missing.toda`, Error);
    });

    it("red: req missing and sat not arb", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/secp256r1/red/req_missing_and_sat_not_arb.toda`, Error);
    });

    it("red: req not arb", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/secp256r1/red/req_not_arb.toda`, Error);
    });

    it("red: sat not arb", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/secp256r1/red/sat_not_arb.toda`, Error);
    });

    it("red: signed over wrong hash", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/secp256r1/red/signed_over_wrong_hash.toda`, Error);
    });

    it("red: wrong private key used", async() => {
        return runThrowTest(`${__dirname}/../toda-tests/reqsat/secp256r1/red/wrong_priv_key_used.toda`, Error);
    });
});