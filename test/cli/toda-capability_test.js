const { Abject } = require("../../src/abject/abject");
const { getAtomsFromPath, setConfig } = require("../../src/cli/bin/util");
const { initPoptop } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");
const yaml = require("yaml");

describe("toda-capability", async() => {
    let configPath = path.resolve(__dirname, "./.toda/config.yml");
    let config = yaml.parse(fs.readFileSync(configPath, "utf8"));
    let toda = path.resolve(__dirname, "../../src/cli/bin");
    setConfig(configPath);

    it("Should create a Capability abject with the correct properties", async() => {
        await initPoptop(config.poptop);
        let out = path.resolve(config.store, "toda-capability.toda");

        try {
            const url = "http://localhost:0001";
            const verbs = "GET,PUT";
            const expiry = 1660591597;
            execSync(`${toda}/toda capability --url ${url} --verbs ${verbs} --expiry ${expiry} --config ${configPath} --out ${out}`);

            let abject = Abject.parse(await getAtomsFromPath(out));
            assert.equal(abject.url(), url);
            assert.deepEqual(abject.methods(), verbs.split(","));
            assert.equal(abject.expiry(), new Date(expiry).toISOString());
        } catch (err) {
            assert.fail(err);
        } finally {
            fs.emptyDirSync(config.store);
        }
    });
});
