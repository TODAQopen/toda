/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { ByteArray } = require("../../src/core/byte-array");
const { Sha256 } = require("../../src/core/hash");
const { Twist } = require("../../src/core/twist");
const { getTodaPath, getConfigPath, getConfig, getClient  } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const assert = require("assert");

describe("toda-control", async() => {

    it("Should validate a file is controlled", async () => {
        let c = await getClient();
            c.inv.deleteAll();

            let q = execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()}`);
            let twist = Twist.fromBytes(q);

            let r = execSync(`${getTodaPath()}/toda control ${twist.getHash().toString()} --config ${getConfigPath()}`);

            assert(r.toString().indexOf(
                "The Local Line integrity has been verified. This system has control of this file as of") > -1);

    });
/** FIXME(acg): move to different test etc 
    it("Should validate a capability is controlled", async() => {
        let out = path.resolve(getConfig().store, "toda-control.toda");

        try {
            const url = "http://localhost:0001";
            const verbs = "GET,PUT";
            const expiry = 1660591597;
            execSync(`${getTodaPath()}/toda capability --url ${url} --verbs ${verbs} --expiry ${expiry} --config ${getConfigPath()} --out ${out}`);

            let r = execSync(`${getTodaPath()}/toda control ${out} --config ${getConfigPath()}`);
            assert(r.toString().indexOf("The Local Line integrity has been verified. This system has control of this file as of") > -1);
        } catch (err) {
            assert.fail(err);
        }
    });
 */

    it("Should validate a file is not controlled", async () => {
        try {
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
            let r = execSync(`${getTodaPath()}/toda create --empty --tether ${h.serialize()} --config ${getConfigPath()}`);
            let twist = Twist.fromBytes(r);
            let s = execSync(`${getTodaPath()}/toda control ${twist.getHash().toString()} --config ${getConfigPath()}` );
            assert.fail("This test should have failed!");
        } catch (err) {
            assert(err.stderr.toString("utf8").indexOf("Unable to establish local control of this file (verifying controller)\n") >= 0);
        }
    });
});
