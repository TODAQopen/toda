import {
    stringifyValues,
    toPagedString,
    formatBytes,
    hydrateHash,
    formatReqSats,
    formatBodyPacket,
    formatTwistPacket,
} from "../../../src/cli/bin/helpers/formatters.js";

import { Sha256, NullHash, Hash } from "../../../src/core/hash.js";
import { Twist } from "../../../src/core/twist.js";
import { Atoms } from "../../../src/core/atoms.js";
import { ByteArray } from "../../../src/core/byte-array.js";
import assert from "assert";
import fs from "fs-extra";
import path from "path";

describe("stringifyValues", () => {
    it("should format Hash values of an object as strings", () => {
        let hash = Sha256.fromBytes("arbitrary string");
        let obj = {
            foo: 12345,
            bar: hash,
            baz: {bazfoo: "bazbar"},
        };

        let expected = {
            foo: 12345,
            bar: hash.toString(),
            baz: {bazfoo: "bazbar"},
        };

        let res = stringifyValues(obj);

        assert.deepEqual(res, expected);
    });
});

describe("toPagedString", () => {
    let hash = Sha256.fromBytes("arbitrary string");

    it("should return a tab-delimited array of the array items up to a limit", () => {
        let arr = [];
        for (let i = 0; i < 30; i++) {
            arr.push(hash);
        }

        let res = toPagedString(arr, false, 0, 3);
        let expected = `${hash}\n${hash}\n${hash}\n... (and 27 more)`;
        assert.equal(res, expected);
    });

    it("should show all rows if specified", () => {
        let arr = [hash, hash, hash];

        let res = toPagedString(arr, true, 0, 1);
        let expected = `${hash}\n${hash}\n${hash}`;
        assert.equal(res, expected);
    });
});

describe("formatBytes", () => {
    it("formats an int value to as a user friendly byte abbreviation", () => {
        assert.equal(formatBytes(11), "11B");
        assert.equal(formatBytes(1100), "1.07K");
        assert.equal(formatBytes(1100000), "1.05M");
        assert.equal(formatBytes(1100000000), "1.02G");
        assert.equal(formatBytes(1100000000000), "1T");
    });
});

describe("hydrateHash", () => {
    it("should build an object that includes the packets associated with each hash value", () => {
        let bytes = new ByteArray(fs.readFileSync(new URL('./files/test.toda', import.meta.url)));
        let twist = new Twist(Atoms.fromBytes(bytes));

        let expected = {
            prev: "4137fdea890ef4733175e7a8fa29da709267ac33090b3323b12aad986f52d20817",
            tether: "41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280",
            shield: "00",
            reqs: "00",
            rigging: "00",
            cargo: "00"
        };

        assert.deepEqual(hydrateHash(twist.getPacket().getBodyHash(), twist), expected);
    });
});

describe("formatReqSats", () => {
    it("should build an object that represents the expanded reqs/sats trie", () => {
        let bytes = new ByteArray(fs.readFileSync(new URL('./files/reqsats.toda', import.meta.url)));
        let twist = new Twist(Atoms.fromBytes(bytes));

        let sats = {
            requirements: [
                {
                    SECP256r1: "3046022100eb12b90b6695058b3d20a1539ccc2b4565d827531e67aa1fb26fbdc43478f646022100e6a21a8a48ad7d68d12954dd517d4c98e52f862f4af1e1a32339f3d6115207e6"
                },
                {
                    SECP256r1: "3046022100a6948dd664f2a43b09099a219ef6fa5427e9f782c28acdd6f2a3b69e80e5b984022100b4a6b229cec6d2f232a78b078a04a1b985af40426ba574fd9a6f6a14360ec991"
                },
                {
                    SECP256r1: "304502210089816d3e22790e0ac925090a049cce7082eaa31057b67ced1677274f7de192b402204eb3706ca6cdc0f36122fdcd9361925f5d51f101c87002f79a6ea293a52fcad3"
                }
            ],
            SECP256r1: "30440220324428650c18e3b0926358fde08e464196ac6cf16e288ab51b4099b1a468555902205d3db92ab82d7f8de3574031fac330c352978e779039074b43d8fbf60960d863"
        };

        assert.deepEqual(formatReqSats(twist.getPacket().getSatsHash(), twist), sats);


        let prev = twist.prev();
        let reqs = {
            requirements: [
                {
                    weight: 200,
                    requirement: {
                        SECP256r1: "3059301306072a8648ce3d020106082a8648ce3d0301070342000429c2fe881e2f126eb0e2e9e2f6daf775957e99c31f5a1ac81f1de687e5ace3bb413c56bd30437ea8b552edc48192241d6ea0922ee8a3867c13750ce4185e1ce1"
                    }
                },
                {
                    weight: 200,
                    requirement: {
                        SECP256r1: "3059301306072a8648ce3d020106082a8648ce3d03010703420004381dd109d3bdbd7eb8a2242ceafc7774cccd377eb26cd49764c2dd6783921939241b6363682a679e6629ef886d4bf36a8cbe25bcc3d36ae342bf243c6b5f9d73"
                    }
                },
                {
                    weight: 200,
                    requirement: {
                        SECP256r1: "3059301306072a8648ce3d020106082a8648ce3d0301070342000452283dc260935946450765943fd720010f40004aa0fe96b81ed0d28d6a92add4afec164b4e2648e4a15f57391bb3463900f0959a0d6ea2d4b4d47784c27eb851"
                    }
                }
            ],
            SECP256r1: "3059301306072a8648ce3d020106082a8648ce3d03010703420004d259092b977ef8718841ce1fcfa30fba2f2012f2f3b0d8b8ff5a2bacb4095f8be415696c6c9da371667b72538bb31e2fb39905ce3f2c1e69be8a64ec10fc91f8"
        };

        assert.deepEqual(formatReqSats(prev.getBody().getReqsHash(), prev), reqs);
    });
});

describe("formatBodyPacket", () => {
    it("should build an object that represents the expanded body packet", () => {
        let bytes = new ByteArray(fs.readFileSync( new URL('./files/test.toda', import.meta.url)));
        let twist = new Twist(Atoms.fromBytes(bytes));

        let expected = {
            prev: Hash.fromHex("4137fdea890ef4733175e7a8fa29da709267ac33090b3323b12aad986f52d20817"),
            tether: Hash.fromHex("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280"),
            shield: new NullHash(),
            reqs: new NullHash(),
            rigging: new NullHash(),
            cargo: new NullHash().toString()
        };

        // assert.deepEqual(formatBodyPacket(twist.getBody(), twist), expected);
        assert.equal(JSON.stringify(formatBodyPacket(twist.getBody(), twist)), JSON.stringify(expected));
    });
});

describe("formatTwistPacket", () => {
    it("should build an object that represents the expanded twist packet", () => {
        let bytes = new ByteArray(fs.readFileSync( new URL('./files/test.toda', import.meta.url)));
        let twist = new Twist(Atoms.fromBytes(bytes));

        let expected = {
            body: {
                prev: "4137fdea890ef4733175e7a8fa29da709267ac33090b3323b12aad986f52d20817",
                tether: "41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280",
                shield: "00",
                reqs: "00",
                rigging: "00",
                cargo: "00"
            },
            sats: new NullHash(),
        };

        assert.deepEqual(formatTwistPacket(twist.getPacket(), twist), expected);
    });
});
