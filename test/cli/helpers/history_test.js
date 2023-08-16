import { getHistory } from "../../../src/cli/bin/helpers/history.js";
import { Atoms } from "../../../src/core/atoms.js";
import { Twist } from "../../../src/core/twist.js";
import { NullHash, Hash } from "../../../src/core/hash.js";
import { ByteArray } from "../../../src/core/byte-array.js";
import fs from "fs-extra";
import path from "path";
import assert from "assert";

describe("getHistory", () => {
    it("should return an array of objects representing the twist and all of its prevs", () => {
        let bytes = new ByteArray(fs.readFileSync(new URL('./files/test.toda', import.meta.url)));
        let twist = new Twist(Atoms.fromBytes(bytes));

        let expected = [{
            twist: Hash.fromHex("4137fdea890ef4733175e7a8fa29da709267ac33090b3323b12aad986f52d20817"),
            sats: new NullHash(),
            prev: new NullHash(),
            tether: Hash.fromHex("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280"),
            shield: new NullHash(),
            reqs: new NullHash(),
            rigging: new NullHash(),
            cargo: new NullHash().toString()
        },
        {
            twist: Hash.fromHex("4151a40bde66fc10e07b1cef4668811f68c570658ead8bb192098cacb55171bd29"),
            sats: new NullHash(),
            prev: Hash.fromHex("4137fdea890ef4733175e7a8fa29da709267ac33090b3323b12aad986f52d20817"),
            tether: Hash.fromHex("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280"),
            shield: new NullHash(),
            reqs: new NullHash(),
            rigging: new NullHash(),
            cargo: new NullHash().toString()
        }];

        assert.equal(JSON.stringify(getHistory(twist)), JSON.stringify(expected));
    });
});
