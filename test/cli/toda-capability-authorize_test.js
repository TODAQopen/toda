import { Abject } from "../../src/abject/abject.js";
import { Capability } from "../../src/abject/capability.js";
import { getAtomsFromPath } from "../../src/cli/bin/util.js";
import { getTodaPath, getConfigPath, getConfig, cleanupTestEnv } from "./test-utils.js";
import { execSync } from "child_process";
import path from "path";
import assert from "assert";

xdescribe("toda-capability-authorize", async() => {
    // beforeEach(initTestEnv);
    afterEach(cleanupTestEnv);

    it("Should authorize a capability with the correct properties", async() => {
        let out = path.resolve(getConfig().store, "toda-capability-auth.toda");

        try {
            const url = "http://localhost:0001";
            const verbs = "GET,PUT";
            const expiry = 1660591597;
            execSync(`${getTodaPath()}/toda capability --url ${url} --verbs ${verbs} --expiry ${expiry} --config ${getConfigPath()} --out ${out}`);
            let master = Abject.parse(await getAtomsFromPath(out));

            const authUrl = "http://localhost:9000/path";
            const authVerb = "GET";
            const authNonce = "foo";

            execSync(`${getTodaPath()}/toda capability-authorize --capability ${out} --url ${authUrl} --verb ${authVerb} --nonce ${authNonce} --config ${getConfigPath()} --out ${out}`);

            let abject = Abject.parse(await getAtomsFromPath(out));
            let authorizes = abject.getAuthorizes();
            assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fUrl), authUrl);
            assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fHttpVerb), authVerb);
            assert.equal(authorizes.getFieldAbject(Capability.simpleRequestAC.fieldSyms.fNonce), authNonce);
            assert(abject.prevHash().equals(master.getHash()));
        } catch (err) {
            assert.fail(err);
        }
    });
});
