const { Abject } = require("../../src/abject/abject");
const { Capability } = require("../../src/abject/capability");
const { getAtomsFromPath, setConfig } = require("../../src/cli/bin/util");
const { initPoptop } = require("./test-utils");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs-extra");
const assert = require("assert");
const yaml = require("yaml");

describe("toda-capability-authorize", async() => {
    let configPath = path.resolve(__dirname, "./.toda/config.yml");
    let config = yaml.parse(fs.readFileSync(configPath, "utf8"));
    let toda = path.resolve(__dirname, "../../src/cli/bin");
    setConfig(configPath);

    it("Should authorize a capability with the correct properties", async() => {
        await initPoptop(config.poptop);
        let out = path.resolve(config.store, "toda-capability-auth.toda");

        try {
            const url = "http://localhost:0001";
            const verbs = "GET,PUT";
            const expiry = 1660591597;
            execSync(`${toda}/toda capability --url ${url} --verbs ${verbs} --expiry ${expiry} --config ${configPath} --out ${out}`);
            let master = Abject.parse(await getAtomsFromPath(out));

            const authUrl = "http://localhost:9000/path";
            const authVerb = "GET";
            const authNonce = "foo";

            execSync(`${toda}/toda capability-authorize --capability ${out} --url ${authUrl} --verb ${authVerb} --nonce ${authNonce} --config ${configPath} --out ${out}`);

            let abject = Abject.parse(await getAtomsFromPath(out));
            let authorizes = abject.getAuthorizes();
            assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fUrl), authUrl);
            assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fHttpVerb), authVerb);
            assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fNonce), authNonce);
            assert(abject.prevHash().equals(master.getHash()));
        } catch (err) {
            assert.fail(err);
        } finally {
            fs.emptyDirSync(config.store);
        }
    });
});
