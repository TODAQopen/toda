const { ByteArray } = require("../../src/core/byte-array");
const { Twist } = require("../../src/core/twist");
const { getAtomsFromPath } = require("../../src/cli/bin/util");
const { initPoptop } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");
const yaml = require("yaml");

describe("toda-inspect", async() => {
    let configPath = path.resolve(__dirname, "./.toda/config.yml");
    let config = yaml.parse(fs.readFileSync(configPath, "utf8"));
    let toda = path.resolve(__dirname, "../../src/cli/bin");

    it("Should display details about the specified hash inside a twist", async() => {
        await initPoptop(config);
        let out = path.resolve(config.store, "toda-inspect.toda");

        try {
            let tether = "41c8bf82c02c255ff566248bf79531572a58027e4d41eea18d735a1192711de583";
            execSync(`${toda}/toda create --empty --config ${configPath} --out ${out} --tether ${tether}`);
            let twist = new Twist(await getAtomsFromPath(out));

            let r = execSync(`${toda}/toda inspect ${twist.packet.getBodyHash()} ${out} --config ${configPath}`);
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
        } finally {
            fs.emptyDirSync(config.store);
        }
    });
});
