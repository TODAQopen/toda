/*************************************************************
* TODAQ Open: TODA File Implementation
* Toronto 2022
*
* Apache License 2.0
*************************************************************/

const { getHistory } = require("../../../src/cli/bin/helpers/history");
const { Atoms } = require("../../../src/core/atoms");
const { Twist } = require("../../../src/core/twist");
const { NullHash, Hash } = require("../../../src/core/hash");
const { ByteArray } = require("../../../src/core/byte-array");
const fs = require("fs-extra");
const path = require("path");
const assert = require("assert");

describe("getHistory", () => {
    it("should return an array of objects representing the twist and all of its prevs", () => {
        let bytes = new ByteArray(fs.readFileSync(path.resolve(__dirname, "./files/test.toda")));
        let twist = new Twist(Atoms.fromBytes(bytes));

        let expected = [{
            twist: Hash.parse(new ByteArray(Buffer.from("4137fdea890ef4733175e7a8fa29da709267ac33090b3323b12aad986f52d20817", "hex"))),
            sats: new NullHash(),
            prev: new NullHash(),
            tether: Hash.parse(new ByteArray(Buffer.from("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280", "hex"))),
            shield: new NullHash(),
            reqs: new NullHash(),
            rigging: new NullHash(),
            cargo: new NullHash().toString()
        },
        {
            twist: Hash.parse(new ByteArray(Buffer.from("4151a40bde66fc10e07b1cef4668811f68c570658ead8bb192098cacb55171bd29", "hex"))),
            sats: new NullHash(),
            prev: Hash.parse(new ByteArray(Buffer.from("4137fdea890ef4733175e7a8fa29da709267ac33090b3323b12aad986f52d20817", "hex"))),
            tether: Hash.parse(new ByteArray(Buffer.from("41313b593c91b6b5c5ab23be3d561cea76d6dba74d8455f01807010580dddbf280", "hex"))),
            shield: new NullHash(),
            reqs: new NullHash(),
            rigging: new NullHash(),
            cargo: new NullHash().toString()
        }];

        assert.deepEqual(getHistory(twist), expected);
    });
});
