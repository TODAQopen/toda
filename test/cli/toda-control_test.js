import { ByteArray } from "../../src/core/byte-array.js";
import { Sha256 } from "../../src/core/hash.js";
import { Twist } from "../../src/core/twist.js";
import { getTodaPath, getConfigPath, getConfig, getClient } from "./test-utils.js";
import { execSync } from "child_process";
import path from "path";
import assert from "assert";


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
            let h = Sha256.fromBytes(ByteArray.fromUtf8("foo"));
            let r = execSync(`${getTodaPath()}/toda create --empty --tether ${h.serialize()} --config ${getConfigPath()}`);
            let twist = Twist.fromBytes(r);
            let s = execSync(`${getTodaPath()}/toda control ${twist.getHash().toString()} --config ${getConfigPath()}` );
            assert.fail("This test should have failed!");
        } catch (err) {
            assert(err.stderr.toString("utf8").indexOf("Unable to establish local control of this file (verifying controller)\n") >= 0);
        }
    });
});
