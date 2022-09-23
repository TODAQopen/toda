const { ByteArray } = require("../../src/core/byte-array");
const { Sha256 } = require("../../src/core/hash");
const { Twist } = require("../../src/core/twist");
const { getAtomsFromPath, setConfig } = require("../../src/cli/bin/util");
const { initPoptop } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");
const yaml = require("yaml");

describe("toda-control", async() => {
    let configPath = path.resolve(__dirname, "./.toda/config.yml");
    let config = yaml.parse(fs.readFileSync(configPath, "utf8"));
    let toda = path.resolve(__dirname, "../../src/cli/bin");
    setConfig(configPath);

    it("Should validate a file is controlled", async() => {
        await initPoptop(config.poptop);
        let out = path.resolve(config.store, "toda-control.toda");

        try {
            execSync(`${toda}/toda create --empty --config ${configPath} --out ${out}`);
            let twist = new Twist(await getAtomsFromPath(out));

            let r = execSync(`${toda}/toda control ${out} --config ${configPath}`);
            assert(r.toString().indexOf(`${twist.tether().getHash()}\n` +
        "The Local Line integrity has been verified. This system has control of this file as of") > -1);
        } catch (err) {
            assert.fail(err);
        } finally {
            // fs.emptyDirSync(config.store);
        }
    });

    it("Should validate a file is not controlled", async() => {
        await initPoptop(config.poptop);
        let out = path.resolve(config.store, "toda-control.toda");

        try {
            let h = Sha256.fromBytes(ByteArray.fromStr("foo"));
            execSync(`${toda}/toda create --empty --tether ${h.serialize()} --config ${configPath} --out ${out}`);
            execSync(`${toda}/toda control ${out} --config ${configPath}` );
            assert.fail("This test should have failed!");
        } catch (err) {
            assert.equal(err.stderr.toString("utf8"), "Unable to establish local control of this file (verifying controller)\n");
        } finally {
            fs.emptyDirSync(config.store);
        }
    });
});
