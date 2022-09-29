/*************************************************************
 * TODAQ Open: TODA File Implementation
 * Toronto 2022
 *
 * Apache License 2.0
 *************************************************************/

const { ByteArray } = require("../../src/core/byte-array");
const { Twist } = require("../../src/core/twist");
const { getAtomsFromPath } = require("../../src/cli/bin/util");
const { initTestEnv, cleanupTestEnv, getTodaPath, getConfigPath, getConfig } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const assert = require("assert");

describe("toda-inspect", async() => {
    beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should display details about the specified hash inside a twist", async() => {
        let out = path.resolve(getConfig().store, "toda-inspect.toda");

        try {
            let tether = "41c8bf82c02c255ff566248bf79531572a58027e4d41eea18d735a1192711de583";
            execSync(`${getTodaPath()}/toda create --empty --config ${getConfigPath()} --out ${out} --tether ${tether}`);
            let twist = new Twist(await getAtomsFromPath(out));

            let r = execSync(`${getTodaPath()}/toda inspect ${twist.packet.getBodyHash()} ${out} --config ${getConfigPath()}`);
            let expected = "type      \tBasic Body Packet\n" +
        "size      \t70\n" +
        "content   \t\n" +
        "\tprev      \t00\n" +
        `\ttether    \t${tether}\n` +
        `\tshield    \t${twist.getBody().getShieldHash()}\n` +
        "\treqs      \t00\n" +
        "\trigging   \t00\n" +
        "\tcargo     \t00\n" +
        "\n";

            assert.equal(new ByteArray(r).toUTF8String(), expected);
        } catch (err) {
            assert.fail(err);
        }
    });
});
