import { Abject } from "../../src/abject/abject.js";
import { getAtomsFromPath } from "../../src/cli/bin/util.js";
import { getTodaPath, getConfigPath, getConfig, cleanupTestEnv } from "./test-utils.js";
import { execSync } from "child_process";
import path from "path";
import assert from "assert";

xdescribe("toda-capability", async() => {
    // beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should create a Capability abject with the correct properties", async() => {
        let config = getConfig();
        let out = path.resolve(config.store, "toda-capability.toda");

        try {
            const url = "http://localhost:0001";
            const verbs = "GET,PUT";
            const expiry = 1660591597;
            execSync(`${getTodaPath()}/toda capability --url ${url} --verbs ${verbs} --expiry ${expiry} --config ${getConfigPath()} --out ${out}`);

            let abject = Abject.parse(await getAtomsFromPath(out));
            assert.equal(abject.url(), url);
            assert.deepEqual(abject.methods(), verbs.split(","));
            assert.equal(abject.expiry(), new Date(expiry).toISOString());
        } catch (err) {
            assert.fail(err);
        }
    });
});
