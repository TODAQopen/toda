const { ByteArray } = require("../../src/core/byte-array");
const { Twist } = require("../../src/core/twist");
const { getAtomsFromPath, setConfig } = require("../../src/cli/bin/util");
const { initPoptop } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");
const yaml = require("yaml");

describe("toda-history", async() => {
    let configPath = path.resolve(__dirname, "./.toda/config.yml");
    let config = yaml.parse(fs.readFileSync(configPath, "utf8"));
    let toda = path.resolve(__dirname, "../../src/cli/bin");
    setConfig(configPath);

    it("Should display the history of a twist", async() => {
        await initPoptop(config.poptop);
        let out = path.resolve(config.store, "toda-history.toda");

        try {
            execSync(`${toda}/toda create --empty --shield foobar --config ${configPath} --out ${out}`);
            let twist = new Twist(await getAtomsFromPath(out));

            let r = execSync(`${toda}/toda history ${out} --config ${configPath}` );
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
        } finally {
            fs.emptyDirSync(config.store);
        }
    });
});
