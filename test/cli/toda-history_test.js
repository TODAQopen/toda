const { ByteArray } = require("../../src/core/byte-array");
const { Twist } = require("../../src/core/twist");
const { getAtomsFromPath } = require("../../src/cli/bin/util");
const { initTestEnv, getTodaPath, getConfigPath, getConfig, cleanupTestEnv } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const assert = require("assert");

describe("toda-history", async() => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should display the history of a twist", async() => {
        let out = path.resolve(getConfig().store, "toda-history.toda");

        try {
            execSync(`${getTodaPath()}/toda create --empty --shield foobar --config ${getConfigPath()} --out ${out}`);
            let twist = new Twist(await getAtomsFromPath(out));

            let r = execSync(`${getTodaPath()}/toda history ${out} --config ${getConfigPath()}` );
            let expected = `twist     \t${twist.getHash()}\n` +
        "sats      \t00\n" +
        "prev      \t00\n" +
        `tether    \t${twist.getBody().getTetherHash()}\n` +
        `shield    \t${twist.getBody().getShieldHash()}\n` +
        "reqs      \t00\n" +
        "rigging   \t00\n" +
        "cargo     \t00\n\n";

            assert.equal(new ByteArray(r).toUTF8String(), expected);
        } catch (err) {
            assert.fail(err);
        }
    });
});
