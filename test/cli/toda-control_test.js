const { ByteArray } = require("../../src/core/byte-array");
const { Sha256 } = require("../../src/core/hash");
const { Twist } = require("../../src/core/twist");
const { getAtomsFromPath } = require("../../src/cli/bin/util");
const { initTestEnv, getTodaPath, getConfigPath, getConfig, cleanupTestEnv } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const assert = require("assert");

describe("toda-control", async() => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should validate a file is controlled", async() => {
        let out = path.resolve(getConfig().store, "toda-control.toda");

        try {
            execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()} --out ${out}`);
            let twist = new Twist(await getAtomsFromPath(out));

            let r = execSync(`${getTodaPath()}/toda control ${out} --config ${getConfigPath()}`);
            assert(r.toString().indexOf(`${twist.tether().getHash()}\n` +
        "The Local Line integrity has been verified. This system has control of this file as of") > -1);
        } catch (err) {
            assert.fail(err);
        }
    });

    it("Should validate a file is not controlled", async() => {
        let out = path.resolve(getConfig().store, "toda-control.toda");

        try {
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
            execSync(`${getTodaPath()}/toda create --empty --tether ${h.serialize()} --config ${getConfigPath()} --out ${out}`);
            execSync(`${getTodaPath()}/toda control ${out} --config ${getConfigPath()}` );
            assert.fail("This test should have failed!");
        } catch (err) {
            assert.equal(err.stderr.toString("utf8"), "Unable to establish local control of this file (verifying controller)\n");
        }
    });
});
